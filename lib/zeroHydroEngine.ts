// src/lib/zeroHydroEngine.ts - Version 5.5 (Alignement Signature Backend)

import { MorphologyID, BassinType, DepthCategoryID } from '../types';

// --- 1. CONSTANTES PHYSIQUES & CALIBRATION (v6.2 - Aligné sur Backend) ---

const SMART_BASELINE: Record<number, number> = {
    0: 5.5,  1: 6.0,  2: 9.0,  3: 12.0, 4: 16.0, 5: 19.5,
    6: 21.0, 7: 21.5, 8: 19.0, 9: 14.5, 10: 10.5, 11: 7.5
};

const BASSIN_OFFSET: Record<BassinType, number> = {
    'URBAIN': 1.2,   
    'AGRICOLE': 0.5, 
    'FORESTIER': 0.0, 
    'PRAIRIE': 0.3
};

export const BASSIN_TURBIDITY_BASE: Record<BassinType, number> = {
    'URBAIN': 12.0,    
    'AGRICOLE': 8.5,   
    'PRAIRIE': 6.0,
    'FORESTIER': 4.5   
};

const DEPTH_MAP: Record<DepthCategoryID, number> = {
    'Z_LESS_3': 2.0, 'Z_3_15': 6.0, 'Z_MORE_15': 15.0
};

const PHYSICAL_PARAMS = {
    alpha: 0.05,
    theta: 0.08,
    precipImpact: 1.8,  // Aligné sur ALPHA_RAIN du backend
    phi: 172            // Solstice
};

const TURBIDITY_CONSTANTS = {
    MAX_NTU: 100,
    DECAY_RATE: 0.77    // Aligné sur DAILY_DECAY du backend
};

// --- 2. HELPERS ---

export const getSmartBaseline = (date: Date): number => {
    return SMART_BASELINE[date.getMonth()] || 12.0;
};

// --- 3. MOTEUR THERMIQUE ---

export const solveAir2Water = (
    history: any[], 
    morphologyId: MorphologyID, 
    bassin: BassinType,
    depthId: DepthCategoryID = 'Z_3_15',
    prevTemp?: number
): number => {
    if (!history || history.length === 0) return prevTemp || 12;

    const offset = BASSIN_OFFSET[bassin] || 0;
    const D = DEPTH_MAP[depthId] || 5.0;
    const delta = morphologyId === 'Z_RIVER' ? 12 : 0.207 * Math.pow(D, 1.35);
    const mu = 0.15 + (1 / (D * 5));
    
    let waterTemp = prevTemp;
    
    if (waterTemp === undefined || waterTemp === null) {
        waterTemp = getSmartBaseline(new Date(history[0].date));
    }

    history.forEach(day => {
        const date = new Date(day.date);
        const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);
        const solarCorrection = mu * Math.sin((2 * Math.PI * (dayOfYear - PHYSICAL_PARAMS.phi)) / 365);
        const equilibriumTemp = (day.temperature || 10) + offset + (solarCorrection * 10);
        
        waterTemp! += (equilibriumTemp - waterTemp!) / delta;
    });

    return Math.max(3, Math.min(26.5, Number(waterTemp!.toFixed(1))));
};

// --- 4. MOTEUR OPTIQUE ---

export const solveTurbidity = (
    history: any[], 
    bassin: BassinType
): number => {
    const baseNTU = BASSIN_TURBIDITY_BASE[bassin] || 6.0;
    if (!history || history.length === 0) return baseNTU;

    let currentNTU = baseNTU;

    history.forEach(day => {
        const precip = day.precipitation || 0;
        currentNTU = baseNTU + (currentNTU - baseNTU) * TURBIDITY_CONSTANTS.DECAY_RATE;
        if (precip > 0.1) currentNTU += precip * PHYSICAL_PARAMS.precipImpact;
    });

    return Math.min(Math.round(currentNTU * 10) / 10, TURBIDITY_CONSTANTS.MAX_NTU);
};

// --- 5. MOTEUR CHIMIQUE ---

/**
 * [ALIGNE SUR historical.ts]
 * Calcule l'Oxygène Dissous (DO) en mg/L.
 */
export const solveDissolvedOxygen = (T: number, P: number): number => {
    let Cs = 14.652 - (0.41022 * T) + (0.007991 * Math.pow(T, 2)) - (0.000077774 * Math.pow(T, 3));
    return parseFloat((Cs * (P / 1013.25)).toFixed(2));
};

// --- 6. MOTEUR PHYSIQUE ---

/**
 * [ALIGNE SUR historical.ts]
 * Calcule la hauteur significative des vagues (Hs) en cm.
 */
export const calculateWaveHeight = (
    windKmH: number, 
    surfaceM2: number = 100000, 
    shapeFactor: number = 1.2
): number => {
    if (windKmH < 10) return 0;
    const fetch = Math.sqrt(surfaceM2) * shapeFactor;
    const hs = 0.0016 * (windKmH / 3.6) * Math.sqrt(fetch / 9.81) * 100 * 0.8; 
    return parseFloat(hs.toFixed(1));
};