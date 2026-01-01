// lib/bioScoreEngine.ts - Version 7.2 (Strict Backend Mirror)

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
    morphoId?: MorphologyID; // [NOUVEAU] Pour distinction Rivière/Étang
}

export interface BioScores {
    sandre: number;
    brochet: number;
    perche: number;
    blackbass: number;
}

// [Mise à jour v7.2] Ajout du Bass
const U_CRIT: Record<string, number> = { 
    'Sandre': 82, 
    'Brochet': 75, 
    'Perche': 68,
    'Black-Bass': 60
};

export const calculateUniversalBioScores = (ctx: BioContext): BioScores => {
    const now = ctx.date || new Date();
    // Formule Lux alignée backend
    const h = now.getHours() + (now.getMinutes() / 60);
    const elev = Math.sin(Math.PI * (h - 7) / 12);
    const lux = Math.max(0.025, elev * (1 - Math.pow(ctx.cloudCover / 100, 2)));
    
    const oxyF = (function(doMgL) {
        if (doMgL >= 6.5) return 1.0;
        if (doMgL <= 3.5) return 0.05;
        return 0.05 + (doMgL - 3.5) * 0.31;
    })(ctx.dissolvedOxygen);

    const crep = (function(d) {
        const hour = d.getHours() + (d.getMinutes() / 60);
        const p1 = Math.exp(-0.5 * Math.pow((hour - 7.5) / 1.5, 2));
        const p2 = Math.exp(-0.5 * Math.pow((hour - 19.5) / 1.5, 2));
        return 1.0 + (Math.max(p1, p2) * 0.4);
    })(now);

    return {
        sandre: computeUltreiaScore('Sandre', ctx, lux, oxyF, crep),
        brochet: computeUltreiaScore('Brochet', ctx, lux, oxyF, crep),
        perche: computeUltreiaScore('Perche', ctx, lux, oxyF, crep),
        blackbass: computeUltreiaScore('Black-Bass', ctx, lux, oxyF, crep) // [NOUVEAU] Calcul réel
    };
};

const calculateRD = (lux: number, ntu: number, species: string): number => {
    const params: any = {
        'Brochet': { rdMax: 6.5, kL: 0.12, kNTU: 0.05 },
        'Sandre':  { rdMax: 4.0, kL: 0.05, kNTU: 0.03 },
        'Perche':  { rdMax: 4.0, kL: 0.08, kNTU: 0.035 },
        'Black-Bass': { rdMax: 4.5, kL: 0.20, kNTU: 0.04 } // [NOUVEAU]
    };
    const p = params[species] || { rdMax: 3.0, kL: 0.20, kNTU: 0.05 };
    return p.rdMax * (lux / (p.kL + lux || 0.01)) * Math.exp(-p.kNTU * ntu);
};

// [NOUVEAU] Fonction de normalisation saisonnière
const getSeasonalMetabolicPotential = (date: Date, species: string): number => {
    const month = date.getMonth(); 
    
    // Logique Bass Hivernal
    if (species === 'Black-Bass') {
        if (month >= 11 || month <= 2) return 0.20; // Hiver: Léthargie
        if (month >= 5 && month <= 8) return 1.0;   // Été: Pleine puissance
        return 0.60;
    }

    if (month >= 11 || month <= 2) { 
        return species === 'Brochet' ? 0.85 : 0.70; 
    }
    if (month >= 5 && month <= 8) { 
        return 1.0; 
    }
    return 0.90; 
};

