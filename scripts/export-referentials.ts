// scripts/export-referentials.ts
// Lancement : npx tsx scripts/export-referentials.ts

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

const SERVICE_ACCOUNT_FILE = 'serviceAccountKey.json';
const OUTPUT_FILE = 'referentials_for_ai.json';

// Les collections de référence définies dans tes specs
const REFS_COLLECTIONS = [
    'ref_lure_types',
    'ref_colors',
    'ref_sizes',
    'ref_weights',
    'techniques',
    'zones'
];

async function exportReferentials() {
    const serviceAccountPath = path.join(process.cwd(), SERVICE_ACCOUNT_FILE);
    
    if (getApps().length === 0) {
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
        initializeApp({ credential: cert(serviceAccount) });
    }

    const db = getFirestore();
    const finalExport: Record<string, any> = {};

    console.log("🚀 Extraction des référentiels Oracle...");

    for (const colName of REFS_COLLECTIONS) {
        const snapshot = await db.collection(colName).get();
        finalExport[colName] = snapshot.docs.map(doc => ({
            id: doc.id,
            label: doc.data().label
        }));
        console.log(`✅ ${colName} : ${snapshot.size} éléments`);
    }

    fs.writeFileSync(
        path.join(process.cwd(), OUTPUT_FILE), 
        JSON.stringify(finalExport, null, 2)
    );

    console.log(`\n✨ Terminé ! Fichier généré : ${OUTPUT_FILE}`);
    console.log("Tu peux maintenant copier le contenu de ce fichier dans le prompt de ta Cloud Function.");
}

exportReferentials().catch(console.error);