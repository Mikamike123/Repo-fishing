// lib/firebase.ts

import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, getDocs, deleteDoc } from "firebase/firestore"; 
import { GoogleGenAI } from "@google/genai";

// ID UTILISATEUR DE DÉMONSTRATION pour les chemins Firestore
export const USER_ID = "USER_WEB_DEMO"; 

// 1. Config Firebase
const firebaseConfig = {
    // @ts-ignore : Ignorer l'erreur de typage 'env' de l'IDE qui persiste
    apiKey: import.meta.env.VITE_GEMINI_API_KEY, 
    authDomain: "mysupstack.firebaseapp.com",
    projectId: "mysupstack", 
};

// Vérification de sécurité de la clé API
const geminiApiKey = firebaseConfig.apiKey;

if (!geminiApiKey) {
    console.error("❌ ERREUR CRITIQUE: Clé API Gemini manquante.");
}

const app = initializeApp(firebaseConfig);

// 2. Initialisation Firestore (Database)
export const db = getFirestore(app);

// 3. Initialisation Gemini
export const ai = new GoogleGenAI({ 
    apiKey: geminiApiKey as string 
});

// --- CHEMINS D'ACCÈS AUX COLLECTIONS ---

// 3.1. Collection de l'historique du Coach (Mémoire IA)
export const chatHistoryCollection = collection(db, 'users', USER_ID, 'coach_memoire');

// 3.2. Collection des Sessions de pêche (Pour la persistance)
export const sessionsCollection = collection(db, 'users', USER_ID, 'sessions');

// NOUVELLES RÉFÉRENCES POUR L'ARSENAL (Configuration utilisateur)

// 3.3. Collection des Paramètres (settings)
export const settingsCollection = collection(db, 'users', USER_ID, 'settings'); 

// 3.4. Document 'config' (Document unique qui stockera Zones, Setups, Techniques)
export const configDocRef = doc(settingsCollection, 'config'); 

/**
 * Supprime tous les messages de l'historique du coach pour redémarrer la conversation (UX).
 */
export const clearChatHistory = async () => {
    const snapshot = await getDocs(chatHistoryCollection);
    
    // Si la collection est déjà vide, ne rien faire
    if (snapshot.empty) return; 
    
    // Supprimer tous les documents trouvés dans la collection
    const deletePromises = snapshot.docs.map(d => deleteDoc(doc(chatHistoryCollection, d.id)));
    
    await Promise.all(deletePromises);
    console.log(`Historique de chat effacé : ${deletePromises.length} messages supprimés.`);
};