// [REFONTE COMPLETE v7.2] Aligné avec historical.ts
const computeUltreiaScore = (species: string, ctx: BioContext, lux: number, oxyF: number, crep: number): number => {
    
    // 1. VETO THERMIQUE STRICT
    if (species === 'Brochet' && ctx.waterTemp > 23.5) return 5;
    if (species === 'Sandre' && ctx.waterTemp > 26.0) return 10;
    if (species === 'Perche' && ctx.waterTemp > 28.0) return 15;
    if (species === 'Black-Bass' && ctx.waterTemp < 8.0) return 5;

    // 2. OPTIQUE (Michaelis-Menten)
    const sedimentaryImpact = ctx.flowTrend === 'Montée' ? 1 + (ctx.flowDerivative / 20) : 0.95;
    const rd = calculateRD(lux, ctx.turbidityNTU * sedimentaryImpact, species);
    
    const bonusMax = 1.5;
    const k_half = 2.0;
    const visualFactor = 1 + (bonusMax * (rd / (k_half + rd)));

    // 3. HYSTÉRÉSIS & MORPHOLOGIE
    let flowModifier = 1.0;
    const isFlood = ctx.flowIndex > 75;
    const isRiver = ctx.morphoId === 'Z_RIVER'; // Défaut false si undefined

    if (ctx.flowTrend === 'Montée') {
        if (species === 'Sandre') flowModifier = 1.35;
        if (species === 'Brochet') flowModifier = 0.60;
        if (species === 'Perche') flowModifier = 0.80;
        if (species === 'Black-Bass') flowModifier = isRiver ? 0.9 : 1.2; 
    } else if (ctx.flowTrend === 'Décrue') {
        if (species === 'Brochet') flowModifier = 1.30;
        if (species === 'Sandre') flowModifier = 1.0;
        if (species === 'Perche') flowModifier = 1.15;
        if (species === 'Black-Bass') flowModifier = 1.0;
    } else {
        if (species === 'Brochet' && !isFlood) flowModifier = 1.1;
    }

    // 4. FACTEURS PHYSIOLOGIQUES
    let tRef = 0, tSigma = 0;
    
    if (species === 'Black-Bass') {
        tRef = 27; 
        tSigma = 8;
    } else {
        tRef = species === 'Brochet' ? 15 : (species === 'Sandre' ? 20 : 21);
        tSigma = species === 'Brochet' ? 6 : (species === 'Sandre' ? 5 : 7);
    }
    
    // Asymétrie Thermique (Tolérance hivernale)
    if (ctx.waterTemp < tRef && species !== 'Brochet' && species !== 'Black-Bass') {
        tSigma = tSigma * 1.5; 
    }
    
    const si_temp = Math.exp(-0.5 * Math.pow((ctx.waterTemp - tRef) / tSigma, 2));

    // Pression
    let si_baro = 1.0;
    if (species === 'Brochet') {
        si_baro = ctx.pressureTrend < -2 ? 1.2 : 1.0; 
    } else if (species === 'Black-Bass') {
        // Post-Frontal Blues
        if (ctx.pressureTrend > 5 && ctx.cloudCover < 20) {
            si_baro = 0.4; 
        } else if (Math.abs(ctx.pressureTrend) < 2) {
            si_baro = 1.1;
        } else {
            si_baro = 0.9;
        }
    } else {
        // Physocliste
        si_baro = Math.max(0.4, 1 - (Math.abs(ctx.pressureTrend) / 12));
    }

    // Pénalité Courant (Seulement si Rivière)
    let metabolicPenalty = 1.0;
    if (isRiver) {
        const u_limit = U_CRIT[species] || 70;
        metabolicPenalty = 0.20 + (0.80 / (1 + Math.exp((ctx.flowIndex - u_limit) / 10)));
    }

    let dynamicBoost = 1.0; // Simplifié car intégré dans flowModifier ci-dessus pour la v7.2
    if (species === 'Brochet') {
        dynamicBoost *= Math.exp(-ctx.flowIndex / 250);
    }

    // 5. CALCUL FINAL
    let rawScore = 100 * si_temp * si_baro * (visualFactor / 1.5);
    rawScore = rawScore * flowModifier * metabolicPenalty * 1.2 * dynamicBoost; // 1.2 Base Boost

    if (ctx.waterTemp > 20) rawScore *= oxyF;
    if (species === 'Sandre') rawScore *= crep;

    const seasonalPotential = getSeasonalMetabolicPotential(ctx.date || new Date(), species);
    
    // Soft Cap Logistique
    let finalScore = Math.min(100, Math.round(rawScore * seasonalPotential));
    if (finalScore > 80) {
        finalScore = 80 + (20 * (1 - Math.exp(-(finalScore - 80) / 15)));
    }
    if (finalScore < 5 && finalScore > 0.5) finalScore = 5;

    return Math.round(finalScore);
};