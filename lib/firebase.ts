// lib/firebase.ts
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, getDocs, deleteDoc } from "firebase/firestore"; 
import { getFunctions } from "firebase/functions"; 
import { getStorage } from "firebase/storage"; 
import { getAuth, GoogleAuthProvider } from "firebase/auth"; // Michael : Ajout de l'Auth
import { GoogleGenAI } from "@google/genai";

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
export const auth = getAuth(app); // Michael : Export du module Auth
export const googleProvider = new GoogleAuthProvider(); // Michael : Préparation du login Google
export const functions = getFunctions(app, "europe-west1");

// 3. Initialisation Gemini (Stricte conformité v4.6)
export const ai = new GoogleGenAI({ 
    apiKey: geminiApiKey || "" 
});

// --- CHEMINS D'ACCÈS AUX COLLECTIONS ---
export const sessionsCollection = collection(db, 'sessions'); 
export const zonesCollection = collection(db, 'zones');
export const setupsCollection = collection(db, 'setups');
export const techniquesCollection = collection(db, 'techniques');
export const luresCollection = collection(db, 'lures');
export const envLogsCollection = collection(db, 'environmental_logs');

/**
 * Michael : Accès dynamique à l'historique par utilisateur.
 * Remplace la constante statique pour le multi-user.
 */
export const getChatHistoryCollection = (userId: string) => {
    return collection(db, 'users', userId, 'coach_memoire');
};

/**
 * Nettoyage de l'historique IA
 */
export const clearChatHistory = async (userId: string) => {
    const chatHistoryCol = getChatHistoryCollection(userId);
    const snapshot = await getDocs(chatHistoryCol);
    if (snapshot.empty) return; 
    
    const deletePromises = snapshot.docs.map(d => 
        deleteDoc(doc(db, 'users', userId, 'coach_memoire', d.id))
    );
    
    await Promise.all(deletePromises);
    console.log(`Historique effacé pour ${userId}`);
};

export { app };