// lib/hubeau-service.ts

import { db } from "./firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
// NOTE: La Cloud Function nous renvoie maintenant une HydroSnapshot qui inclut la température
import { HydroSnapshot } from '../types'; 

// --- NOUVEAU: URL DE LA CLOUD FUNCTION (Proxy côté serveur) ---
// Utilise l'URL locale de l'émulateur pour le développement (port 5001 par défaut)
// Pour la production, vous utiliserez l'URL réelle: 'https://[REGION]-[PROJECT_ID].cloudfunctions.net/fetchHubeauData'
const CLOUD_FUNCTION_URL = (process.env.NODE_ENV === 'development') 
    ? 'http://127.0.0.1:5001/mysupstack/us-central1/fetchHubeauData' 
    : 'https://[VOTRE_REGION]-[VOTRE_PROJECT_ID].cloudfunctions.net/fetchHubeauData';

// STATION_CODE est conservé pour l'info mais n'est plus utilisé dans ce fichier Front-end.
const STATION_CODE = 'F700000103'; 

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
 * (Nous conservons la signature pour la compatibilité avec environmental-service.ts)
 */
export interface HydroResult {
    data: HydroSnapshot; // Contient { flow: number, level: number, waterTemp: number | null }
    message: string; // Message de statut précis
}

// ------------------------------------------------------------------------------------------------
// --- NOUVELLES FONCTIONS D'APPEL DE LA CLOUD FUNCTION ---
// ------------------------------------------------------------------------------------------------


/**
 * Appelle la Cloud Function pour récupérer le Débit et la Hauteur en temps réel.
 * CF Query: type=realtime
 */
export const fetchHydroRealtime = async (): Promise<HydroResult> => {
    
    const queryUrl = `${CLOUD_FUNCTION_URL}?type=realtime`;
    
    try {
        const response = await fetch(queryUrl);
        if (!response.ok) {
            const errorText = response.statusText; 
            console.error(`❌ Erreur CF Hydrométrie Temps Réel (Code: ${response.status}): ${errorText}`);
            return { 
                data: { flow: 0, level: 0, waterTemp: null }, // Ajout de waterTemp: null pour sécurité
                message: `CF ERREUR HTTP ${response.status}: ${errorText}`
            }; 
        }

        // La Cloud Function renvoie HydroResult (flow, level et message)
        const result: HydroResult = await response.json();
        
        console.log(`✅ CF Hydro Temps Réel: Débit=${result.data.flow} m³/s, Niveau=${result.data.level} m`);
        return result;

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Connexion impossible.';
        console.error("❌ Erreur Réseau lors de l'appel CF Hydrométrie Temps Réel:", errorMessage);
        
        return { 
            data: { flow: 0, level: 0, waterTemp: null }, 
            message: `CF ERREUR RÉSEAU: ${errorMessage}`
        }; 
    }
};


/**
 * Appelle la Cloud Function pour récupérer la Température de l'Eau J-1 (historique).
 * CF Query: type=watertemp
 */
export const fetchWaterTempJMinus1 = async (): Promise<WaterTempData | null> => {
    
    const queryUrl = `${CLOUD_FUNCTION_URL}?type=watertemp`;
    
    try {
        const response = await fetch(queryUrl);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Erreur CF Température J-1 (Code: ${response.status}): ${errorText}`);
            return null;
        }

        // La Cloud Function renvoie soit WaterTempData, soit null
        const data: WaterTempData | null = await response.json();

        if (data) {
            console.log(`✅ CF Température J-1: [${data.date}]: ${data.temperature}°C`);
        } else {
             console.log(`CF Température J-1: Aucune donnée trouvée.`);
        }
        
        return data;

    } catch (error) {
        console.error("❌ Erreur Réseau lors de l'appel CF Température J-1:", error);
        return null;
    }
};


// ------------------------------------------------------------------------------------------------
// --- FONCTIONS DE CACHE (Inchangées) ---
// ------------------------------------------------------------------------------------------------

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

// --- FIN LIB/HUBEAUD-SERVICE.TS ---