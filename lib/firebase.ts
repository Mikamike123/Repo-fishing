// lib/firebase.ts
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, getDocs, deleteDoc } from "firebase/firestore"; 
import { getFunctions } from "firebase/functions"; 
import { getStorage } from "firebase/storage"; 
import { getAuth, GoogleAuthProvider } from "firebase/auth"; // Michael : Authentification conservée

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
// Michael : On utilise ici les clés publiques API. 
// Le fichier serviceAccountKey.json ne doit être utilisé QUE dans le dossier functions/
const firebaseConfig = {
    apiKey: getEnvVar('VITE_FIREBASE_API_KEY') || "AIzaSyBg7rhZeL217FPxcKRUqgNj_85Ujm11pQI", // Remplace par ta clé API Firebase standard si besoin
    authDomain: "mysupstack.firebaseapp.com",
    projectId: "mysupstack", 
    storageBucket: "mysupstack.firebasestorage.app"
};

const app = initializeApp(firebaseConfig);

// 2. Initialisation des Services
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app); 
export const googleProvider = new GoogleAuthProvider(); 
export const functions = getFunctions(app, "europe-west1");

// --- Michael : Initialisation Gemini SUPPRIMÉE ICI (Migration Backend effectuée) ---

// --- CHEMINS D'ACCÈS AUX COLLECTIONS (PRÉSERVÉS) ---
export const sessionsCollection = collection(db, 'sessions'); 
export const zonesCollection = collection(db, 'zones');
export const setupsCollection = collection(db, 'setups');
export const techniquesCollection = collection(db, 'techniques');
export const luresCollection = collection(db, 'lures');
export const envLogsCollection = collection(db, 'environmental_logs');

/**
 * Michael : Accès dynamique à l'historique par utilisateur.
 */
export const getChatHistoryCollection = (userId: string) => {
    return collection(db, 'users', userId, 'coach_memoire');
};

/**
 * Nettoyage de l'historique IA (Conservé pour maintenance)
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