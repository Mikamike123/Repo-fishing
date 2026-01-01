// lib/zeroHydroEngine.ts - Version 7.2 (Strict Backend Alignment)

import { MorphologyID, BassinType, DepthCategoryID } from '../types';

// --- 1. CONSTANTES PHYSIQUES ---

const SMART_BASELINE: Record<number, number> = {
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
    'Z_LESS_3': 2.0, 'Z_3_15': 6.0, 'Z_MORE_15': 15.0
};

const PHYSICAL_PARAMS = {
    phi: 172, alpha_rain: 1.8, daily_decay: 0.77 
};

const TURBIDITY_CONSTANTS = { MAX_NTU: 100 };

// --- 2. HELPERS ---

export const getSmartBaseline = (date: Date): number => {
    return SMART_BASELINE[date.getMonth()] || 12.0;
};

// --- 3. MOTEUR THERMIQUE (Air2Water v7.2) ---

export const solveAir2Water = (
    history: any[], 
    morphologyId: MorphologyID, 
    bassin: BassinType,
    depthId: DepthCategoryID = 'Z_3_15',
    prevTemp?: number,
    meanDepth?: number // [NOUVEAU] Précision pour étangs
): number => {
    if (!history || history.length === 0) return prevTemp || 12;

    const offset = BASSIN_OFFSET[bassin] || 0;
    
    // [NOUVEAU] Calcul Inertie spécifique
    const D = meanDepth || DEPTH_MAP[depthId] || 5.0;
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
        
        waterTemp! += (equilibriumTemp - waterTemp!) / delta; // Pas de /24 ici car on est en pas de temps journalier sur history[] frontend
    });

    return Math.max(3, Math.min(29.5, Number(waterTemp!.toFixed(1))));
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
        currentNTU = baseNTU + (currentNTU - baseNTU) * (1 - PHYSICAL_PARAMS.daily_decay);
        if (precip > 0.1) currentNTU += precip * PHYSICAL_PARAMS.alpha_rain;
    });

    return Math.min(Math.round(currentNTU * 10) / 10, TURBIDITY_CONSTANTS.MAX_NTU);
};

// --- 5. MOTEUR CHIMIQUE (v7.2 - Banks-Herrera) ---

/**
 * Calcule l'Oxygène Dissous avec Réaération par le Vent
 */
export const solveDissolvedOxygen = (T: number, P: number, windKmh: number = 0): number => {
    let Cs = 14.652 - (0.41022 * T) + (0.007991 * Math.pow(T, 2)) - (0.000077774 * Math.pow(T, 3));
    Cs = parseFloat((Cs * (P / 1013.25)).toFixed(2));

    // [NOUVEAU] Banks-Herrera
    const Uw = windKmh / 3.6;
    let reaerationBonus = 0;
    if (T > 18 && Uw > 2) {
        const kL = (0.728 * Math.sqrt(Uw)) - (0.317 * Uw) + (0.0372 * Math.pow(Uw, 2));
        reaerationBonus = Math.max(0, kL * 0.5); 
    }

    return parseFloat((Cs + reaerationBonus).toFixed(2));
};

// --- 6. MOTEUR PHYSIQUE (Vagues) ---

export const calculateWaveHeight = (
    windKmH: number, 
    surfaceM2: number = 100000, 
    shapeFactor: number = 1.2
): number => {
    // [FIX] Seuil 3km/h aligné Backend
    if (windKmH < 3) return 0; 
    
    const fetch = Math.sqrt(surfaceM2) * shapeFactor;
    const hs = 0.0016 * (windKmH / 3.6) * Math.sqrt(fetch / 9.81) * 100 * 0.8; 
    return parseFloat(hs.toFixed(1));
};