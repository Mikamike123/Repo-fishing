// lib/oracle-service.ts - Version 8.8 (Physical Simulation Alignment)
// Michael : Intégration du moteur v8.8.1 avec correction de la continuité thermique.

import { calculateUniversalBioScores, BioContext } from './bioScoreEngine';
import { 
    solveDissolvedOxygen, 
    calculateWaveHeight, 
    BASSIN_TURBIDITY_BASE,
    solveAir2Water,
    solveTurbidity
} from './zeroHydroEngine'; 
import { 
    LocationMorphology, 
    DepthCategoryID, 
    BassinType, 
    OracleDataPoint, 
    FullEnvironmentalSnapshot, 
    SCHEMA_VERSION 
} from '../types';

// Michael : Constantes de gestion du cache
const CACHE_KEY_PREFIX = 'oracle_cache_v8_'; 
const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000; // 24 heures

const BASIN_PARAMS: Record<BassinType, { offset: number }> = {
    'URBAIN':    { offset: 1.2 }, 
    'AGRICOLE':  { offset: 0.5 }, 
    'PRAIRIE':   { offset: 0.3 }, 
    'FORESTIER': { offset: 0.0 }  
};

const DEPTH_MAP: Record<DepthCategoryID, number> = {
    'Z_LESS_3': 2.0, // Michael : Aligné sur le moteur physique v8.8.1
    'Z_3_15': 6.0, 
    'Z_MORE_15': 18.0
};

const EMA_ALPHA = 0.30; 
const FLOW_NORM_VAL = 150;
const K_BASE = 0.98;
const K_TEMP_SENSITIVITY = 0.004;

/**
 * Transforme un point de donnée en Snapshot Atomique
 */
export const mapPointToSnapshot = (point: OracleDataPoint, morphology?: LocationMorphology): FullEnvironmentalSnapshot => {
    return {
        weather: {
            temperature: point.airTemp,
            pressure: point.pressure,
            windSpeed: point.windSpeed,
            windDirection: point.windDirection,
            precip: point.precip,
            clouds: point.clouds,
            conditionCode: point.conditionCode
        },
        hydro: {
            flowRaw: point.flowRaw,
            waterTemp: point.waterTemp,
            tFond: point.tFond,
            turbidityNTU: point.turbidityNTU,
            dissolvedOxygen: point.dissolvedOxygen,
            waveHeight: point.waveHeight
        },
        scores: {
            sandre: point.sandre,
            brochet: point.brochet,
            perche: point.perche,
            blackbass: point.blackbass
        },
        metadata: {
            calculationDate: new Date().toISOString(),
            calculationMode: 'ULTREIA_CALIBRATED',
            flowStatus: point.flowStatus,
            morphologyType: morphology?.typeId,
            schemaVersion: SCHEMA_VERSION
        }
    };
};

/**
 * Nettoyage du cache
 */
export const cleanupOracleCache = () => {
    const keys = Object.keys(localStorage);
    const now = Date.now();
    keys.forEach(key => {
        if (key.startsWith('oracle_cache_')) {
            try {
                const item = localStorage.getItem(key);
                if (item) {
                    const parsed = JSON.parse(item);
                    if (!key.startsWith(CACHE_KEY_PREFIX) || parsed.version !== SCHEMA_VERSION || (now - parsed.timestamp > MAX_CACHE_AGE_MS)) {
                        localStorage.removeItem(key);
                    }
                }
            } catch (e) { localStorage.removeItem(key); }
        }
    });
};

/**
 * Point d'entrée principal avec gestion SWR
 */
export const getOrFetchOracleData = async (
    lat: number, 
    lng: number, 
    locationId: string,
    morphology?: LocationMorphology
): Promise<{ points: OracleDataPoint[], snapshot: FullEnvironmentalSnapshot }> => {
    const cacheKey = `${CACHE_KEY_PREFIX}${locationId}`;
    const cached = localStorage.getItem(cacheKey);

    if (cached) {
        try {
            const cachedValue = JSON.parse(cached);
            if (Date.now() - cachedValue.timestamp < CACHE_DURATION_MS && cachedValue.version === SCHEMA_VERSION) {
                return { points: cachedValue.data, snapshot: cachedValue.snapshot };
            }
        } catch (e) { console.error("Cache error", e); }
    }

    try {
        const freshPoints = await fetchOracleChartData(lat, lng, morphology);
        const now = Date.now();
        const currentPoint = freshPoints.find(p => p.timestamp >= now) || freshPoints[freshPoints.length - 1];
        const freshSnapshot = mapPointToSnapshot(currentPoint, morphology);

        const cachePayload = { timestamp: now, version: SCHEMA_VERSION, data: freshPoints, snapshot: freshSnapshot };
        localStorage.setItem(cacheKey, JSON.stringify(cachePayload));
        return { points: freshPoints, snapshot: freshSnapshot };
    } catch (error) {
        if (cached) {
            const parsed = JSON.parse(cached);
            return { points: parsed.data, snapshot: parsed.snapshot };
        }
        throw error;
    }
};

/**
 * LE MOTEUR DE SIMULATION (fetch + loop 1100 points)
 */
