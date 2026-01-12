// lib/firebase.ts
import { initializeApp } from "firebase/app";
import { 
    initializeFirestore, // Michael : Nouveau moteur d'initialisation
    persistentLocalCache, 
    persistentMultipleTabManager,
    collection, 
    doc, 
    getDocs, 
    deleteDoc
} from "firebase/firestore"; 
import { getFunctions } from "firebase/functions"; 
import { getStorage } from "firebase/storage"; 
import { 
    getAuth, 
    GoogleAuthProvider, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from "firebase/auth";
// Michael : Importation du module de messagerie pour les notifications push
import { getMessaging, getToken } from "firebase/messaging"; 

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

/**
 * Michael : Configuration Firebase optimisée.
 * L'ajout de l'appId est CRITIQUE pour Firebase Messaging et Installations.
 */
const firebaseConfig = {
    apiKey: getEnvVar('VITE_FIREBASE_API_KEY') || 'AIzaSyBg7rhZeL217FPxcKRUqgNj_85Ujm11pQI',
    authDomain: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN') || "mysupstack.firebaseapp.com",
    projectId: getEnvVar('VITE_FIREBASE_PROJECT_ID') || "mysupstack", 
    storageBucket: getEnvVar('VITE_FIREBASE_STORAGE_BUCKET') || "mysupstack.firebasestorage.app",
    messagingSenderId: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID') || "951910603732",
    // Michael : Identifiant préservé pour le Cloud Messaging
    appId: getEnvVar('VITE_FIREBASE_APP_ID') || "1:1072483547940:web:b5bdba593e8b74372e11b1", 
    measurementId: getEnvVar('VITE_FIREBASE_MEASUREMENT_ID')
};

const app = initializeApp(firebaseConfig);

/**
 * 2. Initialisation des Services
 * Michael : Migration vers initializeFirestore pour supprimer l'avertissement de dépréciation.
 * On active la persistance multi-onglets (Offline First) directement ici.
 */
export const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
    })
});

export const storage = getStorage(app);
export const auth = getAuth(app); 
export const googleProvider = new GoogleAuthProvider(); 
export const functions = getFunctions(app, "europe-west1");

// Michael : Initialisation de l'antenne de messagerie (uniquement côté client)
export const messaging = typeof window !== 'undefined' ? getMessaging(app) : null;

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

// Exports des méthodes pour l'usage dans les composants
export { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    getToken // Michael : On exporte getToken pour récupérer la clé du téléphone
};

export { app };