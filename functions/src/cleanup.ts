import { onDocumentDeleted, onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

/**
 * HELPER : Extraire le chemin du Storage à partir d'une URL Firebase Storage
 * Format type: https://firebasestorage.googleapis.com/v0/b/[BUCKET]/o/catches%2F[USERID]%2F[FILE].jpg?alt=media...
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
 * ACTION : Supprimer physiquement un fichier du Storage
 * Michael, on catch l'erreur pour que le trigger Firestore ne boucle pas si le fichier est déjà mort.
 */
const deleteStorageFile = async (url: string) => {
    const path = getPathFromUrl(url);
    if (!path) return;

    try {
        const bucket = admin.storage().bucket();
        const file = bucket.file(path);
        const [exists] = await file.exists();
        
        if (exists) {
            await file.delete();
            logger.info(`[Cleanup] Fichier supprimé avec succès : ${path}`);
        }
    } catch (error: any) {
        logger.warn(`[Cleanup] Échec de suppression (asynchrone) pour ${path}: ${error.message}`);
    }
};

/**
 * 1. TRIGGER : Suppression globale d'une Session
 * On nettoie TOUTES les photos associées à TOUTES les prises de la session.
 */
export const cleanupSessionPhotos = onDocumentDeleted({
    document: "sessions/{sessionId}",
    region: "europe-west1"
}, async (event) => {
    const deletedData = event.data?.data();
    if (!deletedData || !deletedData.catches) return;

    const allUrls = (deletedData.catches as any[]).flatMap(c => c.photoUrls || []);
    
    if (allUrls.length === 0) return;

    logger.info(`[Cleanup] Session ${event.params.sessionId} supprimée. Nettoyage de ${allUrls.length} photos.`);
    
    // Michael : On utilise allSettled pour ne pas bloquer si une suppression foire
    await Promise.allSettled(allUrls.map(url => deleteStorageFile(url)));
});

/**
 * 2. TRIGGER : Mise à jour d'une Session (Suppression d'une Prise)
 * Si Michael retire une prise de sa session, on supprime les photos orphelines.
 */
export const cleanupRemovedCatchPhotos = onDocumentUpdated({
    document: "sessions/{sessionId}",
    region: "europe-west1"
}, async (event) => {
    const beforeCatches = (event.data?.before.data()?.catches || []) as any[];
    const afterCatches = (event.data?.after.data()?.catches || []) as any[];

    // Identifier les URLs qui étaient présentes avant mais plus après
    const beforeUrls = beforeCatches.flatMap(c => c.photoUrls || []);
    const afterUrls = afterCatches.flatMap(c => c.photoUrls || []);
    
    const urlsToDelete = beforeUrls.filter(url => !afterUrls.includes(url));

    if (urlsToDelete.length === 0) return;

    logger.info(`[Cleanup] ${urlsToDelete.length} photos orphelines détectées après mise à jour de la session ${event.params.sessionId}.`);
    
    await Promise.allSettled(urlsToDelete.map(url => deleteStorageFile(url)));
});