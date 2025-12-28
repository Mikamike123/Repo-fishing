// bioScoreEngine.ts - Version 4.8 (Alignement Scientifique Zéro-Hydro)

import { SpeciesType } from '../types';

// --- INTERFACES ---
export interface BioContext {
    waterTemp: number;      // °C (Tw)
    cloudCover: number;     // % (Pour le calcul du Lux)
    windSpeed: number;      // km/h
    pressureTrend: number;  // hPa (Variation ΔP sur 3h ou 24h)
    turbidityNTU: number;   // [DOC] Valeur réelle en NTU pour les formules sigmoïdes
    dissolvedOxygen: number;// mg/L
    waveHeight: number;     // [AJOUT DOC 1.3] Hs en cm pour le Walleye Chop
    date?: Date;            
}

export interface BioScores {
    sandre: number;
    brochet: number;
    perche: number;
    blackbass: number;
}

// --- MOTEUR DE CALCUL (ALIGNÉ SUR SPEC PARTIE V) ---

export const calculateUniversalBioScores = (ctx: BioContext): BioScores => {
    const lux = calculateLux(ctx.date || new Date(), ctx.cloudCover);
    const oxyF = calculateOxygenFactor(ctx.dissolvedOxygen);

    return {
        sandre: computeSandreScore(ctx, lux, oxyF),
        brochet: computeBrochetScore(ctx, oxyF),
        perche: computePercheScore(ctx, oxyF),
        blackbass: computeBlackBassScore(ctx, lux, oxyF)
    };
};

// 1. SANDRE (Zander)
const computeSandreScore = (ctx: BioContext, lux: number, oxyF: number): number => {
    const si_temp = Math.exp(-0.5 * Math.pow((ctx.waterTemp - 22) / 5, 2));
    const si_optic = Math.exp(-0.5 * Math.pow((ctx.turbidityNTU - 25) / 15, 2));
    
    // [FLUIDIFICATION] Remplace les paliers par une fonction linéaire continue [SPEC 134]
    // SI_baro décroît progressivement de 1.0 à 0.4 entre 0 et 10 hPa d'instabilité
    const si_baro = Math.max(0.4, 1 - (Math.abs(ctx.pressureTrend) / 16.6));

    const bonusMec = ctx.waveHeight > 15 ? 1.2 : 1.0;
    let score = 100 * Math.pow(si_baro, 0.4) * Math.pow(si_optic, 0.4) * Math.pow(si_temp, 0.2);
    score = score * bonusMec * Math.pow(oxyF, 0.5);
    return Math.min(Math.round(score), 100);
};

// 2. BROCHET (Pike)
const computeBrochetScore = (ctx: BioContext, oxyF: number): number => {
    if (ctx.waterTemp > 24.0) return 0;
    const si_temp = Math.exp(-0.5 * Math.pow((ctx.waterTemp - 16) / 8, 2));
    const si_optic = 1 / (1 + Math.exp(0.5 * (ctx.turbidityNTU - 12)));
    
    // [FLUIDIFICATION] Bonus/Malus continu (Bonus si dP < 0, Malus si dP > 0) [SPEC 167]
    const si_baro = 1.0 - (ctx.pressureTrend / 15); 

    let score = 100 * Math.pow(si_temp, 0.5) * Math.pow(si_optic, 0.3) * Math.pow(si_baro, 0.2);
    return Math.min(Math.round(score * oxyF), 100);
};

// 3. PERCHE (Perch)
const computePercheScore = (ctx: BioContext, oxyF: number): number => {
    const si_temp = Math.exp(-0.5 * Math.pow((ctx.waterTemp - 20) / 8, 2));
    // [FLUIDIFICATION] Identique Sandre pour la stabilité
    const si_baro = Math.max(0.4, 1 - (Math.abs(ctx.pressureTrend) / 16.6));
    const si_optic = 1 / (1 + Math.exp(0.3 * (ctx.turbidityNTU - 25)));

    let score = 100 * Math.pow(si_temp, 0.5) * Math.pow(si_baro, 0.5) * si_optic;
    return Math.min(Math.round(score * Math.pow(oxyF, 0.8)), 100);
};

// 4. BLACK-BASS (Bass)
const computeBlackBassScore = (ctx: BioContext, lux: number, oxyF: number): number => {
    const si_temp = Math.exp(-0.5 * Math.pow((ctx.waterTemp - 27) / 10, 2));
    let si_baro = Math.exp(-1.5 * Math.abs(ctx.pressureTrend));
    if (ctx.pressureTrend > 3 && lux > 0.8) si_baro *= 0.3;

    let score = 100 * Math.pow(si_temp, 0.6) * Math.pow(si_baro, 0.4);
    return Math.min(Math.round(score * oxyF), 100);
};

// --- HELPERS ---

function calculateOxygenFactor(doMgL: number): number {
    if (doMgL >= 6) return 1.0;
    if (doMgL <= 3) return 0.1; // Seuil létal / inactivité
    return 0.1 + (doMgL - 3) * 0.3; // Interpolation 3-6mg/L
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
        if (hour < rise || hour > set) return 0;
        const elev = Math.sin(Math.PI * (hour - rise) / (set - rise));
        // Atténuation cubique selon SPEC 215 (N^3)
        const cloudFactor = 1 - Math.pow(cloudCover / 100, 3);
        return Math.max(0, elev * cloudFactor);
    } catch { return 0.5; }
}