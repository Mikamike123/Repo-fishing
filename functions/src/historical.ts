// functions/src/historical.ts - Version 8.8.9 (Final Production Sync)
// Michael : Alignement ATOMIQUE Physique v8.8.1 + Bio v8.4. Zéro Warning.

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { z } from "zod"; 
import { MorphologyID, BassinType, DepthCategoryID, FullEnvironmentalSnapshot, SCHEMA_VERSION } from "./types";

// --- 1. SCHÉMA DE VALIDATION Michael ---
const HistoricalInputSchema = z.object({
    weather: z.any(),
    weatherHistory: z.array(z.any()),
    location: z.object({
        morphology: z.object({
            typeId: z.string().optional(),
            bassin: z.string().optional(),
            depthId: z.string().optional(),
            meanDepth: z.number().optional(),
            surfaceArea: z.number().optional(),
            shapeFactor: z.number().optional()
        }).optional()
    }),
    dateStr: z.string(),
    startTime: z.string().optional().nullable(),
    endTime: z.string().optional().nullable()
});

// --- 2. CONSTANTES PHYSIQUES v8.8.1 ---
const BASSIN_OFFSET: Record<BassinType, number> = {
    'URBAIN': 1.2, 'AGRICOLE': 0.5, 'FORESTIER': 0.0, 'PRAIRIE': 0.3
};
const BASSIN_TURBIDITY_BASE: Record<BassinType, number> = {
    'URBAIN': 12.0, 'AGRICOLE': 8.5, 'PRAIRIE': 6.0, 'FORESTIER': 4.5
};
const DEPTH_MAP: Record<DepthCategoryID, number> = {
    'Z_LESS_3': 2.0, 'Z_3_15': 6.0, 'Z_MORE_15': 18.0
};
const SMART_BASELINE: Record<number, number> = {
    0: 5.5,  1: 6.0,  2: 9.0,  3: 12.0, 4: 16.0, 5: 19.5,
    6: 21.0, 7: 21.5, 8: 19.0, 9: 14.5, 10: 10.5, 11: 7.5
};

// --- 3. CONSTANTES BIOLOGIQUES v8.4 ---
const U_CRIT: Record<string, number> = { 
    'Sandre': 82, 'Brochet': 75, 'Perche': 68, 'Black-Bass': 60
};
const THERMAL_PROFILES: Record<string, { tRef: number; tSigma: number }> = {
    'Sandre':     { tRef: 22.0, tSigma: 4.5 },
    'Brochet':    { tRef: 18.0, tSigma: 6.0 },
    'Perche':     { tRef: 21.0, tSigma: 6.5 },
    'Black-Bass': { tRef: 26.0, tSigma: 7.5 }
};

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
    morphoId: MorphologyID;
}

// --- 4. MOTEURS PHYSIQUES ---

export function solveAir2Water(
    history: any[], morphoId: MorphologyID, bassin: BassinType, depthId: DepthCategoryID, 
    _prevTemp?: number, meanDepth?: number, surfaceArea?: number, shapeFactor?: number
): number {
    if (!history || history.length === 0) return _prevTemp || 12;
    const offset = BASSIN_OFFSET[bassin] || 0;
    const D = meanDepth || DEPTH_MAP[depthId] || 5.0;
    const S = surfaceArea || 100000;
    const F = shapeFactor || 1.2;

    let delta = 12; 
    const mId = morphoId.toString().toUpperCase();
    if (mId === 'Z_MED') delta = 10;
    else if (mId === 'Z_POND' || mId === 'Z_DEEP') {
        delta = 0.207 * Math.pow(D, 1.35) * Math.pow(S / 100000, 0.08) * (1.2 / F);
        if (mId === 'Z_DEEP') delta = Math.max(delta, 14); 
    }

    const mu = (mId === 'Z_POND' || mId === 'Z_DEEP') ? (0.15 + (1 / (D * 5))) : 0.05;
    let waterTemp = (_prevTemp !== undefined && _prevTemp !== null) ? _prevTemp : (SMART_BASELINE[new Date(history[0].date).getMonth()] || 12);

    history.forEach((hour: any) => {
        const date = new Date(hour.date);
        const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);
        const solarCorrection = mu * Math.sin((2 * Math.PI * (dayOfYear - 172)) / 365);
        waterTemp += ((hour.temperature || 10) + offset + (solarCorrection * 10) - waterTemp) / (delta * 24);
    });
    return Number(waterTemp.toFixed(2));
}

export function solveDissolvedOxygen(T: number, P: number, windKmh: number): number {
    let Cs = 14.652 - (0.41022 * T) + (0.007991 * Math.pow(T, 2)) - (0.000077774 * Math.pow(T, 3));
    Cs = parseFloat((Cs * (P / 1013.25)).toFixed(2));
    const Uw = windKmh / 3.6;
    let reaerationBonus = (T > 18 && Uw > 2) ? Math.max(0, ((0.728 * Math.sqrt(Uw)) - (0.317 * Uw) + (0.0372 * Math.pow(Uw, 2))) * 0.4) : 0;
    return parseFloat((Cs + reaerationBonus).toFixed(2));
}

