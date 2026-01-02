// functions/src/historical.ts
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { MorphologyID, BassinType, DepthCategoryID, FullEnvironmentalSnapshot } from "./types";

// --- 1. CONSTANTES PHYSIQUES v7.2 (BLACK-BASS & MORPHOLOGY AWARE) ---

const BASSIN_OFFSET: Record<BassinType, number> = {
    'URBAIN': 1.2, 'AGRICOLE': 0.5, 'FORESTIER': 0.0, 'PRAIRIE': 0.3
};

const BASSIN_TURBIDITY_BASE: Record<BassinType, number> = {
    'URBAIN': 12.0, 'AGRICOLE': 8.5, 'PRAIRIE': 6.0, 'FORESTIER': 4.5
};

const DEPTH_MAP: Record<DepthCategoryID, number> = {
    'Z_LESS_3': 2.0, 'Z_3_15': 6.0, 'Z_MORE_15': 15.0
};

// Smart Baseline alignée sur le Live v7.3
const SMART_BASELINE: Record<number, number> = {
    0: 5.5,  1: 6.0,  2: 9.0,  3: 12.0, 4: 16.0, 5: 19.5,
    6: 21.0, 7: 21.5, 8: 19.0, 9: 14.5, 10: 10.5, 11: 7.5
};

const PHI = 172; 
const ALPHA_RAIN = 1.8; 
const DAILY_DECAY = 0.77; 
const K_TEMP_SENSITIVITY = 0.004; 
const LAG_KERNEL = [0.10, 0.45, 0.35, 0.10]; 
const FLOW_NORM_VAL = 150; 
const K_BASE = 0.98;

// Seuils de courant critique (cm/s) pour pénalité métabolique
// Note: Le Bass est robuste mais n'aime pas le courant fort continu
const U_CRIT: Record<string, number> = {
    'Sandre': 82,
    'Brochet': 75,
    'Perche': 68,
    'Black-Bass': 60 
};

// --- 2. INTERFACES ---

interface BioContext {
    waterTemp: number;
    cloudCover: number;
    windSpeed: number; // km/h
    pressureTrend: number;
    turbidityNTU: number;
    dissolvedOxygen: number; // Saturation théorique
    waveHeight: number;
    flowIndex: number; 
    flowDerivative: number; 
    flowTrend: 'Montée' | 'Décrue' | 'Stable';
    date: Date;
    morphoId: MorphologyID; // [NOUVEAU] Nécessaire pour adapter le scoring
}

// --- 3. MOTEURS PHYSIQUES (V7.2) ---

function solveAir2Water(history: any[], morphoId: MorphologyID, bassin: BassinType, depthId: DepthCategoryID, meanDepth?: number): number {
    const offset = BASSIN_OFFSET[bassin] || 0;
    
    // [MORPHOLOGY] Prise en compte réelle de la profondeur et du type
    const D = meanDepth || DEPTH_MAP[depthId] || 5.0;
    
    // Pour une rivière, l'inertie est standardisée (brassage). 
    // Pour un étang/lac, elle dépend strictement de la profondeur (Loi de puissance).
    const delta = morphoId === 'Z_RIVER' ? 12 : 0.207 * Math.pow(D, 1.35); 
    
    const mu = 0.15 + (1 / (D * 5));

    // Smart Baseline (J-45)
    const firstDate = (history && history.length > 0) ? new Date(history[0].date) : new Date();
    const month = firstDate.getMonth();
    let waterTemp = SMART_BASELINE[month] || 12;

    history.forEach((hour: any) => {
        const date = new Date(hour.date);
        const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);
        const solarCorrection = mu * Math.sin((2 * Math.PI * (dayOfYear - PHI)) / 365);
        
        const equilibriumTemp = (hour.temperature || 10) + offset + (solarCorrection * 10);
        waterTemp += (equilibriumTemp - waterTemp) / (delta * 24);
    });
    
    return Math.max(3, Math.min(29.5, waterTemp)); // Max relevé à 29.5 pour le Bass
}

