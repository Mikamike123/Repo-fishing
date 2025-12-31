// bioScoreEngine.ts - Version 5.4 (Alignement Intégral Ultreia Backend)

import { SpeciesType } from '../types';

// --- INTERFACES ---
export interface BioContext {
    waterTemp: number;      // °C (Tw)
    cloudCover: number;     // % (Pour le calcul du Lux)
    windSpeed: number;      // km/h
    pressureTrend: number;  // hPa (Variation ΔP sur 3h ou 24h)
    turbidityNTU: number;   // Valeur réelle en NTU
    dissolvedOxygen: number;// mg/L
    waveHeight: number;     // Hs en cm pour le Walleye Chop
    // Nouveaux champs pour alignement Backend v6.2
    flowIndex?: number;     // Intensité du flux (0-100)
    flowDerivative?: number;// Tendance (Montée/Décrue)
    flowTrend?: 'Montée' | 'Décrue' | 'Stable';
    date?: Date;            
}

export interface BioScores {
    sandre: number;
    brochet: number;
    perche: number;
    blackbass: number;
}

// Constantes critiques issues du backend
const U_CRIT: Record<string, number> = {
    'Sandre': 82,
    'Brochet': 75,
    'Perche': 68 
};

// --- MOTEUR DE CALCUL (v5.4 - ALIGNÉ) ---

export const calculateUniversalBioScores = (ctx: BioContext): BioScores => {
    const now = ctx.date || new Date();
    const lux = calculateLux(now, ctx.cloudCover);
    const oxyF = calculateOxygenFactor(ctx.dissolvedOxygen);
    const crepFactor = calculateCrepuscularFactor(now);

    return {
        sandre: computeSandreScore(ctx, lux, oxyF, crepFactor),
        brochet: computeBrochetScore(ctx, lux, oxyF, crepFactor),
        perche: computePercheScore(ctx, lux, oxyF, crepFactor),
        blackbass: computeBlackBassScore(ctx, lux, oxyF, crepFactor)
    };
};

/**
 * HELPER : Crepuscular Factor (Γ)
 * Aligné sur la logique "crep" du backend.
 */
const calculateCrepuscularFactor = (date: Date): number => {
    const hour = date.getHours() + (date.getMinutes() / 60);
    const morningPeak = Math.exp(-0.5 * Math.pow((hour - 7.5) / 1.5, 2));
    const eveningPeak = Math.exp(-0.5 * Math.pow((hour - 19.5) / 1.5, 2));
    return 1.0 + (Math.max(morningPeak, eveningPeak) * 0.4);
};

/**
 * HELPER CENTRAL : Reaction Distance (RD)
 * Paramètres strictement alignés sur historical.ts v6.2
 */
const calculateRD = (lux: number, ntu: number, species: SpeciesType): number => {
    const params: Record<string, { rdMax: number, kL: number, kNTU: number }> = {
        'Brochet': { rdMax: 6.5, kL: 0.12, kNTU: 0.05 },
        'Sandre':  { rdMax: 4.0, kL: 0.05, kNTU: 0.03 },
        'Perche':  { rdMax: 4.0, kL: 0.08, kNTU: 0.035 },
        'Black-Bass': { rdMax: 4.5, kL: 0.20, kNTU: 0.05 },
        'Inconnu': { rdMax: 3.0, kL: 0.20, kNTU: 0.05 }
    };

    const p = params[species] || params['Inconnu'];
    const lightFactor = lux / (p.kL + lux || 0.01);
    const opticFactor = Math.exp(-p.kNTU * ntu);
    
    return p.rdMax * lightFactor * opticFactor;
};

/**
 * HELPER : Pénalité métabolique liée au débit (Nouveau)
 */
const calculateMetabolicPenalty = (species: string, flowIndex: number = 15): number => {
    const u_limit = U_CRIT[species] || 70;
    return 0.20 + (0.80 / (1 + Math.exp((flowIndex - u_limit) / 12)));
};

