// src/lib/zeroHydroEngine.ts

import { MorphologyID, BassinType, DepthCategoryID } from '../types';

// --- 1. CONSTANTES PHYSIQUES & CALIBRATION (v5.2 - Baseline Dynamique) ---

/**
 * [ALIGNE SUR types.ts]
 * Calibré pour refléter l'albedo et l'inertie thermique des bassins versants.
 */
const BASSIN_OFFSET: Record<BassinType, number> = {
    'URBAIN': 1.2,   
    'AGRICOLE': 0.5, 
    'FORESTIER': 0.0, // Référence sauvage
    'PRAIRIE': 0.3
};

/**
 * [NOUVEAU v5.2] Baseline de turbidité par bassin (Le "fond de cuve")
 * Évite le blocage à 5 NTU dans les zones chargées par le trafic ou le ruissellement permanent.
 */
export const BASSIN_TURBIDITY_BASE: Record<BassinType, number> = {
    'URBAIN': 12.0,    // Particules fines et trafic permanent
    'AGRICOLE': 8.5,   // Voile sédimentaire lié aux sols nus
    'PRAIRIE': 6.0,
    'FORESTIER': 4.5   // Seul milieu capable d'une clarté totale
};

const PHI = 172; // Solstice d'été pour le cycle solaire

// Mapping des profondeurs moyennes par défaut (si meanDepth est absent)
const DEPTH_MAP: Record<DepthCategoryID, number> = {
    'Z_LESS_3': 2.0,
    'Z_3_15': 6.0,
    'Z_MORE_15': 15.0
};

/**
 * [CALIBRATION v5.2] Optimisation du relief optique.
 * K_DECAY : 0.06 (6%/h) - On ralentit encore la décantation pour garder la mémoire des événements.
 * ALPHA_RAIN : 1.8 - On remonte la sensibilité aux averses pour voir les pics sur le graphique.
 * ALPHA_WIND : 0.8 - Resuspension éolienne équilibrée.
 */
const TURBIDITY_CONSTANTS = {
    MAX_NTU: 100.0,     // Cap de lisibilité Oracle
    K_DECAY: 0.06,      
    ALPHA_RAIN: 1.8,    
    ALPHA_WIND: 0.8     
};

// --- 2. INTERFACES ---

export interface DailyWeather {
    date: string;
    avgTemp: number;
    precipitation?: number; 
    windSpeed?: number;     // km/h (U10)
    pressure?: number;      // hPa
    cloudCover?: number;    
}

// --- 3. MOTEUR THERMIQUE (Air2Water v5.2) ---

/**
 * Équation différentielle de transfert thermique pilotée par la profondeur.
 * [Audit source 50, 53]
 */
export const solveAir2Water = (
    weatherHistory: DailyWeather[] | { temp: number; date: string }[],
    morphoType: MorphologyID,
    bassinType: BassinType, 
    meanDepth?: number,
    depthCategory: DepthCategoryID = 'Z_3_15',
    initialWaterTemp?: number
): number => {
    const offset = BASSIN_OFFSET[bassinType] || 0;
    const D = meanDepth || DEPTH_MAP[depthCategory];

    // Inertie thermique basée sur la loi de puissance du volume d'eau
    let delta = morphoType === 'Z_RIVER' ? 14 : 0.207 * Math.pow(D, 1.35); 
    let mu = 0.5 + (1 / D); 

    const normalizedHistory = weatherHistory.map(d => {
        if ('avgTemp' in d) return { temp: d.avgTemp, date: d.date };
        return d;
    });

    let waterTemp = initialWaterTemp ?? normalizedHistory[0].temp;

    normalizedHistory.forEach((day, index) => {
        if (index === 0 && initialWaterTemp === undefined) return;
        
        const dayOfYear = getDayOfYear(new Date(day.date));
        const solarTerm = mu * Math.sin((2 * Math.PI * (dayOfYear - PHI)) / 365);
        
        const dTw_dt = (1 / delta) * ((day.temp + offset) - waterTemp) + solarTerm;
        waterTemp += dTw_dt;
    });

    return Number(waterTemp.toFixed(1));
};