function solveDissolvedOxygen(T: number, P: number, windKmh: number): number {
    let Cs = 14.652 - (0.41022 * T) + (0.007991 * Math.pow(T, 2)) - (0.000077774 * Math.pow(T, 3));
    Cs = parseFloat((Cs * (P / 1013.25)).toFixed(2));

    const Uw = windKmh / 3.6;
    let reaerationBonus = 0;
    if (T > 18 && Uw > 2) {
        const kL = (0.728 * Math.sqrt(Uw)) - (0.317 * Uw) + (0.0372 * Math.pow(Uw, 2));
        reaerationBonus = Math.max(0, kL * 0.5); 
    }

    return parseFloat((Cs + reaerationBonus).toFixed(2));
}

function calculateWaveHeight(windKmH: number, surfaceM2: number = 100000, shapeFactor: number = 1.2): number {
    if (windKmH < 3) return 0;
    // [MORPHOLOGY] Surface et Forme impactent le Fetch
    const fetch = Math.sqrt(surfaceM2) * shapeFactor;
    const hs = 0.0016 * (windKmH / 3.6) * Math.sqrt(fetch / 9.81) * 100 * 0.8; 
    return parseFloat(hs.toFixed(1));
}

function solveUltreiaFlow(history: any[]) {
    let api = 15; 
    const dailySignals: number[] = [];
    let currentDayIndex = -1;

    history.forEach((hour: any) => {
        const rain = hour.precipitation || hour.precip || 0;
        const temp = hour.temperature || 15;
        const currentK_Base = Math.max(0.70, K_BASE - (temp * K_TEMP_SENSITIVITY));
        const hourlyK = Math.pow(currentK_Base, 1/24);

        api = (api * hourlyK) + rain;

        const d = new Date(hour.date);
        if (d.getDate() !== currentDayIndex) {
            dailySignals.push(api);
            currentDayIndex = d.getDate();
        }
    });

    if (dailySignals.length === 0) dailySignals.push(api);
    dailySignals[dailySignals.length - 1] = api;

    const getWeightedSignal = (idx: number) => {
        let weighted = 0;
        for (let i = 0; i < LAG_KERNEL.length; i++) {
            const indexToRead = idx - i;
            const val = indexToRead >= 0 ? dailySignals[indexToRead] : dailySignals[0];
            weighted += val * LAG_KERNEL[i];
        }
        return weighted;
    };

    const currentFlow = getWeightedSignal(dailySignals.length - 1);
    const prevFlow = getWeightedSignal(dailySignals.length - 2);

    const intensity = Math.min(100, (currentFlow / FLOW_NORM_VAL) * 100);
    const prevIntensity = Math.min(100, (prevFlow / FLOW_NORM_VAL) * 100);
    const derivative = intensity - prevIntensity;
    
    const trend: 'Montée' | 'Décrue' | 'Stable' = derivative > 0.5 
        ? 'Montée' 
        : (derivative < -0.5 ? 'Décrue' : 'Stable');

    return { intensity, derivative, trend };
}

// --- 4. HELPERS BIOSCORES ---

function calculateOxygenFactor(doMgL: number): number {
    if (doMgL >= 6.5) return 1.0;
    if (doMgL <= 3.5) return 0.05;
    return 0.05 + (doMgL - 3.5) * 0.31;
}

function calculateRD(lux: number, ntu: number, species: string): number {
    const params: any = {
        'Brochet': { rdMax: 6.5, kL: 0.12, kNTU: 0.05 },
        'Sandre':  { rdMax: 4.0, kL: 0.05, kNTU: 0.03 },
        'Perche':  { rdMax: 4.0, kL: 0.08, kNTU: 0.035 },
        'Black-Bass': { rdMax: 4.5, kL: 0.20, kNTU: 0.04 } // [NEW] Bass: Tolérance turbidité moyenne
    };
    const p = params[species] || { rdMax: 3.0, kL: 0.20, kNTU: 0.05 };
    return p.rdMax * (lux / (p.kL + lux || 0.01)) * Math.exp(-p.kNTU * ntu);
}

