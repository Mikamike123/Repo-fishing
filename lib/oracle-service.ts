// lib/oracle-service.ts
import { calculateUniversalBioScores, BioContext, BioScores } from './bioScoreEngine';

export interface OracleDataPoint extends BioScores {
    timestamp: number;
    hourLabel: string;
    isForecast: boolean;
    waterTemp: number;
    bestScore: number; // Nouveau : Score max de l'heure (pour le comparatif simplifiée)
}

/**
 * Récupère les données météo étendues (-12h / +72h) pour des coordonnées spécifiques
 */
export const fetchOracleChartData = async (lat: number, lng: number): Promise<OracleDataPoint[]> => {
    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,surface_pressure,cloud_cover,wind_speed_10m,precipitation&timezone=Europe%2FParis&past_days=1&forecast_days=4`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error('Météo Oracle indisponible');
        
        const data = await response.json();
        const hourly = data.hourly;
        
        const points: OracleDataPoint[] = [];
        const now = Date.now();
        const oneHour = 3600 * 1000;
        const startGraph = now - (12 * oneHour);
        const endGraph = now + (72 * oneHour);

        for (let i = 0; i < hourly.time.length; i++) {
            const timeStr = hourly.time[i];
            const timestamp = new Date(timeStr).getTime();

            if (timestamp < startGraph || timestamp > endGraph) continue;

            // Calcul des deltas (Pression)
            const currentPressure = hourly.surface_pressure[i];
            const prevPressure = i >= 3 ? hourly.surface_pressure[i - 3] : currentPressure;
            const pressureTrend = currentPressure - prevPressure;

            // Simulation Turbidité (Simplifiée pour la démo, à connecter au ZeroHydroEngine plus tard)
            const precip = hourly.precipitation[i];
            const simulatedTurbidity = precip > 0.5 ? 0.8 : 0.3;

            const ctx: BioContext = {
                waterTemp: hourly.temperature_2m[i], // Proxy Air=Eau (à affiner)
                cloudCover: hourly.cloud_cover[i],
                windSpeed: hourly.wind_speed_10m[i],
                pressureTrend: pressureTrend,
                turbidity: simulatedTurbidity,
                date: new Date(timestamp)
            };

            const scores = calculateUniversalBioScores(ctx);
            
            // On calcule le score "Global" (le max des espèces) pour la comparaison inter-secteurs
            const maxScore = Math.max(scores.sandre, scores.brochet, scores.perche);

            points.push({
                timestamp,
                hourLabel: new Date(timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
                isForecast: timestamp > now,
                waterTemp: hourly.temperature_2m[i],
                bestScore: maxScore,
                ...scores
            });
        }

        return points;

    } catch (error) {
        console.error("Erreur Oracle Service:", error);
        return [];
    }
};