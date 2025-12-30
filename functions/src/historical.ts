import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { MorphologyID, BassinType, DepthCategoryID, FullEnvironmentalSnapshot } from "./types";

// --- 1. CONSTANTES PHYSIQUES & CALIBRATION (ALIGNÉES v5.3) ---

const BASSIN_OFFSET: Record<BassinType, number> = {
    'URBAIN': 1.2,   
    'AGRICOLE': 0.5, 
    'FORESTIER': 0.0,
    'PRAIRIE': 0.3
};

const BASSIN_TURBIDITY_BASE: Record<BassinType, number> = {
    'URBAIN': 12.0,
    'AGRICOLE': 8.5, 
    'PRAIRIE': 6.0,
    'FORESTIER': 4.5
};

const DEPTH_MAP: Record<DepthCategoryID, number> = {
    'Z_LESS_3': 2.0,
    'Z_3_15': 6.0,
    'Z_MORE_15': 15.0
};

const PHI = 172; // Solstice d'été (Phase du rayonnement solaire net)
const TURBIDITY_DECAY = 0.06; // 6% par heure (Loi de Stokes / Décantation)
const ALPHA_RAIN = 1.8; // Coefficient d'apport sédimentaire
const ALPHA_WIND = 0.8; // Facteur de transfert mécanique du vent (Fetch)

// --- 2. INTERFACES INTERNES ---

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

// --- 3. MOTEURS PHYSIQUES (LOGIQUE MIROIR ORACLE) ---

function solveAir2Water(history: any[], morphoId: MorphologyID, bassin: BassinType, depthId: DepthCategoryID, meanDepth?: number): number {
    const offset = BASSIN_OFFSET[bassin] || 0;
    const D = meanDepth || DEPTH_MAP[depthId] || 5.0;

    const delta = morphoId === 'Z_RIVER' ? 14 : 0.207 * Math.pow(D, 1.35); 
    const mu = 0.5 + (1 / D);

    let waterTemp = history[0]?.temperature || 10;

    history.forEach((day) => {
        const date = new Date(day.date);
        const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);
        const solarTerm = mu * Math.sin((2 * Math.PI * (dayOfYear - PHI)) / 365);
        const dTw = (1 / delta) * ((day.temperature + offset) - waterTemp) + solarTerm;
        waterTemp += dTw;
    });

    return waterTemp;
}

function calculateRD(lux: number, ntu: number, species: string): number {
    const params: any = {
        'Brochet': { rdMax: 6.0, kL: 0.25, kNTU: 0.08 },
        'Sandre':  { rdMax: 4.0, kL: 0.05, kNTU: 0.03 },
        'Perche':  { rdMax: 4.0, kL: 0.12, kNTU: 0.05 },
        'Black-Bass': { rdMax: 4.5, kL: 0.20, kNTU: 0.05 }
    };
    const p = params[species] || { rdMax: 3.0, kL: 0.20, kNTU: 0.05 };
    const lightFactor = lux / (p.kL + lux || 0.01);
    const opticFactor = Math.exp(-p.kNTU * ntu);
    return p.rdMax * lightFactor * opticFactor;
}

function calculateCrepuscularFactor(date: Date): number {
    const hour = date.getHours() + (date.getMinutes() / 60);
    const morningPeak = Math.exp(-0.5 * Math.pow((hour - 7.5) / 1.5, 2));
    const eveningPeak = Math.exp(-0.5 * Math.pow((hour - 19.5) / 1.5, 2));
    return 1.0 + (Math.max(morningPeak, eveningPeak) * 0.4);
}

