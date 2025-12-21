/**
 * ============================================================================
 * SCRIPT: Backfill Observatoire (RETRY & CRASH RECOVERY)
 * ============================================================================
 * * DESCRIPTION:
 * Ce script est conçu pour combler les trous récents (quelques jours max)
 * en utilisant STRICTEMENT les mêmes APIs que la Cloud Function de Production.
 *
 * * SOURCES :
 * - Météo : api.open-meteo.com (Forecast API avec paramètre past_days)
 * - Hydro : Vigicrues (observations.json avec MaxObs élevé)
 *
 * * PRÉREQUIS :
 * - Le fichier 'serviceAccountKey.json' doit être à la racine.
 * ============================================================================
 * COMMANDES :
 * npx tsx scripts/backfill-observatory.ts --date 2025-12-19 --dry-run
 * npx tsx scripts/backfill-observatory.ts --date 2025-12-19
 * npx tsx scripts/backfill-observatory.ts --date 2025-12-19 --update-empty
 *  ============================================================================
 */


import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import * as path from 'path';
import * as fs from 'fs';
import minimist from 'minimist';
import { addHours, format, startOfDay, endOfDay, isSameHour } from 'date-fns';

// --- CONFIGURATION IDENTIQUE PROD ---
const LAT = 48.92;
const LON = 2.19;
const STATION_CODE_HYDRO = "F700000103"; // Paris-Austerlitz (H et Q disponibles)
const VIGICRUES_BASE_URL = "https://www.vigicrues.gouv.fr/services/observations.json";

// --- CONFIG FIREBASE ---
try {
    const serviceAccountPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
    if (!fs.existsSync(serviceAccountPath)) throw new Error(`Clé introuvable : ${serviceAccountPath}`);
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    
    if (getApps().length === 0) initializeApp({ credential: cert(serviceAccount) });
} catch (error) {
    console.error("❌ Erreur Config Firebase:", error);
    process.exit(1);
}
const db = getFirestore();

// --- FETCHERS ---

/**
 * Récupère la météo via l'API Open-Meteo (Forecast) avec historique.
 */
