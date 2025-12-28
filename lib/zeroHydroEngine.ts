// src/lib/zeroHydroEngine.ts

import { MorphologyID, BassinType } from '../types';

// --- 1. CONSTANTES PHYSIQUES (CALIBRATION V4.5) ---

const MORPHO_PARAMS: Record<MorphologyID, { delta: number; mu: number }> = {
    'Z_POND':  { delta: 4,  mu: 0.8 }, 
    'Z_MED':   { delta: 15, mu: 1.5 }, 
    'Z_DEEP':  { delta: 40, mu: 3.5 }, 
    'Z_RIVER': { delta: 14, mu: 0.6 }  
};

const PHI = 172; // Solstice d'été

const BASSIN_OFFSET: Record<BassinType, number> = {
    'URBAIN': 1.2,   
    'AGRICOLE': 0.5, 
    'NATUREL': 0.0   
};

// Constantes Turbidité (Spec Partie III)
const TURBIDITY_CONSTANTS = {
    ALPHA_SED: 2.5,
    BETA: 0.8,       // Profil Z_RIVER par défaut
    K_DECAY: 0.15,   // Ajusté à 0.15 (heure) pour la dynamique Oracle
    BASE_NTU: 5.0,
    MAX_NTU: 80.0
};

// Facteurs de sensibilité morphologique (Pour solveTurbidity)
const MORPHO_TURBIDITY_FACTOR: Record<MorphologyID, number> = {
    'Z_POND': 0.5,   
    'Z_MED': 0.3,    
    'Z_DEEP': 0.1,   
    'Z_RIVER': 1.2   
};

// --- 2. INTERFACES ---

export interface DailyWeather {
    date: string;
    avgTemp: number;
    precipitation?: number; 
    windSpeed?: number;     
    pressure?: number;      
    cloudCover?: number;    
}

// --- 3. MOTEUR D'ACQUISITION (OPEN-METEO) ---
// (Conservé tel quel pour compatibilité existante)

export const fetchWeatherHistory = async (lat: number, lng: number, daysNumber: number): Promise<DailyWeather[]> => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - daysNumber);

    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=${formatDate(startDate)}&end_date=${formatDate(endDate)}&daily=temperature_2m_mean,precipitation_sum,wind_speed_10m_max,surface_pressure_mean,cloud_cover_mean&timezone=Europe%2FParis`;

    try {
        const res = await fetch(url);
        const data = await res.json();

        if (!data.daily || !data.daily.time) return [];

        return data.daily.time.map((time: string, index: number) => ({
            date: time,
            avgTemp: data.daily.temperature_2m_mean[index],
            precipitation: data.daily.precipitation_sum[index],
            windSpeed: data.daily.wind_speed_10m_max[index],
            pressure: data.daily.surface_pressure_mean[index],
            cloudCover: data.daily.cloud_cover_mean[index]
        }));
    } catch (error) {
        console.error("Erreur Open-Meteo:", error);
        return [];
    }
};

// --- 4. MOTEUR THERMIQUE (Air2Water) ---

export const solveAir2Water = (
    weatherHistory: DailyWeather[] | { temp: number; date: string }[], // Compatible avec les deux formats
    morphoType: MorphologyID,
    bassinType: BassinType, 
    initialWaterTemp?: number
): number => {
    const params = MORPHO_PARAMS[morphoType] || MORPHO_PARAMS['Z_RIVER'];
    const offset = BASSIN_OFFSET[bassinType] || 0;
    const { delta, mu } = params;

    // Normalisation de l'entrée (gestion des deux formats d'historique)
    const normalizedHistory = weatherHistory.map(d => {
        if ('avgTemp' in d) return { temp: d.avgTemp, date: d.date };
        return d;
    });

    let waterTemp = initialWaterTemp ?? normalizedHistory[0].temp;

    normalizedHistory.forEach((day, index) => {
        if (index === 0 && initialWaterTemp === undefined) return;
        
        // Calcul physique
        const dayOfYear = getDayOfYear(new Date(day.date));
        const solarTerm = mu * Math.sin((2 * Math.PI * (dayOfYear - PHI)) / 365);
        
        // Équation différentielle discrétisée
        const dTw_dt = (1 / delta) * ((day.temp + offset) - waterTemp) + solarTerm;
        
        waterTemp += dTw_dt;
    });

    return Number(waterTemp.toFixed(1));
};

// --- 5. MOTEUR OPTIQUE (Turbidité) ---

/**
 * [MISE À JOUR] Calcule la turbidité physique (NTU)
 * Remplace l'ancien calcul d'index pour permettre la simulation Oracle précise
 */
export const solveTurbidity = (
    precipHistory: number[], 
    morphoId: MorphologyID = 'Z_RIVER',
    lastKnownNTU: number = TURBIDITY_CONSTANTS.BASE_NTU
): number => {
    let currentNTU = lastKnownNTU;
    const sensitivity = MORPHO_TURBIDITY_FACTOR[morphoId] || 1.0;
    
    const alpha = TURBIDITY_CONSTANTS.ALPHA_SED * sensitivity;
    const decay = TURBIDITY_CONSTANTS.K_DECAY;

    for (const rainMm of precipHistory) {
        // 1. Décantation (Loi de Stokes simplifiée)
        const decanted = currentNTU * (1 - decay);
        currentNTU = Math.max(TURBIDITY_CONSTANTS.BASE_NTU, decanted);

        // 2. Accrétion (Ruissellement)
        if (rainMm > 0.2) {
            const influx = rainMm * alpha;
            currentNTU += influx;
        }
    }

    return Math.min(Math.round(currentNTU * 10) / 10, TURBIDITY_CONSTANTS.MAX_NTU);
};

// Gardé pour rétro-compatibilité temporaire (alias vers la nouvelle logique)
export const calculateTurbidityIndex = (weatherHistory: DailyWeather[]): number => {
    const rains = weatherHistory.map(w => w.precipitation || 0);
    const ntu = solveTurbidity(rains, 'Z_RIVER');
    return Math.min(1.0, ntu / TURBIDITY_CONSTANTS.MAX_NTU);
};

// --- 6. MOTEUR CHIMIQUE (Oxygène Dissous) ---
// [NOUVEAU] Requis par Oracle Service

/**
 * Calcule l'Oxygène Dissous (DO) théorique en mg/L
 * Basé sur la loi de Henry (Température) et la Pression Atmosphérique
 */
export const solveDissolvedOxygen = (
    waterTemp: number, 
    pressurehPa: number
): number => {
    // 1. Saturation à 100% (Formule Benson & Krause)
    const T = waterTemp;
    let doSaturation = 14.652 - (0.41022 * T) + (0.007991 * Math.pow(T, 2)) - (0.000077774 * Math.pow(T, 3));

    if (doSaturation < 0) doSaturation = 0;

    // 2. Correction Pression
    const pressureCorrection = pressurehPa / 1013.25;

    const finalDO = doSaturation * pressureCorrection;
    
    return Number(finalDO.toFixed(2));
};

// --- HELPER: UTILS ---

const getDayOfYear = (date: Date): number => {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
};

// NOTE DE MIGRATION :
// Les fonctions BioScores (calculateUniversalBioScores, computeSandreScore, etc.) 
// ont été déplacées dans 'bioScoreEngine.ts' pour supporter le Black-Bass et l'Oxygène.