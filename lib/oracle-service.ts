// lib/oracle-service.ts - Version 7.6 (Full Integration)

import { calculateUniversalBioScores, BioContext, BioScores } from './bioScoreEngine';
import { solveDissolvedOxygen, calculateWaveHeight, BASSIN_TURBIDITY_BASE } from './zeroHydroEngine'; 
import { LocationMorphology, DepthCategoryID, BassinType } from '../types';

export interface OracleDataPoint extends BioScores {
    timestamp: number;
    hourLabel: string;
    isForecast: boolean;
    waterTemp: number;
    tFond: number;
    turbidityNTU: number;
    dissolvedOxygen: number;
    waveHeight: number;
    bestScore: number;
    flowRaw: number;
}

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

export const fetchOracleChartData = async (
    lat: number, 
    lng: number, 
    morphology?: LocationMorphology
): Promise<OracleDataPoint[]> => {
    if (!lat || !lng) return [];
    try {
        // [CONFIG] Récupération Morpho
        const m = morphology?.typeId || 'Z_RIVER';
        const b = morphology?.bassin || 'URBAIN';
        const bParams = BASIN_PARAMS[b] || BASIN_PARAMS['URBAIN'];
        const baseNTU = BASSIN_TURBIDITY_BASE[b] || 8.0; 
        const D = morphology?.meanDepth || DEPTH_MAP[morphology?.depthId || 'Z_3_15']; // Profondeur précise
        const surface = morphology?.surfaceArea || 100000; 
        const shape = morphology?.shapeFactor || 1.2;

        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,surface_pressure,cloud_cover,wind_speed_10m,precipitation&timezone=Europe%2FParis&past_days=45&forecast_days=4`;
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

            // 1. Thermique (Inertie adaptée morpho)
            const delta = m === 'Z_RIVER' ? 12 : 0.207 * Math.pow(D, 1.35); // [NOUVEAU]
            const mu = 0.15 + (1 / (D * 5));
            const solarTerm = mu * Math.sin((2 * Math.PI * (dayOfYear - PHI)) / 365);
            const equilibriumTemp = Ta + bParams.offset + (solarTerm * 10);
            currentWaterTemp += (equilibriumTemp - currentWaterTemp) / (delta * 24);

            // 2. Hydro-Sédimentaire
            const hourlyDecayFactor = Math.pow(1 - DAILY_DECAY, 1/24);
            currentNTU = baseNTU + (currentNTU - baseNTU) * hourlyDecayFactor;
            if (precip > 0.1) currentNTU += precip * ALPHA_RAIN;

            // 3. Flux API
            const currentK = Math.max(0.70, K_BASE - (Ta * K_TEMP_SENSITIVITY));
            const hourlyK = Math.pow(currentK, 1/24);
            api = (api * hourlyK) + precip; 
            
            const intensity = Math.min(100, (api / FLOW_NORM_VAL) * 100);
            const derivative = intensity - prevIntensity;
            const trend: 'Montée' | 'Décrue' | 'Stable' = derivative > 0.021 ? 'Montée' : (derivative < -0.021 ? 'Décrue' : 'Stable');
            prevIntensity = intensity;

            const hs = calculateWaveHeight(windKmH, surface, shape);

            if (ts < startGraph || ts > endGraph) continue;

            // 4. BioScores
            // [NOUVEAU] Passage du vent pour Banks-Herrera
            const dissolvedOxygen = solveDissolvedOxygen(currentWaterTemp, Patm, windKmH);
            const prevPress24h = i >= 24 ? hourly.surface_pressure[i - 24] : hourly.surface_pressure[0];
            const deltaP24h = Patm - prevPress24h;

            const ctx: BioContext = {
                waterTemp: currentWaterTemp,
                cloudCover: hourly.cloud_cover[i],
                windSpeed: windKmH,
                pressureTrend: deltaP24h, 
                turbidityNTU: currentNTU,
                dissolvedOxygen: dissolvedOxygen,
                waveHeight: hs,
                flowIndex: intensity,
                flowDerivative: derivative * 24, 
                flowTrend: trend,
                date: date,
                morphoId: m // [NOUVEAU]
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
                bestScore: Math.round(Math.max(emaScores.sandre, emaScores.brochet, emaScores.perche, emaScores.blackbass)),
                sandre: Math.round(emaScores.sandre),
                brochet: Math.round(emaScores.brochet),
                perche: Math.round(emaScores.perche),
                blackbass: Math.round(emaScores.blackbass),
                flowRaw: Math.round(intensity)
            });
        }
        return points;
    } catch (error) {
        console.error("Erreur Oracle Service - Sync 24h Failed:", error);
        return [];
    }
};