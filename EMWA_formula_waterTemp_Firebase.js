import admin from 'firebase-admin';
import fs from 'fs';

// --- CONFIGURATION ---
const SERVICE_ACCOUNT_PATH = './serviceAccountKey.json';
const INPUT_FILE = 'export_seine_2025-12-22-06-49-06.csv';
const DRY_RUN = false; // <--- METTRE À FALSE POUR LA PRODUCTION
const CONCURRENCY_LIMIT = 50; // Nombre de mises à jour simultanées

// --- PARAMÈTRES ALGORITHME ---
const TW0 = 14.5;
const K_DAY = 0.15;
const KH = 1 - Math.pow((1 - K_DAY), 1 / 24);
const WINDOW_SIZE = 72;

// --- INITIALISATION FIREBASE ---
if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error("❌ Erreur : Fichier serviceAccountKey.json introuvable.");
    process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
const collectionRef = db.collection('environmental_logs');

async function runBackfill() {
    console.log(`--- DÉMARRAGE DU BACKFILL ---`);
    console.log(`Fichier : ${INPUT_FILE}`);
    console.log(`Mode : ${DRY_RUN ? '🚩 DRY RUN (Preview)' : '🚀 PRODUCTION'}\n`);

    const rawData = fs.readFileSync(INPUT_FILE, 'utf8');
    const lines = rawData.trim().split('\n');
    const header = lines[0].split(';');

    const idIndex = header.indexOf('ID_Document');
    const tempIndex = header.indexOf('temp');

    let currentTw = TW0;
    let stats = { success: 0, error: 0, skipped: 0 };
    let tasks = [];

    for (let i = 1; i < lines.length; i++) {
        const columns = lines[i].split(';');
        const docId = columns[idIndex];
        
        // --- 1. CALCUL EWMA (Toujours calculé pour garder la mémoire du modèle) ---
        let sumAir = 0;
        let count = 0;
        for (let j = Math.max(1, i - WINDOW_SIZE + 1); j <= i; j++) {
            let t = parseFloat(lines[j].split(';')[tempIndex]);
            if (!isNaN(t)) { sumAir += t; count++; }
        }
        const tAir3d = sumAir / count;

        if (i > 1) {
            currentTw = currentTw + KH * (tAir3d - currentTw);
        } else {
            currentTw = TW0;
        }

        const waterTempCalculated = parseFloat(currentTw.toFixed(2));

        // --- 2. LOGIQUE D'AFFICHAGE OU D'ÉCRITURE ---
        if (DRY_RUN) {
            if (i <= 30) {
                console.log(`[PREVIEW] ${docId} -> Air: ${tAir3d.toFixed(1)}°C | Eau Calc: ${waterTempCalculated}°C`);
            }
            if (i === 30) console.log("... (fin de preview)");
            continue;
        }

        // --- 3. MODE PRODUCTION ---
        // On prépare la tâche de mise à jour
        const updateTask = (async (id, val) => {
            try {
                const docRef = collectionRef.doc(id);
                await docRef.update({
                    'hydro.waterTemp': val,
                    'hydro.tempSource': 'Model EWMA (k=0.15)',
                    'updatedAt': admin.firestore.FieldValue.serverTimestamp()
                });
                stats.success++;
            } catch (err) {
                // Si l'erreur est "NOT_FOUND", c'est que le doc n'existe pas
                if (err.code === 5) { // NOT_FOUND
                    stats.skipped++;
                } else {
                    console.error(`❌ Erreur sur ${id}: ${err.message}`);
                    stats.error++;
                }
            }
        })(docId, waterTempCalculated);

        tasks.push(updateTask);

        // On exécute par paquets pour ne pas saturer la mémoire et le réseau
        if (tasks.length >= CONCURRENCY_LIMIT) {
            await Promise.all(tasks);
            tasks = [];
            process.stdout.write(`\rProgression : ${i}/${lines.length - 1} documents traités...`);
        }
    }

    // Attendre les dernières tâches
    await Promise.all(tasks);

    // --- COMPTE RENDU FINAL ---
    console.log(`\n\n--- COMPTE-RENDU D'EXÉCUTION ---`);
    console.log(`✅ Mises à jour réussies : ${stats.success}`);
    console.log(`⏩ Documents inexistants (sautés) : ${stats.skipped}`);
    console.log(`❌ Erreurs critiques : ${stats.error}`);
    console.log(`---------------------------------`);
    
    if (DRY_RUN) {
        console.log(`💡 Note : Aucun changement n'a été fait sur Firestore (Mode DRY_RUN).`);
    }
}

runBackfill().catch(err => console.error("🛑 Erreur fatale :", err));