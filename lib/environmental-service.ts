// lib/environmental-service.ts

import { fetchNanterreWeather } from './open-meteo-service';
import { 
    WaterTempData, 
    getCachedWaterTemp, 
    updateWaterTempCache,
    fetchHydroRealtime,
    fetchWaterTempJMinus1 
} from './hubeau-service';
import { WeatherSnapshot, HydroSnapshot } from '../types'; 
import { db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const CACHE_NAME = 'environmental_live';

/**
 * RÉCUPÉRATION DES CONDITIONS ENVIRONNEMENTALES (V3)
 * Gère le mapping des données provenant de la Cloud Function.
 */
export const getRealtimeEnvironmentalConditions = async (): Promise<{ 
    weather: WeatherSnapshot | null, 
    hydro: HydroSnapshot | null,
    hydroMessage: string | null
}> => {
    const cacheRef = doc(db, 'cache', CACHE_NAME);
    
    // 1. Tentative de lecture du cache (validité 30 min pour réactivité accrue)
    try {
        const snap = await getDoc(cacheRef);
        if (snap.exists()) {
            const cached = snap.data();
            if (Date.now() / 1000 - cached.timestamp < 1800) {
                return { 
                    weather: cached.weather, 
                    hydro: cached.hydro, 
                    hydroMessage: cached.hydroMessage 
                };
            }
        }
    } catch (e) {
        console.warn("Échec lecture cache Firestore");
    }

    // 2. Appel des API réelles (ou Cloud Functions)
    console.log("📡 Mise à jour des conditions environnementales...");
    const [weatherResult, hydroRawResult] = await Promise.all([
        fetchNanterreWeather(),
        fetchHydroRealtime()
    ]);

    // Extraction sécurisée des données du backend
    const hydroResult: HydroSnapshot = {
        flow: hydroRawResult?.data?.flow || 0,
        level: hydroRawResult?.data?.level || 0,
        waterTemp: null // Complété par getRealtimeWaterTemp
    };

    const result = {
        weather: weatherResult,
        hydro: hydroResult,
        hydroMessage: hydroRawResult?.message || "OK",
        timestamp: Date.now() / 1000
    };

    // 3. Persistance dans le cache
    try {
        await setDoc(cacheRef, result);
    } catch (e) {
        console.error("Impossible de mettre à jour le cache Firestore", e);
    }

    return { 
        weather: weatherResult, 
        hydro: hydroResult, 
        hydroMessage: result.hydroMessage 
    }; 
};

/**
 * RÉCUPÉRATION DE LA TEMPÉRATURE DE L'EAU
 */
export const getRealtimeWaterTemp = async (dateString: string | null = null): Promise<WaterTempData | null> => { 
    if (dateString) return null; // Simplification V3

    // Toujours tenter de récupérer la donnée fraîche du backend (estimée ou réelle)
    const apiData = await fetchWaterTempJMinus1();
    
    if (apiData) {
        await updateWaterTempCache(apiData); 
        return apiData;
    }
    
    // Fallback sur le dernier cache Firestore si le réseau échoue
    return getCachedWaterTemp();
};