// lib/hubeau-service.ts
import { db } from "./firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { HydroSnapshot } from '../types'; 

const CLOUD_FUNCTION_URL = import.meta.env.VITE_CLOUD_FUNCTION_URL;

console.log("DEBUG: Appel CF via", CLOUD_FUNCTION_URL);

export interface WaterTempData {
    date: string;
    temperature: number;
    unit: string;
}

export interface HydroResult {
    data: HydroSnapshot;
    message: string;
}

export const fetchHydroRealtime = async (): Promise<HydroResult> => {
    if (!CLOUD_FUNCTION_URL) {
        console.error("❌ VITE_CLOUD_FUNCTION_URL manquante dans le .env");
        return { data: { flow: 0, level: 0, waterTemp: null }, message: "URL CF Manquante" };
    }
    
    const queryUrl = `${CLOUD_FUNCTION_URL}?type=realtime`;
    try {
        const response = await fetch(queryUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result: HydroResult = await response.json();
        return result;
    } catch (error) {
        console.error("❌ Erreur CF Hydrométrie:", error);
        return { data: { flow: 0, level: 0, waterTemp: null }, message: "Erreur réseau" }; 
    }
};

export const fetchWaterTempJMinus1 = async (): Promise<WaterTempData | null> => {
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