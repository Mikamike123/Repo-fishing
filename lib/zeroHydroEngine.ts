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
    K_DECAY: 0.6,
    BASE_NTU: 5.0,
    MAX_NTU: 80.0
};

// --- 2. INTERFACES ---

export interface DailyWeather {
    date: string;
    avgTemp: number;
    precipitation?: number; // Pour Turbidité
    windSpeed?: number;     // Pour BioScores
    pressure?: number;      // Pour BioScores
    cloudCover?: number;    // Pour BioScores
}

export interface BioContext {
    waterTemp: number;      // °C
    cloudCover: number;     // %
    windSpeed: number;      // km/h
    pressureTrend: number;  // hPa (dP sur 3h ou 24h selon dispo)
    turbidity: number;      // 0-1 (Indice calculé)
    date?: Date;            
}

export interface BioScores {
    sandre: number;
    brochet: number;
    perche: number;
}

// --- 3. MOTEUR D'ACQUISITION (OPEN-METEO) ---

/**
 * Récupère l'historique météo complet via Open-Meteo Archive
 */
export const fetchWeatherHistory = async (lat: number, lng: number, daysNumber: number): Promise<DailyWeather[]> => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - daysNumber);

    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    // On demande toutes les variables nécessaires aux 3 moteurs
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
    weatherHistory: DailyWeather[],
    morphoType: MorphologyID,
    bassinType: BassinType, 
    initialWaterTemp?: number
): number => {
    const params = MORPHO_PARAMS[morphoType] || MORPHO_PARAMS['Z_RIVER'];
    const offset = BASSIN_OFFSET[bassinType] || 0;
    const { delta, mu } = params;

    let waterTemp = initialWaterTemp ?? weatherHistory[0].avgTemp;

    weatherHistory.forEach((day, index) => {
        if (index === 0 && initialWaterTemp === undefined) return;
        const dayOfYear = getDayOfYear(new Date(day.date));
        const solarTerm = mu * Math.sin((2 * Math.PI * (dayOfYear - PHI)) / 365);
        const dTw_dt = (1 / delta) * (day.avgTemp - waterTemp) + solarTerm;
        waterTemp += dTw_dt;
    });

    return Number((waterTemp + offset).toFixed(1));
};

// --- 5. MOTEUR OPTIQUE (Turbidité) ---

/**
 * Calcule l'indice de clarté (0.0 - 1.0) basé sur l'historique des pluies
 */
export const calculateTurbidityIndex = (weatherHistory: DailyWeather[]): number => {
    let currentNTU = TURBIDITY_CONSTANTS.BASE_NTU;

    weatherHistory.forEach((day) => {
        const rain = day.precipitation || 0;

        // 1. Décroissance (Loi de Stokes)
        const excess = Math.max(0, currentNTU - TURBIDITY_CONSTANTS.BASE_NTU);
        currentNTU = TURBIDITY_CONSTANTS.BASE_NTU + (excess * Math.exp(-TURBIDITY_CONSTANTS.K_DECAY));

        // 2. Accrétion (First Flush) - Seuil > 2mm
        if (rain > 2.0) {
            currentNTU += TURBIDITY_CONSTANTS.ALPHA_SED * rain * TURBIDITY_CONSTANTS.BETA;
        }
    });

    // Normalisation 0-1 (1.0 = Eau chocolat)
    return Math.min(1.0, currentNTU / TURBIDITY_CONSTANTS.MAX_NTU);
};

// --- 6. MOTEUR BIOLOGIQUE (BioScores) ---

export const calculateUniversalBioScores = (ctx: BioContext): BioScores => {
    // Pré-calculs des facteurs environnementaux
    const lux = calculateLux(ctx.date || new Date(), ctx.cloudCover);
    const windF = Math.min(1.0, Math.max(0.2, 0.2 + 0.8 * (ctx.windSpeed / 30)));
    
    return {
        sandre: computeSandreScore(ctx, lux),
        brochet: computeBrochetScore(ctx, windF),
        perche: computePercheScore(ctx)
    };
};

// HELPER: SANDRE
const computeSandreScore = (ctx: BioContext, lux: number): number => {
    // Pression (Stabilité)
    const fP = 1 / (1 + Math.exp(2.0 * (ctx.pressureTrend - 0.5)));
    // Lumière / Turbidité (Fonction Vampire)
    const fLT = (1 - lux) + lux * Math.tanh(4 * ctx.turbidity);
    // Température
    const fT = Math.exp(-Math.pow(ctx.waterTemp - 17, 2) / 128);

    const score = 100 * Math.pow(fP, 0.4) * Math.pow(fLT, 0.4) * Math.pow(fT, 0.2);
    return Math.min(Math.round(score), 100);
};

// HELPER: BROCHET
const computeBrochetScore = (ctx: BioContext, windF: number): number => {
    // Veto Éthique
    if (ctx.waterTemp > 24.0) return 0;

    // Température (Aime le frais)
    const fT = 1 / (1 + Math.exp(0.8 * (ctx.waterTemp - 21)));
    // Visibilité (Déteste l'eau trouble)
    const fVis = Math.exp(-2.5 * ctx.turbidity);

    const score = 100 * Math.pow(fT, 0.5) * Math.pow(fVis, 0.3) * Math.pow(windF, 0.2);
    return Math.min(Math.round(score), 100);
};

// HELPER: PERCHE
const computePercheScore = (ctx: BioContext): number => {
    // Température (Optimum 21°C)
    const fT = Math.exp(-Math.pow(ctx.waterTemp - 21, 2) / 72);
    // Stabilité Pression
    const dP = ctx.pressureTrend;
    const fP = Math.max(Math.exp(-2 * Math.abs(dP)), 1 / (1 + Math.exp(3.0 * (dP + 1.5))));

    const score = 100 * Math.pow(fT, 0.5) * Math.pow(fP, 0.5);
    return Math.min(Math.round(score), 100);
};

// HELPER: LUMINOSITÉ (LUX)
function calculateLux(date: Date, cloudCover: number): number {
    try {
        const hour = date.getHours() + (date.getMinutes() / 60);
        const month = date.getMonth() + 1;

        const schedule: { [key: number]: [number, number] } = {
            1: [8.5, 17.0], 2: [8.0, 18.0], 3: [7.0, 19.0], 4: [6.0, 20.5], 
            5: [5.5, 21.5], 6: [5.5, 22.0], 7: [6.0, 21.5], 8: [6.5, 20.5], 
            9: [7.5, 19.5], 10: [8.0, 18.5], 11: [8.0, 17.0], 12: [8.5, 16.5]
        };

        const [rise, set] = schedule[month] || [7, 19];
        if (hour < rise || hour > set) return 0;

        const elev = Math.sin(Math.PI * (hour - rise) / (set - rise));
        const cloudFactor = 1 - 0.75 * Math.pow(cloudCover / 100, 2);

        return Math.max(0, elev * cloudFactor);
    } catch { return 0.5; }
}

// HELPER: UTILS
const getDayOfYear = (date: Date): number => {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
};