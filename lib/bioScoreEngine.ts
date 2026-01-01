// lib/bioScoreEngine.ts - Version 7.1 (Strict Backend Alignment)

import { SpeciesType } from '../types';

export interface BioContext {
    waterTemp: number;
    cloudCover: number;
    windSpeed: number;
    pressureTrend: number; // DOIT ÊTRE UN DELTA SUR 24H
    turbidityNTU: number;
    dissolvedOxygen: number;
    waveHeight: number;
    flowIndex: number;
    flowDerivative: number;
    flowTrend: 'Montée' | 'Décrue' | 'Stable';
    date?: Date;            
}

export interface BioScores {
    sandre: number;
    brochet: number;
    perche: number;
    blackbass: number;
}

const U_CRIT: Record<string, number> = { 'Sandre': 82, 'Brochet': 75, 'Perche': 68 };

export const calculateUniversalBioScores = (ctx: BioContext): BioScores => {
    const now = ctx.date || new Date();
    // Utilisation de la formule Lux simplifiée du backend pour éviter les écarts
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
        blackbass: 20 // Aligné sur le fix backend v6.2
    };
};

const calculateRD = (lux: number, ntu: number, species: string): number => {
    const params: any = {
        'Brochet': { rdMax: 6.5, kL: 0.12, kNTU: 0.05 },
        'Sandre':  { rdMax: 4.0, kL: 0.05, kNTU: 0.03 },
        'Perche':  { rdMax: 4.0, kL: 0.08, kNTU: 0.035 }
    };
    const p = params[species] || { rdMax: 3.0, kL: 0.20, kNTU: 0.05 };
    return p.rdMax * (lux / (p.kL + lux || 0.01)) * Math.exp(-p.kNTU * ntu);
};

const computeUltreiaScore = (species: string, ctx: BioContext, lux: number, oxyF: number, crep: number): number => {
    const sedimentaryImpact = ctx.flowTrend === 'Montée' ? 1 + (ctx.flowDerivative / 20) : 0.95;
    const rd = calculateRD(lux, ctx.turbidityNTU * sedimentaryImpact, species);
    
    const tRef = species === 'Brochet' ? 16 : (species === 'Sandre' ? 21 : 20);
    const tSigma = species === 'Brochet' ? 8 : (species === 'Sandre' ? 5 : 7);
    const si_temp = Math.exp(-0.5 * Math.pow((ctx.waterTemp - tRef) / tSigma, 2));
    
    // Crucial : La tendance de pression doit être sur 24h pour que ce Math.abs soit significatif
    const si_baro = Math.max(0.4, 1 - (Math.abs(ctx.pressureTrend) / 15));

    const u_limit = U_CRIT[species] || 70;
    const metabolicPenalty = 0.20 + (0.80 / (1 + Math.exp((ctx.flowIndex - u_limit) / 12)));

    let dynamicBoost = 1.0;
    if (ctx.flowTrend === 'Montée') {
        dynamicBoost = species === 'Sandre' ? 1.35 : (species === 'Perche' ? 1.25 : 1.80);
    } else if (ctx.flowTrend === 'Décrue') {
        dynamicBoost = species === 'Perche' ? 1.20 : 1.10; 
    }

    if (species === 'Brochet') {
        dynamicBoost *= Math.exp(-ctx.flowIndex / 250);
    }

    const score = 100 * Math.pow(si_baro, 0.3) * Math.pow(si_temp, 0.4) * (rd / 3.0);
    return Math.min(100, Math.round(score * metabolicPenalty * dynamicBoost * oxyF * crep * 1.8));
};