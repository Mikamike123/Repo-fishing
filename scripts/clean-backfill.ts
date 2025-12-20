import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldPath } from 'firebase-admin/firestore'; // Import direct
import * as path from 'path';
import * as fs from 'fs';

// --- CONFIG ---
const TARGET_DATE_PREFIX = "2025-12-19"; // La date à nettoyer

async function cleanBadBackfill() {
    try {
        const serviceAccountPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
        
        if (!fs.existsSync(serviceAccountPath)) {
            throw new Error(`Fichier clé introuvable : ${serviceAccountPath}`);
        }

        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        
        if (getApps().length === 0) {
            initializeApp({ credential: cert(serviceAccount) });
        }
        const db = getFirestore();

        console.log(`🧹 Recherche des documents commençant par "${TARGET_DATE_PREFIX}"...`);

        // Utilisation de FieldPath.documentId() directement
        const snapshot = await db.collection('environmental_logs')
            .where(FieldPath.documentId(), '>=', TARGET_DATE_PREFIX)
            .where(FieldPath.documentId(), '<', TARGET_DATE_PREFIX + '\uf8ff')
            .get();

        if (snapshot.empty) {
            console.log("✅ Aucun document trouvé à nettoyer.");
            return;
        }

        console.log(`⚠️  ${snapshot.size} documents trouvés. Suppression en cours...`);

        const batch = db.batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();
        console.log("✨ Nettoyage terminé avec succès !");

    } catch (error) {
        console.error("Erreur:", error);
    }
}

cleanBadBackfill();