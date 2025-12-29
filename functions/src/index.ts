import { onSchedule } from "firebase-functions/v2/scheduler";
import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { setGlobalOptions } from "firebase-functions/v2";

setGlobalOptions({ region: "europe-west9", maxInstances: 10 });

if (!admin.apps.length) { admin.initializeApp(); }
const db = admin.firestore();

const LAT = 48.915976; 
const LON = 2.212963; 
const STATION_CODE_HYDRO = "F700000103"; 
const KH = 0.0067487; // Coefficient k horaire pour k_jour = 0.15

/**
 * HELPER : Formater l'ID Document (Europe/Paris)
 */
const getDocId = (date: Date) => {
    const p = new Intl.DateTimeFormat("fr-FR", {
        timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false
    }).formatToParts(date);
    return `${p.find(x=>x.type==='year')?.value}-${p.find(x=>x.type==='month')?.value}-${p.find(x=>x.type==='day')?.value}_${p.find(x=>x.type==='hour')?.value}00`;
};

/**
 * 1. CAPTURE DES DONNÉES (HH:10) - STABLE
 */
export const recordHourlyEnvironment = onSchedule(
    { schedule: "10 * * * *", timeZone: "Europe/Paris", region: "europe-west1" },
    async () => {
      try {
        const now = new Date();
        const docId = getDocId(now);
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,surface_pressure,wind_speed_10m,wind_direction_10m,precipitation,cloud_cover,weather_code&timezone=Europe%2FParis`;
        
        const results = await Promise.allSettled([
            fetch(url).then(res => res.json()),
            fetchVigicruesHydro("H"),
            fetchVigicruesHydro("Q")
        ]);

        const weather = results[0].status === 'fulfilled' ? results[0].value : null;
        if (!weather?.current) throw new Error("API Météo indisponible");

        await db.collection("environmental_logs").doc(docId).set({
          timestamp: admin.firestore.Timestamp.now(),
          id: docId, 
          location: { lat: LAT, lon: LON, label: "Seine Nanterre (Pêche)" },
          weather: {
              temp: weather.current.temperature_2m ?? null,
              pressure: weather.current.surface_pressure ?? null,
              windSpeed: weather.current.wind_speed_10m ?? null,
              windDir: weather.current.wind_direction_10m ?? null,
              precip: weather.current.precipitation ?? null,
              cloudCover: weather.current.cloud_cover ?? null, 
              condition_code: weather.current.weather_code ?? null
          },
          hydro: { 
              level: results[1].status === 'fulfilled' && results[1].value !== null ? Math.round(results[1].value * 1000) : null, 
              flow: results[2].status === 'fulfilled' && results[2].value !== null ? Math.round(results[2].value * 1000) : null, 
              station: STATION_CODE_HYDRO,
              waterTemp: null // Sera rempli à HH:15
          },
          updatedAt: admin.firestore.Timestamp.now()
        }, { merge: true });

        logger.info(`✅ Log initialisé pour ${docId}`);
      } catch (e: any) {
        logger.error(`❌ Erreur recordHourlyEnvironment: ${e.message}`);
      }
    }
);

/**
 * 2. ENRICHISSEMENT EWMA (HH:15) - STABLE
 */
export const enrichWaterTempEWMA = onSchedule(
    { schedule: "15 * * * *", timeZone: "Europe/Paris", region: "europe-west1" },
    async () => {
        try {
            const now = new Date();
            const docId = getDocId(now);
            
            const seventyTwoHoursAgo = new Date(now.getTime() - (72 * 60 * 60 * 1000));
            const airHistory = await db.collection("environmental_logs")
                .where("timestamp", ">=", seventyTwoHoursAgo)
                .where("timestamp", "<=", now)
                .get();
            
            const temps = airHistory.docs.map(d => d.data().weather?.temp).filter(t => t !== null);
            const tAir3d = temps.reduce((a, b) => a + b, 0) / temps.length;

            const prevDocs = await db.collection("environmental_logs")
                .where("id", "<", docId)
                .orderBy("id", "desc")
                .limit(1)
                .get();

            if (prevDocs.empty) throw new Error("Pas de document précédent trouvé.");
            const prevTw = prevDocs.docs[0].data().hydro?.waterTemp || 14.5;

            const newTw = prevTw + KH * (tAir3d - prevTw);

            await db.collection("environmental_logs").doc(docId).update({
                "hydro.waterTemp": parseFloat(newTw.toFixed(2)),
                "hydro.tempSource": "Model EWMA (k=0.15)",
                "updatedAt": admin.firestore.FieldValue.serverTimestamp()
            });

            logger.info(`✅ WaterTemp enrichie pour ${docId} : ${newTw.toFixed(2)}°C`);
        } catch (e: any) {
            logger.error(`❌ Erreur enrichWaterTempEWMA: ${e.message}`);
        }
    }
);

/**
 * 3. RE-CALCUL MANUEL (HTTP) - STABLE
 */
export const manualWaterTempRepair = onRequest(async (req, res) => {
    const { startId, endId } = req.query;
    if (!startId || !endId) {
        res.status(400).send("Paramètres startId et endId requis (format YYYY-MM-DD_HH00)");
        return;
    }

    try {
        const snapshot = await db.collection("environmental_logs")
            .where("id", ">=", startId as string)
            .where("id", "<=", endId as string)
            .orderBy("id", "asc")
            .get();

        let lastTw: number | null = null;

        for (const doc of snapshot.docs) {
            const data = doc.data();
            if (lastTw === null) {
                const prev = await db.collection("environmental_logs")
                    .where("id", "<", doc.id)
                    .orderBy("id", "desc").limit(1).get();
                lastTw = prev.empty ? 14.5 : prev.docs[0].data().hydro?.waterTemp;
            }

            const docTime = data.timestamp.toDate();
            const startHistory = new Date(docTime.getTime() - (72 * 60 * 60 * 1000));
            const history = await db.collection("environmental_logs")
                .where("timestamp", ">=", startHistory)
                .where("timestamp", "<=", docTime)
                .get();
            
            const temps = history.docs.map(d => d.data().weather?.temp).filter(t => t !== null);
            const tAir3d = temps.reduce((a, b) => a + b, 0) / temps.length;

            lastTw = (lastTw || 14.5) + KH * (tAir3d - (lastTw || 14.5));
            
            await doc.ref.update({
                "hydro.waterTemp": parseFloat(lastTw.toFixed(2)),
                "hydro.tempSource": "Model EWMA (k=0.15) [Repair]",
                "updatedAt": admin.firestore.FieldValue.serverTimestamp()
            });
        }
        res.send(`✅ Réparation terminée : ${snapshot.size} documents mis à jour.`);
    } catch (e: any) {
        res.status(500).send(e.message);
    }
});

/**
 * 4. ENRICHISSEMENT BIOSCORES (HH:20)
 * Calcule les indicateurs avancés pour l'enregistrement qui vient d'être créé.
 */
export const enrichBioscoresHourly = onSchedule(
    { schedule: "20 * * * *", timeZone: "Europe/Paris", region: "europe-west1" },
    async () => {
        try {
            const now = new Date();
            const docId = getDocId(now);

            // A. Récupération du contexte (Les 100 derniers docs pour les lissages et tendances)
            const snapshot = await db.collection("environmental_logs")
                .orderBy("id", "desc")
                .limit(100)
                .get();

            if (snapshot.empty) throw new Error("Aucun log trouvé pour le calcul.");

            // Conversion et tri chronologique pour les calculs de tendance
            const docs = snapshot.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() } as any)).reverse();
            const targetIndex = docs.findIndex((d: any) => d.id === docId);

            if (targetIndex === -1) {
                logger.warn(`⚠️ Le document ${docId} n'est pas encore prêt ou introuvable.`);
                return;
            }

            const d = docs[targetIndex];

            // --- PARAMÈTRES ET CONSTANTES ---
            const Q_MIN = 100; const Q_MAX = 1200; const LAG_MIN_PHYSICAL = 8.0;

            // --- 1. ACCÈS DONNÉES ---
            const Tw = parseFloat(d.hydro?.waterTemp) || 14.5;
            const q_m3s = (parseFloat(d.hydro?.flow) || 0) / 1000;
            const h_m = (parseFloat(d.hydro?.level) || 0) / 1000;
            const press = parseFloat(d.weather?.pressure) || 1013;
            const cloud = parseFloat(d.weather?.cloudCover) || 0;
            const wind = parseFloat(d.weather?.windSpeed) || 0;

            // --- 2. LOGIQUE INDICATEURS ---
            // Lag et Débit décalé
            const lag = Math.max(LAG_MIN_PHYSICAL, 36.4 - (0.058 * q_m3s) + (5.125 * h_m));
            const lookbackIdx = Math.max(0, targetIndex - Math.round(lag));
            const flowLagged = (parseFloat(docs[lookbackIdx]?.hydro?.flow) || (q_m3s * 1000)) / 1000;

            // Gradient Pression (3h)
            let dP = 0;
            if (targetIndex >= 3) dP = press - (parseFloat(docs[targetIndex - 3]?.weather?.pressure) || press);

            // Turbidité (Tendance 24h)
            let flowTrend24 = 0;
            if (targetIndex >= 24) {
                const flow24hAgo = (parseFloat(docs[targetIndex - 24]?.hydro?.flow) || (q_m3s * 1000)) / 1000;
                flowTrend24 = flowLagged - flow24hAgo;
            }
            const qNorm = Math.min(1, Math.max(0, (flowLagged - Q_MIN) / (Q_MAX - Q_MIN)));
            const turbIdx = (flowTrend24 > 0) ? Math.min(1.0, qNorm * 2.5) : qNorm;

            // Lissage Air (72h)
            let sumAir = 0, countAir = 0;
            for (let k = Math.max(0, targetIndex - 71); k <= targetIndex; k++) {
                sumAir += parseFloat(docs[k]?.weather?.temp) || 15;
                countAir++;
            }
            const tAir3d = sumAir / countAir;

            // Facteurs Environnementaux
            const lux = calculateSeasonalLux(d.id, cloud);
            const windF = Math.min(1.0, Math.max(0.2, 0.2 + 0.8 * (wind / 30)));

            // --- 3. CALCUL BIOSCORES ---
            // SANDRE (Lissage 3h simulé par le contexte précédent)
            const fP_s = 1 / (1 + Math.exp(2.0 * (dP - 0.5)));
            const fLT_s = (1 - lux) + lux * Math.tanh(4 * turbIdx);
            const fT_s = Math.exp(-Math.pow(Tw - 17, 2) / 128);
            const scoreSandre = 100 * Math.pow(fP_s, 0.4) * Math.pow(fLT_s, 0.4) * Math.pow(fT_s, 0.2);

            // BROCHET (Veto 24°C)
            let scoreBrochet = 0;
            if (Tw <= 24.0) {
                const fT_b = 1 / (1 + Math.exp(0.8 * (Tw - 21)));
                const fVis_b = Math.exp(-2.5 * turbIdx);
                scoreBrochet = 100 * Math.pow(fT_b, 0.5) * Math.pow(fVis_b, 0.3) * Math.pow(windF, 0.2);
            }

            // PERCHE
            const fT_p = Math.exp(-Math.pow(Tw - 21, 2) / 72);
            const fP_p = Math.max(Math.exp(-2 * Math.abs(dP)), 1 / (1 + Math.exp(3.0 * (dP + 1.5))));
            const scorePerche = 100 * Math.pow(fT_p, 0.5) * Math.pow(fP_p, 0.5);

            // --- 4. MISE À JOUR ---
            await d.ref.update({
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
            });

            logger.info(`✅ Bioscores calculés pour ${docId} (Sandre: ${scoreSandre.toFixed(1)})`);
        } catch (e: any) {
            logger.error(`❌ Erreur enrichBioscoresHourly: ${e.message}`);
        }
    }
);

