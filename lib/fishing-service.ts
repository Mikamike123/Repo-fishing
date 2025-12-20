// lib/fishing-service.ts

import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

/**
 * INTERFACE DU BRIEFING (V3.2)
 * Aligné sur la structure enregistrée par la Cloud Function
 */
export interface FishingBrief {
    date: string;
    content: string;
    created_at: any;
    conditions_snapshot: {
        temp: number;
        river_level: number;
    };
}

/**
 * RÉCUPÉRATION DU BRIEFING IA DU JOUR
 * Cette fonction interroge la collection 'fishing_briefs' pour l'ID du jour.
 */
export const getDailyFishingBrief = async (): Promise<FishingBrief | null> => {
    try {
        // Génère l'ID correspondant à la date actuelle (ex: 2025-12-20)
        const dateId = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
        
        console.log("🎣 Récupération du briefing Oracle pour :", dateId);

        const docRef = doc(db, 'fishing_briefs', dateId);
        const snap = await getDoc(docRef);

        if (snap.exists()) {
            return snap.data() as FishingBrief;
        }

        console.warn("⚠️ Aucun briefing trouvé pour aujourd'hui.");
        return null;
    } catch (error) {
        console.error("❌ Erreur lors de la récupération du briefing :", error);
        return null;
    }
};