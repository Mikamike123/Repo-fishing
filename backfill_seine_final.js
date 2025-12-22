import admin from 'firebase-admin';
import fs from 'fs';

// --- CONFIGURATION ---
const SERVICE_ACCOUNT_PATH = './serviceAccountKey.json';
const COLLECTION_PATH = 'environmental_logs'; // Correspond à votre screenshot
const DRY_RUN = false; // Mettre à false pour appliquer les changements
const MAX_LOGS_SAMPLES = 5; 

const Q_MIN = 100; 
const Q_MAX = 1200; 
const LAG_MIN_PHYSICAL = 8.0; 

// --- INITIALISATION FIREBASE ---
if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error("❌ Erreur : Fichier serviceAccountKey.json introuvable.");
    process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function runBackfill() {
    console.log(`🚀 Mode : ${DRY_RUN ? '🔍 DRY RUN' : '💾 PRODUCTION'}`);
    console.log(`📥 Collection : ${COLLECTION_PATH}`);

    // Tri par ID de document pour garantir l'ordre chronologique
    const snapshot = await db.collection(COLLECTION_PATH)
                             .orderBy(admin.firestore.FieldPath.documentId(), 'asc')
                             .get();
    
    if (snapshot.empty) return console.log("❌ Aucune donnée trouvée.");

    const docs = snapshot.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));
    console.log(`📊 ${docs.length} documents chargés.`);

    let batch = db.batch();
    let countInBatch = 0;
    let totalProcessed = 0;
    let sandreBuffer = []; 

    for (let i = 0; i < docs.length; i++) {
        const d = docs[i];
        
        // --- 1. ACCÈS AUX DONNÉES (Structure imbriquée validée) ---
        const Tw = parseFloat(d.hydro?.waterTemp) || 0;
        const q_m3s = (parseFloat(d.hydro?.flow) || 0) / 1000;
        const h_m = (parseFloat(d.hydro?.level) || 0) / 1000;
        
        const press = parseFloat(d.weather?.pressure) || 1013; 
        const cloud = parseFloat(d.weather?.cloudCover) || 0;
        const wind = parseFloat(d.weather?.windSpeed) || 0;
        const tempAir = parseFloat(d.weather?.temp) || 15;

        // --- 2. LOGIQUE DE CALCUL ---
        const lag = Math.max(LAG_MIN_PHYSICAL, 36.4 - (0.058 * q_m3s) + (5.125 * h_m));
        const lookbackIdx = Math.max(0, i - Math.round(lag));
        const flowLagged = (parseFloat(docs[lookbackIdx].hydro?.flow) || 0) / 1000;

        let dP = 0;
        if (i >= 3) {
            const oldPress = parseFloat(docs[i-3].weather?.pressure) || press;
            dP = press - oldPress;
        }

        let flowTrend24 = 0;
        if (i >= 24) {
            const flow24hAgo = (parseFloat(docs[i-24].hydro?.flow) || 0) / 1000;
            flowTrend24 = flowLagged - flow24hAgo;
        }
        
        const qNorm = Math.min(1, Math.max(0, (flowLagged - Q_MIN) / (Q_MAX - Q_MIN)));
        const turbIdx = (flowTrend24 > 0) ? Math.min(1.0, qNorm * 2.5) : qNorm;
        const lux = calculateSeasonalLux(d.id, cloud);
        const windF = Math.min(1.0, Math.max(0.2, 0.2 + 0.8 * (wind / 30)));

        let sumAir = 0, countAir = 0;
        for (let k = Math.max(0, i - 71); k <= i; k++) {
            sumAir += parseFloat(docs[k].weather?.temp) || 15;
            countAir++;
        }
        const tAir3d = sumAir / countAir;

        // --- 3. BIOSCORES ---
        const fP_s = 1 / (1 + Math.exp(2.0 * (dP - 0.5)));
        const fLT_s = (1 - lux) + lux * Math.tanh(4 * turbIdx);
        const fT_s = Math.exp(-Math.pow(Tw - 17, 2) / 128);
        const rawSandre = 100 * Math.pow(fP_s, 0.4) * Math.pow(fLT_s, 0.4) * Math.pow(fT_s, 0.2);
        
        sandreBuffer.push(rawSandre);
        if (sandreBuffer.length > 3) sandreBuffer.shift();
        const scoreSandre = sandreBuffer.reduce((a, b) => a + b, 0) / sandreBuffer.length;

        let scoreBrochet = 0;
        if (Tw <= 24.0) {
            const fT_b = 1 / (1 + Math.exp(0.8 * (Tw - 21)));
            const fVis_b = Math.exp(-2.5 * turbIdx);
            scoreBrochet = 100 * Math.pow(fT_b, 0.5) * Math.pow(fVis_b, 0.3) * Math.pow(windF, 0.2);
        }

        const fT_p = Math.exp(-Math.pow(Tw - 21, 2) / 72);
        const fP_p = Math.max(Math.exp(-2 * Math.abs(dP)), 1 / (1 + Math.exp(3.0 * (dP + 1.5))));
        const scorePerche = 100 * Math.pow(fT_p, 0.5) * Math.pow(fP_p, 0.5);

        // --- 4. OBJET DE MISE À JOUR ---
        const updatePayload = {
            "computed.lag_hours": parseFloat(lag.toFixed(1)),
            "computed.flow_lagged": parseFloat(flowLagged.toFixed(2)),
            "computed.turbidity_idx": parseFloat(turbIdx.toFixed(3)),
            "computed.lux_norm": parseFloat(lux.toFixed(3)),
            "computed.pressure_gradient_3h": parseFloat(dP.toFixed(2)),
            "computed.wind_factor": parseFloat(windF.toFixed(3)),
            "computed.temp_air_smoothed_3d": parseFloat(tAir3d.toFixed(2)),
            "computed.score_sandre": parseFloat(scoreSandre.toFixed(1)),
            "computed.score_brochet": parseFloat(scoreBrochet.toFixed(1)),
            "computed.score_perche": parseFloat(scorePerche.toFixed(1)),
            "computed.last_backfill": admin.firestore.FieldValue.serverTimestamp()
        };

        // --- 5. LOGS DÉTAILLÉS (5 PREMIERS) ---
        if (totalProcessed < MAX_LOGS_SAMPLES) {
            console.log(`\n📄 [${d.id}] --------------------------------`);
            console.log(`   Entrées : Flow=${q_m3s.toFixed(1)}m3/s, Temp Eau=${Tw}°C`);
            console.log(`   Calculs : Sandre=${scoreSandre.toFixed(1)}, Turbidité=${turbIdx.toFixed(2)}`);
            console.log(`   Action  : ${DRY_RUN ? 'SIMULATION' : 'MISE À JOUR'}`);
        }

        if (!DRY_RUN) {
            batch.update(d.ref, updatePayload);
            countInBatch++;
            if (countInBatch === 500) {
                await batch.commit();
                batch = db.batch();
                countInBatch = 0;
            }
        }
        totalProcessed++;
    }

    if (!DRY_RUN && countInBatch > 0) await batch.commit();
    console.log(`\n✨ Terminé sur ${totalProcessed} documents.`);
}

function calculateSeasonalLux(docId, cloudCover) {
    try {
        const parts = docId.split('_'); 
        const dateParts = parts[0].split('-');
        const month = parseInt(dateParts[1]);
        const hour = parseInt(parts[1].substring(0, 2)) + (parseInt(parts[1].substring(2)) / 60);
        const schedule = {
            1: [8.5, 17.0], 2: [8.0, 18.0], 3: [7.0, 19.0], 4: [6.0, 20.5], 5: [5.5, 21.5], 6: [5.5, 22.0],
            7: [6.0, 21.5], 8: [6.5, 20.5], 9: [7.5, 19.5], 10: [8.0, 18.5], 11: [8.0, 17.0], 12: [8.5, 16.5]
        };
        const [rise, set] = schedule[month] || [7, 19];
        if (hour < rise || hour > set) return 0;
        const elev = Math.sin(Math.PI * (hour - rise) / (set - rise));
        return Math.max(0, elev * (1 - 0.75 * Math.pow(cloudCover / 100, 2)));
    } catch (e) { return 0.5; }
}

runBackfill().catch(console.error);