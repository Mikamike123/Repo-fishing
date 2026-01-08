// lib/bioScoreEngine.ts - Version 8.4 (High-Fidelity Biological Logic)

import { SpeciesType, MorphologyID } from '../types';

export interface BioContext {
    waterTemp: number;
    cloudCover: number;
    windSpeed: number;
    pressureTrend: number; // Delta sur 24h
    turbidityNTU: number;
    dissolvedOxygen: number;
    waveHeight: number;
    flowIndex: number;
    flowDerivative: number;
    flowTrend: 'Montée' | 'Décrue' | 'Stable';
    date?: Date;
    morphoId?: MorphologyID;
}

export interface BioScores {
    sandre: number;
    brochet: number;
    perche: number;
    blackbass: number;
}

// Seuils Critiques de Nage (U_CRIT) - Rapport A
const U_CRIT: Record<string, number> = { 
    'Sandre': 82, 
    'Brochet': 75, 
    'Perche': 68,
    'Black-Bass': 60
};

// Optima Thermiques et Sigma (Largeur de la courbe de Gauss)
const THERMAL_PROFILES: Record<string, { tRef: number; tSigma: number }> = {
    'Sandre':     { tRef: 22.0, tSigma: 4.5 },
    'Brochet':    { tRef: 18.0, tSigma: 6.0 },
    'Perche':     { tRef: 21.0, tSigma: 6.5 },
    'Black-Bass': { tRef: 26.0, tSigma: 7.5 }
};

export const calculateUniversalBioScores = (ctx: BioContext): BioScores => {
    const now = ctx.date || new Date();
    
    // 1. CALCUL DU LUX (Angle Solaire + Couverture Nuageuse)
    const h = now.getHours() + (now.getMinutes() / 60);
    const elev = Math.sin(Math.PI * (h - 7) / 12);
    const lux = Math.max(0.01, elev * (1 - Math.pow(ctx.cloudCover / 100, 1.5)));
    
    // 2. FACTEUR CRÉPUSCULAIRE (Fenêtre de chasse Sandre)
    const crep = (function(d) {
        const hour = d.getHours() + (d.getMinutes() / 60);
        // Pics à 7h30 et 19h30 (moyenne française)
        const p1 = Math.exp(-0.5 * Math.pow((hour - 7.5) / 1.2, 2));
        const p2 = Math.exp(-0.5 * Math.pow((hour - 19.5) / 1.2, 2));
        return 1.0 + (Math.max(p1, p2) * 0.5);
    })(now);

    return {
        sandre: computeUltreiaScore('Sandre', ctx, lux, crep),
        brochet: computeUltreiaScore('Brochet', ctx, lux, crep),
        perche: computeUltreiaScore('Perche', ctx, lux, crep),
        blackbass: computeUltreiaScore('Black-Bass', ctx, lux, crep)
    };
};

/**
 * Distance de Réaction (Michaelis-Menten) - Influence Optique
 */
const calculateRD = (lux: number, ntu: number, species: string): number => {
    const params: Record<string, { rdMax: number; kL: number; kNTU: number }> = {
        'Brochet':    { rdMax: 7.0, kL: 0.15, kNTU: 0.06 },  // Très visuel, pénalisé par NTU
        'Sandre':     { rdMax: 4.0, kL: 0.04, kNTU: 0.02 },  // Lucifuge, performant en turbide
        'Perche':     { rdMax: 4.5, kL: 0.10, kNTU: 0.035 }, // Équilibré
        'Black-Bass': { rdMax: 5.0, kL: 0.18, kNTU: 0.045 }  // Chasseur à vue
    };
    const p = params[species];
    return p.rdMax * (lux / (p.kL + lux)) * Math.exp(-p.kNTU * ntu);
};

/**
 * Potentiel Métabolique Saisonnier
 */
const getSeasonalMetabolicPotential = (date: Date, species: string): number => {
    const month = date.getMonth(); 
    if (species === 'Black-Bass') {
        if (month >= 11 || month <= 2) return 0.25; // Hivernage profond
        if (month >= 5 && month <= 8) return 1.0;
        return 0.65;
    }
    // Brochet très actif au printemps/automne
    if (species === 'Brochet' && (month === 3 || month === 4 || month === 9 || month === 10)) return 1.0;
    
    if (month >= 11 || month <= 2) return 0.75; 
    return 0.95; 
};

/**
 * LE MOTEUR CENTRAL (ULTREIA ENGINE v8.4)
 */