// 1. SANDRE (Zander)
const computeSandreScore = (ctx: BioContext, lux: number, oxyF: number, crep: number): number => {
    const si_temp = Math.exp(-0.5 * Math.pow((ctx.waterTemp - 21) / 5, 2));
    const rd = calculateRD(lux, ctx.turbidityNTU, 'Sandre');
    const si_baro = Math.max(0.4, 1 - (Math.abs(ctx.pressureTrend) / 15));
    
    const metabolicPenalty = calculateMetabolicPenalty('Sandre', ctx.flowIndex);
    
    let dynamicBoost = 1.0;
    if (ctx.flowTrend === 'Montée') dynamicBoost = 1.35;

    let si_light = 1.0;
    if (lux > 0.6) si_light = 1.0 - (lux - 0.6) * 0.8;
    if (ctx.waveHeight > 10) si_light = Math.max(si_light, 0.85);

    const score = 100 * Math.pow(si_baro, 0.3) * Math.pow(si_temp, 0.4) * (rd / 3.0);
    return Math.min(100, Math.round(score * si_light * metabolicPenalty * dynamicBoost * oxyF * crep * 1.8));
};

// 2. BROCHET (Pike)
const computeBrochetScore = (ctx: BioContext, lux: number, oxyF: number, crep: number): number => {
    if (ctx.waterTemp > 24.5) return 0;
    const si_temp = Math.exp(-0.5 * Math.pow((ctx.waterTemp - 16) / 8, 2));
    const rd = calculateRD(lux, ctx.turbidityNTU, 'Brochet');
    const si_baro = Math.max(0.4, 1 - (Math.abs(ctx.pressureTrend) / 15));

    const metabolicPenalty = calculateMetabolicPenalty('Brochet', ctx.flowIndex);
    
    let dynamicBoost = 1.0;
    if (ctx.flowTrend === 'Montée') {
        dynamicBoost = 1.80 * Math.exp(-(ctx.flowIndex || 15) / 250);
    }

    const score = 100 * Math.pow(si_baro, 0.3) * Math.pow(si_temp, 0.4) * (rd / 3.0);
    return Math.min(100, Math.round(score * metabolicPenalty * dynamicBoost * oxyF * crep * 1.8));
};

// 3. PERCHE (Perch)
const computePercheScore = (ctx: BioContext, lux: number, oxyF: number, crep: number): number => {
    const si_temp = Math.exp(-0.5 * Math.pow((ctx.waterTemp - 20) / 7, 2));
    const si_baro = Math.max(0.4, 1 - (Math.abs(ctx.pressureTrend) / 15));
    const rd = calculateRD(lux, ctx.turbidityNTU, 'Perche');
    
    const metabolicPenalty = calculateMetabolicPenalty('Perche', ctx.flowIndex);
    
    let dynamicBoost = 1.0;
    if (ctx.flowTrend === 'Montée') dynamicBoost = 1.25;
    else if (ctx.flowTrend === 'Décrue') dynamicBoost = 1.20;

    const si_light = (lux > 0.2 && lux < 0.7) ? 1.2 : 0.8;

    const score = 100 * Math.pow(si_baro, 0.3) * Math.pow(si_temp, 0.4) * (rd / 3.0);
    return Math.min(100, Math.round(score * metabolicPenalty * dynamicBoost * oxyF * si_light * crep * 1.8));
};

// 4. BLACK-BASS (Bass) - Conservé & Optimisé
const computeBlackBassScore = (ctx: BioContext, lux: number, oxyF: number, crep: number): number => {
    const si_temp = Math.exp(-0.5 * Math.pow((ctx.waterTemp - 26) / 9, 2));
    let si_baro = Math.exp(-1.2 * Math.abs(ctx.pressureTrend));
    if (ctx.pressureTrend > 2.5 && lux > 0.85) si_baro *= 0.25;

    const rd = calculateRD(lux, ctx.turbidityNTU, 'Black-Bass');

    const score = 100 * Math.pow(si_temp, 0.5) * Math.pow(si_baro, 0.3) * (rd / 3.0);
    return Math.min(100, Math.round(score * oxyF * crep * 1.8));
};

// --- HELPERS ---

function calculateOxygenFactor(doMgL: number): number {
    if (doMgL >= 6.5) return 1.0;
    if (doMgL <= 3.5) return 0.05;
    return 0.05 + (doMgL - 3.5) * 0.31;
}

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
        
        if (hour < rise - 0.5 || hour > set + 0.5) return 0.01; 
        const elev = Math.sin(Math.PI * (hour - rise) / (set - rise));
        const cloudFactor = 1 - Math.pow(cloudCover / 100, 3);
        return Math.max(0.01, elev * cloudFactor);
    } catch { return 0.5; }
}