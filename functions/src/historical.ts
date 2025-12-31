// functions/src/historical.ts
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { MorphologyID, BassinType, DepthCategoryID, FullEnvironmentalSnapshot } from "./types";

// --- 1. CONSTANTES PHYSIQUES v6.2 (ÉDITION ÉQUILIBRÉE SEINE) ---

const BASSIN_OFFSET: Record<BassinType, number> = {
    'URBAIN': 1.2, 'AGRICOLE': 0.5, 'FORESTIER': 0.0, 'PRAIRIE': 0.3
};

const BASSIN_TURBIDITY_BASE: Record<BassinType, number> = {
    'URBAIN': 12.0, 'AGRICOLE': 8.5, 'PRAIRIE': 6.0, 'FORESTIER': 4.5
};

const DEPTH_MAP: Record<DepthCategoryID, number> = {
    'Z_LESS_3': 2.0, 'Z_3_15': 6.0, 'Z_MORE_15': 15.0
};

// Michael : Dictionnaire Smart Baseline (v5.0) pour l'initialisation thermique
// Valeurs calibrées pour la Seine (Moyennes mensuelles historiques)
const SMART_BASELINE: Record<number, number> = {
    0: 5.5,  // Janvier (Source SFD v5.0) [cite: 432]
    1: 6.0,  // Février
    2: 9.0,  // Mars
    3: 12.0, // Avril
    4: 16.0, // Mai
    5: 19.5, // Juin
    6: 21.0, // Juillet (Source SFD v5.0) [cite: 432]
    7: 21.5, // Août
    8: 19.0, // Septembre
    9: 14.5, // Octobre
    10: 10.5,// Novembre
    11: 7.5  // Décembre
};

const PHI = 172; 
const ALPHA_RAIN = 1.8; 
const DAILY_DECAY = 0.77; 

const K_BASE = 0.98; 
const K_TEMP_SENSITIVITY = 0.004; 
const LAG_KERNEL = [0.10, 0.45, 0.35, 0.10]; 
const FLOW_NORM_VAL = 150; 

const U_CRIT: Record<string, number> = {
    'Sandre': 82,
    'Brochet': 75,
    'Perche': 68 
};

// --- 2. INTERFACES ---

interface BioContext {
    waterTemp: number;
    cloudCover: number;
    windSpeed: number;
    pressureTrend: number;
    turbidityNTU: number;
    dissolvedOxygen: number;
    waveHeight: number;
    flowIndex: number; 
    flowDerivative: number; 
    flowTrend: 'Montée' | 'Décrue' | 'Stable';
    date: Date;
}

// --- 3. MOTEURS PHYSIQUES ---

function solveAir2Water(history: any[], morphoId: MorphologyID, bassin: BassinType, depthId: DepthCategoryID, meanDepth?: number): number {
    const offset = BASSIN_OFFSET[bassin] || 0;
    const D = meanDepth || DEPTH_MAP[depthId] || 5.0;
    const delta = morphoId === 'Z_RIVER' ? 12 : 0.207 * Math.pow(D, 1.35); 
    const mu = 0.15 + (1 / (D * 5));

    // Michael : Application de la Smart Baseline au lieu de l'air J-45 pour tuer le biais de Cold Start 
    const firstDate = (history && history.length > 0) ? new Date(history[0].date) : new Date();
    const month = firstDate.getMonth();
    let waterTemp = SMART_BASELINE[month] || 12;

    history.forEach((day: any) => {
        const date = new Date(day.date);
        const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);
        const solarCorrection = mu * Math.sin((2 * Math.PI * (dayOfYear - PHI)) / 365);
        const equilibriumTemp = (day.temperature || 10) + offset + (solarCorrection * 10);
        // Équation différentielle Air2Water [cite: 19, 25]
        waterTemp += (equilibriumTemp - waterTemp) / delta;
    });
    return Math.max(3, Math.min(26.5, waterTemp));
}

function solveDissolvedOxygen(T: number, P: number): number {
    let Cs = 14.652 - (0.41022 * T) + (0.007991 * Math.pow(T, 2)) - (0.000077774 * Math.pow(T, 3));
    return parseFloat((Cs * (P / 1013.25)).toFixed(2));
}

