// lib/universal-weather-service.ts
import { WeatherSnapshot } from '../types';

/**
 * Récupère les données météo actuelles via Open-Meteo (LIVE)
 */
export const fetchUniversalWeather = async (lat: number, lng: number): Promise<WeatherSnapshot | null> => {
    if (lat === undefined || lng === undefined) return null;
    const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,surface_pressure,cloud_cover,wind_speed_10m,wind_direction_10m,precipitation,weathercode&timezone=Europe%2FParis&forecast_days=1`;

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) return null;
        const data = await response.json();
        if (data.hourly) {
            const currentHour = new Date().getHours();
            const safeIndex = data.hourly.temperature_2m[currentHour] !== undefined ? currentHour : 0;
            return {
                temperature: data.hourly.temperature_2m[safeIndex],
                pressure: data.hourly.surface_pressure[safeIndex],
                clouds: data.hourly.cloud_cover[safeIndex],
                windSpeed: data.hourly.wind_speed_10m[safeIndex],
                windDirection: data.hourly.wind_direction_10m[safeIndex],
                precip: data.hourly.precipitation[safeIndex],
                conditionCode: data.hourly.weathercode[safeIndex]
            };
        }
        return null;
    } catch (error) {
        console.error("Erreur fetchUniversalWeather:", error);
        return null;
    }
};

/**
 * Récupère l'historique simple pour les graphiques (Forecast based)
 */
export const fetchWeatherHistory = async (lat: number, lng: number, days: number): Promise<any[]> => {
    // Note: Open-Meteo 'past_days' fonctionne jusqu'à 92 jours. 
    const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&past_days=${days}&hourly=temperature_2m,precipitation,surface_pressure&timezone=Europe%2FParis`;

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) return [];
        const data = await response.json();

        if (!data.hourly || !data.hourly.time) return [];

        const history = [];
        for (let i = 0; i < data.hourly.time.length; i++) {
            if (data.hourly.temperature_2m[i] !== null) {
                history.push({
                    date: data.hourly.time[i],
                    temperature: data.hourly.temperature_2m[i],
                    precipitation: data.hourly.precipitation[i] || 0,
                    pressure: data.hourly.surface_pressure[i] || 1013
                });
            }
        }
        return history;
    } catch (error) {
        console.error("Erreur fetchWeatherHistory:", error);
        return [];
    }
};

/**
 * [MISE À JOUR v6.4] HYBRID ROUTER
 * Récupère le contexte météo complet pour les archives (Cloud Function).
 * - Si date < 7 jours : Utilise l'API FORECAST (Données récentes précises)
 * - Si date > 7 jours : Utilise l'API ARCHIVE (Données historiques consolidées)
 [cite_start]* [cite: 310, 312]
 */
export const fetchHistoricalWeatherContext = async (lat: number, lng: number, dateStr: string) => {
    const targetDate = new Date(dateStr);
    const now = new Date();
    
    // Calcul de l'ancienneté en jours
    const diffTime = now.getTime() - targetDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Seuil de bascule : 7 jours (Marge de sécurité pour l'Archive)
    const IS_RECENT = diffDays < 7;

    // Configuration commune
    const DAYS_HISTORY_NEEDED = 45;

    let url = "";

    if (IS_RECENT) {
        // --- MODE FORECAST (Pour le récent/live) ---
        // On demande "past_days" pour avoir l'historique récent + "forecast_days" pour couvrir aujourd'hui
        // Max past_days autorisé par l'API Forecast : 92 jours. On est large avec 45.
        console.log(`📡 [Hybrid Router] Mode FORECAST activé pour ${dateStr} (Diff: ${diffDays}j)`);
        url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&past_days=${DAYS_HISTORY_NEEDED + 2}&forecast_days=2&hourly=temperature_2m,surface_pressure,precipitation,cloud_cover,wind_speed_10m,wind_direction_10m,weathercode&timezone=Europe%2FParis`;
    } else {
        // --- MODE ARCHIVE (Pour le passé lointain) ---
        console.log(`📜 [Hybrid Router] Mode ARCHIVE activé pour ${dateStr}`);
        const startDate = new Date(targetDate);
        startDate.setDate(startDate.getDate() - DAYS_HISTORY_NEEDED);
        const startStr = startDate.toISOString().split('T')[0];
        const endStr = targetDate.toISOString().split('T')[0];
        
        url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=${startStr}&end_date=${endStr}&hourly=temperature_2m,surface_pressure,precipitation,cloud_cover,wind_speed_10m,wind_direction_10m,weathercode&timezone=Europe%2FParis`;
    }

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Open-Meteo Error (${IS_RECENT ? 'Forecast' : 'Archive'}): ${response.status}`);
        
        const data = await response.json();
        if (!data.hourly) return null;

        // --- Logique de parsing commune ---
        
        // 1. Trouver l'index de l'heure cible (Snapshot)
        // Format ISO de l'heure cible (ex: "2023-09-15T14")
        // Attention : Si on est en mode Forecast, targetDate peut être dans le futur proche ou aujourd'hui
        const targetTimeStr = targetDate.toISOString().slice(0, 13);
        
        let targetIndex = data.hourly.time.findIndex((t: string) => t.startsWith(targetTimeStr));
        
        // Sécurité : Si l'heure exacte n'est pas trouvée (ex: changement d'heure ou bord de tableau)
        if (targetIndex === -1) {
            // Si c'est aujourd'hui, on prend l'heure courante ou la dernière dispo
            targetIndex = data.hourly.time.length - 1;
        }

        // 2. Construire le Snapshot (Instant T)
        const snapshot: WeatherSnapshot = {
            temperature: data.hourly.temperature_2m[targetIndex],
            pressure: data.hourly.surface_pressure[targetIndex],
            clouds: data.hourly.cloud_cover[targetIndex] ?? 0,
            windSpeed: data.hourly.wind_speed_10m[targetIndex] ?? 0,
            windDirection: data.hourly.wind_direction_10m[targetIndex] ?? 0,
            precip: data.hourly.precipitation[targetIndex] ?? 0,
            conditionCode: data.hourly.weathercode[targetIndex] ?? 0
        };

        // 3. Construire l'Historique (45 jours avant -> Instant T)
        // On filtre pour ne garder que ce qui est antérieur ou égal à targetIndex
        // Pour éviter d'envoyer du futur au moteur historique
        const history = [];
        
        // Optimisation : On ne prend que les index <= targetIndex
        // Et on s'assure d'avoir au moins les 45 jours (45 * 24 = 1080 heures)
        const startIndex = Math.max(0, targetIndex - (DAYS_HISTORY_NEEDED * 24));

        for (let i = startIndex; i <= targetIndex; i++) {
             // Protection contre les données nulles (surtout si Archive a des trous)
             const temp = data.hourly.temperature_2m[i];
             if (temp !== null && temp !== undefined) {
                 history.push({
                    date: data.hourly.time[i],
                    temperature: temp,
                    precipitation: data.hourly.precipitation[i] || 0,
                    pressure: data.hourly.surface_pressure[i] || 1013
                });
             }
        }
        
        return { snapshot, history };

    } catch (error) {
        console.error("Erreur fetchHistoricalWeatherContext:", error);
        return null;
    }
};