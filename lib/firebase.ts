// lib/firebase.ts

import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, getDocs, deleteDoc } from "firebase/firestore"; 
import { GoogleGenAI } from "@google/genai";

// ID UTILISATEUR DE DÉMONSTRATION (Utilisé pour le multi-tenancy V3)
export const USER_ID = "user_1"; 

// 1. Config Firebase
const firebaseConfig = {
    // @ts-ignore
    apiKey: import.meta.env.VITE_GEMINI_API_KEY, 
    authDomain: "mysupstack.firebaseapp.com",
    projectId: "mysupstack", 
};

const geminiApiKey = firebaseConfig.apiKey;
if (!geminiApiKey) {
    console.error("❌ ERREUR CRITIQUE: Clé API Gemini manquante.");
}

const app = initializeApp(firebaseConfig);

// 2. Initialisation Firestore
export const db = getFirestore(app);

// 3. Initialisation Gemini
export const ai = new GoogleGenAI({ 
    apiKey: geminiApiKey as string 
});

// --- CHEMINS D'ACCÈS AUX COLLECTIONS (Architecture V3) ---

// 3.1. Coach & Sessions
export const chatHistoryCollection = collection(db, 'users', USER_ID, 'coach_memoire');
export const sessionsCollection = collection(db, 'sessions'); // Collection racine avec userId interne

// 3.2. Arsenal (Nouvelle structure V3)
export const zonesCollection = collection(db, 'zones');
export const setupsCollection = collection(db, 'setups');
export const techniquesCollection = collection(db, 'techniques');
export const luresCollection = collection(db, 'lures');

// 3.3. Logs Environnementaux (Pour le futur Data Hoarder)
export const envLogsCollection = collection(db, 'environmental_logs');

/**
 * Nettoyage de l'historique IA
 */
export const clearChatHistory = async () => {
    const snapshot = await getDocs(chatHistoryCollection);
    if (snapshot.empty) return; 
    const deletePromises = snapshot.docs.map(d => deleteDoc(doc(chatHistoryCollection, d.id)));
    await Promise.all(deletePromises);
    console.log(`Historique de chat effacé : ${deletePromises.length} messages supprimés.`);
};