function calculateWaveHeight(windKmH: number, surfaceM2: number = 100000, shapeFactor: number = 1.2): number {
    if (windKmH < 10) return 0;
    const fetch = Math.sqrt(surfaceM2) * shapeFactor;
    const hs = 0.0016 * (windKmH / 3.6) * Math.sqrt(fetch / 9.81) * 100 * 0.8; 
    return parseFloat(hs.toFixed(1));
}

function solveUltreiaFlow(history: any[]) {
    let api = 15; 
    const dailySignals: number[] = [];

    history.forEach((day: any) => {
        const rain = day.precipitation || day.precip || 0;
        const temp = day.temperature || 15;
        const currentK = Math.max(0.70, K_BASE - (temp * K_TEMP_SENSITIVITY));
        api = (api * currentK) + rain;
        dailySignals.push(api);
    });

    const getWeightedSignal = (idx: number) => {
        let weighted = 0;
        for (let i = 0; i < LAG_KERNEL.length; i++) {
            const val = dailySignals[idx - i] || dailySignals[0];
            weighted += val * LAG_KERNEL[i];
        }
        return weighted;
    };

    const currentFlow = getWeightedSignal(dailySignals.length - 1);
    const prevFlow = getWeightedSignal(dailySignals.length - 2);

    const intensity = Math.min(100, (currentFlow / FLOW_NORM_VAL) * 100);
    const prevIntensity = Math.min(100, (prevFlow / FLOW_NORM_VAL) * 100);
    const derivative = intensity - prevIntensity;
    
    const trend: 'Montée' | 'Décrue' | 'Stable' = derivative > 0.5 
        ? 'Montée' 
        : (derivative < -0.5 ? 'Décrue' : 'Stable');

    return { intensity, derivative, trend };
}

// --- 4. HELPERS BIOSCORES ---

function calculateOxygenFactor(doMgL: number): number {
    if (doMgL >= 6.5) return 1.0;
    if (doMgL <= 3.5) return 0.05;
    return 0.05 + (doMgL - 3.5) * 0.31;
}

function calculateRD(lux: number, ntu: number, species: string): number {
    const params: any = {
        'Brochet': { rdMax: 6.5, kL: 0.12, kNTU: 0.05 },
        'Sandre':  { rdMax: 4.0, kL: 0.05, kNTU: 0.03 },
        'Perche':  { rdMax: 4.0, kL: 0.08, kNTU: 0.035 },
        'Black-Bass': { rdMax: 4.5, kL: 0.20, kNTU: 0.05 }
    };
    const p = params[species] || { rdMax: 3.0, kL: 0.20, kNTU: 0.05 };
    return p.rdMax * (lux / (p.kL + lux || 0.01)) * Math.exp(-p.kNTU * ntu);
}

// --- 5. CALCULS DES SCORES ---

const computeUltreiaScore = (species: string, ctx: BioContext, lux: number, oxyF: number, crep: number): number => {
    const sedimentaryImpact = ctx.flowTrend === 'Montée' ? 1 + (ctx.flowDerivative / 20) : 0.95;
    const rd = calculateRD(lux, ctx.turbidityNTU * sedimentaryImpact, species);
    
    const tRef = species === 'Brochet' ? 16 : (species === 'Sandre' ? 21 : 20);
    const tSigma = species === 'Brochet' ? 8 : (species === 'Sandre' ? 5 : 7);
    const si_temp = Math.exp(-0.5 * Math.pow((ctx.waterTemp - tRef) / tSigma, 2));
    const si_baro = Math.max(0.4, 1 - (Math.abs(ctx.pressureTrend) / 15));

    const u_limit = U_CRIT[species] || 70;
    const metabolicPenalty = 0.20 + (0.80 / (1 + Math.exp((ctx.flowIndex - u_limit) / 12)));

    let dynamicBoost = 1.0;
    if (ctx.flowTrend === 'Montée') {
        dynamicBoost = species === 'Sandre' ? 1.35 : (species === 'Perche' ? 1.25 : 1.80);
    } else if (ctx.flowTrend === 'Décrue') {
        dynamicBoost = species === 'Perche' ? 1.20 : 1.10; 
    }

    if (species === 'Brochet') {
        dynamicBoost *= Math.exp(-ctx.flowIndex / 250);
    }

    const score = 100 * Math.pow(si_baro, 0.3) * Math.pow(si_temp, 0.4) * (rd / 3.0);
    return Math.min(100, Math.round(score * metabolicPenalty * dynamicBoost * oxyF * crep * 1.8));
};

