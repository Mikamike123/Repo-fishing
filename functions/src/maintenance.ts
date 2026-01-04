import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

/**
 * PURGE HEBDOMADAIRE DE LA MÉMOIRE DU COACH
 * Déclenchement : Tous les lundis à 04:00 (Europe/Paris)
 * Cible : Collection users/{userId}/coach_memoire
 */
export const purgeCoachMemory = onSchedule({
    schedule: "0 4 * * 1", 
    timeZone: "Europe/Paris",
    region: "europe-west1",
    memory: "256MiB", // Michael : Pas besoin de beaucoup de RAM pour supprimer des strings
}, async (event) => {
    const db = admin.firestore();
    
    try {
        // 1. On récupère tous les utilisateurs pour accéder à leurs sous-collections
        const usersSnap = await db.collection("users").get();

        if (usersSnap.empty) {
            logger.info("[Maintenance] Aucun utilisateur trouvé. Purge annulée.");
            return;
        }

        logger.info(`[Maintenance] Lancement de la purge pour ${usersSnap.size} profils.`);

        const promises = usersSnap.docs.map(async (userDoc) => {
            const userId = userDoc.id;
            // Chemin conforme à ta structure coach_memoire
            const memoryCol = db.collection("users").doc(userId).collection("coach_memoire");
            const messagesSnap = await memoryCol.get();

            if (messagesSnap.empty) return;

            // Michael : Utilisation d'un batch pour une suppression atomique par utilisateur
            const batch = db.batch();
            messagesSnap.docs.forEach(doc => batch.delete(doc.ref));
            
            await batch.commit();
            logger.info(`[Maintenance] Mémoire vidée pour l'UID: ${userId} (${messagesSnap.size} messages supprimés).`);
        });

        await Promise.all(promises);
        logger.info("[Maintenance] Opération Clean Slate terminée avec succès.");

    } catch (error: any) {
        logger.error("[Maintenance] Échec critique de la purge hebdomadaire :", error.message);
    }
});