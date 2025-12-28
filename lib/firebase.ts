// lib/firebase.ts

import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, getDocs, deleteDoc } from "firebase/firestore"; 
import { getFunctions } from "firebase/functions"; 
import { getStorage } from "firebase/storage"; 
import { GoogleGenAI } from "@google/genai";

/**
 * Michael : Fonction utilitaire pour détecter l'environnement (Scripts Node vs Frontend Vite).
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

// ID UTILISATEUR DE DÉMONSTRATION
export const USER_ID = "user_1"; 

// 1. Config Firebase
const firebaseConfig = {
    apiKey: getEnvVar('VITE_GEMINI_API_KEY'), 
    authDomain: "mysupstack.firebaseapp.com",
    projectId: "mysupstack", 
    storageBucket: "mysupstack.firebasestorage.app"
};

const geminiApiKey = firebaseConfig.apiKey;
if (!geminiApiKey) {
    console.warn("⚠️ Attention: Clé API Gemini non détectée.");
}

const app = initializeApp(firebaseConfig);

// 2. Initialisation des Services
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, "europe-west1");

// 3. Initialisation Gemini
// Michael : Correction TS2559 - On passe un objet { apiKey: string }
export const ai = new GoogleGenAI({ 
    apiKey: geminiApiKey || "" 
});

// --- CHEMINS D'ACCÈS AUX COLLECTIONS ---
export const chatHistoryCollection = collection(db, 'users', USER_ID, 'coach_memoire');
export const sessionsCollection = collection(db, 'sessions'); 
export const zonesCollection = collection(db, 'zones');
export const setupsCollection = collection(db, 'setups');
export const techniquesCollection = collection(db, 'techniques');
export const luresCollection = collection(db, 'lures');
export const envLogsCollection = collection(db, 'environmental_logs');

/**
 * Nettoyage de l'historique IA
 */
export const clearChatHistory = async () => {
    const snapshot = await getDocs(chatHistoryCollection);
    if (snapshot.empty) return; 
    
    const deletePromises = snapshot.docs.map(d => 
        deleteDoc(doc(db, 'users', USER_ID, 'coach_memoire', d.id))
    );
    
    await Promise.all(deletePromises);
    console.log(`Historique de chat effacé : ${deletePromises.length} messages supprimés.`);
};

export { app };