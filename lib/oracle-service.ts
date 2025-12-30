// lib/oracle-service.ts - Version 5.2 (Intégration Baselines Dynamiques & Calibration Finale)

import { calculateUniversalBioScores, BioContext, BioScores } from './bioScoreEngine';
import { solveDissolvedOxygen, calculateWaveHeight, BASSIN_TURBIDITY_BASE } from './zeroHydroEngine'; 
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

// --- 1. CONSTANTES PHYSIQUES v5.2 (ALIGNÉES SUR AUDIT & ENGINE) ---

const BASIN_PARAMS: Record<BassinType, { offset: number }> = {
    'URBAIN':    { offset: 1.2 }, 
    'AGRICOLE':  { offset: 0.5 }, 
    'PRAIRIE':   { offset: 0.3 }, 
    'FORESTIER': { offset: 0.0 }  
};

const DEPTH_MAP: Record<DepthCategoryID, number> = {
    'Z_LESS_3': 2.0,
    'Z_3_15': 6.0,
    'Z_MORE_15': 15.0
};

const PHI = 172; // Solstice d'été
const EMA_ALPHA = 0.35; // Lissage v5.2 pour une réactivité équilibrée

const MONTHLY_WATER_TEMP_BASELINE: { [key: number]: number } = {
    0: 5.5, 1: 6.0, 2: 8.5, 3: 11.5, 4: 15.0, 5: 18.5,
    6: 21.0, 7: 22.5, 8: 20.0, 9: 16.5, 10: 11.0, 11: 7.0
};

/**
 * MOTEUR D'ESTIMATION PHYSIQUE & BIOLOGIQUE v5.2
 * Calibration avec "Fond de Cuve" (Baseline) dynamique par Bassin Versant.
 */
export const fetchOracleChartData = async (
    lat: number, 
    lng: number, 
    morphology?: LocationMorphology
): Promise<OracleDataPoint[]> => {
    if (!lat || !lng) return [];
    try {
        // --- A. INITIALISATION DES PARAMETRES GEOMORPHO (v5.2) ---
        const m = morphology?.typeId || 'Z_RIVER';
        const b = morphology?.bassin || 'URBAIN';
        const bParams = BASIN_PARAMS[b];
        
        // Récupération de la turbidité plancher spécifique au milieu (v5.2)
        const baseNTU = BASSIN_TURBIDITY_BASE[b] || 5.0;

        // Profondeur Numérique (D) pour les équations différentielles
        const D = morphology?.meanDepth || DEPTH_MAP[morphology?.depthId || 'Z_3_15'];
        
        // Paramètres de surface pour le Fetch (Vagues & Turbidité)
        const surface = morphology?.surfaceArea || 100000; 
        const shape = morphology?.shapeFactor || 1.2;

        // 1. APPEL API (30 jours de passé + 4 jours de prévision)
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

        // 2. ÉTATS INITIAUX DU MODÈLE (v5.2)
        // On initialise sur la baseline du bassin pour un démarrage cohérent
        let currentNTU = baseNTU; 
        const firstDate = new Date(hourly.time[0]);
        let currentWaterTemp = MONTHLY_WATER_TEMP_BASELINE[firstDate.getMonth()] || 8.0;

        // Trackers EMA pour le lissage des scores
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

            // --- B. MÉCANIQUE THERMIQUE (Lois de Puissance Air2Water) ---
            const delta = m === 'Z_RIVER' ? 14 : 0.207 * Math.pow(D, 1.35);
            const mu = 0.5 + (1 / D);
            
            const solarTerm = mu * Math.sin((2 * Math.PI * (dayOfYear - PHI)) / 365);
            const dTw_dt = (1 / (delta * 24)) * ((Ta + bParams.offset) - currentWaterTemp) + (solarTerm / 24);
            currentWaterTemp += dTw_dt;

            // Calcul T_fond (Stratification v5.2)
            let tFond = currentWaterTemp;
            if (m !== 'Z_RIVER' && currentWaterTemp > 15) {
                tFond = 15 + (currentWaterTemp - 15) * 0.15; 
            }

            // --- C. MÉCANIQUE HYDRO-SÉDIMENTAIRE (Calibration v5.2) ---
            // Taux de décantation vers la base du bassin
            const k_hourly = 0.06; // 6% de retour vers la base par heure
            currentNTU = baseNTU + (currentNTU - baseNTU) * Math.exp(-k_hourly);
            
            // Influx Pluie (Remonté à 1.8 pour marquer les averses)
            if (precip > 0.1) currentNTU += 1.8 * precip;
            
            // Resuspension Vent (Uniquement eaux closes si > U_critique)
            const U_crit = (3.0 + 1.2 * Math.log(Math.max(0.5, D))) * 3.6;
            if (m !== 'Z_RIVER' && windKmH > U_crit) {
                currentNTU += (windKmH - U_crit) * 0.8; // Coefficient v5.2
            }
            currentNTU = Math.min(currentNTU, 100); 

            // --- D. MÉCANIQUE DES VAGUES (Walleye Chop) ---
            const hs = calculateWaveHeight(windKmH, surface, shape);

            // FILTRAGE FENÊTRE GRAPHIQUE
            if (ts < startGraph || ts > endGraph) continue;

            // --- E. CALCUL DES BIOSCORES ---
            const dissolvedOxygen = solveDissolvedOxygen(currentWaterTemp, Patm, windKmH, D);
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

            // Lissage EMA v5.2
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