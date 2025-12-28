// lib/hubeau-service.ts
import { db } from "./firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { HydroSnapshot } from '../types'; 

/**
 * Michael : Utilisation du helper pour détecter l'URL de la Cloud Function
 * que ce soit dans le navigateur (Vite) ou en script (Node/TSX).
 */
const getEnvVar = (key: string): string | undefined => {
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
        return process.env[key];
    }
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
        // @ts-ignore
        return import.meta.env[key];
    }
    return undefined;
};

const CLOUD_FUNCTION_URL = getEnvVar('VITE_CLOUD_FUNCTION_URL');

console.log("DEBUG: Configuration CF chargée");

export interface WaterTempData {
    date: string;
    temperature: number;
    unit: string;
}

export interface HydroResult {
    data: HydroSnapshot;
    message: string;
}

/**
 * Michael : Correction des erreurs TS2353. 
 * L'objet par défaut doit désormais inclure flowRaw, flowLagged et turbidityIdx.
 */
export const fetchHydroRealtime = async (): Promise<HydroResult> => {
    if (!CLOUD_FUNCTION_URL) {
        console.error("❌ VITE_CLOUD_FUNCTION_URL manquante");
        return { 
            data: { 
                flowRaw: 0, 
                flowLagged: 0, 
                level: 0, 
                waterTemp: null, 
                turbidityIdx: 0 
            }, 
            message: "URL CF Manquante" 
        };
    }
    
    const queryUrl = `${CLOUD_FUNCTION_URL}?type=realtime`;
    try {
        const response = await fetch(queryUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result: HydroResult = await response.json();
        return result;
    } catch (error) {
        console.error("❌ Erreur CF Hydrométrie:", error);
        return { 
            data: { 
                flowRaw: 0, 
                flowLagged: 0, 
                level: 0, 
                waterTemp: null, 
                turbidityIdx: 0 
            }, 
            message: "Erreur réseau" 
        }; 
    }
};

export const fetchWaterTempJMinus1 = async (): Promise<WaterTempData | null> => {
    if (!CLOUD_FUNCTION_URL) return null;
    const queryUrl = `${CLOUD_FUNCTION_URL}?type=watertemp`;
    try {
        const response = await fetch(queryUrl);
        return response.ok ? await response.json() : null;
    } catch { return null; }
};

export const getCachedWaterTemp = async (): Promise<WaterTempData | null> => {
    const cacheRef = doc(db, 'cache', 'water_temp');
    const docSnap = await getDoc(cacheRef);
    return docSnap.exists() ? docSnap.data() as WaterTempData : null;
};

export const updateWaterTempCache = async (data: WaterTempData) => {
    await setDoc(doc(db, 'cache', 'water_temp'), data);
};