// lib/zeroHydroEngine.ts - Version 8.8.1 (Stateful Relaxation)
// Michael : Correction du "Bug de Sisyphe" pour permettre la continuité thermique dans les boucles.

import { MorphologyID, BassinType, DepthCategoryID } from '../types';

export const SMART_BASELINE: Record<number, number> = {
    0: 5.5,  1: 6.0,  2: 9.0,  3: 12.0, 4: 16.0, 5: 19.5,
    6: 21.0, 7: 21.5, 8: 19.0, 9: 14.5, 10: 10.5, 11: 7.5
};

const BASSIN_OFFSET: Record<BassinType, number> = {
    'URBAIN': 1.2, 'AGRICOLE': 0.5, 'FORESTIER': 0.0, 'PRAIRIE': 0.3
};

export const BASSIN_TURBIDITY_BASE: Record<BassinType, number> = {
    'URBAIN': 12.0, 'AGRICOLE': 8.5, 'PRAIRIE': 6.0, 'FORESTIER': 4.5
};

const DEPTH_MAP: Record<DepthCategoryID, number> = {
    'Z_LESS_3': 2.0, 
    'Z_3_15': 6.0, 
    'Z_MORE_15': 18.0
};

const PHYSICAL_PARAMS = {
    phi: 172, 
    alpha_rain: 1.8, 
    daily_decay: 0.77
};

const TURBIDITY_CONSTANTS = { MAX_NTU: 100 };

export const getSmartBaseline = (date: Date): number => {
    return SMART_BASELINE[date.getMonth()] || 12.0;
};

/**
 * MOTEUR THERMIQUE v8.8.1
 * @param _prevTemp : IMPORTANT - Permet de porter l'état thermique d'une heure à l'autre
 */
export const solveAir2Water = (
    history: any[], 
    morphologyId: MorphologyID, 
    bassin: BassinType,
    depthId: DepthCategoryID = 'Z_3_15',
    _prevTemp?: number, 
    meanDepth?: number,
    surfaceArea?: number,
    shapeFactor?: number
): number => {
    if (!history || history.length === 0) return _prevTemp || 12;

    const offset = BASSIN_OFFSET[bassin] || 0;
    const D = meanDepth || DEPTH_MAP[depthId] || 5.0;
    const S = surfaceArea || 100000;
    const F = shapeFactor || 1.2;

    // 1. CALCUL DU DELTA (Inertie en jours)
    let delta = 12; 
    const mId = morphologyId.toString().toUpperCase();
    
    if (mId === 'Z_MED') {
        delta = 10;
    } else if (mId === 'Z_POND' || mId === 'Z_DEEP') {
        // Base v7.2 liée à la profondeur
        delta = 0.207 * Math.pow(D, 1.35);
        
        // Ajustement Morpho
        const surfaceInertia = Math.pow(S / 100000, 0.08);
        const shapeCooling = 1.2 / F;
        delta = delta * surfaceInertia * shapeCooling;

        // Michael : Sécurité Z_DEEP - Un lac profond ne peut pas être moins inerte qu'une rivière
        if (mId === 'Z_DEEP') delta = Math.max(delta, 14); 
    }

    const isLentic = mId === 'Z_POND' || mId === 'Z_DEEP';
    const mu = isLentic ? (0.15 + (1 / (D * 5))) : 0.05;
    
    // Michael : LA CORRECTION EST ICI 
    // Si _prevTemp existe (appel itératif), on l'utilise. Sinon, on prend la baseline (Cold Start).
    let waterTemp = (_prevTemp !== undefined && _prevTemp !== null) 
        ? _prevTemp 
        : (SMART_BASELINE[new Date(history[0].date || history[0].time).getMonth()] || 12);

    history.forEach(point => {
        const date = new Date(point.date || point.time);
        const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);
        const solarCorrection = mu * Math.sin((2 * Math.PI * (dayOfYear - PHYSICAL_PARAMS.phi)) / 365);
        
        const airTemp = point.temperature ?? point.airTemp ?? 10;
        const equilibriumTemp = airTemp + offset + (solarCorrection * 10);
        
        // Relaxation thermique
        waterTemp += (equilibriumTemp - waterTemp) / (delta * 24);
    });

    return Number(waterTemp.toFixed(2));
};

// ... (Reste des fonctions solveTurbidity, solveDissolvedOxygen, calculateWaveHeight identiques)
export const solveTurbidity = (history: any[], bassin: BassinType, isHourly: boolean = true): number => {
    const baseNTU = BASSIN_TURBIDITY_BASE[bassin] || 6.0;
    if (!history || history.length === 0) return baseNTU;
    let currentNTU = baseNTU;
    const dt = isHourly ? 1 : 24;
    const decayFactor = Math.pow(1 - PHYSICAL_PARAMS.daily_decay, dt / 24);
    history.forEach(point => {
        const precip = point.precipitation || point.precip || 0;
        currentNTU = baseNTU + (currentNTU - baseNTU) * decayFactor;
        if (precip > 0.1) {
            const rainImpact = isHourly ? (precip * PHYSICAL_PARAMS.alpha_rain) / 4 : precip * PHYSICAL_PARAMS.alpha_rain;
            currentNTU += rainImpact;
        }
    });
    return Math.min(Math.round(currentNTU * 10) / 10, TURBIDITY_CONSTANTS.MAX_NTU);
};

export const solveDissolvedOxygen = (T: number, P: number, windKmh: number = 0): number => {
    let Cs = 14.652 - (0.41022 * T) + (0.007991 * Math.pow(T, 2)) - (0.000077774 * Math.pow(T, 3));
    Cs = parseFloat((Cs * (P / 1013.25)).toFixed(2));
    const Uw = windKmh / 3.6;
    let reaerationBonus = 0;
    if (T > 18 && Uw > 2) {
        const kL = (0.728 * Math.sqrt(Uw)) - (0.317 * Uw) + (0.0372 * Math.pow(Uw, 2));
        reaerationBonus = Math.max(0, kL * 0.4); 
    }
    return parseFloat((Cs + reaerationBonus).toFixed(2));
};

export const calculateWaveHeight = (windKmH: number, surfaceM2: number = 100000, shapeFactor: number = 1.2): number => {
    if (windKmH < 3) return 0; 
    const fetch = Math.sqrt(surfaceM2) * shapeFactor;
    const hs = 0.0016 * (windKmH / 3.6) * Math.sqrt(fetch / 9.81) * 100 * 0.8; 
    return parseFloat(hs.toFixed(1));
};