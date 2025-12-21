import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { setGlobalOptions } from "firebase-functions/v2";

// --- CONFIGURATION ---
setGlobalOptions({ region: "europe-west3", maxInstances: 10 });

if (!admin.apps.length) { admin.initializeApp(); }
const db = admin.firestore();

const STATION_CODE_HYDRO = "F700000103"; // Paris-Austerlitz (H et Q disponibles)
const LAT = 48.92;
const LON = 2.19;

/**
 * HELPER : Récupération des données via l'API Vigicrues
 * Retourne le nombre (m ou m3/s) ou null si aucune donnée n'est disponible.
 */
const fetchVigicruesStealth = async (grandeur: "Q" | "H"): Promise<number | null> => {
    // Utilisation du service d'observations de Vigicrues
    const url = `https://www.vigicrues.gouv.fr/services/observations.json?CdStationHydro=${STATION_CODE_HYDRO}&GrdSerie=${grandeur}&FormatDate=iso&MaxObs=50`;
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'Referer': 'https://www.vigicrues.gouv.fr/',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        if (!response.ok) {
            logger.error(`[API] Erreur ${response.status} pour ${grandeur}`);
            return null;
        }

        const data: any = await response.json();
        const obs = data?.Serie?.ObssHydro;
        
        if (!obs || !Array.isArray(obs) || obs.length === 0) {
            logger.warn(`[DATA] Aucun relevé trouvé pour la grandeur ${grandeur}`);
            return null;
        }
        
        // On récupère la valeur numérique la plus récente (fin du tableau)
        // La station Austerlitz est débitmétrique et limnimétrique
        for (let i = obs.length - 1; i >= 0; i--) {
            const val = obs[i].ResObsHydro;
            if (val !== undefined && val !== null) return val;
        }
        
        return null;
    } catch (error: any) {
        logger.error(`[ERROR] ${grandeur}: ${error.message}`);
        return null;
    }
};

export const recordHourlyEnvironment = onSchedule(
    { schedule: "10 * * * *", timeZone: "Europe/Paris" },
    async (event) => {
      try {
        const now = new Date();
        const formatter = new Intl.DateTimeFormat("fr-FR", {
            timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
            hour: "2-digit", hour12: false
        });
        
        const p = formatter.formatToParts(now);
        const docId = `${p.find(x=>x.type==='year')?.value}-${p.find(x=>x.type==='month')?.value}-${p.find(x=>x.type==='day')?.value}_${p.find(x=>x.type==='hour')?.value}00`;

        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,surface_pressure,wind_speed_10m,wind_direction_10m,precipitation,cloud_cover,weather_code&timezone=Europe%2FParis`;
        
        // Récupération simultanée de la météo et des données hydro (H et Q)
        const [weatherRes, riverLevel, riverFlow] = await Promise.all([
            fetch(weatherUrl).then(res => res.json()),
            fetchVigicruesStealth("H"),
            fetchVigicruesStealth("Q")
        ]);
  
        // Sécurité : Si l'API renvoie null pour les deux, on ne veut peut-être pas polluer Firestore
        if (riverLevel === null && riverFlow === null) {
            logger.warn(`⚠️ Abandon de l'écriture : Aucune donnée hydro disponible pour ${docId}`);
            return;
        }

        const w = (weatherRes as any).current;
        const dataToSave = {
          timestamp: admin.firestore.Timestamp.now(),
          id: docId, 
          source: "observatoire_live_final_stealth",
          location: { lat: LAT, lon: LON },
          weather: {
              temp: w.temperature_2m,
              pressure: w.surface_pressure,
              windSpeed: w.wind_speed_10m,
              windDir: w.wind_direction_10m,
              precip: w.precipitation,
              cloudCover: w.cloud_cover, 
              condition_code: w.weather_code
          },
          hydro: { 
              // Conversion en mm et L/s si valeur présente, sinon null
              level: riverLevel !== null ? Math.round(riverLevel * 1000) : null, 
              flow: riverFlow !== null ? Math.round(riverFlow * 1000) : null, 
              station: STATION_CODE_HYDRO,
              waterTemp: null
          },
          updatedAt: admin.firestore.Timestamp.now()
        };
  
        await db.collection("environmental_logs").doc(docId).set(dataToSave);
        logger.info(`✅ Succès : ${docId} (H: ${riverLevel}m, Q: ${riverFlow}m3/s)`);
        
      } catch (error: any) {
        logger.error("❌ Erreur critique lors de l'exécution du schedule:", error.message);
      }
    }
);