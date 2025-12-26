import { SpeciesType } from '../types';

// --- INTERFACES ---
export interface BioContext {
    waterTemp: number;      // °C (Tw)
    cloudCover: number;     // % (Pour le calcul du Lux)
    windSpeed: number;      // km/h (Pour le wind_factor Brochet)
    pressureTrend: number;  // hPa (dP sur 3h)
    turbidity: number;      // 0-1 (turbIdx)
    date?: Date;            // Pour le calcul de l'élévation solaire (optionnel, défaut = now)
}

export interface BioScores {
    sandre: number;
    brochet: number;
    perche: number;
}

// --- MOTEUR DE CALCUL (CLONE STRICT DU BACKEND) ---

export const calculateUniversalBioScores = (ctx: BioContext): BioScores => {
    // Pré-calculs des facteurs environnementaux partagés
    const lux = calculateLux(ctx.date || new Date(), ctx.cloudCover);
    const windF = Math.min(1.0, Math.max(0.2, 0.2 + 0.8 * (ctx.windSpeed / 30)));
    
    return {
        sandre: computeSandreScore(ctx, lux),
        brochet: computeBrochetScore(ctx, windF),
        perche: computePercheScore(ctx)
    };
};

// 1. SANDRE : Pression (40%) + Lumière (40%) + Temp (20%)
const computeSandreScore = (ctx: BioContext, lux: number): number => {
    // A. Pression (Sigmoïde) : Déteste les hausses, aime la stabilité ou baisse légère
    // Backend: 1 / (1 + Math.exp(2.0 * (dP - 0.5)))
    const fP = 1 / (1 + Math.exp(2.0 * (ctx.pressureTrend - 0.5)));

    // B. Lumière / Turbidité (Fonction Vampire)
    // Backend: (1 - lux) + lux * Math.tanh(4 * turbIdx)
    const fLT = (1 - lux) + lux * Math.tanh(4 * ctx.turbidity);

    // C. Température (Gaussienne centrée sur 17°C, large)
    // Backend: Math.exp(-Math.pow(Tw - 17, 2) / 128)
    const fT = Math.exp(-Math.pow(ctx.waterTemp - 17, 2) / 128);

    // Formule Pondérée : 100 * P^0.4 * L^0.4 * T^0.2
    let score = 100 * Math.pow(fP, 0.4) * Math.pow(fLT, 0.4) * Math.pow(fT, 0.2);
    
    return Math.min(Math.round(score), 100);
};

// 2. BROCHET : Temp (50%) + Visibilité (30%) + Vent (20%)
const computeBrochetScore = (ctx: BioContext, windF: number): number => {
    // A. Veto Éthique
    if (ctx.waterTemp > 24.0) return 0;

    // B. Température (Sigmoïde inversée : Aime le frais < 21°C)
    // Backend: 1 / (1 + Math.exp(0.8 * (Tw - 21)))
    const fT = 1 / (1 + Math.exp(0.8 * (ctx.waterTemp - 21)));

    // C. Visibilité (Décroissance exponentielle avec la turbidité)
    // Backend: Math.exp(-2.5 * turbIdx)
    const fVis = Math.exp(-2.5 * ctx.turbidity);

    // D. Vent (Facteur mécanique)
    // windF calculé plus haut

    // Formule Pondérée : 100 * T^0.5 * V^0.3 * W^0.2
    let score = 100 * Math.pow(fT, 0.5) * Math.pow(fVis, 0.3) * Math.pow(windF, 0.2);

    return Math.min(Math.round(score), 100);
};

// 3. PERCHE : Temp (50%) + Pression (50%)
const computePercheScore = (ctx: BioContext): number => {
    // A. Température (Gaussienne stricte centrée sur 21°C)
    // Backend: Math.exp(-Math.pow(Tw - 21, 2) / 72)
    const fT = Math.exp(-Math.pow(ctx.waterTemp - 21, 2) / 72);

    // B. Stabilité Pression
    // Backend: max(exp(-2 * |dP|), 1 / (1 + exp(3.0 * (dP + 1.5))))
    const dP = ctx.pressureTrend;
    const fP = Math.max(
        Math.exp(-2 * Math.abs(dP)), 
        1 / (1 + Math.exp(3.0 * (dP + 1.5)))
    );

    // Formule Pondérée : 100 * T^0.5 * P^0.5
    let score = 100 * Math.pow(fT, 0.5) * Math.pow(fP, 0.5);

    return Math.min(Math.round(score), 100);
};

// --- HELPER : SIMULATION LUMINOSITÉ (LUX) ---
// Clone simplifié de la logique Backend pour estimer la lumière incidente
function calculateLux(date: Date, cloudCover: number): number {
    try {
        const hour = date.getHours() + (date.getMinutes() / 60);
        const month = date.getMonth() + 1; // 1-12

        // Table simplifiée des levers/couchers (Paris)
        const schedule: { [key: number]: [number, number] } = {
            1: [8.5, 17.0], 2: [8.0, 18.0], 3: [7.0, 19.0], 4: [6.0, 20.5], 
            5: [5.5, 21.5], 6: [5.5, 22.0], 7: [6.0, 21.5], 8: [6.5, 20.5], 
            9: [7.5, 19.5], 10: [8.0, 18.5], 11: [8.0, 17.0], 12: [8.5, 16.5]
        };

        const [rise, set] = schedule[month] || [7, 19];
        
        // Si nuit -> 0
        if (hour < rise || hour > set) return 0;

        // Élévation sinusoïdale (0 à 1 à midi solaire)
        const elev = Math.sin(Math.PI * (hour - rise) / (set - rise));
        
        // Atténuation nuageuse quadratique (Backend logic)
        // (1 - 0.75 * (cloud/100)^2)
        const cloudFactor = 1 - 0.75 * Math.pow(cloudCover / 100, 2);

        return Math.max(0, elev * cloudFactor);
    } catch { 
        return 0.5; // Valeur par défaut si erreur
    }
}