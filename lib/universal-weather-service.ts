import { WeatherSnapshot } from '../types';

/**
 * Récupère les données météo actuelles via Open-Meteo pour n'importe quelles coordonnées géographiques.
 * Utile pour les secteurs personnalisés (Locations).
 * @param lat Latitude du secteur
 * @param lng Longitude du secteur
 */
export const fetchUniversalWeather = async (lat: number, lng: number): Promise<WeatherSnapshot | null> => {
    // Vérification basique des coordonnées
    if (lat === undefined || lng === undefined) return null;

    // Construction de l'URL dynamique avec tous les champs requis
    const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,surface_pressure,cloud_cover,wind_speed_10m,wind_direction_10m,precipitation,weathercode&timezone=Europe%2FParis&forecast_days=1`;

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            console.error(`Erreur Open-Meteo (Universal): ${response.status} ${response.statusText}`);
            return null;
        }

        const data = await response.json();

        if (data.hourly) {
            const currentHour = new Date().getHours();
            const safeIndex = data.hourly.temperature_2m[currentHour] !== undefined ? currentHour : 0;

            const snapshot: WeatherSnapshot = {
                temperature: data.hourly.temperature_2m[safeIndex],
                pressure: data.hourly.surface_pressure[safeIndex],
                clouds: data.hourly.cloud_cover[safeIndex],
                windSpeed: data.hourly.wind_speed_10m[safeIndex],
                windDirection: data.hourly.wind_direction_10m[safeIndex],
                precip: data.hourly.precipitation[safeIndex],
                conditionCode: data.hourly.weathercode[safeIndex]
            };
            
            return snapshot;
        }

        return null;

    } catch (error) {
        console.error(`Erreur lors de l'appel Open-Meteo pour (${lat}, ${lng}):`, error);
        return null;
    }
};