async function fetchWeatherStandard(targetDate: Date) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure,cloud_cover&hourly=temperature_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure,cloud_cover&timezone=Europe%2FParis&past_days=7`;

    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`OpenMeteo Error: ${res.statusText}`);
        const json = await res.json();
        
        const times = json.hourly.time; 
        const targetIsoShort = format(targetDate, "yyyy-MM-dd'T'HH:mm");
        const index = times.findIndex((t: string) => t === targetIsoShort);

        if (index === -1) return null;

        const h = json.hourly;
        return {
            temp: h.temperature_2m[index],
            pressure: h.surface_pressure[index],
            windSpeed: h.wind_speed_10m[index],
            windDir: h.wind_direction_10m[index],
            precip: h.precipitation[index],
            cloudCover: h.cloud_cover[index],
            condition_code: h.weather_code[index]
        };
    } catch (e) {
        console.error("   ⚠️ Erreur Fetch Weather:", e);
        return null;
    }
}

/**
 * Récupère l'hydro via Vigicrues (Observations Temps Réel).
 * Austerlitz fournit le débit (Q) et la hauteur (H).
 */
async function fetchVigicruesData(targetDate: Date) {
    const getVigicruesValue = async (grandeur: "H" | "Q"): Promise<number | null> => {
        const url = `${VIGICRUES_BASE_URL}?CdStationHydro=${STATION_CODE_HYDRO}&GrdSerie=${grandeur}&FormatDate=iso&MaxObs=600`;
        
        try {
            const res = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
            });
            if (!res.ok) return null;
            const json = await res.json();
            const observations = json.Serie?.ObssHydro; 

            if (!observations || observations.length === 0) return null;

            const targetTime = targetDate.getTime();
            let bestMatch: any = null;
            let minDiff = Infinity;

            for (const obs of observations) {
                const obsTime = new Date(obs.DtObsHydro).getTime();
                const diff = Math.abs(obsTime - targetTime);

                // Tolérance de 60 minutes pour trouver le relevé le plus proche
                if (diff < minDiff && diff < 60 * 60 * 1000) { 
                    minDiff = diff;
                    bestMatch = obs;
                }
            }
            return bestMatch ? bestMatch.ResObsHydro : null;
        } catch (e) {
            return null;
        }
    };

    const [valH, valQ] = await Promise.all([
        getVigicruesValue("H"),
        getVigicruesValue("Q")
    ]);

    if (valH === null && valQ === null) return null;

    return {
        // Conversion : m -> mm et m3/s -> L/s
        level: valH !== null ? Math.round(valH * 1000) : null,
        flow: valQ !== null ? Math.round(valQ * 1000) : null,
        station: STATION_CODE_HYDRO
    };
}

// --- LOGIQUE PRINCIPALE ---

async function main() {
    const args = minimist(process.argv.slice(2));
    const targetDateStr = args['date'];
    const isDryRun = args['dry-run'] || false;
    const updateEmpty = args['update-empty'] || false;

    if (!targetDateStr) {
        console.error("❌ Erreur: --date YYYY-MM-DD manquant.");
        process.exit(1);
    }

    const now = new Date(); // Heure actuelle pour la sécurité de boucle
    const targetDate = new Date(targetDateStr);
    const start = startOfDay(targetDate);
    const end = endOfDay(targetDate);

    console.log(`\n🌊 BACKFILL OBSERVATOIRE (RETRY MODE)`);
    console.log(`📅 Cible : ${targetDateStr}`);
    console.log(`⚙️  Mode  : ${isDryRun ? '🧪 SIMULATION' : '🚀 LIVE'}\n`);

    const snapshot = await db.collection('environmental_logs')
        .where('timestamp', '>=', start)
        .where('timestamp', '<=', end)
        .get();
    const existingLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

    let created = 0, updated = 0, skipped = 0;

    for (let i = 0; i < 24; i++) {
        const currentHour = addHours(start, i);
        
        // --- SÉCURITÉ : Ne pas créer de données dans le futur ---
        if (currentHour > now) {
            console.log(`[${format(currentHour, 'HH:mm')}] ⏩ Heure future. Arrêt du script.`);
            break; 
        }

        const formattedId = format(currentHour, 'yyyy-MM-dd_HHmm');
        const hourLabel = format(currentHour, 'HH:mm');
        const existing = existingLogs.find(l => isSameHour(l.timestamp.toDate(), currentHour));

        if (!existing) {
            console.log(`[${hourLabel}] 🔭 Récupération...`);
            
            const [weather, hydro] = await Promise.all([
                fetchWeatherStandard(currentHour),
                fetchVigicruesData(currentHour)
            ]);

            if (!weather) {
                console.log(`   ❌ Météo indisponible.`);
                continue;
            }

            const newDoc = {
                id: formattedId,
                timestamp: Timestamp.fromDate(currentHour),
                dateString: format(currentHour, 'yyyy-MM-dd'),
                source: 'backfill_retry',
                location: { lat: LAT, lon: LON },
                weather,
                // Utilisation de null au lieu de 0 pour l'intégrité
                hydro: hydro || { level: null, flow: null, station: STATION_CODE_HYDRO, note: "Vigicrues Unavailable" },
                updatedAt: FieldValue.serverTimestamp()
            };

            if (isDryRun) {
                console.log(`   📦 [SIMUL] ID: ${formattedId} | Flow: ${newDoc.hydro.flow}`);
                created++;
            } else {
                await db.collection('environmental_logs').doc(formattedId).set(newDoc);
                console.log(`   ✅ Créé : ${formattedId}`);
                created++;
            }
        } else if (updateEmpty && (!existing.weather || !existing.hydro)) {
            // Logique de mise à jour si données manquantes
            const [w, h] = await Promise.all([fetchWeatherStandard(currentHour), fetchVigicruesData(currentHour)]);
            const updatePayload: any = { updatedAt: FieldValue.serverTimestamp() };
            if (!existing.weather && w) updatePayload.weather = w;
            if (!existing.hydro && h) updatePayload.hydro = h;
            
            if (Object.keys(updatePayload).length > 1) {
                if (!isDryRun) await db.collection('environmental_logs').doc(existing.id).update(updatePayload);
                console.log(`[${hourLabel}] 🛠  Mis à jour.`);
                updated++;
            }
        } else {
            skipped++;
        }
    }
    console.log(`\n🏁 Fin du run. Créés: ${created}, Mis à jour: ${updated}, Ignorés: ${skipped}`);
}

main().catch(console.error);