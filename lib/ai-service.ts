// lib/ai-service.ts
import { functions } from './firebase';
import { httpsCallable } from 'firebase/functions';

/**
 * askFishingCoach - Proxy vers l'Oracle Cloud
 * Michael : Toute la logique (Firestore, Gemini, RAG) est maintenant 
 * déportée côté serveur pour la sécurité et la performance.
 */
export const askFishingCoach = async (
    userMessage: string, 
    currentLocation: { lat: number, lng: number },
    narrativeContext: string = "",
    liveContext: string = "",
    userName: string = "Pêcheur",
    strategicContext: string = "",
    userId: string = "guest" 
): Promise<string> => {
    
    console.log("--- APPEL ORACLE VIA CLOUD FUNCTION ---");
    console.log("Utilisateur:", userName);

    try {
        // Michael : On appelle la fonction 'askFishingCoach' déployée sur europe-west1
        const callOracle = httpsCallable(functions, 'askFishingCoach');
        
        const response = await callOracle({
            userMessage,
            currentLocation, // Transmis au cas où le backend en ait besoin
            narrativeContext,
            liveContext,
            userName,
            strategicContext
        });

        // La Cloud Function renvoie un objet { text: "la réponse" }
        const data = response.data as { text: string };
        
        console.log("✅ Réponse Oracle reçue avec succès.");
        return data.text;

    } catch (error: any) {
        console.error("❌ ERREUR LIAISON ORACLE :", error);
        
        // Gestion des cas spécifiques (ex: timeout ou auth)
        if (error.code === 'unauthenticated') {
            return "Désolé Michael, la session a expiré. Reconnecte-toi pour consulter l'Oracle.";
        }
        
        return "L'Oracle est momentanément indisponible (erreur de communication).";
    }
};