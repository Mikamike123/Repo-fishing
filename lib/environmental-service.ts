// lib/environmental-service.ts

import { fetchNanterreWeather } from './open-meteo-service';
import { 
    fetchAusterlitzHydro, 
    fetchWaterTemperature, 
    WaterTempData, 
    getCachedWaterTemp, 
    updateWaterTempCache,
    HydroResult // NOUVEL IMPORT : L'interface pour gérer le message de statut
} from './hubeau-service';
import { WeatherSnapshot, HydroSnapshot } from '../types'; 
import { db } from './firebase'; 
import { doc, getDoc, setDoc } from 'firebase/firestore';

// Nom du cache central (Météo et Hydro Temps Réel)
const CACHE_NAME = 'environmental_live';
const CACHE_DURATION_SECONDS = 3600; // 1 heure

// AJOUT DE hydroMessage À L'INTERFACE DU CACHE
interface EnvironmentalCache {
    weather: WeatherSnapshot | null;
    hydro: HydroSnapshot | null;
    timestamp: number;
    hydroMessage?: string | null; // Message d'info contextuel pour Débit/Niveau
}

/**
 * Lit le cache environnemental (Météo/Hydro) depuis Firestore et vérifie sa validité (1 heure).
 */
const getEnvironmentalCache = async (): Promise<EnvironmentalCache | null> => {
    const cacheRef = doc(db, 'cache', CACHE_NAME);
    try {
        const docSnap = await getDoc(cacheRef);
        if (docSnap.exists()) {
            const data = docSnap.data() as EnvironmentalCache;
            // Vérifie si le cache est encore valide (1 heure)
            if (Date.now() / 1000 - data.timestamp < CACHE_DURATION_SECONDS) {
                return data;
            }
        }
    } catch (e) {
        console.error("Erreur de lecture du cache environnemental", e);
    }
    return null;
};

/**
 * Met à jour le cache environnemental dans Firestore.
 */
const updateEnvironmentalCache = async (data: { 
    weather: WeatherSnapshot | null, 
    hydro: HydroSnapshot | null,
    hydroMessage: string | null 
}) => {
    const cacheRef = doc(db, 'cache', CACHE_NAME);
    try {
        await setDoc(cacheRef, { 
            ...data, 
            timestamp: Date.now() / 1000,
            hydroMessage: data.hydroMessage // Assurer la sauvegarde du message
        });
    } catch (e) {
        console.error("Erreur de mise à jour du cache environnemental", e);
    }
};


/**
 * Récupère toutes les conditions environnementales actuelles (Météo Nanterre + Hydro Austerlitz),
 * en utilisant le cache d'une heure.
 * Inclut le message d'info Hydro si les données sont manquantes.
 */
export const getRealtimeEnvironmentalConditions = async (): Promise<{ 
    weather: WeatherSnapshot | null, 
    hydro: HydroSnapshot | null,
    hydroMessage: string | null
}> => {
    const cachedData = await getEnvironmentalCache();
    if (cachedData) {
        console.log("Conditions météo/hydro temps réel chargées depuis le cache.");
        // Assurer que hydroMessage est retourné, même s'il est null/undefined
        return { 
            weather: cachedData.weather, 
            hydro: cachedData.hydro, 
            hydroMessage: cachedData.hydroMessage || null
        };
    }

    // Récupération des données réelles
    const [weatherResult, hydroRawResult] = await Promise.all([
        fetchNanterreWeather(), // Pression, Temp, Couverture (Nanterre)
        fetchAusterlitzHydro() // Utilise le nouveau retour HydroResult
    ]);
    
    // Extraction des données et du message
    const hydroResult = hydroRawResult.data; // Le HydroSnapshot { flow, level }
    const hydroMessage = hydroRawResult.message; // Le message de statut précis (Erreur HTTP, OK, etc.)
    
    // Mise à jour du cache
    await updateEnvironmentalCache({
        weather: weatherResult,
        hydro: hydroResult,
        hydroMessage: hydroMessage,
    });

    return { weather: weatherResult, hydro: hydroResult, hydroMessage: hydroMessage };
};


/**
 * Récupère la température de l'eau (Hubeau J-1) pour le Dashboard ou une date spécifique pour le formulaire.
 * Utilise le cache WaterTempData.
 * @param dateString Si fourni, cherche pour une date historique exacte.
 */
export const getRealtimeWaterTemp = async (dateString: string | null = null): Promise<WaterTempData | null> => {
    
    // Si une date spécifique est demandée (session passée), on appelle l'API directement sans cache Dashboard.
    if (dateString) {
        return fetchWaterTemperature(dateString);
    }
    
    // Sinon, on gère la donnée J-1 avec le cache Dashboard/API J-1
    const cachedData = await getCachedWaterTemp();
    
    if (cachedData) {
        return cachedData;
    }
    
    const apiData = await fetchWaterTemperature(null); // Appel J-1
    if (apiData) {
        await updateWaterTempCache(apiData);
    }
    return apiData;
};