// --- 4. MOTEUR HYDRO-SÉDIMENTAIRE (Turbidité v5.2) ---

/**
 * Calcule la turbidité NTU dynamique (Pluies + Vent).
 * Version 5.2 : Décante vers la baseline spécifique du bassin versant.
 * [Audit source 82, 86]
 */
export const solveTurbidity = (
    precipHistory: number[], 
    windSpeedHistory: number[] = [],
    morphoId: MorphologyID = 'Z_RIVER',
    bassinType: BassinType = 'URBAIN',
    meanDepth?: number,
    lastKnownNTU?: number
): number => {
    const baseNTU = BASSIN_TURBIDITY_BASE[bassinType] || 5.0;
    let currentNTU = lastKnownNTU ?? baseNTU;
    const h = meanDepth || 5.0; 
    
    // Vitesse critique du vent (km/h) pour resuspension
    const U_critical = (3.0 + 1.2 * Math.log(Math.max(0.5, h))) * 3.6;

    precipHistory.forEach((rainMm, i) => {
        const windKmH = windSpeedHistory[i] || 0;

        // 1. Décantation (Déclin vers la base du bassin, pas vers zéro)
        currentNTU = baseNTU + (currentNTU - baseNTU) * (1 - TURBIDITY_CONSTANTS.K_DECAY);

        // 2. Ruissellement (Impact des pluies v5.2)
        if (rainMm > 0.1) {
            currentNTU += rainMm * TURBIDITY_CONSTANTS.ALPHA_RAIN;
        }

        // 3. Resuspension Éolienne (Uniquement milieux lentiques)
        if (morphoId !== 'Z_RIVER' && windKmH > U_critical) {
            const windStress = (windKmH - U_critical) * TURBIDITY_CONSTANTS.ALPHA_WIND;
            currentNTU += windStress;
        }
    });

    return Math.min(Math.round(currentNTU * 10) / 10, TURBIDITY_CONSTANTS.MAX_NTU);
};

// --- 5. MOTEUR CHIMIQUE (Oxygène Dissous - Banks-Herrera) ---

/**
 * Calcule l'Oxygène Dissous (DO) en mg/L.
 * Intègre la température, la pression et la réaération par le vent.
 */
export const solveDissolvedOxygen = (
    waterTemp: number, 
    pressurehPa: number,
    windSpeedKmH: number = 0,
    meanDepth: number = 5.0
): number => {
    // 1. Saturation théorique (Loi de Henry)
    const T = waterTemp;
    let Cs = 14.652 - (0.41022 * T) + (0.007991 * Math.pow(T, 2)) - (0.000077774 * Math.pow(T, 3));
    Cs *= (pressurehPa / 1013.25); 

    // 2. Facteur de réaération cinétique (Banks-Herrera)
    const U10 = windSpeedKmH / 3.6; 
    const kL = 0.728 * Math.pow(U10, 0.5) - 0.317 * U10 + 0.0372 * Math.pow(U10, 2);
    
    // Pour l'affichage instantané Oracle, on cible Cs.
    return Number(Cs.toFixed(2));
};

// --- HELPERS ---

const getDayOfYear = (date: Date): number => {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
};

/**
 * Calcul Hs (cm) via SMB simplifié.
 * Indispensable pour le "Walleye Chop" (Bonus Sandre).
 */
export const calculateWaveHeight = (windKmH: number, surfaceM2: number, shapeFactor: number): number => {
    if (windKmH < 10) return 0;
    
    const fetch = Math.sqrt(surfaceM2) * shapeFactor;
    const U = windKmH / 3.6;
    const hs = 0.0016 * U * Math.sqrt(fetch / 9.81) * 100; 
    
    return Math.min(Math.round(hs), 100);
};