export function calculateWaveHeight(windKmH: number, surfaceM2: number = 100000, shapeFactor: number = 1.2): number {
    if (windKmH < 3) return 0;
    const fetch = Math.sqrt(surfaceM2) * shapeFactor;
    return parseFloat((0.0016 * (windKmH / 3.6) * Math.sqrt(fetch / 9.81) * 100 * 0.8).toFixed(1));
}

// --- 5. MOTEUR BIOLOGIQUE v8.4 ---

function calculateRD(lux: number, ntu: number, species: string): number {
    const params: Record<string, { rdMax: number; kL: number; kN: number }> = {
        'Brochet':    { rdMax: 7.0, kL: 0.15, kN: 0.06 },
        'Sandre':     { rdMax: 4.0, kL: 0.04, kN: 0.02 },
        'Perche':     { rdMax: 4.5, kL: 0.10, kN: 0.035 },
        'Black-Bass': { rdMax: 5.0, kL: 0.18, kN: 0.045 }
    };
    const p = params[species] || params['Perche'];
    return p.rdMax * (lux / (p.kL + lux)) * Math.exp(-p.kN * ntu);
}

export function computeUltreiaScore(species: string, ctx: BioContext, lux: number, crep: number): number {
    if (species === 'Brochet' && ctx.waterTemp > 23.5) return 5;
    if (species === 'Sandre' && ctx.waterTemp > 26.5) return 8;
    if (species === 'Perche' && ctx.waterTemp > 28.5) return 12;
    if (species === 'Black-Bass' && ctx.waterTemp < 7.5) return 5;

    const oxyF = (function(doMgL, sp) {
        const threshold = sp === 'Sandre' ? 5.5 : 4.5;
        if (doMgL >= threshold + 2) return 1.0;
        if (doMgL <= threshold - 1) return 0.1;
        return 0.1 + (doMgL - (threshold - 1)) * 0.3;
    })(ctx.dissolvedOxygen, species);

    const sedimentaryImpact = ctx.flowTrend === 'Montée' ? 1 + (ctx.flowDerivative / 15) : 0.98;
    const rd = calculateRD(lux, ctx.turbidityNTU * sedimentaryImpact, species);
    const visualFactor = 1 + (1.4 * (rd / (2.2 + rd)));
    
    let flowModifier = 1.0;
    const isRiver = ctx.morphoId === 'Z_RIVER' || ctx.morphoId === 'Z_MED';
    if (isRiver) {
        if (ctx.flowTrend === 'Montée') flowModifier = species === 'Sandre' ? 1.4 : (species === 'Brochet' ? 0.6 : 0.85);
        else if (ctx.flowTrend === 'Décrue') flowModifier = species === 'Brochet' ? 1.35 : 1.1;
    }

    const profile = THERMAL_PROFILES[species];
    const currentSigma = ctx.waterTemp < profile.tRef ? profile.tSigma * 1.4 : profile.tSigma;
    const si_temp = Math.exp(-0.5 * Math.pow((ctx.waterTemp - profile.tRef) / currentSigma, 2));
    
    let si_baro = 1.0;
    if (species === 'Brochet') si_baro = ctx.pressureTrend < -2.5 ? 1.25 : 1.0;
    else if (species === 'Black-Bass') {
        if (ctx.pressureTrend > 4 && ctx.cloudCover < 25) si_baro = 0.45;
        else si_baro = Math.abs(ctx.pressureTrend) < 2 ? 1.15 : 0.95;
    } else si_baro = Math.max(0.4, 1 - (Math.abs(ctx.pressureTrend) / 14));

    const metabolicPenalty = isRiver ? 0.25 + (0.75 / (1 + Math.exp((ctx.flowIndex - (U_CRIT[species] || 70)) / 8))) : 1.0;

    let rawScore = 100 * si_temp * si_baro * (visualFactor / 1.4) * flowModifier * metabolicPenalty * 1.30;
    if (ctx.waterTemp > 19) rawScore *= oxyF;
    if (species === 'Sandre') rawScore *= crep;

    const month = ctx.date.getMonth();
    let seasonalPotential = 0.95;
    if (species === 'Black-Bass') seasonalPotential = (month >= 11 || month <= 2) ? 0.25 : (month >= 5 && month <= 8 ? 1.0 : 0.65);
    else if (species === 'Brochet' && [3, 4, 9, 10].includes(month)) seasonalPotential = 1.0;
    else if (month >= 11 || month <= 2) seasonalPotential = 0.75;

    let finalScore = rawScore * seasonalPotential;
    if (finalScore > 85) finalScore = 85 + (15 * (1 - Math.exp(-(finalScore - 85) / 15)));
    return Math.round(Math.max(0, Math.min(100, (finalScore < 5 && finalScore > 0.8 ? 5 : finalScore))));
}

