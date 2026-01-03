// scripts/export-referentials.ts
// Lancement : npx tsx scripts/export-referentials.ts

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

const SERVICE_ACCOUNT_FILE = 'serviceAccountKey.json';
const OUTPUT_FILE = 'referentials_for_ai.json';

/**
 * Liste des collections de référence techniques (Arsenal).
 * On exclut 'locations' pour garantir la confidentialité des zones de pêche.
 */
const REFS_COLLECTIONS = [
    'ref_lure_types', // Types de leurres (LS, PN, etc.)
    'ref_colors',     // Nuancier des couleurs
    'ref_sizes',      // Tailles référencées
    'ref_weights',    // Poids référencés
    'techniques',     // Techniques de pêche (Linéaire, Verticale...)
    'setups'          // Combos canne/moulinet
];

async function exportReferentials() {
    const serviceAccountPath = path.join(process.cwd(), SERVICE_ACCOUNT_FILE);
    
    if (!fs.existsSync(serviceAccountPath)) {
        console.error(`❌ Erreur : Le fichier ${SERVICE_ACCOUNT_FILE} est introuvable.`);
        process.exit(1);
    }

    if (getApps().length === 0) {
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
        initializeApp({ credential: cert(serviceAccount) });
    }

    const db = getFirestore();
    const finalExport: Record<string, any> = {};

    console.log("🚀 Extraction des référentiels techniques Oracle (uniquement les items actifs)...");

    for (const colName of REFS_COLLECTIONS) {
        try {
            // Michael : Ajout du filtre .where('active', '==', true) pour n'exporter que les items valides
            const snapshot = await db.collection(colName).where('active', '==', true).get();
            
            finalExport[colName] = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    // On gère la priorité entre 'label' et 'name' selon la collection
                    label: data.label || data.name || "Sans nom"
                };
            });
            
            console.log(`✅ ${colName} : ${finalExport[colName].length} éléments actifs extraits`);
        } catch (error) {
            console.error(`⚠️ Erreur sur la collection ${colName}:`, error);
        }
    }

    finalExport['metadata'] = {
        exportedAt: new Date().toISOString(),
        version: "4.5-arsenal-only"
    };

    fs.writeFileSync(
        path.join(process.cwd(), OUTPUT_FILE), 
        JSON.stringify(finalExport, null, 2)
    );

    console.log(`\n✨ Terminé ! Fichier généré : ${OUTPUT_FILE}`);
    console.log("Tu peux maintenant injecter ce JSON dans le prompt de ta Cloud Function pour le mapping Oracle Vision.");
}

exportReferentials().catch(console.error);