export const fetchOracleChartData = async (
    lat: number, 
    lng: number, 
    morphology?: LocationMorphology
): Promise<OracleDataPoint[]> => {
    if (!lat || !lng) return [];
    try {
        const m = (morphology?.typeId || 'Z_RIVER') as any;
        const b = (morphology?.bassin || 'URBAIN') as BassinType;
        const D = morphology?.meanDepth || DEPTH_MAP[morphology?.depthId || 'Z_3_15'];
        const surface = morphology?.surfaceArea || 100000; 
        const shape = morphology?.shapeFactor || 1.2;

        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,surface_pressure,cloud_cover,wind_speed_10m,wind_direction_10m,precipitation,weathercode&timezone=Europe%2FParis&past_days=45&forecast_days=4`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error('Météo indisponible');
        const data = await response.json();
        const hourly = data.hourly;
        
        const points: OracleDataPoint[] = [];
        const nowTs = Date.now();
        const startGraph = nowTs - (12 * 3600 * 1000); 
        const endGraph = nowTs + (72 * 3600 * 1000);   

        // État initial (Cold Start à J-45)
        let soilSaturation = 15; 
        let currentNTU = BASSIN_TURBIDITY_BASE[b] || 8.0; 
        
        // Michael : Doit être undefined pour laisser solveAir2Water choisir la Baseline au début
        let currentWaterTemp: number | undefined = undefined; 
        
        let prevFlowIntensity = 0;
        let emaScores = { sandre: 0, brochet: 0, perche: 0, blackbass: 0 };

        for (let i = 0; i < hourly.time.length; i++) {
            const date = new Date(hourly.time[i]);
            const ts = date.getTime();
            
            const Ta = hourly.temperature_2m[i]; 
            const Patm = hourly.surface_pressure[i];
            const windKmH = hourly.wind_speed_10m[i];
            const precip = hourly.precipitation[i] || 0;

            // 1. SIMULATION THERMIQUE v8.8.1 (Correction continuité)
            // L'état 'currentWaterTemp' est passé en argument 5 pour la relaxation
            currentWaterTemp = solveAir2Water(
                [{ date: date.toISOString(), temperature: Ta }], 
                m, 
                b, 
                morphology?.depthId as DepthCategoryID, 
                currentWaterTemp, 
                D, 
                surface, 
                shape
            );

            // 2. SIMULATION TURBIDITÉ
            currentNTU = solveTurbidity(
                [{ precipitation: precip }], 
                b, 
                true 
            );

            // 3. LOGIQUE HYDRO
            const hourlyK = Math.pow(Math.max(0.70, K_BASE - (Ta * K_TEMP_SENSITIVITY)), 1/24);
            soilSaturation = (soilSaturation * hourlyK) + precip; 
            const flowIntensity = Math.min(100, (soilSaturation / FLOW_NORM_VAL) * 100);
            const derivative = flowIntensity - prevFlowIntensity;
            const trend: 'Montée' | 'Décrue' | 'Stable' = derivative > 0.02 ? 'Montée' : (derivative < -0.02 ? 'Décrue' : 'Stable');
            prevFlowIntensity = flowIntensity;

            // 4. FILTRAGE FENÊTRE D'AFFICHAGE
            if (ts < startGraph || ts > endGraph) continue;

            // 5. CALCUL BIOLOGIQUE
            const hs = calculateWaveHeight(windKmH, surface, shape);
            const dissolvedOxygen = solveDissolvedOxygen(currentWaterTemp, Patm, windKmH);
            const prevPress24h = i >= 24 ? hourly.surface_pressure[i - 24] : hourly.surface_pressure[0];

            const ctx: BioContext = {
                waterTemp: currentWaterTemp,
                cloudCover: hourly.cloud_cover[i],
                windSpeed: windKmH,
                pressureTrend: Patm - prevPress24h, 
                turbidityNTU: currentNTU,
                dissolvedOxygen: dissolvedOxygen,
                waveHeight: hs,
                flowIndex: flowIntensity,
                flowDerivative: derivative * 24, 
                flowTrend: trend,
                date: date,
                morphoId: m
            };

            const rawScores = calculateUniversalBioScores(ctx);

            // 6. LISSAGE EMA
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
                isForecast: ts > nowTs,
                waterTemp: Number(currentWaterTemp.toFixed(1)),
                tFond: Number(currentWaterTemp.toFixed(1)),
                turbidityNTU: Number(currentNTU.toFixed(1)),
                dissolvedOxygen: Number(dissolvedOxygen.toFixed(2)),
                waveHeight: Number(hs.toFixed(1)),
                airTemp: Number(Ta.toFixed(1)),
                pressure: Math.round(Patm),
                clouds: Math.round(hourly.cloud_cover[i]),
                windSpeed: Math.round(windKmH),
                windDirection: Math.round(hourly.wind_direction_10m[i]),
                precip: Number(precip.toFixed(1)),
                conditionCode: hourly.weathercode[i],
                bestScore: Math.round(Math.max(emaScores.sandre, emaScores.brochet, emaScores.perche, emaScores.blackbass)),
                sandre: Math.round(emaScores.sandre),
                brochet: Math.round(emaScores.brochet),
                perche: Math.round(emaScores.perche),
                blackbass: Math.round(emaScores.blackbass),
                flowRaw: Math.round(flowIntensity),
                flowStatus: trend
            });
        }
        return points;
    } catch (error) {
        console.error("Oracle simulation error:", error);
        throw error;
    }
};