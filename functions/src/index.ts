import { onSchedule } from "firebase-functions/v2/scheduler";
import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { setGlobalOptions } from "firebase-functions/v2";
import axios, { AxiosResponse } from "axios";
import { VertexAI } from "@google-cloud/vertexai";

// --- 1. CONFIGURATION GLOBALE (EUROPE) ---
setGlobalOptions({ region: "europe-west1", maxInstances: 10 });

// --- 2. INITIALISATION ADMIN ---
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();

// --- 3. CONSTANTES ---
const STATION_CODE_HYDRO = "F700000103"; 
const VIGICRUES_BASE_URL = "https://www.vigicrues.gouv.fr/services/observations.json";
const LAT = 48.92;
const LON = 2.19;

// --- 4. INITIALISATION VERTEX AI ---
const vertex_ai = new VertexAI({
    project: "mysupstack", 
    location: "europe-west1"
});

const model = vertex_ai.getGenerativeModel({ 
    model: "gemini-1.5-flash" 
});

// --- TYPES ---
interface VigicruesObservation {
    DtObsHydro: string;
    ResObsHydro: number;
}

interface VigicruesResult {
    Serie: {
        GrdSerie: "H" | "Q";
        ObssHydro: VigicruesObservation[];
    }
}

// --- FONCTIONS HELPERS ---

const fetchVigicruesData = async (grandeur: "Q" | "H"): Promise<number> => {
    const url = `${VIGICRUES_BASE_URL}?CdStationHydro=${STATION_CODE_HYDRO}&GrdSerie=${grandeur}&FormatDate=iso&MaxObs=200`;
    try {
        const response: AxiosResponse<VigicruesResult> = await axios.get(url);
        const observations = response.data?.Serie?.ObssHydro;
        if (!observations || observations.length === 0) return 0;
        return observations[observations.length - 1].ResObsHydro;
    } catch (error: any) {
        logger.error(`Erreur Vigicrues (${grandeur}): ${error.message}`);
        return 0;
    }
};

// --- CLOUD FUNCTIONS ---

export const fetchHubeauData = onRequest({ cors: true }, async (request, response) => {
    const dataType = request.query.type as string;
    if (dataType === "realtime") {
        const [flow, level] = await Promise.all([
            fetchVigicruesData("Q"),
            fetchVigicruesData("H"),
        ]);
        response.status(200).json({ data: {flow, level} });
    } else {
        response.status(400).send("Type inconnu.");
    }
});

/**
 * 2. SCHEDULER DATA (L'Observatoire)
 */
export const recordHourlyEnvironment = onSchedule(
    { schedule: "10 * * * *", timeZone: "Europe/Paris" },
    async (event) => {
      logger.info("CRON: Démarrage de l'enregistrement horaire complet");
      try {
        const now = new Date();
        const datePart = now.toLocaleDateString("en-CA", {timeZone: "Europe/Paris"}); 
        const hourPart = now.toLocaleTimeString("fr-FR", {timeZone: "Europe/Paris", hour: "2-digit"}).split(' ')[0];
        const docId = `${datePart}_${hourPart.padStart(2, '0')}00`;
  
        logger.info(`Étape 1: ID du document cible = ${docId}`);

        // URL MISE À JOUR : Ajout de cloud_cover pour la réconciliation avec le backfill
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure,cloud_cover&timezone=Europe%2FParis`;
        
        logger.info("Étape 2: Appel des API Météo et Vigicrues (H et Q)...");
        const [weatherRes, riverLevel, riverFlow] = await Promise.all([
            axios.get(weatherUrl),
            fetchVigicruesData("H"),
            fetchVigicruesData("Q") // AJOUT : Récupération du débit
        ]);
  
        const w = weatherRes.data.current;
        
        // --- STRUCTURE RÉCONCILIÉE AVEC LE BACKFILL ---
        const dataToSave = {
          timestamp: admin.firestore.Timestamp.now(),
          id: docId, 
          source: "observatoire_live",
          location: { lat: LAT, lon: LON },
          weather: {
              temp: w.temperature_2m,
              pressure: w.surface_pressure,
              windSpeed: w.wind_speed_10m,
              windDir: w.wind_direction_10m,
              precip: w.precipitation,
              cloudCover: w.cloud_cover, // AJOUT : Cohérence avec le backfill
              condition_code: w.weather_code
          },
          hydro: { 
              level: riverLevel,
              flow: riverFlow, // AJOUT : Cohérence avec le backfill
              station: STATION_CODE_HYDRO
          },
          updatedAt: admin.firestore.Timestamp.now()
        };
  
        logger.info("Étape 3: Tentative d'écriture dans Firestore...");
        await db.collection("environmental_logs").doc(docId).set(dataToSave);
        logger.info(`Étape 4: Succès total pour l'ID ${docId}`);
  
      } catch (error: any) {
        logger.error("ERREUR lors de l'archivage :", error.message);
      }
    }
);

/**
 * 3. SCHEDULER AI (Le Coach Pêche)
 */
export const generateDailyFishingBrief = onSchedule(
    { schedule: "0 6 * * *", timeZone: "Europe/Paris" },
    async (event) => {
        logger.info("IA: Génération du briefing...");
        try {
            const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,precipitation,weather_code,wind_speed_10m&timezone=Europe%2FParis`;
            const [weatherRes, riverLevel] = await Promise.all([
                axios.get(weatherUrl),
                fetchVigicruesData("H")
            ]);
            const w = weatherRes.data.current;

            const prompt = `Expert pêche Seine. Conditions: Eau ${riverLevel}m, Météo code ${w.weather_code}, Air ${w.temperature_2m}°C. Conseil 3 phrases max (leurre/zone).`;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.candidates?.[0]?.content?.parts?.[0]?.text || "Pas de conseil.";

            const dateId = new Date().toLocaleDateString("en-CA", {timeZone: "Europe/Paris"});
            
            await db.collection("fishing_briefs").doc(dateId).set({
                date: dateId,
                created_at: admin.firestore.Timestamp.now(),
                content: text,
                conditions_snapshot: { temp: w.temperature_2m, river_level: riverLevel }
            });

            logger.info("IA: Briefing sauvegardé !");
        } catch (error) {
            logger.error("IA Erreur:", error);
        }
    }
);