function calculateLux(date: Date, cloudCover: number): number {
    const hour = date.getHours() + (date.getMinutes() / 60);
    const month = date.getMonth() + 1;
    const schedule: { [key: number]: [number, number] } = {
        1: [8.5, 17.0], 2: [8.0, 18.0], 3: [7.0, 19.0], 4: [6.0, 20.5], 
        5: [5.5, 21.5], 6: [5.5, 22.0], 7: [6.0, 21.5], 8: [6.5, 20.5], 
        9: [7.5, 19.5], 10: [8.0, 18.5], 11: [8.0, 17.0], 12: [8.5, 16.5]
    };
    const [rise, set] = schedule[month] || [7, 19];
    if (hour < rise - 0.5 || hour > set + 0.5) return 0.01; 
    const elev = Math.sin(Math.PI * (hour - rise) / (set - rise));
    const cloudFactor = 1 - Math.pow(cloudCover / 100, 3);
    return Math.max(0.01, elev * cloudFactor);
}

// --- 4. CALCULS DES SCORES PAR ESPÈCE ---

const computeSandreScore = (ctx: BioContext, lux: number, oxyF: number, crep: number): number => {
    const si_temp = Math.exp(-0.5 * Math.pow((ctx.waterTemp - 21) / 5, 2));
    const rd = calculateRD(lux, ctx.turbidityNTU, 'Sandre');
    const si_optic = Math.exp(-0.5 * Math.pow((rd - 1.8) / 1.2, 2));
    const si_baro = Math.max(0.4, 1 - (Math.abs(ctx.pressureTrend) / 16.6));
    let si_light = lux > 0.6 ? 1.0 - (lux - 0.6) * 0.8 : 1.0;
    if (ctx.waveHeight > 10) si_light = Math.max(si_light, 0.85);
    let score = 100 * Math.pow(si_baro, 0.3) * Math.pow(si_optic, 0.4) * Math.pow(si_temp, 0.3);
    return Math.min(Math.round(score * si_light * oxyF * crep), 100);
};

const computeBrochetScore = (ctx: BioContext, lux: number, oxyF: number, crep: number): number => {
    if (ctx.waterTemp > 24.5) return 0;
    const si_temp = Math.exp(-0.5 * Math.pow((ctx.waterTemp - 16) / 8, 2));
    const rd = calculateRD(lux, ctx.turbidityNTU, 'Brochet');
    const si_optic = rd / 3.5;
    const si_baro = 1.0 - (ctx.pressureTrend / 12); 
    let score = 100 * Math.pow(si_temp, 0.4) * Math.pow(si_optic, 0.4) * Math.pow(si_baro, 0.2);
    return Math.min(Math.round(score * oxyF * crep), 100);
};

const computePercheScore = (ctx: BioContext, lux: number, oxyF: number, crep: number): number => {
    const si_temp = Math.exp(-0.5 * Math.pow((ctx.waterTemp - 20) / 7, 2));
    const si_baro = Math.max(0.3, 1 - (Math.abs(ctx.pressureTrend) / 14));
    const rd = calculateRD(lux, ctx.turbidityNTU, 'Perche');
    const si_light = (lux > 0.2 && lux < 0.7) ? 1.2 : 0.8;
    let score = 100 * Math.pow(si_temp, 0.4) * Math.pow(si_baro, 0.3) * (rd / 2.5);
    return Math.min(Math.round(score * oxyF * si_light * crep), 100);
};

const computeBlackBassScore = (ctx: BioContext, lux: number, oxyF: number, crep: number): number => {
    const si_temp = Math.exp(-0.5 * Math.pow((ctx.waterTemp - 26) / 9, 2));
    let si_baro = Math.exp(-1.2 * Math.abs(ctx.pressureTrend));
    if (ctx.pressureTrend > 2.5 && lux > 0.85) si_baro *= 0.25;
    const rd = calculateRD(lux, ctx.turbidityNTU, 'Black-Bass');
    let score = 100 * Math.pow(si_temp, 0.5) * Math.pow(si_baro, 0.3) * (rd / 3.0);
    return Math.min(Math.round(score * oxyF * crep), 100);
};

// --- 5. CLOUD FUNCTION PRINCIPALE ---

