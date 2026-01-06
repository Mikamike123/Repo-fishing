// lib/firebase.ts
import { initializeApp } from "firebase/app";
import { 
    getFirestore, 
    collection, 
    doc, 
    getDocs, 
    deleteDoc, 
    enableMultiTabIndexedDbPersistence 
} from "firebase/firestore"; 
import { getFunctions } from "firebase/functions"; 
import { getStorage } from "firebase/storage"; 
import { getAuth, GoogleAuthProvider } from "firebase/auth";

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

const firebaseConfig = {
    apiKey: 'AIzaSyBg7rhZeL217FPxcKRUqgNj_85Ujm11pQI',
    authDomain: "mysupstack.firebaseapp.com",
    projectId: "mysupstack", 
    storageBucket: "mysupstack.firebasestorage.app"
};

const app = initializeApp(firebaseConfig);

// 2. Initialisation des Services
export const db = getFirestore(app);

/**
 * Michael : Activation du mode Offline First pour Firestore.
 * Permet la consultation des sessions et secteurs sans réseau.
 */
enableMultiTabIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
        console.warn("La persistance échoue (multiples onglets ouverts)");
    } else if (err.code === 'unimplemented') {
        console.warn("Le navigateur actuel ne supporte pas la persistance");
    }
});

export const storage = getStorage(app);
export const auth = getAuth(app); 
export const googleProvider = new GoogleAuthProvider(); 
export const functions = getFunctions(app, "europe-west1");

// --- CHEMINS D'ACCÈS AUX COLLECTIONS (PRÉSERVÉS) ---
export const sessionsCollection = collection(db, 'sessions'); 
export const zonesCollection = collection(db, 'zones');
export const setupsCollection = collection(db, 'setups');
export const techniquesCollection = collection(db, 'techniques');
export const luresCollection = collection(db, 'lures');
export const envLogsCollection = collection(db, 'environmental_logs');

export const getChatHistoryCollection = (userId: string) => {
    return collection(db, 'users', userId, 'coach_memoire');
};

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