// lib/oracle-service.ts - Version 4.9 (Simulateur Physique Avancé)

import { calculateUniversalBioScores, BioContext, BioScores } from './bioScoreEngine';
import { solveDissolvedOxygen } from './zeroHydroEngine'; 
import { LocationMorphology, MorphologyID, DepthCategoryID, BassinType } from '../types';

export interface OracleDataPoint extends BioScores {
    timestamp: number;
    hourLabel: string;
    isForecast: boolean;
    waterTemp: number;     // T_surface
    tFond: number;         // T_hypolimnion
    turbidityNTU: number;
    dissolvedOxygen: number;
    waveHeight: number;    // Hs en cm
    bestScore: number;
}

// --- 1. CONSTANTES PHYSIQUES (PARTIE I & II) ---

const MORPHO_PARAMS: Record<MorphologyID, { delta: number; mu: number; k_decay: number; base_ntu: number }> = {
    'Z_POND':  { delta: 4,  mu: 0.5, k_decay: 0.15, base_ntu: 15.0 }, // [cite: 78, 105, 110]
    'Z_MED':   { delta: 15, mu: 1.5, k_decay: 0.05, base_ntu: 5.0  }, // [cite: 78, 106, 108]
    'Z_DEEP':  { delta: 35, mu: 3.0, k_decay: 0.03, base_ntu: 2.0  }, // [cite: 78, 106, 109]
    'Z_RIVER': { delta: 18,  mu: 1.2, k_decay: 0.70, base_ntu: 8.0  }  // [cite: 78, 103]
};

const BASIN_PARAMS: Record<BassinType, { beta: number; offset: number }> = {
    'URBAIN':    { beta: 0.95, offset: 1.5 }, // [cite: 33]
    'AGRICOLE':  { beta: 0.80, offset: 0.5 }, // [cite: 33]
    'PRAIRIE':   { beta: 0.40, offset: 0.0 }, // [cite: 33]
    'FORESTIER': { beta: 0.15, offset: -0.5 } // [cite: 33]
};

const PHI = 172; // Solstice d'été [cite: 79]
const ALPHA_SED = 2.5; // [cite: 113]
const EMA_ALPHA = 0.4; // Lissage physiologique [cite: 218]

const MONTHLY_WATER_TEMP_BASELINE: { [key: number]: number } = {
    0: 5.5, 1: 6.0, 2: 8.5, 3: 11.5, 4: 15.0, 5: 18.5,
    6: 21.0, 7: 22.5, 8: 20.0, 9: 16.5, 10: 11.0, 11: 7.0
};

/**
 * MOTEUR D'ESTIMATION PHYSIQUE & BIOLOGIQUE
 */