export const getHistoricalContext = onCall({ region: "europe-west1" }, async (request) => {
    const { weather, weatherHistory, location, dateStr } = request.data;
    
    if (!weather || !location || !weatherHistory || !Array.isArray(weatherHistory)) {
        throw new HttpsError("invalid-argument", "Michael, données manquantes pour la simulation.");
    }

    const sessionDate = new Date(dateStr);
    const morpho = location.morphology;
    const morphoId = (morpho?.typeId || 'Z_RIVER') as MorphologyID;
    const bassin = (morpho?.bassin || 'URBAIN') as BassinType;
    const depthId = (morpho?.depthId || 'Z_3_15') as DepthCategoryID;
    const meanDepth = morpho?.meanDepth || DEPTH_MAP[depthId];

    // --- A. CALCULS PHYSIQUES ---
    const Tw = solveAir2Water(weatherHistory, morphoId, bassin, depthId, meanDepth);

    const baseNTU = BASSIN_TURBIDITY_BASE[bassin] || 8.0;
    const rains = weatherHistory.map((w: any) => w.precipitation || w.precip || 0);
    
    let NTU = baseNTU;
    rains.forEach(r => {
        NTU = baseNTU + (NTU - baseNTU) * (1 - TURBIDITY_DECAY);
        if (r > 0.1) NTU += r * ALPHA_RAIN;
    });

    const pressureTrend = (weather.pressure || 1013) - (weatherHistory[weatherHistory.length - 1]?.pressure || 1013);
    const T = Tw;
    let Cs = 14.652 - (0.41022 * T) + (0.007991 * Math.pow(T, 2)) - (0.000077774 * Math.pow(T, 3));
    const DO = Cs * ((weather.pressure || 1013) / 1013.25);
    const oxyF = DO >= 6.5 ? 1.0 : (DO <= 3.5 ? 0.05 : 0.05 + (DO - 3.5) * 0.31);

    const surface = morpho?.surfaceArea || 100000;
    const shape = morpho?.shapeFactor || 1.2;
    const windSpeed = weather.windSpeed || 0;
    const fetch = Math.sqrt(surface) * shape;
    const waveHeight = windSpeed < 10 ? 0 : 0.0016 * (windSpeed / 3.6) * Math.sqrt(fetch / 9.81) * 100 * ALPHA_WIND;

    const lux = calculateLux(sessionDate, weather.clouds || 0);
    const crep = calculateCrepuscularFactor(sessionDate);

    const context: BioContext = {
        waterTemp: Tw, cloudCover: weather.clouds || 0, windSpeed,
        pressureTrend, turbidityNTU: NTU, dissolvedOxygen: DO,
        waveHeight, date: sessionDate
    };

    const response: FullEnvironmentalSnapshot = {
        weather: {
            temperature: weather.temperature || weather.temp || 0,
            pressure: weather.pressure || 1013,
            windSpeed: windSpeed,
            windDirection: weather.windDirection || weather.windDir || 0,
            precip: weather.precip || 0,
            clouds: weather.clouds || 0,
            conditionCode: weather.conditionCode || weather.condition_code || 0
        },
        hydro: {
            waterTemp: parseFloat(Tw.toFixed(1)),
            turbidityNTU: parseFloat(NTU.toFixed(1)),
            dissolvedOxygen: parseFloat(DO.toFixed(1)),
            waveHeight: parseFloat(waveHeight.toFixed(0)),
            flowRaw: 0,
            flowLagged: 0,
            level: 0
        },
        scores: {
            sandre: Math.round(computeSandreScore(context, lux, oxyF, crep)),
            brochet: Math.round(computeBrochetScore(context, lux, oxyF, crep)),
            perche: Math.round(computePercheScore(context, lux, oxyF, crep)),
            blackbass: Math.round(computeBlackBassScore(context, lux, oxyF, crep))
        },
        metadata: {
            calculationDate: new Date().toISOString(),
            calculationMode: 'ZERO_HYDRO'
        }
    };

    logger.info(`Simulation ZERO_HYDRO terminée. Tw: ${Tw.toFixed(1)}°C, NTU: ${NTU.toFixed(1)}`);

    return response;
});