const computeUltreiaScore = (species: string, ctx: BioContext, lux: number, crep: number): number => {
    
    // --- 1. VETO THERMIQUE (Rapport A) ---
    if (species === 'Brochet' && ctx.waterTemp > 23.5) return 5;
    if (species === 'Sandre' && ctx.waterTemp > 26.5) return 8;
    if (species === 'Perche' && ctx.waterTemp > 28.5) return 12;
    if (species === 'Black-Bass' && ctx.waterTemp < 7.5) return 5;

    // --- 2. FACTEUR OXYGÈNE (Espèce-Dépendant) ---
    const oxyF = (function(doMgL, sp) {
        const threshold = sp === 'Sandre' ? 5.5 : 4.5;
        if (doMgL >= threshold + 2) return 1.0;
        if (doMgL <= threshold - 1) return 0.1;
        return 0.1 + (doMgL - (threshold - 1)) * 0.3;
    })(ctx.dissolvedOxygen, species);

    // --- 3. OPTIQUE & TURBIDITÉ ---
    // Impact sédimentaire accru en montée d'eau
    const sedimentaryImpact = ctx.flowTrend === 'Montée' ? 1 + (ctx.flowDerivative / 15) : 0.98;
    const rd = calculateRD(lux, ctx.turbidityNTU * sedimentaryImpact, species);
    
    // Facteur Visuel (Michaelis-Menten normalisé)
    const bonusMax = 1.4;
    const k_half = 2.2;
    const visualFactor = 1 + (bonusMax * (rd / (k_half + rd)));

    // --- 4. HYDRO-DYNAMIQUE ---
    let flowModifier = 1.0;
    const isRiver = ctx.morphoId === 'Z_RIVER' || ctx.morphoId === 'Z_MED';

    if (isRiver) {
        if (ctx.flowTrend === 'Montée') {
            flowModifier = species === 'Sandre' ? 1.4 : (species === 'Brochet' ? 0.6 : 0.85);
        } else if (ctx.flowTrend === 'Décrue') {
            flowModifier = species === 'Brochet' ? 1.35 : 1.1;
        }
    }

    // --- 5. PHYSIOLOGIE (Température & Pression) ---
    const profile = THERMAL_PROFILES[species];
    let currentSigma = profile.tSigma;

    // Asymétrie thermique (On tolère mieux le froid que le chaud)
    if (ctx.waterTemp < profile.tRef) currentSigma *= 1.4;

    const si_temp = Math.exp(-0.5 * Math.pow((ctx.waterTemp - profile.tRef) / currentSigma, 2));

    // Pression Atmosphérique (Physoclistes vs Physostomes)
    let si_baro = 1.0;
    if (species === 'Brochet') {
        si_baro = ctx.pressureTrend < -2.5 ? 1.25 : 1.0; // Le Brochet adore les baisses de pression
    } else if (species === 'Black-Bass') {
        if (ctx.pressureTrend > 4 && ctx.cloudCover < 25) si_baro = 0.45; // Post-frontal blues
        else si_baro = Math.abs(ctx.pressureTrend) < 2 ? 1.15 : 0.95;
    } else {
        // Sandre & Perche (Sensibles à la variation brutale de profondeur/pression)
        si_baro = Math.max(0.4, 1 - (Math.abs(ctx.pressureTrend) / 14));
    }

    // --- 6. PÉNALITÉ DE COURANT (Métabolisme) ---
    let metabolicPenalty = 1.0;
    if (isRiver) {
        const u_limit = U_CRIT[species] || 70;
        metabolicPenalty = 0.25 + (0.75 / (1 + Math.exp((ctx.flowIndex - u_limit) / 8)));
    }

    // --- 7. CALCUL FINAL ---
    let rawScore = 100 * si_temp * si_baro * (visualFactor / 1.4);
    
    // Application des multiplicateurs
    rawScore = rawScore * flowModifier * metabolicPenalty * 1.25; // 1.25 Base Boost

    // Application de l'Oxygène si eau chaude
    if (ctx.waterTemp > 19) rawScore *= oxyF;
    
    // Bonus Sandre Lucifuge
    if (species === 'Sandre') rawScore *= crep;

    const seasonalPotential = getSeasonalMetabolicPotential(ctx.date || new Date(), species);
    
    // Soft Cap Logistique (Évite les scores bloqués à 100)
    let finalScore = rawScore * seasonalPotential;
    if (finalScore > 85) {
        finalScore = 85 + (15 * (1 - Math.exp(-(finalScore - 85) / 12)));
    }

    // Protection plancher
    if (finalScore < 5 && finalScore > 0.8) finalScore = 5;

    return Math.round(Math.max(0, Math.min(100, finalScore)));
};