function getSeasonalMetabolicPotential(date: Date, species: string): number {
    const month = date.getMonth(); // 0-11
    
    // [NEW] Black-Bass: Thermophile absolu
    // En hiver (< Mars), métabolisme à l'arrêt quasi total
    if (species === 'Black-Bass') {
        if (month >= 11 || month <= 2) return 0.20; // Hiver: Léthargie
        if (month >= 5 && month <= 8) return 1.0;   // Été: Pleine puissance
        return 0.60; // Saison de transition
    }

    if (month >= 11 || month <= 2) { 
        return species === 'Brochet' ? 0.85 : 0.70; 
    }
    if (month >= 5 && month <= 8) { 
        return 1.0; 
    }
    return 0.90; 
}

// --- 5. CALCULS DES SCORES (REFONTE V7.2 - BASS & MORPHO) ---

const computeUltreiaScore = (species: string, ctx: BioContext, lux: number, oxyF: number, crep: number): number => {
    
    // --- 1. VETO THERMIQUE STRICT ---
    if (species === 'Brochet' && ctx.waterTemp > 23.5) return 5;
    if (species === 'Sandre' && ctx.waterTemp > 26.0) return 10;
    if (species === 'Perche' && ctx.waterTemp > 28.0) return 15;
    // [NEW] Bass: Veto inversé (Froid)
    if (species === 'Black-Bass' && ctx.waterTemp < 8.0) return 5; 

    // --- 2. OPTIQUE ---
    const sedimentaryImpact = ctx.flowTrend === 'Montée' ? 1 + (ctx.flowDerivative / 20) : 0.95;
    const rd = calculateRD(lux, ctx.turbidityNTU * sedimentaryImpact, species);
    
    const bonusMax = 1.5;
    const k_half = 2.0;
    const visualFactor = 1 + (bonusMax * (rd / (k_half + rd)));
    
    // --- 3. HYSTÉRÉSIS & MORPHOLOGIE ---
    let flowModifier = 1.0;
    const isFlood = ctx.flowIndex > 75;

    // [MORPHOLOGY CHECK] Si ce n'est pas une rivière, le "débit" est en fait le niveau/ruissellement
    // En étang, la montée des eaux est souvent bénéfique (accès aux bordures) pour tous, sauf eau boueuse
    const isRiver = ctx.morphoId === 'Z_RIVER';

    if (ctx.flowTrend === 'Montée') {
        if (species === 'Sandre') flowModifier = 1.35;
        if (species === 'Brochet') flowModifier = 0.60;
        if (species === 'Perche') flowModifier = 0.80;
        // [NEW] Bass: Aime l'eau qui monte (inondation des structures) si pas trop froide
        if (species === 'Black-Bass') flowModifier = isRiver ? 0.9 : 1.2; 
    } else if (ctx.flowTrend === 'Décrue') {
        if (species === 'Brochet') flowModifier = 1.30;
        if (species === 'Sandre') flowModifier = 1.0;
        if (species === 'Perche') flowModifier = 1.15;
        if (species === 'Black-Bass') flowModifier = 1.0;
    } else {
        if (species === 'Brochet' && !isFlood) flowModifier = 1.1;
    }

    // --- 4. FACTEURS PHYSIOLOGIQUES ---
    
    // [NEW] Configuration Bass
    let tRef = 0, tSigma = 0;
    
    if (species === 'Black-Bass') {
        tRef = 27; // Optimum chaud
        tSigma = 8; // Large plage de tolérance (20-30°C)
    } else {
        tRef = species === 'Brochet' ? 15 : (species === 'Sandre' ? 20 : 21);
        tSigma = species === 'Brochet' ? 6 : (species === 'Sandre' ? 5 : 7);
    }
    
    // Asymétrie Thermique (Tolérance hivernale pour Sandre/Perche)
    if (ctx.waterTemp < tRef && species !== 'Brochet' && species !== 'Black-Bass') {
        tSigma = tSigma * 1.5; 
    }
    
    const si_temp = Math.exp(-0.5 * Math.pow((ctx.waterTemp - tRef) / tSigma, 2));
    
    // Pression
    let si_baro = 1.0;
    if (species === 'Brochet') {
        si_baro = ctx.pressureTrend < -2 ? 1.2 : 1.0; 
    } else if (species === 'Black-Bass') {
        // [NEW] "Post-Frontal Blues" du Bass [cite: 1640]
        // Si Pression monte vite (>5hPa) ET Ciel dégagé (<20%) -> Catastrophe
        if (ctx.pressureTrend > 5 && ctx.cloudCover < 20) {
            si_baro = 0.4; // Malus sévère "Lockjaw"
        } else if (Math.abs(ctx.pressureTrend) < 2) {
            si_baro = 1.1; // Aime la stabilité
        } else {
            si_baro = 0.9;
        }
    } else {
        // Sandre/Perche
        si_baro = Math.max(0.4, 1 - (Math.abs(ctx.pressureTrend) / 12));
    }

    // Pénalité Courant (Seulement si Rivière !)
    // [MORPHOLOGY] En étang, pas de courant de nage, donc pas de pénalité métabolique liée au débit
    let metabolicPenalty = 1.0;
    if (isRiver) {
        const u_limit = U_CRIT[species] || 70;
        metabolicPenalty = 0.20 + (0.80 / (1 + Math.exp((ctx.flowIndex - u_limit) / 10)));
    }

    // --- 5. CALCUL FINAL ---
    
    let rawScore = 100 * si_temp * si_baro * (visualFactor / 1.5);
    rawScore = rawScore * flowModifier * metabolicPenalty * 1.2;
    
    if (ctx.waterTemp > 20) rawScore *= calculateOxygenFactor(ctx.dissolvedOxygen);
    if (species === 'Sandre') rawScore *= crep;

    const seasonalPotential = getSeasonalMetabolicPotential(ctx.date, species);
    
    // Soft Cap Logistique
    let finalScore = Math.min(100, Math.round(rawScore * seasonalPotential));
    if (finalScore > 80) {
        finalScore = 80 + (20 * (1 - Math.exp(-(finalScore - 80) / 15)));
    }
    if (finalScore < 5 && finalScore > 0.5) finalScore = 5;

    return Math.round(finalScore);
};

