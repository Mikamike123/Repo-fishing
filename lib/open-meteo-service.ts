import { WeatherSnapshot } from '../types'; // Assurez-vous d'importer WeatherSnapshot

// Coordonnées approximatives de Nanterre (proche de Paris Ouest)
const NANTERRE_LAT = 48.90;
const NANTERRE_LNG = 2.21;

// Base de l'API Open-Meteo (Hourly data pour une mise à jour régulière)
// AJOUT ICI : &hourly=...wind_direction_10m... et &timezone=Europe/Paris pour caler les heures
const API_URL = `https://api.open-meteo.com/v1/forecast?latitude=${NANTERRE_LAT}&longitude=${NANTERRE_LNG}&hourly=temperature_2m,surface_pressure,cloud_cover,wind_speed_10m,wind_direction_10m&timezone=Europe%2FParis&forecast_days=1`;

// Nom du cache Firestore pour la météo
const CACHE_NAME = 'nanterre_weather';
// Durée du cache : 1 heure (3600 secondes) pour la météo
const CACHE_DURATION_SECONDS = 3600; 

/**
 * Récupère les données météo actuelles via Open-Meteo, utilise le cache si récent.
 */
export const fetchNanterreWeather = async (): Promise<WeatherSnapshot | null> => {
    try {
        // NOTE: La logique de cache Firestore sera ajoutée dans lib/environmental-service.ts

        const response = await fetch(API_URL);
        if (!response.ok) {
            console.error(`Erreur Open-Meteo: ${response.status} ${response.statusText}`);
            return null;
        }

        const data = await response.json();

        // Trouver la donnée horaire la plus récente
        if (data.hourly) {
            // CORRECTION IMPORTANTE :
            // Open-Meteo renvoie un tableau de 24h (0h à 23h).
            // L'index correspond donc exactement à l'heure actuelle de Paris.
            const currentHour = new Date().getHours();
            const nowIndex = currentHour; 

            // Sécurité : si on interroge tard le soir et qu'il y a un décalage, on fallback sur la dernière valeur
            const safeIndex = data.hourly.temperature_2m[nowIndex] !== undefined ? nowIndex : 0;

            const snapshot: WeatherSnapshot = {
                temperature: data.hourly.temperature_2m[safeIndex],
                pressure: data.hourly.surface_pressure[safeIndex], // hPa
                clouds: data.hourly.cloud_cover[safeIndex],      // %
                windSpeed: data.hourly.wind_speed_10m[safeIndex],
                // AJOUT : Direction du vent
                windDirection: data.hourly.wind_direction_10m[safeIndex] 
            };
            
            return snapshot;
        }

        return null;

    } catch (error) {
        console.error("Erreur lors de l'appel à l'API Open-Meteo:", error);
        return null;
    }
};