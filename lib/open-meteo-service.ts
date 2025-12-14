// lib/open-meteo-service.ts

import { WeatherSnapshot } from '../types'; // Assurez-vous d'importer WeatherSnapshot

// Coordonnées approximatives de Nanterre (proche de Paris Ouest)
const NANTERRE_LAT = 48.90;
const NANTERRE_LNG = 2.21;

// Base de l'API Open-Meteo (Hourly data pour une mise à jour régulière)
const API_URL = `https://api.open-meteo.com/v1/forecast?latitude=${NANTERRE_LAT}&longitude=${NANTERRE_LNG}&hourly=temperature_2m,surface_pressure,cloud_cover,wind_speed_10m`;

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

        // Trouver la donnée horaire la plus récente (index 0 de 'hourly')
        if (data.hourly) {
            const nowIndex = 0; // On prend la première heure (la plus proche du présent)

            const snapshot: WeatherSnapshot = {
                temperature: data.hourly.temperature_2m[nowIndex],
                pressure: data.hourly.surface_pressure[nowIndex], // hPa
                clouds: data.hourly.cloud_cover[nowIndex],      // %
                windSpeed: data.hourly.wind_speed_10m[nowIndex],
            };
            
            return snapshot;
        }

        return null;

    } catch (error) {
        console.error("Erreur lors de l'appel à l'API Open-Meteo:", error);
        return null;
    }
};

// NOTE: Les fonctions de cache Firestore (get/updateCache) seront centralisées.