// --- 6. CLOUD FUNCTION PRINCIPALE ---

export const getHistoricalContext = onCall({ region: "europe-west1" }, async (request) => {
    const { weather, weatherHistory, location, dateStr, startTime, endTime } = request.data;
    if (!weather || !location || !weatherHistory) throw new HttpsError("invalid-argument", "Data missing.");

    let sessionDate = new Date(dateStr);
    
    if (startTime && endTime) {
        try {
            const [startH, startM] = startTime.split(':').map(Number);
            const [endH, endM] = endTime.split(':').map(Number);
            const medianTotal = Math.floor(((startH * 60) + startM + (endH * 60) + endM) / 2);
            sessionDate.setHours(Math.floor(medianTotal / 60), medianTotal % 60, 0, 0);
            logger.info(`Session Median Time: ${sessionDate.toISOString()}`);
        } catch (e) {
            logger.warn("Error calculating median time", e);
        }
    }

    const morpho = location.morphology;
    const morphoId = (morpho?.typeId || 'Z_RIVER') as MorphologyID;
    const bassin = (morpho?.bassin || 'URBAIN') as BassinType;
    const meanDepth = morpho?.meanDepth; // [NEW] Récupération explicite

    const targetTimestamp = sessionDate.getTime();
    const historyToUse = weatherHistory.filter((h: any) => new Date(h.date).getTime() <= targetTimestamp);
    if (historyToUse.length === 0) historyToUse.push(...weatherHistory);

    // [MORPHOLOGY] Passage de tous les paramètres morpho
    const Tw = solveAir2Water(historyToUse, morphoId, bassin, morpho?.depthId || 'Z_3_15', meanDepth);
    
    const { intensity, derivative, trend } = solveUltreiaFlow(historyToUse);
    
    const baseNTU = BASSIN_TURBIDITY_BASE[bassin] || 8.0;
    let NTU = baseNTU;
    const hourlyDecayFactor = Math.pow(1 - DAILY_DECAY, 1/24);

    historyToUse.forEach((hour: any) => {
        const r = hour.precipitation || hour.precip || 0;
        NTU = baseNTU + (NTU - baseNTU) * hourlyDecayFactor;
        if (r > 0.1) NTU += r * ALPHA_RAIN;
    });

    const P = weather.pressure || 1013;
    const wind = weather.windSpeed || 0;
    const DO = solveDissolvedOxygen(Tw, P, wind); 
    const wavesHs = calculateWaveHeight(wind, morpho?.surfaceArea, morpho?.shapeFactor);

    const lux = (function(d, c) {
        const h = d.getHours() + (d.getMinutes() / 60);
        const elev = Math.sin(Math.PI * (h - 7) / 12);
        return Math.max(0.025, elev * (1 - Math.pow(c / 100, 2)));
    })(sessionDate, weather.clouds || 0);
    
    const crep = (function(d) {
        const h = d.getHours() + (d.getMinutes() / 60);
        const p1 = Math.exp(-0.5 * Math.pow((h - 7.5) / 1.5, 2));
        const p2 = Math.exp(-0.5 * Math.pow((h - 19.5) / 1.5, 2));
        return 1.0 + (Math.max(p1, p2) * 0.4);
    })(sessionDate);

    let closestIdx = historyToUse.length - 1; 
    const currentPress = historyToUse[closestIdx]?.pressure || P;
    const prevPress = closestIdx >= 24 ? historyToUse[closestIdx - 24].pressure : historyToUse[0].pressure;
    const pressureTrend = currentPress - prevPress;

    const context: BioContext = {
        waterTemp: Tw, cloudCover: weather.clouds || 0, windSpeed: wind,
        pressureTrend: pressureTrend,
        turbidityNTU: NTU, dissolvedOxygen: DO, waveHeight: wavesHs,
        flowIndex: intensity, flowDerivative: derivative, flowTrend: trend, date: sessionDate,
        morphoId: morphoId // [NEW] Injection dans le contexte
    };

    const response: FullEnvironmentalSnapshot = {
        weather: { ...weather },
        hydro: {
            waterTemp: parseFloat(Tw.toFixed(1)),
            turbidityNTU: parseFloat(NTU.toFixed(1)),
            turbidityIdx: parseFloat(Math.min(1.0, NTU / 80).toFixed(2)),
            dissolvedOxygen: DO,
            waveHeight: wavesHs,
            flowRaw: Math.round(intensity) 
            
        },
        scores: {
            sandre: computeUltreiaScore('Sandre', context, lux, calculateOxygenFactor(DO), crep),
            brochet: computeUltreiaScore('Brochet', context, lux, calculateOxygenFactor(DO), crep),
            perche: computeUltreiaScore('Perche', context, lux, calculateOxygenFactor(DO), crep),
            blackbass: computeUltreiaScore('Black-Bass', context, lux, calculateOxygenFactor(DO), crep)
        },
        metadata: {
            calculationDate: new Date().toISOString(),
            calculationMode: 'ULTREIA_CALIBRATED' as any,
            flowStatus: trend,
            morphologyType: morphoId,
            sourceLogId: 'ultreia_hourly_45d'
        }
    };

    logger.info(`Ultreia v7.2 (Bass & Morpho). Bass: ${response.scores.blackbass}, Temp: ${Tw}°C, Morpho: ${morphoId}`);
    return response;
});