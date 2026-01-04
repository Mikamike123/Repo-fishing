// lib/oracle-service.ts - Version 7.8 (Offline First & Garbage Collection)
import { calculateUniversalBioScores, BioContext, BioScores } from './bioScoreEngine';
import { solveDissolvedOxygen, calculateWaveHeight, BASSIN_TURBIDITY_BASE } from './zeroHydroEngine'; 
import { LocationMorphology, DepthCategoryID, BassinType, OracleDataPoint } from '../types';

// Michael : Constantes de gestion du cache
const CACHE_KEY_PREFIX = 'oracle_cache_';
const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes pour la fraîcheur
const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000; // 24 heures pour le nettoyage

const BASIN_PARAMS: Record<BassinType, { offset: number }> = {
    'URBAIN':    { offset: 1.2 }, 
    'AGRICOLE':  { offset: 0.5 }, 
    'PRAIRIE':   { offset: 0.3 }, 
    'FORESTIER': { offset: 0.0 }  
};

const DEPTH_MAP: Record<DepthCategoryID, number> = {
    'Z_LESS_3': 2.0, 'Z_3_15': 6.0, 'Z_MORE_15': 15.0
};

const PHI = 172; 
const EMA_ALPHA = 0.35; 
const MONTHLY_WATER_TEMP_BASELINE: { [key: number]: number } = {
    0: 5.5,  1: 6.0,  2: 9.0,  3: 12.0, 4: 16.0, 5: 19.5,
    6: 21.0, 7: 21.5, 8: 19.0, 9: 14.5, 10: 10.5, 11: 7.5
};

const K_BASE = 0.98;
const FLOW_NORM_VAL = 150;
const K_TEMP_SENSITIVITY = 0.004;
const ALPHA_RAIN = 1.8;
const DAILY_DECAY = 0.77;

/**
 * [NOUVEAU] Michael : Garbage Collection
 * Supprime les entrées de cache vieilles de plus de 24h
 */
export const cleanupOracleCache = () => {
    const keys = Object.keys(localStorage);
    const now = Date.now();

    keys.forEach(key => {
        if (key.startsWith(CACHE_KEY_PREFIX)) {
            try {
                const item = localStorage.getItem(key);
                if (item) {
                    const { timestamp } = JSON.parse(item);
                    if (now - timestamp > MAX_CACHE_AGE_MS) {
                        localStorage.removeItem(key);
                        console.log(`🧹 [GC Oracle] Cache expiré supprimé : ${key}`);
                    }
                }
            } catch (e) {
                // Suppression préventive si le format est corrompu
                localStorage.removeItem(key);
            }
        }
    });
};

/**
 * [MODIFIÉ] Gère la récupération intelligente : Cache Local vs API (avec Fallback Hors-Ligne)
 */
export const getOrFetchOracleData = async (
    lat: number, 
    lng: number, 
    locationId: string,
    morphology?: LocationMorphology
): Promise<OracleDataPoint[]> => {
    const cacheKey = `${CACHE_KEY_PREFIX}${locationId}`;
    const cached = localStorage.getItem(cacheKey);

    let cachedValue: any = null;
    
    // 1. Analyse du cache existant
    if (cached) {
        try {
            cachedValue = JSON.parse(cached);
            const age = Date.now() - cachedValue.timestamp;
            
            // Si le cache est très récent (< 30 min), on l'utilise direct
            if (age < CACHE_DURATION_MS) {
                console.log(`🚀 [Cache Oracle] Secteur ${locationId} : Donnée fraîche (${Math.round(age/60000)}min).`);
                return cachedValue.data;
            }
        } catch (e) {
            console.error("Erreur parsing cache Oracle", e);
        }
    }

    // 2. Tentative de mise à jour via l'API
    try {
        const freshData = await fetchOracleChartData(lat, lng, morphology);
        
        if (freshData.length > 0) {
            localStorage.setItem(cacheKey, JSON.stringify({
                timestamp: Date.now(),
                data: freshData
            }));
        }
        return freshData;
    } catch (error) {
        // 3. MODE HORS-LIGNE (FALLBACK)
        // Si le réseau échoue mais qu'on a un cache (même ancien), on le rend au lieu d'afficher une erreur
        if (cachedValue && cachedValue.data) {
            console.warn(`📡 [Oracle Offline] Réseau indisponible pour ${locationId}. Utilisation de la dernière donnée connue.`);
            return cachedValue.data;
        }
        // Si vraiment rien en mémoire, on propage l'erreur
        throw error;
    }
};

/**
 * Moteur principal de calcul environnemental
 */
