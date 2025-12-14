// lib/hubeau-service.ts

import { db } from "./firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { HydroSnapshot } from '../types'; 

// Code de la station hydro-météo de Paris Austerlitz (Seul point à modifier si vous changez de lieu)
const STATION_CODE = 'F700000103'; 

// CORRECTION CRITIQUE : Utiliser le chemin de proxy RELATIF /hubeau-proxy
const BASE_TEMP_URL = `/hubeau-proxy/api/v1/qualite_rivieres/analyse_spatiale?code_station=${STATION_CODE}&code_parametre=1307&size=1`;

// CORRECTION CRITIQUE : Utiliser le chemin de proxy RELATIF /hubeau-proxy
const BASE_HYDRO_URL = `/hubeau-proxy/api/v1/hydrometrie/observations_tr?code_station=${STATION_CODE}&grandeur_hydro=QmJ&grandeur_hydro=H&sort=desc&size=2`;


/**
 * Interface pour les données de température de l'eau que nous allons stocker.
 */
export interface WaterTempData {
    date: string; // Date de la mesure (AAAA-MM-JJ)
    temperature: number; // Température en °C
    unit: string; // Unité (généralement °C)
}

/**
 * Interface de retour pour Hydrométrie pour inclure le statut précis.
 */
export interface HydroResult {
    data: HydroSnapshot; // Contient { flow: number, level: number } (utilisera 0 en cas d'échec)
    message: string; // Message de statut précis (Erreur HTTP, Données vides, OK, Erreur Réseau)
}


/**
 * Appelle l'API Hubeau pour récupérer la température de l'eau.
 */
export const fetchWaterTemperature = async (dateString: string | null = null): Promise<WaterTempData | null> => {
    let dateParam: string;
    
    // Utilisation de BASE_TEMP_URL pour la requête
    const BASE_API_URL = BASE_TEMP_URL;

    if (dateString) {
        dateParam = dateString;
    } else {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        dateParam = yesterday.toISOString().split('T')[0];
    }
    
    const queryUrl = `${BASE_API_URL}&date_debut_analyse=${dateParam}&date_fin_analyse=${dateParam}`;

    try {
        const response = await fetch(queryUrl);
        if (!response.ok) {
            console.error(`Erreur Hubeau Température (Code: ${response.status}): ${response.statusText}`);
            return null;
        }

        const data = await response.json();

        if (data.count === 0 || !data.data || data.data.length === 0) {
            console.log(`Hubeau: Aucune donnée de température trouvée pour le ${dateParam}.`);
            return null;
        }

        const latestData = data.data[0];
        
        const waterTemp: WaterTempData = {
            date: latestData.date_prelevement.split('T')[0], // AAAA-MM-JJ
            temperature: latestData.resultat_analyse,
            unit: latestData.symbole_unite,
        };
        
        console.log(`✅ Température de l'eau [${waterTemp.date}]: ${waterTemp.temperature}°C`);
        return waterTemp;

    } catch (error) {
        console.error("❌ Erreur lors de l'appel à l'API Hubeau Température:", error);
        return null;
    }
};


/**
 * Récupère le Débit (flow) et la Hauteur (level) les plus récents à Austerlitz.
 * Hydrométrie Temps Réel.
 */
export const fetchAusterlitzHydro = async (): Promise<HydroResult> => {
    try {
        const response = await fetch(BASE_HYDRO_URL);
        
        if (!response.ok) {
            const errorText = response.statusText; // Pas besoin d'await pour statusText
            console.error(`❌ Erreur Hubeau Hydrométrie (Code: ${response.status}): ${errorText}`);
            // Retourne l'erreur HTTP, avec des valeurs à 0.0
            return { 
                data: { flow: 0, level: 0 }, 
                message: `ERREUR HTTP ${response.status}: ${errorText}`
            }; 
        }

        const data = await response.json();
        const observations = data.data || [];
        
        console.log("🌊 Hubeau Hydro Raw Data:", observations); // LOGGING DES DONNÉES BRUTES

        if (observations.length === 0) {
            console.log("Hubeau Hydrométrie: Aucune observation trouvée pour Débit/Niveau.");
            // 200 OK mais données vides
            return { 
                data: { flow: 0, level: 0 }, 
                message: "INFO 200: Données temps réel de débit/niveau (QmJ/H) indisponibles ou vides."
            };
        }

        let flow: number | undefined;
        let level: number | undefined;
        let flowDate: string | undefined;
        let levelDate: string | undefined;

        // On parcourt les observations
        for (const obs of observations) {
            const val = parseFloat(obs.resultat_obs); // Tenter de convertir en float
            const obsTime = obs.date_obs;

            if (obs.grandeur_hydro === 'QmJ' && flow === undefined && !isNaN(val)) {
                flow = val;
                flowDate = obsTime;
            }
            if (obs.grandeur_hydro === 'H' && level === undefined && !isNaN(val)) {
                level = val;
                levelDate = obsTime;
            }
            
            if (flow !== undefined && level !== undefined) {
                break; 
            }
        }

        const hydroSnapshot: HydroSnapshot = {
            flow: flow ?? 0, 
            level: level ?? 0,
        };
        
        console.log(`✅ Hubeau Hydro Snapshot : Débit=${hydroSnapshot.flow} m³/s (Obs: ${flowDate ?? 'N/A'}), Niveau=${hydroSnapshot.level} m (Obs: ${levelDate ?? 'N/A'})`);

        return { 
            data: hydroSnapshot, 
            message: "200 OK: Données récupérées et fusionnées."
        };

    } catch (error) {
        // C'est ICI que l'erreur "Failed to fetch" est attrapée (erreur réseau)
        const errorMessage = error instanceof Error ? error.message : 'Connexion impossible.';
        console.error("❌ Erreur lors de l'appel à l'API Hubeau Hydrométrie:", errorMessage);
        
        // Erreur réseau/catch
        return { 
            data: { flow: 0, level: 0 }, 
            message: `ERREUR RÉSEAU: ${errorMessage}`
        }; 
    }
};


/**
 * Lit la dernière température de l'eau mise en cache dans Firestore (dans un document 'cache').
 */
export const getCachedWaterTemp = async (): Promise<WaterTempData | null> => {
    const cacheRef = doc(db, 'cache', 'water_temp');
    try {
        const docSnap = await getDoc(cacheRef);
        if (docSnap.exists()) {
            return docSnap.data() as WaterTempData;
        }
        return null;
    } catch (error) {
        console.error("Erreur de lecture du cache de température:", error);
        return null;
    }
};

/**
 * Met à jour le cache de température de l'eau dans Firestore.
 */
export const updateWaterTempCache = async (data: WaterTempData) => {
    const cacheRef = doc(db, 'cache', 'water_temp');
    try {
        await setDoc(cacheRef, data);
    } catch (error) {
        console.error("Erreur de mise à jour du cache de température:", error);
    }
};