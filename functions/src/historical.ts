// functions/src/historical.ts
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { MorphologyID, BassinType } from "./types";

/**
 * --- INTERFACES TECHNIQUES ALIGNÉES ---
 */
export interface BioScores {
    sandre: number;
    brochet: number;
    perche: number;
    blackbass: number;
}

interface BioContext {
    waterTemp: number;
    cloudCover: number;
    windSpeed: number;
    pressureTrend: number;
    turbidityNTU: number;
    dissolvedOxygen: number;
    waveHeight: number;
    date: Date;
}

/**
 * --- CONSTANTES PHYSIQUES (ZERO-HYDRO GOLD STANDARD v4.5) ---
 */
const MORPHO_PARAMS: Record<MorphologyID, { delta: number; mu: number; base_ntu: number }> = {
    'Z_POND':  { delta: 4,  mu: 0.8, base_ntu: 15.0 }, 
    'Z_MED':   { delta: 15, mu: 1.5, base_ntu: 5.0  }, 
    'Z_DEEP':  { delta: 40, mu: 3.5, base_ntu: 2.0  }, 
    'Z_RIVER': { delta: 14, mu: 0.6, base_ntu: 8.0  }  
};

const BASSIN_OFFSET: Record<BassinType, number> = {
    'URBAIN': 1.2,   
    'AGRICOLE': 0.5, 
    'FORESTIER': 0.0,
    'PRAIRIE': 0.3 
};

const TURBIDITY_CONSTANTS = {
    ALPHA_SED: 2.5,
    BASE_NTU: 5.0,
    MAX_NTU: 80.0
};

const PHI = 172; // Solstice d'été

/**
 * --- MOTEUR PHYSIQUE ---
 */

function solveAir2Water(history: any[], morphoId: MorphologyID, bassin: BassinType): number {
    if (!history || history.length === 0) return 15;
    const params = MORPHO_PARAMS[morphoId];
    const offset = BASSIN_OFFSET[bassin];
    const T_media = history.reduce((acc, curr) => acc + (curr.temperature || 0), 0) / history.length;
    const now = new Date();
    const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
    const A = params.delta * Math.sin((2 * Math.PI / 365) * (dayOfYear - PHI));
    return T_media + A + offset;
}

function solveTurbidity(rains: number[]): number {
    const cumulatedRain = rains.slice(-3).reduce((a, b) => a + b, 0);
    return Math.min(TURBIDITY_CONSTANTS.MAX_NTU, TURBIDITY_CONSTANTS.BASE_NTU + (cumulatedRain * TURBIDITY_CONSTANTS.ALPHA_SED));
}

function solveDissolvedOxygen(waterTemp: number, pressurehPa: number): number {
    const T = waterTemp;
    let doSaturation = 14.652 - (0.41022 * T) + (0.007991 * Math.pow(T, 2)) - (0.000077774 * Math.pow(T, 3));
    const pressureCorrection = pressurehPa / 1013.25;
    return Math.max(0, doSaturation * pressureCorrection);
}

function calculateLux(date: Date, cloudCover: number): number {
    const hour = date.getHours() + (date.getMinutes() / 60);
    const month = date.getMonth() + 1;
    const schedule: { [key: number]: [number, number] } = {
        1: [8.5, 17.0], 2: [8.0, 18.0], 3: [7.0, 19.0], 4: [7.0, 20.0],
        5: [6.0, 21.0], 6: [5.5, 22.0], 7: [6.0, 21.5], 8: [7.0, 20.5],
        9: [7.5, 19.5], 10: [8.0, 18.5], 11: [8.0, 17.5], 12: [8.5, 16.5]
    };
    const [rise, set] = schedule[month] || [8, 18];
    if (hour < rise || hour > set) return 0.05;
    const dist = Math.abs(hour - ((rise + set) / 2)) / ((set - rise) / 2);
    const baseLux = Math.max(0, 1 - Math.pow(dist, 2));
    return Math.max(0.05, baseLux * (1 - (cloudCover / 100) * 0.7));
}

/**
 * --- MOTEUR BIOLOGIQUE ---
 */

const computeSandreScore = (ctx: BioContext, lux: number, oxyF: number): number => {
    const fT = Math.exp(-Math.pow(ctx.waterTemp - 18, 2) / 50);
    const fL = Math.exp(-Math.pow(lux - 0.15, 2) / 0.05);
    const fVis = Math.exp(-Math.pow(ctx.turbidityNTU - 15, 2) / 300);
    const fP = Math.exp(-Math.abs(ctx.pressureTrend) / 4);
    const base = 100 * Math.pow(fT, 0.4) * Math.pow(fL, 0.3) * Math.pow(fVis, 0.2) * Math.pow(fP, 0.1);
    return Math.min(Math.round(base * oxyF), 100);
};

