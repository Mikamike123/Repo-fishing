// lib/oracle-service.ts - Version 6.0 (Alignement Intégral Ultreia & Fix Signature)

import { calculateUniversalBioScores, BioContext, BioScores } from './bioScoreEngine';
import { solveDissolvedOxygen, calculateWaveHeight, BASSIN_TURBIDITY_BASE } from './zeroHydroEngine'; 
import { LocationMorphology, MorphologyID, DepthCategoryID, BassinType } from '../types';

export interface OracleDataPoint extends BioScores {
    timestamp: number;
    hourLabel: string;
    isForecast: boolean;
    waterTemp: number;     // T_surface
    tFond: number;         // T_hypolimnion
    turbidityNTU: number;
    dissolvedOxygen: number;
    waveHeight: number;    // Hs en cm
    bestScore: number;
}

// --- 1. CONSTANTES PHYSIQUES v6.0 (ALIGNÉES SUR BACKEND v6.2) ---

const BASIN_PARAMS: Record<BassinType, { offset: number }> = {
    'URBAIN':    { offset: 1.2 }, 
    'AGRICOLE':  { offset: 0.5 }, 
    'PRAIRIE':   { offset: 0.3 }, 
    'FORESTIER': { offset: 0.0 }  
};

const DEPTH_MAP: Record<DepthCategoryID, number> = {
    'Z_LESS_3': 2.0,
    'Z_3_15': 6.0,
    'Z_MORE_15': 15.0
};

const PHI = 172; 
const EMA_ALPHA = 0.35; 

// [ALIGNE SUR historical.ts]
const MONTHLY_WATER_TEMP_BASELINE: { [key: number]: number } = {
    0: 5.5,  1: 6.0,  2: 9.0,  3: 12.0, 4: 16.0, 5: 19.5,
    6: 21.0, 7: 21.5, 8: 19.0, 9: 14.5, 10: 10.5, 11: 7.5
};

// Paramètres Ultreia pour le flux (v6.2)
const K_BASE = 0.98;
const FLOW_NORM_VAL = 150;

