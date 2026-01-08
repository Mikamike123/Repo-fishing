// lib/zeroHydroEngine.ts - Version 8.4 (Force-Restoring Thermal Model)

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
    'Z_LESS_3': 1.5, // Ajusté pour refléter les étangs critiques
    'Z_3_15': 6.0, 
    'Z_MORE_15': 18.0
};

const PHYSICAL_PARAMS = {
    phi: 172, 
    alpha_rain: 1.8, 
    daily_decay: 0.77,
    water_heat_capacity: 4184 // J/(kg·K) - Pour référence théorique
};

const TURBIDITY_CONSTANTS = { MAX_NTU: 100 };

// --- 2. HELPERS ---

export const getSmartBaseline = (date: Date): number => {
    return SMART_BASELINE[date.getMonth()] || 12.0;
};

// --- 3. MOTEUR THERMIQUE (Unified Air2Water v8.4) ---

/**
 * Calcule la température de l'eau via un modèle de Force-Restoring.
 * Gère à la fois l'historique (pas journalier) et le forecast (pas horaire).
 */
export const solveAir2Water = (
    history: any[], 
    morphologyId: MorphologyID, 
    bassin: BassinType,
    depthId: DepthCategoryID = 'Z_3_15',
    prevTemp?: number,
    meanDepth?: number,
    isHourly: boolean = false // [NOUVEAU] Pilotage du pas de temps dt
): number => {
    if (!history || history.length === 0) return prevTemp || 12;

    const offset = BASSIN_OFFSET[bassin] || 0;
    const D = meanDepth || DEPTH_MAP[depthId] || 5.0;
    const dt = isHourly ? 1 : 24; // Pas de temps en heures

    // 1. CALCUL DE L'INERTIE THERMIQUE (TAU)
    // Pour les étangs (POND/DEEP), Tau augmente avec la profondeur pour stabiliser le modèle.
    // Pour les rivières (RIVER/MED), Tau est plus stable car le flux est moteur.
    let tau: number;
    const isLentic = morphologyId === 'Z_POND' || morphologyId === 'Z_DEEP';
    
    if (isLentic) {
        // Modèle de rétention : plus c'est profond, plus c'est lent.
        // On impose un plancher d'inertie de 18h même pour 50cm d'eau.
        tau = Math.max(18, 15 * Math.pow(D, 0.8));
        if (morphologyId === 'Z_DEEP') tau *= 1.5; // Bonus de masse pour les grands lacs
    } else {
        // Modèle de rivière : inertie plus faible car brassage constant
        tau = morphologyId === 'Z_RIVER' ? 14 : 10;
    }

    // 2. GAIN SOLAIRE (MU)
    // Uniquement pour les milieux stagnants (bilan radiatif)
    const mu = isLentic ? (0.12 + (1 / (D * 8))) : 0.05;
    
    let waterTemp = prevTemp;
    if (waterTemp === undefined || waterTemp === null) {
        waterTemp = getSmartBaseline(new Date(history[0].date || history[0].time));
    }

    history.forEach(point => {
        const date = new Date(point.date || point.time);
        const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);
        
        // Correction solaire cyclique
        const solarCorrection = mu * Math.sin((2 * Math.PI * (dayOfYear - PHYSICAL_PARAMS.phi)) / 365);
        
        // Température d'équilibre théorique (Air + Offsets)
        const airTemp = point.temperature ?? point.airTemp ?? 10;
        const equilibriumTemp = airTemp + offset + (solarCorrection * 10);
        
        // ÉQUATION DE FORCE-RESTORING (Euler discret)
        // Tw(t+dt) = Tw(t) + (dt / Tau) * (Teq - Tw(t))
        const deltaT = (dt / tau) * (equilibriumTemp - waterTemp!);
        
        // Bridage de la variation horaire pour éviter la volatilité (Max 0.4°C/h en étang)
        const hourlyLimit = isLentic ? 0.4 : 0.8;
        const cappedDeltaT = isHourly ? Math.max(-hourlyLimit, Math.min(hourlyLimit, deltaT)) : deltaT;
        
        waterTemp! += cappedDeltaT;
    });

    // Protection contre les valeurs aberrantes (Températures françaises)
    return Math.max(2.5, Math.min(31, Number(waterTemp!.toFixed(1))));
};

// --- 4. MOTEUR OPTIQUE (Turbidité v8.4) ---

export const solveTurbidity = (
    history: any[], 
    bassin: BassinType,
    isHourly: boolean = false
): number => {
    const baseNTU = BASSIN_TURBIDITY_BASE[bassin] || 6.0;
    if (!history || history.length === 0) return baseNTU;

    let currentNTU = baseNTU;
    const dt = isHourly ? 1 : 24;
    // On adapte le decay au pas de temps (loi de décroissance exponentielle)
    const decayFactor = Math.pow(1 - PHYSICAL_PARAMS.daily_decay, dt / 24);

    history.forEach(point => {
        const precip = point.precipitation || point.precip || 0;
        currentNTU = baseNTU + (currentNTU - baseNTU) * decayFactor;
        
        if (precip > 0.1) {
            // L'impact de la pluie est plus dilué en mode horaire
            const rainImpact = isHourly ? (precip * PHYSICAL_PARAMS.alpha_rain) / 4 : precip * PHYSICAL_PARAMS.alpha_rain;
            currentNTU += rainImpact;
        }
    });

    return Math.min(Math.round(currentNTU * 10) / 10, TURBIDITY_CONSTANTS.MAX_NTU);
};

// --- 5. MOTEUR CHIMIQUE (v7.2 - Banks-Herrera préservé) ---

/**
 * Calcule l'Oxygène Dissous avec Réaération par le Vent
 */
export const solveDissolvedOxygen = (T: number, P: number, windKmh: number = 0): number => {
    // Équation de saturation (Benson & Krause simplifiée)
    let Cs = 14.652 - (0.41022 * T) + (0.007991 * Math.pow(T, 2)) - (0.000077774 * Math.pow(T, 3));
    Cs = parseFloat((Cs * (P / 1013.25)).toFixed(2));

    // Bonus de réaération (Banks-Herrera)
    // Plus le vent est fort, plus on se rapproche de la saturation, voire un léger sur-stockage.
    const Uw = windKmh / 3.6;
    let reaerationBonus = 0;
    if (T > 18 && Uw > 2) {
        const kL = (0.728 * Math.sqrt(Uw)) - (0.317 * Uw) + (0.0372 * Math.pow(Uw, 2));
        reaerationBonus = Math.max(0, kL * 0.4); 
    }

    return parseFloat((Cs + reaerationBonus).toFixed(2));
};

// --- 6. MOTEUR PHYSIQUE (Vagues v7.2 préservé) ---

export const calculateWaveHeight = (
    windKmH: number, 
    surfaceM2: number = 100000, 
    shapeFactor: number = 1.2
): number => {
    // Seuil de déclenchement à 3km/h
    if (windKmH < 3) return 0; 
    
    const fetch = Math.sqrt(surfaceM2) * shapeFactor;
    // Formule simplifiée de Bretschneider
    const hs = 0.0016 * (windKmH / 3.6) * Math.sqrt(fetch / 9.81) * 100 * 0.8; 
    return parseFloat(hs.toFixed(1));
};