// --- 6. CLOUD FUNCTION PRINCIPALE ---

export const getHistoricalContext = onCall({ region: "europe-west1" }, async (request) => {
    const { weather, weatherHistory, location, dateStr } = request.data;
    if (!weather || !location || !weatherHistory) throw new HttpsError("invalid-argument", "Data missing.");

    const sessionDate = new Date(dateStr);
    const morpho = location.morphology;
    const morphoId = (morpho?.typeId || 'Z_RIVER') as MorphologyID;
    const bassin = (morpho?.bassin || 'URBAIN') as BassinType;

    const Tw = solveAir2Water(weatherHistory, morphoId, bassin, morpho?.depthId || 'Z_3_15');
    const { intensity, derivative, trend } = solveUltreiaFlow(weatherHistory);
    
    const baseNTU = BASSIN_TURBIDITY_BASE[bassin] || 8.0;
    let NTU = baseNTU;
    weatherHistory.forEach((day: any) => {
        const r = day.precipitation || day.precip || 0;
        NTU = baseNTU + (NTU - baseNTU) * (1 - DAILY_DECAY);
        if (r > 0.1) NTU += r * ALPHA_RAIN;
    });

    const P = weather.pressure || 1013;
    const DO = solveDissolvedOxygen(Tw, P);
    const wind = weather.windSpeed || 0;
    const wavesHs = calculateWaveHeight(wind, morpho?.surfaceArea, morpho?.shapeFactor);

    const lux = (function(d, c) {
        const h = d.getHours() + (d.getMinutes() / 60);
        const elev = Math.sin(Math.PI * (h - 7) / 12);
        return Math.max(0.025, elev * (1 - Math.pow(c / 100, 2)));
    })(sessionDate, weather.clouds || 0);
    
    const crep = (function(d) {
        const h = d.getHours() + (d.getMinutes() / 60);
        const p1 = Math.exp(-0.5 * Math.pow((h - 7.5) / 1.5, 2));
        const p2 = Math.exp(-0.5 * Math.pow((h - 19.5) / 1.5, 2));
        return 1.0 + (Math.max(p1, p2) * 0.4);
    })(sessionDate);

    const context: BioContext = {
        waterTemp: Tw, cloudCover: weather.clouds || 0, windSpeed: wind,
        pressureTrend: P - (weatherHistory[weatherHistory.length - 1]?.pressure || P),
        turbidityNTU: NTU, dissolvedOxygen: DO, waveHeight: wavesHs,
        flowIndex: intensity, flowDerivative: derivative, flowTrend: trend, date: sessionDate
    };

    const response: FullEnvironmentalSnapshot = {
        weather: { ...weather },
        hydro: {
            waterTemp: parseFloat(Tw.toFixed(1)),
            turbidityNTU: parseFloat(NTU.toFixed(1)),
            turbidityIdx: parseFloat(Math.min(1.0, NTU / 80).toFixed(2)),
            dissolvedOxygen: DO,
            waveHeight: wavesHs,
            flowRaw: Math.round(intensity), 
            flowLagged: 0, level: 0
        },
        scores: {
            sandre: computeUltreiaScore('Sandre', context, lux, calculateOxygenFactor(DO), crep),
            brochet: computeUltreiaScore('Brochet', context, lux, calculateOxygenFactor(DO), crep),
            perche: computeUltreiaScore('Perche', context, lux, calculateOxygenFactor(DO), crep),
            blackbass: 20 
        },
        metadata: {
            calculationDate: new Date().toISOString(),
            calculationMode: 'ULTREIA_CALIBRATED' as any,
            flowStatus: trend,
            morphologyType: morphoId 
        }
    };

    logger.info(`Ultreia Balanced v6.2. Sandre: ${response.scores.sandre}, Pike: ${response.scores.brochet}`);
    return response;
});