/**
 * MOTEUR D'ESTIMATION PHYSIQUE & BIOLOGIQUE v6.0
 * Aligné intégralement sur le moteur de Cloud Function "Ultreia Balanced".
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
        const bParams = BASIN_PARAMS[b];
        const baseNTU = BASSIN_TURBIDITY_BASE[b] || 6.0;
        const D = morphology?.meanDepth || DEPTH_MAP[morphology?.depthId || 'Z_3_15'];
        const surface = morphology?.surfaceArea || 100000; 
        const shape = morphology?.shapeFactor || 1.2;

        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,surface_pressure,cloud_cover,wind_speed_10m,precipitation&timezone=Europe%2FParis&past_days=30&forecast_days=4`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Météo Oracle indisponible');
        const data = await response.json();
        const hourly = data.hourly;
        
        const points: OracleDataPoint[] = [];
        const now = Date.now();
        const oneHour = 3600 * 1000;
        const startGraph = now - (12 * oneHour);
        const endGraph = now + (72 * oneHour);

        // --- 2. ÉTATS INITIAUX ---
        let currentNTU = baseNTU; 
        const firstDate = new Date(hourly.time[0]);
        let currentWaterTemp = MONTHLY_WATER_TEMP_BASELINE[firstDate.getMonth()] || 12.0;
        let api = 15; // Antecedent Precipitation Index initial
        let prevIntensity = 0;

        let emaScores = { sandre: 0, brochet: 0, perche: 0, blackbass: 0 };

        // --- 3. BOUCLE DE SIMULATION HORAIRE ---
        for (let i = 0; i < hourly.time.length; i++) {
            const timeStr = hourly.time[i];
            const date = new Date(timeStr);
            const ts = date.getTime();
            const dayOfYear = Math.floor((ts - new Date(date.getFullYear(), 0, 0).getTime()) / (oneHour * 24));
            
            const precip = hourly.precipitation[i] || 0;
            const Ta = hourly.temperature_2m[i];
            const Patm = hourly.surface_pressure[i];
            const windKmH = hourly.wind_speed_10m[i];

            // A. Thermique (Aligné v6.2)
            const delta = m === 'Z_RIVER' ? 12 : 0.207 * Math.pow(D, 1.35);
            const mu = 0.15 + (1 / (D * 5));
            const solarTerm = mu * Math.sin((2 * Math.PI * (dayOfYear - PHI)) / 365);
            const equilibriumTemp = Ta + bParams.offset + (solarTerm * 10);
            
            currentWaterTemp += (equilibriumTemp - currentWaterTemp) / (delta * 24);

            let tFond = currentWaterTemp;
            if (m !== 'Z_RIVER' && currentWaterTemp > 15) {
                tFond = 15 + (currentWaterTemp - 15) * 0.15; 
            }

            // B. Hydro-Sédimentaire (Aligné v6.2)
            const k_hourly = 0.054; // Dérivé du DAILY_DECAY de 0.77
            currentNTU = baseNTU + (currentNTU - baseNTU) * Math.exp(-k_hourly);
            if (precip > 0.1) currentNTU += 1.8 * precip;

            // C. Flux Ultreia Lite
            const currentK = Math.max(0.70, K_BASE - (currentWaterTemp * 0.004));
            api = (api * Math.pow(currentK, 1/24)) + precip; // Distribution horaire du déclin
            const intensity = Math.min(100, (api / FLOW_NORM_VAL) * 100);
            const derivative = intensity - prevIntensity;
            const trend: 'Montée' | 'Décrue' | 'Stable' = derivative > 0.02 ? 'Montée' : (derivative < -0.02 ? 'Décrue' : 'Stable');
            prevIntensity = intensity;

            // D. Vagues
            const hs = calculateWaveHeight(windKmH, surface, shape);

            if (ts < startGraph || ts > endGraph) continue;

            // E. BioScores (Aligné v6.2)
            // Correction de l'erreur TS2554 : Uniquement 2 arguments passés
            const dissolvedOxygen = solveDissolvedOxygen(currentWaterTemp, Patm);
            const prevPress = i >= 3 ? hourly.surface_pressure[i - 3] : Patm;
            
            const ctx: BioContext = {
                waterTemp: currentWaterTemp,
                cloudCover: hourly.cloud_cover[i],
                windSpeed: windKmH,
                pressureTrend: Patm - prevPress,
                turbidityNTU: currentNTU,
                dissolvedOxygen: dissolvedOxygen,
                waveHeight: hs,
                flowIndex: intensity,
                flowDerivative: derivative * 24, // Normalisé à la journée pour le moteur
                flowTrend: trend,
                date: date
            };

            const rawScores = calculateUniversalBioScores(ctx);

            // Lissage EMA
            if (points.length === 0) {
                emaScores = { ...rawScores };
            } else {
                emaScores.sandre += EMA_ALPHA * (rawScores.sandre - emaScores.sandre);
                emaScores.brochet += EMA_ALPHA * (rawScores.brochet - emaScores.brochet);
                emaScores.perche += EMA_ALPHA * (rawScores.perche - emaScores.perche);
                emaScores.blackbass += EMA_ALPHA * (rawScores.blackbass - emaScores.blackbass);
            }

            const maxScore = Math.max(emaScores.sandre, emaScores.brochet, emaScores.perche, emaScores.blackbass);

            points.push({
                timestamp: ts,
                hourLabel: date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
                isForecast: ts > now,
                waterTemp: Number(currentWaterTemp.toFixed(1)),
                tFond: Number(tFond.toFixed(1)),
                turbidityNTU: Number(currentNTU.toFixed(1)),
                dissolvedOxygen: Number(dissolvedOxygen.toFixed(2)),
                waveHeight: Number(hs.toFixed(1)),
                bestScore: Math.round(maxScore),
                sandre: Math.round(emaScores.sandre),
                brochet: Math.round(emaScores.brochet),
                perche: Math.round(emaScores.perche),
                blackbass: Math.round(emaScores.blackbass)
            });
        }

        return points;

    } catch (error) {
        console.error("Erreur Oracle Service:", error);
        return [];
    }
};