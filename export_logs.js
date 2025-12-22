/**
 * SCRIPT D'EXPORTATION FIRESTORE VERS CSV (Version ESM)
 * * LANCEMENT : 
 * node export_logs.js
 * * RÉCUPÉRATION :
 * Le fichier sera généré dans ce dossier : export_seine_YYYY-MM-DD_HH-mm-ss.csv
 */

import admin from 'firebase-admin';
import fs from 'fs';
import { createRequire } from 'module';

// Nécessaire pour charger un fichier JSON en mode ES Module
const require = createRequire(import.meta.url);
const serviceAccount = require("./serviceAccountKey.json");

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function exportToCSV() {
    console.log("🚀 Lancement de l'exportation locale (Mode : Cohérence)...");

    try {
        const snapshot = await db.collection('environmental_logs').get();
        
        if (snapshot.empty) {
            console.log("⚠️ Aucune donnée trouvée dans la collection 'environmental_logs'.");
            return;
        }

        // 1. Transformation et Tri par ID de document
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        docs.sort((a, b) => a.id.localeCompare(b.id));

        // 2. Entêtes demandés
        const headers = [
            "ID_Document", "temp", "pressure", "windSpeed", "windDir", 
            "precip", "cloudCover", "condition_code", "level", 
            "flow", "station", "waterTemp"
        ];
        
        let csvContent = headers.join(';') + '\n';

        // 3. Boucle de génération des lignes
        docs.forEach(doc => {
            const w = doc.weather || {};
            const h = doc.hydro || {};

            const row = [
                doc.id,
                w.temp ?? "",
                w.pressure ?? "",
                w.windSpeed ?? "",
                w.windDir ?? "",
                w.precip ?? "",
                w.cloudCover ?? "",
                w.condition_code ?? "",
                h.level ?? "",
                h.flow ?? "",
                h.station ?? "",
                "" // waterTemp : Colonne maintenue vide pour la future estimation
            ];
            
            csvContent += row.join(';') + '\n';
        });

        // 4. Génération du nom de fichier avec timestamp
        const now = new Date();
        const timestamp = now.toISOString()
            .replace(/[:T]/g, '-')
            .slice(0, 19);
        const fileName = `export_seine_${timestamp}.csv`;

        // 5. Écriture physique du fichier
        fs.writeFileSync(fileName, csvContent, 'utf8');

        console.log(`✅ Exportation terminée avec succès !`);
        console.log(`📂 Fichier : ${fileName}`);
        console.log(`📊 Total : ${docs.length} lignes exportées.`);

    } catch (error) {
        console.error("❌ Erreur lors de l'exécution :", error);
    } finally {
        process.exit();
    }
}

exportToCSV();