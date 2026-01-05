// functions/src/storageCleanup.ts
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

/**
 * HELPER : Extraire le chemin du Storage à partir d'une URL
 */
const getPathFromUrl = (url: string): string | null => {
    try {
        if (!url.includes("firebasestorage.googleapis.com")) return null;
        const parts = url.split("/o/");
        if (parts.length < 2) return null;
        const encodedPath = parts[1].split("?")[0];
        return decodeURIComponent(encodedPath);
    } catch (e) {
        return null;
    }
};

/**
 * CRON JOB : Nettoyage quotidien des fichiers fantômes (Ghost Files)
 */
export const scheduledPhotosCleanup = onSchedule({
    schedule: "0 4 * * *",
    region: "europe-west1",
    memory: "512MiB",
    timeoutSeconds: 540
}, async (event) => {
    const bucket = admin.storage().bucket();
    const db = admin.firestore();

    logger.info("[Storage-Cleanup] Démarrage du cycle de purge...");

    try {
        const sessionsSnapshot = await db.collection("sessions").get();
        const usedPaths = new Set<string>();

        sessionsSnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.catches && Array.isArray(data.catches)) {
                data.catches.forEach((c: any) => {
                    if (c.photoUrls && Array.isArray(c.photoUrls)) {
                        c.photoUrls.forEach((url: string) => {
                            const path = getPathFromUrl(url);
                            if (path) usedPaths.add(path);
                        });
                    }
                });
            }
        });

        const [files] = await bucket.getFiles({ prefix: "catches/" });
        
        const now = Date.now();
        const gracePeriod = 24 * 60 * 60 * 1000; 
        let deleteCount = 0;

        const cleanupTasks = files.map(async (file) => {
            // Correction Erreur 7030 : Retourner explicitement null
            if (file.name.endsWith('/')) return null;

            const [metadata] = await file.getMetadata();
            
            // Correction Erreur 2769 : Vérifier la présence de timeCreated
            if (!metadata.timeCreated) {
                logger.warn(`[Storage-Cleanup] Date de création manquante pour ${file.name}, ignoré.`);
                return null;
            }

            const timeCreated = new Date(metadata.timeCreated).getTime();
            
            if (now - timeCreated < gracePeriod) return null;

            if (!usedPaths.has(file.name)) {
                logger.info(`[Storage-Cleanup] Suppression : ${file.name}`);
                deleteCount++;
                await file.delete();
                return true; 
            }

            return null; // Assure que tous les chemins retournent une valeur
        });

        await Promise.allSettled(cleanupTasks);
        logger.info(`[Storage-Cleanup] Cycle terminé. ${deleteCount} fichiers supprimés.`);

    } catch (error: any) {
        logger.error(`[Storage-Cleanup] Erreur : ${error.message}`);
    }
});