const computeBrochetScore = (ctx: BioContext, oxyF: number): number => {
    const fT = Math.exp(-Math.pow(ctx.waterTemp - 16, 2) / 80);
    const fVis = ctx.turbidityNTU < 5 ? 1.0 : Math.exp(-(ctx.turbidityNTU - 5) / 15);
    const fP = Math.exp(-Math.abs(ctx.pressureTrend) / 6);
    const base = 100 * Math.pow(fT, 0.5) * Math.pow(fVis, 0.3) * Math.pow(fP, 0.2);
    return Math.min(Math.round(base * oxyF), 100);
};

const computePercheScore = (ctx: BioContext, oxyF: number): number => {
    const fT = Math.exp(-Math.pow(ctx.waterTemp - 21, 2) / 72);
    const fP = Math.exp(-Math.abs(ctx.pressureTrend) / 3);
    const base = 100 * Math.pow(fT, 0.6) * Math.pow(fP, 0.4);
    return Math.min(Math.round(base * oxyF), 100);
};

const computeBlackBassScore = (ctx: BioContext, lux: number, oxyF: number): number => {
    const si_temp = Math.exp(-0.5 * Math.pow((ctx.waterTemp - 27) / 10, 2));
    let si_baro = Math.exp(-1.5 * Math.abs(ctx.pressureTrend));
    if (ctx.pressureTrend > 3 && lux > 0.8) si_baro *= 0.3;
    const base = 100 * Math.pow(si_temp, 0.6) * Math.pow(si_baro, 0.4);
    return Math.min(Math.round(base * oxyF), 100);
};

/**
 * --- CLOUD FUNCTION HISTORICAL ---
 * Correction Michael : Ajout explicite de la région europe-west1
 */

export const getHistoricalContext = onCall({ region: "europe-west1" }, async (request) => {
/*    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Michael, authentification requise.");
    }
*/
    const { weather, weatherHistory, location, dateStr } = request.data;
    
    if (!weather || !location || !weatherHistory || !Array.isArray(weatherHistory)) {
        throw new HttpsError("invalid-argument", "Données incomplètes.");
    }

    const sessionDate = new Date(dateStr);
    const morpho = (location.morphology?.typeId || 'Z_RIVER') as MorphologyID;
    const bassin = (location.morphology?.bassin || 'URBAIN') as BassinType;

    const Tw = solveAir2Water(weatherHistory, morpho, bassin);
    const rains = weatherHistory.map((w: any) => w.precipitation || w.precip || 0);
    const NTU = solveTurbidity(rains);

    const recentHistory = weatherHistory.slice(-1);
    const lastPressure = recentHistory[0]?.pressure || 1013;
    const pressureTrend = (weather.pressure || 1013) - lastPressure;

    const DO = solveDissolvedOxygen(Tw, weather.pressure || 1013);
    const oxyF = DO >= 6 ? 1.0 : (DO <= 3 ? 0.1 : 0.1 + (DO - 3) * 0.3);
    const waveHeight = weather.windSpeed ? (weather.windSpeed * 0.5) : 0;

    const context: BioContext = {
        waterTemp: Tw,
        cloudCover: weather.clouds || 0,
        windSpeed: weather.windSpeed || 0,
        pressureTrend: pressureTrend,
        turbidityNTU: NTU,
        dissolvedOxygen: DO,
        waveHeight: waveHeight,
        date: sessionDate
    };

    const lux = calculateLux(sessionDate, context.cloudCover);

    const scores: BioScores = {
        sandre: computeSandreScore(context, lux, oxyF),
        brochet: computeBrochetScore(context, oxyF),
        perche: computePercheScore(context, oxyF),
        blackbass: computeBlackBassScore(context, lux, oxyF)
    };

    logger.info(`Session historique calculée sur europe-west1 pour Michael.`);

    return {
        waterTemp: parseFloat(Tw.toFixed(1)),
        turbidityNTU: parseFloat(NTU.toFixed(1)),
        dissolvedOxygen: parseFloat(DO.toFixed(2)),
        waveHeight: parseFloat(waveHeight.toFixed(1)),
        pressureTrend: parseFloat(pressureTrend.toFixed(1)),
        scores
    };
});