/**
 * HELPER : Calcul de la luminosité normalisée (Lux_norm)
 */
function calculateSeasonalLux(docId: string, cloudCover: number): number {
    try {
        const parts = docId.split('_');
        const dateParts = parts[0].split('-');
        const month = parseInt(dateParts[1]);
        const hour = parseInt(parts[1].substring(0, 2)) + (parseInt(parts[1].substring(2)) / 60);

        const schedule: { [key: number]: [number, number] } = {
            1: [8.5, 17.0], 2: [8.0, 18.0], 3: [7.0, 19.0], 4: [6.0, 20.5], 5: [5.5, 21.5], 6: [5.5, 22.0],
            7: [6.0, 21.5], 8: [6.5, 20.5], 9: [7.5, 19.5], 10: [8.0, 18.5], 11: [8.0, 17.0], 12: [8.5, 16.5]
        };

        const [rise, set] = schedule[month] || [7, 19];
        if (hour < rise || hour > set) return 0;

        const elev = Math.sin(Math.PI * (hour - rise) / (set - rise));
        return Math.max(0, elev * (1 - 0.75 * Math.pow(cloudCover / 100, 2)));
    } catch { return 0.5; }
}

/**
 * HELPER : Vigicrues - STABLE
 */
async function fetchVigicruesHydro(grandeur: "Q" | "H"): Promise<number | null> {
    const url = `https://www.vigicrues.gouv.fr/services/observations.json?CdStationHydro=${STATION_CODE_HYDRO}&GrdSerie=${grandeur}&FormatDate=iso&MaxObs=5`;
    try {
        const response = await fetch(url);
        const data: any = await response.json();
        const obs = data?.Serie?.ObssHydro;
        return (obs && obs.length > 0) ? obs[obs.length - 1].ResObsHydro : null;
    } catch { return null; }
}

// BRANCHEMENT DE LA NOUVELLE FONCTION VISION (ISOLEE DANS VISION.TS)
export * from "./vision";
export * from "./cleanup";

export { getHistoricalContext } from "./historical";