export const fetchOracleChartData = async (
    lat: number, 
    lng: number, 
    morphology?: LocationMorphology
): Promise<OracleDataPoint[]> => {
    if (!lat || !lng) return [];
    try {
        const m = morphology?.typeId || 'Z_RIVER';
        const b = morphology?.bassin || 'URBAIN';
        const bParams = BASIN_PARAMS[b] || BASIN_PARAMS['URBAIN'];
        const baseNTU = BASSIN_TURBIDITY_BASE[b] || 8.0; 
        const D = morphology?.meanDepth || DEPTH_MAP[morphology?.depthId || 'Z_3_15'];
        const surface = morphology?.surfaceArea || 100000; 
        const shape = morphology?.shapeFactor || 1.2;

        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,surface_pressure,cloud_cover,wind_speed_10m,wind_direction_10m,precipitation,weathercode&timezone=Europe%2FParis&past_days=45&forecast_days=4`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error('Météo Oracle indisponible');
        const data = await response.json();
        const hourly = data.hourly;
        
        const points: OracleDataPoint[] = [];
        const now = Date.now();
        const oneHour = 3600 * 1000;
        const startGraph = now - (12 * oneHour);
        const endGraph = now + (72 * oneHour);

        let api = 15; 
        let currentNTU = baseNTU; 
        const firstDate = new Date(hourly.time[0]);
        let currentWaterTemp = MONTHLY_WATER_TEMP_BASELINE[firstDate.getMonth()] || 12.0;
        let prevIntensity = 0;
        let emaScores = { sandre: 0, brochet: 0, perche: 0, blackbass: 0 };

        for (let i = 0; i < hourly.time.length; i++) {
            const timeStr = hourly.time[i];
            const date = new Date(timeStr);
            const ts = date.getTime();
            const dayOfYear = Math.floor((ts - new Date(date.getFullYear(), 0, 0).getTime()) / (oneHour * 24));
            
            const precip = hourly.precipitation[i] || 0;
            const Ta = hourly.temperature_2m[i]; 
            const Patm = hourly.surface_pressure[i];
            const windKmH = hourly.wind_speed_10m[i];
            const windDir = hourly.wind_direction_10m[i];
            const clouds = hourly.cloud_cover[i];
            const wCode = hourly.weathercode[i];

            const delta = m === 'Z_RIVER' ? 12 : 0.207 * Math.pow(D, 1.35);
            const mu = 0.15 + (1 / (D * 5));
            const solarTerm = mu * Math.sin((2 * Math.PI * (dayOfYear - PHI)) / 365);
            const equilibriumTemp = Ta + bParams.offset + (solarTerm * 10);
            currentWaterTemp += (equilibriumTemp - currentWaterTemp) / (delta * 24);

            const hourlyDecayFactor = Math.pow(1 - DAILY_DECAY, 1/24);
            currentNTU = baseNTU + (currentNTU - baseNTU) * hourlyDecayFactor;
            if (precip > 0.1) currentNTU += precip * ALPHA_RAIN;

            const currentK = Math.max(0.70, K_BASE - (Ta * K_TEMP_SENSITIVITY));
            const hourlyK = Math.pow(currentK, 1/24);
            api = (api * hourlyK) + precip; 
            
            const intensity = Math.min(100, (api / FLOW_NORM_VAL) * 100);
            const derivative = intensity - prevIntensity;
            const trend: 'Montée' | 'Décrue' | 'Stable' = derivative > 0.021 ? 'Montée' : (derivative < -0.021 ? 'Décrue' : 'Stable');
            prevIntensity = intensity;

            const hs = calculateWaveHeight(windKmH, surface, shape);

            if (ts < startGraph || ts > endGraph) continue;

            const dissolvedOxygen = solveDissolvedOxygen(currentWaterTemp, Patm, windKmH);
            const prevPress24h = i >= 24 ? hourly.surface_pressure[i - 24] : hourly.surface_pressure[0];
            const deltaP24h = Patm - prevPress24h;

            const ctx: BioContext = {
                waterTemp: currentWaterTemp,
                cloudCover: clouds,
                windSpeed: windKmH,
                pressureTrend: deltaP24h, 
                turbidityNTU: currentNTU,
                dissolvedOxygen: dissolvedOxygen,
                waveHeight: hs,
                flowIndex: intensity,
                flowDerivative: derivative * 24, 
                flowTrend: trend,
                date: date,
                morphoId: m
            };

            const rawScores = calculateUniversalBioScores(ctx);

            if (points.length === 0) {
                emaScores = { ...rawScores };
            } else {
                emaScores.sandre += EMA_ALPHA * (rawScores.sandre - emaScores.sandre);
                emaScores.brochet += EMA_ALPHA * (rawScores.brochet - emaScores.brochet);
                emaScores.perche += EMA_ALPHA * (rawScores.perche - emaScores.perche);
                emaScores.blackbass += EMA_ALPHA * (rawScores.blackbass - emaScores.blackbass);
            }

            points.push({
                timestamp: ts,
                hourLabel: date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
                isForecast: ts > now,
                waterTemp: Number(currentWaterTemp.toFixed(1)),
                tFond: Number(currentWaterTemp.toFixed(1)),
                turbidityNTU: Number(currentNTU.toFixed(1)),
                dissolvedOxygen: Number(dissolvedOxygen.toFixed(2)),
                waveHeight: Number(hs.toFixed(1)),
                
                airTemp: Number(Ta.toFixed(1)),
                pressure: Math.round(Patm),
                clouds: Math.round(clouds),
                windSpeed: Math.round(windKmH),
                windDirection: Math.round(windDir),
                precip: Number(precip.toFixed(1)),
                conditionCode: wCode,

                bestScore: Math.round(Math.max(emaScores.sandre, emaScores.brochet, emaScores.perche, emaScores.blackbass)),
                sandre: Math.round(emaScores.sandre),
                brochet: Math.round(emaScores.brochet),
                perche: Math.round(emaScores.perche),
                blackbass: Math.round(emaScores.blackbass),
                flowRaw: Math.round(intensity),
                flowStatus: trend
            });
        }
        return points;
    } catch (error) {
        console.error("Erreur Oracle Service - Sync 24h Failed:", error);
        throw error;
    }
};