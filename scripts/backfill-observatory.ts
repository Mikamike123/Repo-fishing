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
import { addHours, format, startOfDay, endOfDay, isSameHour, subDays } from 'date-fns';

// --- CONFIGURATION IDENTIQUE PROD ---
const LAT = 48.92;
const LON = 2.19;
const STATION_CODE_HYDRO = "F700000103"; 
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
 * Récupère la météo via l'API Standard (Forecast) en demandant l'historique récent.
 * Open-Meteo Forecast permet 'past_days' jusqu'à 92 jours.
 */
async function fetchWeatherStandard(targetDate: Date) {
    // On demande 7 jours d'historique pour être large (couvre les plantages de la semaine)
    // On utilise exactement les mêmes champs que la Cloud Function
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure,cloud_cover&hourly=temperature_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure,cloud_cover&timezone=Europe%2FParis&past_days=7`;

    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`OpenMeteo Error: ${res.statusText}`);
        const json = await res.json();
        
        // L'API renvoie un tableau 'hourly' avec 'time' (ISO strings).
        // Il faut trouver l'index qui correspond à notre targetDate.
        const times = json.hourly.time; // ex: ["2025-12-19T00:00", "2025-12-19T01:00", ...]
        
        // Format OpenMeteo dans le JSON : YYYY-MM-DDTHH:mm
        const targetIsoShort = format(targetDate, "yyyy-MM-dd'T'HH:mm");
        
        const index = times.findIndex((t: string) => t === targetIsoShort);

        if (index === -1) {
            console.error(`   ⚠️ Heure ${targetIsoShort} introuvable dans la réponse API.`);
            return null;
        }

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
 * Récupère l'hydro via VIGICRUES (observations.json)
 * C'est l'API utilisée en PROD.
 */
async function fetchVigicruesData(targetDate: Date) {
    
    // Fonction interne pour récupérer une série (H ou Q)
    const getVigicruesValue = async (grandeur: "H" | "Q"): Promise<number | null> => {
        // MaxObs=600 permet de remonter environ 2 à 4 jours en arrière selon la fréquence de la station
        const url = `${VIGICRUES_BASE_URL}?CdStationHydro=${STATION_CODE_HYDRO}&GrdSerie=${grandeur}&FormatDate=iso&MaxObs=600`;
        
        try {
            const res = await fetch(url);
            if (!res.ok) return null;
            const json = await res.json();
            const observations = json.Serie?.ObssHydro; 

            if (!observations || observations.length === 0) return null;

            // Trouver l'observation la plus proche de targetDate
            const targetTime = targetDate.getTime();
            let bestMatch: any = null;
            let minDiff = Infinity;

            for (const obs of observations) {
                const obsTime = new Date(obs.DtObsHydro).getTime();
                const diff = Math.abs(obsTime - targetTime);

                // Tolérance de 60 minutes max pour éviter les incohérences
                if (diff < minDiff && diff < 60 * 60 * 1000) { 
                    minDiff = diff;
                    bestMatch = obs;
                }
            }

            return bestMatch ? bestMatch.ResObsHydro : null;

        } catch (e) {
            console.error(`   ⚠️ Erreur Vigicrues (${grandeur}):`, e);
            return null;
        }
    };

    const [valH, valQ] = await Promise.all([
        getVigicruesValue("H"),
        getVigicruesValue("Q")
    ]);

    if (valH === null && valQ === null) return null;

    // --- CONVERSIONS STRICTES PROD ---
    // Vigicrues H (m) -> mm (x1000)
    // Vigicrues Q (m3/s) -> l/s (x1000)
    
    return {
        level: valH !== null ? Math.round(valH * 1000) : 0,
        flow: valQ !== null ? Math.round(valQ * 1000) : 0,
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

    const targetDate = new Date(targetDateStr);
    const start = startOfDay(targetDate);
    const end = endOfDay(targetDate);

    console.log(`\n🌊 BACKFILL OBSERVATOIRE (RETRY MODE)`);
    console.log(`📅 Cible : ${targetDateStr}`);
    console.log(`⚙️  Mode  : ${isDryRun ? '🧪 SIMULATION' : '🚀 LIVE'}\n`);

    // Lecture existants
    const snapshot = await db.collection('environmental_logs')
        .where('timestamp', '>=', start)
        .where('timestamp', '<=', end)
        .get();
    const existingLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

    let created = 0, updated = 0, skipped = 0;
    let stopSim = false;

    for (let i = 0; i < 24; i++) {
        if (isDryRun && stopSim) break;

        const currentHour = addHours(start, i);
        const formattedId = format(currentHour, 'yyyy-MM-dd_HHmm');
        const hourLabel = format(currentHour, 'HH:mm');
        
        const existing = existingLogs.find(l => isSameHour(l.timestamp.toDate(), currentHour));

        // CAS A : CRÉATION (Le but principal du script)
        if (!existing) {
            console.log(`[${hourLabel}] 🔭 Récupération données (Vigicrues/OpenMeteo)...`);
            
            // On appelle nos fetchers "Standards"
            const [weather, hydro] = await Promise.all([
                fetchWeatherStandard(currentHour),
                fetchVigicruesData(currentHour)
            ]);

            if (!weather) {
                console.log(`   ❌ Météo introuvable pour cette heure, on passe.`);
                continue;
            }

            const newDoc = {
                id: formattedId,
                timestamp: Timestamp.fromDate(currentHour),
                dateString: format(currentHour, 'yyyy-MM-dd'),
                source: 'backfill_retry', // Pour différencier du live
                location: { lat: LAT, lon: LON },
                weather,
                hydro: hydro || { level: 0, flow: 0, note: "Vigicrues Unavailable" },
                updatedAt: FieldValue.serverTimestamp()
            };

            if (isDryRun) {
                console.log(`   📦 [SIMULATION] Création :`, JSON.stringify(newDoc, null, 2));
                stopSim = true;
            } else {
                await db.collection('environmental_logs').doc(formattedId).set(newDoc);
                console.log(`   ✅ Créé (ID: ${formattedId})`);
                created++;
            }
        } 
        // CAS B : MISE A JOUR (Uniquement si demandé explicitement)
        else if (updateEmpty && (!existing.weather || !existing.hydro)) {
            console.log(`[${hourLabel}] 🟠 Incomplet...`);
            
            if (isDryRun) {
                const [w, h] = await Promise.all([fetchWeatherStandard(currentHour), fetchVigicruesData(currentHour)]);
                console.log(`   📦 [SIMULATION] Data trouvée :`, { weather: w, hydro: h });
                stopSim = true;
            } else {
                try {
                    const [w, h] = await Promise.all([fetchWeatherStandard(currentHour), fetchVigicruesData(currentHour)]);
                    const updatePayload: any = {};
                    if (!existing.weather && w) updatePayload.weather = w;
                    if (!existing.hydro && h) updatePayload.hydro = h;
                    
                    if (Object.keys(updatePayload).length > 0) {
                        updatePayload.updatedAt = FieldValue.serverTimestamp();
                        await db.collection('environmental_logs').doc(existing.id).update(updatePayload);
                        console.log(`   🛠  Mis à jour.`);
                        updated++;
                    }
                } catch (e) {
                    console.error("Erreur update", e);
                }
            }
        } else {
            skipped++;
        }
    }

    if (!isDryRun) {
        console.log(`\n🏁 Terminé. Créés: ${created}, Mis à jour: ${updated}, Ignorés: ${skipped}`);
    }
}

main().catch(console.error);