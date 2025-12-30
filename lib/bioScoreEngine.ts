// bioScoreEngine.ts - Version 5.3 (Coup du Matin & Behavioral Stealth)

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
    date?: Date;            
}

export interface BioScores {
    sandre: number;
    brochet: number;
    perche: number;
    blackbass: number;
}

// --- MOTEUR DE CALCUL (v5.3 - COMPORTEMENTAL) ---

export const calculateUniversalBioScores = (ctx: BioContext): BioScores => {
    const now = ctx.date || new Date();
    const lux = calculateLux(now, ctx.cloudCover);
    const oxyF = calculateOxygenFactor(ctx.dissolvedOxygen);
    
    // [NOUVEAU v5.3] Facteur Comportemental (Aube/Crépuscule)
    // Simule l'avantage optique du prédateur lors des transitions lumineuses.
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
 * Cible les fenêtres d'activité intense indépendantes de la météo pure.
 */
const calculateCrepuscularFactor = (date: Date): number => {
    const hour = date.getHours() + (date.getMinutes() / 60);
    // On définit deux cloches d'activité (Matin ~7h30, Soir ~19h30)
    const morningPeak = Math.exp(-0.5 * Math.pow((hour - 7.5) / 1.5, 2));
    const eveningPeak = Math.exp(-0.5 * Math.pow((hour - 19.5) / 1.5, 2));
    
    // Bonus de 40% durant ces fenêtres d'opportunité
    return 1.0 + (Math.max(morningPeak, eveningPeak) * 0.4);
};

/**
 * HELPER CENTRAL v5.0 : Reaction Distance (RD)
 * [Modèle Michaelis-Menten]
 */
const calculateRD = (lux: number, ntu: number, species: SpeciesType): number => {
    const params = {
        'Brochet': { rdMax: 6.0, kL: 0.25, kNTU: 0.08 },
        'Sandre':  { rdMax: 4.0, kL: 0.05, kNTU: 0.03 },
        'Perche':  { rdMax: 4.0, kL: 0.12, kNTU: 0.05 }, // Boosté en v5.3
        'Black-Bass': { rdMax: 4.5, kL: 0.20, kNTU: 0.05 },
        'Inconnu': { rdMax: 3.0, kL: 0.20, kNTU: 0.05 }
    };

    const p = params[species as keyof typeof params] || params['Inconnu'];
    const lightFactor = lux / (p.kL + lux || 0.01);
    const opticFactor = Math.exp(-p.kNTU * ntu);
    
    return p.rdMax * lightFactor * opticFactor;
};

// 1. SANDRE (Zander) - Le Vampire lucifuge
const computeSandreScore = (ctx: BioContext, lux: number, oxyF: number, crep: number): number => {
    const si_temp = Math.exp(-0.5 * Math.pow((ctx.waterTemp - 21) / 5, 2));
    const rd = calculateRD(lux, ctx.turbidityNTU, 'Sandre');
    const si_optic = Math.exp(-0.5 * Math.pow((rd - 1.8) / 1.2, 2));
    const si_baro = Math.max(0.4, 1 - (Math.abs(ctx.pressureTrend) / 16.6));

    // [v5.3] Malus Soleil Direct : Le Sandre fuit la lumière forte
    let si_light = 1.0;
    if (lux > 0.6) {
        si_light = 1.0 - (lux - 0.6) * 0.8; // Chute du score par grand soleil
    }

    // Le Walleye Chop réduit l'inconfort lumineux
    const bonusMec = ctx.waveHeight > 10 ? 1.3 : 1.0;
    if (ctx.waveHeight > 10) si_light = Math.max(si_light, 0.85);

    let score = 100 * Math.pow(si_baro, 0.3) * Math.pow(si_optic, 0.4) * Math.pow(si_temp, 0.3);
    // On applique le facteur crépusculaire massif pour le Sandre
    return Math.min(Math.round(score * si_light * bonusMec * oxyF * crep), 100);
};

// 2. BROCHET (Pike) - Le chasseur d'embuscade
const computeBrochetScore = (ctx: BioContext, lux: number, oxyF: number, crep: number): number => {
    if (ctx.waterTemp > 24.5) return 0;
    const si_temp = Math.exp(-0.5 * Math.pow((ctx.waterTemp - 16) / 8, 2));
    const rd = calculateRD(lux, ctx.turbidityNTU, 'Brochet');
    const si_optic = rd / 3.5; 
    const si_baro = 1.0 - (ctx.pressureTrend / 12); 

    let score = 100 * Math.pow(si_temp, 0.4) * Math.pow(si_optic, 0.4) * Math.pow(si_baro, 0.2);
    return Math.min(Math.round(score * oxyF * crep), 100);
};

// 3. PERCHE (Perch) - L'opportuniste des transitions
const computePercheScore = (ctx: BioContext, lux: number, oxyF: number, crep: number): number => {
    const si_temp = Math.exp(-0.5 * Math.pow((ctx.waterTemp - 20) / 7, 2));
    const si_baro = Math.max(0.3, 1 - (Math.abs(ctx.pressureTrend) / 14));
    const rd = calculateRD(lux, ctx.turbidityNTU, 'Perche');
    
    // [v5.3] La Perche préfère les lumières diffuses (temps couvert ou aube/soir)
    const si_light = (lux > 0.2 && lux < 0.7) ? 1.2 : 0.8;

    let score = 100 * Math.pow(si_temp, 0.4) * Math.pow(si_baro, 0.3) * (rd / 2.5);
    return Math.min(Math.round(score * oxyF * si_light * crep), 100);
};

// 4. BLACK-BASS (Bass) - Le thermophile du matin
const computeBlackBassScore = (ctx: BioContext, lux: number, oxyF: number, crep: number): number => {
    const si_temp = Math.exp(-0.5 * Math.pow((ctx.waterTemp - 26) / 9, 2));
    let si_baro = Math.exp(-1.2 * Math.abs(ctx.pressureTrend));
    if (ctx.pressureTrend > 2.5 && lux > 0.85) si_baro *= 0.25;

    const rd = calculateRD(lux, ctx.turbidityNTU, 'Black-Bass');

    let score = 100 * Math.pow(si_temp, 0.5) * Math.pow(si_baro, 0.3) * (rd / 3.0);
    return Math.min(Math.round(score * oxyF * crep), 100);
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