// --- 6. CLOUD FUNCTION PRINCIPALE ---

export const getHistoricalContext = onCall({ region: "europe-west1" }, async (request): Promise<FullEnvironmentalSnapshot> => {
    const validation = HistoricalInputSchema.safeParse(request.data);
    if (!validation.success) {
        logger.error("Validation Error", validation.error);
        throw new HttpsError("invalid-argument", "Données incomplètes.");
    }

    const { weather, weatherHistory, location, dateStr, startTime, endTime } = validation.data;
    const sessionDate = new Date(dateStr);

    // Michael : Utilisation de startTime et endTime (Warnings résolus)
    if (startTime && endTime) {
        try {
            const [sH, sM] = startTime.split(':').map(Number);
            const [eH, eM] = endTime.split(':').map(Number);
            const med = Math.floor(((sH * 60 + sM) + (eH * 60 + eM)) / 2);
            sessionDate.setHours(Math.floor(med / 60), med % 60, 0, 0);
            logger.info(`Session Time Adjusted: ${sessionDate.toISOString()}`);
        } catch (e) { logger.warn("Time format error", e); }
    }

    const morpho = location.morphology;
    const morphoId = (morpho?.typeId || 'Z_RIVER') as MorphologyID;
    const bassin = (morpho?.bassin || 'URBAIN') as BassinType;
    const historyToUse = weatherHistory.filter((h: any) => new Date(h.date).getTime() <= sessionDate.getTime());
    
    const Tw = solveAir2Water(historyToUse, morphoId, bassin, (morpho?.depthId || 'Z_3_15') as DepthCategoryID, undefined, morpho?.meanDepth, morpho?.surfaceArea, morpho?.shapeFactor);
    
    // Michael : Utilisation de BASSIN_TURBIDITY_BASE (Warning résolu)
    const baseNTU = BASSIN_TURBIDITY_BASE[bassin] || 8.0;
    let NTU = baseNTU;
    historyToUse.forEach((hour: any) => {
        NTU = baseNTU + (NTU - baseNTU) * Math.pow(1 - 0.77, 1/24);
        if ((hour.precipitation || 0) > 0.1) NTU += (hour.precipitation || 0) * 1.8;
    });

    // Flux simplifié
    const api = historyToUse.reduce((acc: any, h: any) => (acc * Math.pow(Math.max(0.7, 0.98 - (h.temperature || 15) * 0.004), 1/24)) + (h.precipitation || 0), 15);
    const flowIntensity = Math.min(100, (api / 150) * 100);

    const P = weather.pressure || 1013;
    const wind = weather.windSpeed || 0;
    const DO = solveDissolvedOxygen(Tw, P, wind); 
    const wavesHs = calculateWaveHeight(wind, morpho?.surfaceArea, morpho?.shapeFactor);

    const h = sessionDate.getHours() + (sessionDate.getMinutes() / 60);
    const lux = Math.max(0.01, Math.sin(Math.PI * (h - 7) / 12) * (1 - Math.pow((weather.clouds || 0) / 100, 1.5)));
    const crep = 1.0 + (Math.max(Math.exp(-0.5 * Math.pow((h - 7.5) / 1.2, 2)), Math.exp(-0.5 * Math.pow((h - 19.5) / 1.2, 2))) * 0.5);
    
    const pressureTrend = (historyToUse[historyToUse.length - 1]?.pressure || P) - (historyToUse[Math.max(0, historyToUse.length - 25)]?.pressure || P);

    const context: BioContext = {
        waterTemp: Tw, cloudCover: weather.clouds || 0, windSpeed: wind,
        pressureTrend: pressureTrend, turbidityNTU: NTU, dissolvedOxygen: DO, 
        waveHeight: wavesHs, flowIndex: flowIntensity, flowDerivative: 0, 
        flowTrend: 'Stable', date: sessionDate, morphoId: morphoId
    };

    logger.info(`Sync v8.8.9 Final - Tw: ${Tw}, Sandre: ${computeUltreiaScore('Sandre', context, lux, crep)}`);

    return {
        weather: { ...weather },
        hydro: { 
            waterTemp: parseFloat(Tw.toFixed(1)), 
            turbidityNTU: parseFloat(NTU.toFixed(1)), 
            dissolvedOxygen: DO, 
            waveHeight: wavesHs, 
            flowRaw: Math.round(flowIntensity) 
        },
        scores: {
            sandre: computeUltreiaScore('Sandre', context, lux, crep),
            brochet: computeUltreiaScore('Brochet', context, lux, crep),
            perche: computeUltreiaScore('Perche', context, lux, crep),
            blackbass: computeUltreiaScore('Black-Bass', context, lux, crep)
        },
        metadata: { 
            calculationDate: new Date().toISOString(), 
            calculationMode: 'ULTREIA_CALIBRATED' as any, 
            schemaVersion: SCHEMA_VERSION 
        }
    };
});