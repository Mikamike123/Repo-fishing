// lib/universal-weather-service.ts
import { WeatherSnapshot } from '../types';

/**
 * Récupère les données météo actuelles via Open-Meteo
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
 * [NOUVEAU] Récupère l'historique simple pour useWaterTemp
 * Michael : INDISPENSABLE pour le calcul local de la température de l'eau
 */
export const fetchWeatherHistory = async (lat: number, lng: number, days: number): Promise<any[]> => {
    const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&past_days=${days}&hourly=temperature_2m&timezone=Europe%2FParis`;

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) return [];
        const data = await response.json();

        if (!data.hourly) return [];

        const history = [];
        for (let i = 0; i < days; i++) {
            const start = i * 24;
            const end = start + 24;
            const dayTemps = data.hourly.temperature_2m.slice(start, end);

            if (dayTemps.length > 0) {
                history.push({
                    date: new Date(Date.now() - (days - i) * 86400000).toISOString(),
                    temperature: dayTemps.reduce((a: number, b: number) => a + b, 0) / dayTemps.length
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
 * Récupère le contexte météo complet pour les archives (Cloud Function)
 */
export const fetchHistoricalWeatherContext = async (lat: number, lng: number, dateStr: string) => {
    const targetDate = new Date(dateStr);
    const startDate = new Date(targetDate);
    startDate.setDate(startDate.getDate() - 30);
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = targetDate.toISOString().split('T')[0];

    const archiveUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=${startStr}&end_date=${endStr}&hourly=temperature_2m,surface_pressure,precipitation,cloud_cover,wind_speed_10m,wind_direction_10m,weathercode&timezone=Europe%2FParis`;

    try {
        const response = await fetch(archiveUrl);
        if (!response.ok) throw new Error(`Open-Meteo Archive Error: ${response.status}`);
        const data = await response.json();
        if (!data.hourly) return null;

        const dayIndex = (30 * 24) + 12; 
        const snapshot: WeatherSnapshot = {
            temperature: data.hourly.temperature_2m[dayIndex] ?? data.hourly.temperature_2m[data.hourly.temperature_2m.length - 1],
            pressure: data.hourly.surface_pressure[dayIndex] ?? 1013,
            clouds: data.hourly.cloud_cover[dayIndex] ?? 0,
            windSpeed: data.hourly.wind_speed_10m[dayIndex] ?? 0,
            windDirection: data.hourly.wind_direction_10m[dayIndex] ?? 0,
            precip: data.hourly.precipitation[dayIndex] ?? 0,
            conditionCode: data.hourly.weathercode[dayIndex] ?? 0
        };

        const history = [];
        for (let i = 0; i < 31; i++) {
            const start = i * 24;
            const end = start + 24;
            const dayTemps = data.hourly.temperature_2m.slice(start, end);
            const dayPrecip = data.hourly.precipitation.slice(start, end);
            const dayPressure = data.hourly.surface_pressure.slice(start, end);
            if (dayTemps.length > 0) {
                history.push({
                    date: new Date(startDate.getTime() + i * 86400000).toISOString(),
                    temperature: dayTemps.reduce((a: number, b: number) => a + b, 0) / dayTemps.length,
                    precipitation: dayPrecip.reduce((a: number, b: number) => a + b, 0),
                    pressure: dayPressure[dayPressure.length - 1] || 1013
                });
            }
        }
        return { snapshot, history };
    } catch (error) {
        console.error("Erreur fetchHistoricalWeatherContext:", error);
        return null;
    }
};