export const fetchOracleChartData = async (
    lat: number, 
    lng: number, 
    morphology?: LocationMorphology
): Promise<OracleDataPoint[]> => {
    try {
        // --- A. INITIALISATION DES CONSTANTES ---
        const m = morphology?.typeId || 'Z_RIVER';
        const b = morphology?.bassin || 'URBAIN';
        const params = MORPHO_PARAMS[m];
        const bParams = BASIN_PARAMS[b];

        // Calcul du Fetch Effectif (Partie 1.3) [cite: 38]
        const surface = morphology?.surfaceArea || 100000; // Défaut 10ha
        const shape = morphology?.shapeFactor || 1.2;
        const fetchEff = Math.sqrt(surface) * shape;

        // 1. APPEL API (30 jours de passé) [cite: 77]
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,surface_pressure,cloud_cover,wind_speed_10m,precipitation&timezone=Europe%2FParis&past_days=30&forecast_days=4`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Météo Oracle indisponible');
        const data = await response.json();
        const hourly = data.hourly;
        
        const points: OracleDataPoint[] = [];
        const now = Date.now();
        const oneHour = 3600 * 1000;
        const startGraph = now - (12 * oneHour);
        const endGraph = now + (72 * oneHour);

        // 2. ÉTATS INITIAUX DU MODÈLE
        let currentNTU = params.base_ntu;
        const firstDate = new Date(hourly.time[0]);
        let currentWaterTemp = MONTHLY_WATER_TEMP_BASELINE[firstDate.getMonth()] || 8.0;

        // Trackers EMA pour le lissage des scores (Partie 6.2) [cite: 217]
        let emaScores = { sandre: 0, brochet: 0, perche: 0, blackbass: 0 };

        // 3. BOUCLE DE SIMULATION HORAIRE
        for (let i = 0; i < hourly.time.length; i++) {
            const timeStr = hourly.time[i];
            const date = new Date(timeStr);
            const ts = date.getTime();
            const dayOfYear = Math.floor((ts - new Date(date.getFullYear(), 0, 0).getTime()) / (oneHour * 24));
            
            const precip = hourly.precipitation[i] || 0;
            const Ta = hourly.temperature_2m[i];
            const Patm = hourly.surface_pressure[i];
            const windKmH = hourly.wind_speed_10m[i];

            // --- B. MÉCANIQUE THERMIQUE (Air2Water Complet) [cite: 82, 83] ---
            const solarTerm = params.mu * Math.sin((2 * Math.PI * (dayOfYear - PHI)) / 365);
            // On divise par params.delta * 24 pour appliquer l'inertie journalière sur un pas horaire
            const dTw_dt = (1 / (params.delta * 24)) * ((Ta + bParams.offset) - currentWaterTemp) + (solarTerm / 24);
            currentWaterTemp += dTw_dt;

            // Calcul T_fond (Stratification) [cite: 85]
            let tFond = currentWaterTemp;
            if ((m === 'Z_DEEP' || m === 'Z_MED') && currentWaterTemp > 14) {
                tFond = 14 + (currentWaterTemp - 14) * 0.10;
            }

            // --- C. MÉCANIQUE OPTIQUE (EMC / Stokes) [cite: 116] ---
            const k_hourly = params.k_decay / 24;
            currentNTU = params.base_ntu + (currentNTU - params.base_ntu) * Math.exp(-k_hourly);
            if (precip > 0.1) {
                currentNTU += ALPHA_SED * precip * bParams.beta;
            }

            // --- D. MÉCANIQUE DES VAGUES (SMB Equations) [cite: 138, 139] ---
            const windMS = windKmH / 3.6;
            // Hs (cm) = 0.0016 * U^2 * sqrt(F/g) -> Version simplifiée calibrée
            const hs = 0.0016 * Math.pow(windMS, 2) * Math.sqrt(fetchEff / 9.81) * 100;

            // FILTRAGE FENÊTRE GRAPHIQUE
            if (ts < startGraph || ts > endGraph) continue;

            // --- E. CALCUL DES BIOSCORES ---
            const dissolvedOxygen = solveDissolvedOxygen(currentWaterTemp, Patm);
            const prevPress = i >= 3 ? hourly.surface_pressure[i - 3] : Patm;
            
            const ctx: BioContext = {
                waterTemp: currentWaterTemp,
                cloudCover: hourly.cloud_cover[i],
                windSpeed: windKmH,
                pressureTrend: Patm - prevPress,
                turbidityNTU: currentNTU,
                dissolvedOxygen: dissolvedOxygen,
                waveHeight: hs,
                date: date
            };

            const rawScores = calculateUniversalBioScores(ctx);

            // Application du lissage EMA (Partie 6.2) [cite: 218]
            if (points.length === 0) {
                emaScores = { ...rawScores };
            } else {
                emaScores.sandre = emaScores.sandre + EMA_ALPHA * (rawScores.sandre - emaScores.sandre);
                emaScores.brochet = emaScores.brochet + EMA_ALPHA * (rawScores.brochet - emaScores.brochet);
                emaScores.perche = emaScores.perche + EMA_ALPHA * (rawScores.perche - emaScores.perche);
                emaScores.blackbass = emaScores.blackbass + EMA_ALPHA * (rawScores.blackbass - emaScores.blackbass);
            }

            const maxScore = Math.max(emaScores.sandre, emaScores.brochet, emaScores.perche, emaScores.blackbass);

            points.push({
                timestamp: ts,
                hourLabel: date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
                isForecast: ts > now,
                waterTemp: Number(currentWaterTemp.toFixed(1)),
                tFond: Number(tFond.toFixed(1)),
                turbidityNTU: Number(currentNTU.toFixed(1)),
                dissolvedOxygen: Number(dissolvedOxygen.toFixed(2)),
                waveHeight: Number(hs.toFixed(1)),
                bestScore: Math.round(maxScore),
                sandre: Math.round(emaScores.sandre),
                brochet: Math.round(emaScores.brochet),
                perche: Math.round(emaScores.perche),
                blackbass: Math.round(emaScores.blackbass)
            });
        }

        return points;

    } catch (error) {
        console.error("Erreur Oracle Service:", error);
        return [];
    }
};