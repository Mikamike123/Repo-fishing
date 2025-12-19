import { onSchedule } from "firebase-functions/v2/scheduler";
import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { setGlobalOptions } from "firebase-functions/v2";
import axios, { AxiosResponse } from "axios";
import { VertexAI } from "@google-cloud/vertexai";

// --- 1. CONFIGURATION GLOBALE (EUROPE) ---
// On force toutes les fonctions à s'exécuter en Europe (Belgique)
setGlobalOptions({ region: "europe-west1", maxInstances: 10 });

// --- 2. INITIALISATION ADMIN ---
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();

// --- 3. CONSTANTES ---
const STATION_CODE_HYDRO = "F700000103"; // Station Austerlitz
const VIGICRUES_BASE_URL = "https://www.vigicrues.gouv.fr/services/observations.json";
const LAT = 48.92;
const LON = 2.19;

// --- 4. INITIALISATION VERTEX AI (GEMINI) ---
// On initialise le client Vertex AI en Europe également
const vertex_ai = new VertexAI({
    project: process.env.GCLOUD_PROJECT,
    location: "europe-west1" // <-- IMPORTANT : L'IA répond depuis l'Europe
});

// Utilisation du modèle Flash (Rapide et économique)
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

const getSeasonalWaterTemp = (): {date: string, temperature: number, unit: string} => {
    const now = new Date();
    const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 1000 / 60 / 60 / 24);
    const average = 14.5;
    const amplitude = 9.5;
    const phaseShift = 110; 
    const tempEstim = average + amplitude * Math.sin(2 * Math.PI * (dayOfYear - phaseShift) / 365);
    return {
        date: now.toISOString().split("T")[0],
        temperature: parseFloat(tempEstim.toFixed(1)),
        unit: "°C (Est.)",
    };
};

// --- CLOUD FUNCTIONS ---

/**
 * 1. API HTTP (Frontend)
 */
export const fetchHubeauData = onRequest({ cors: true }, async (request, response) => {
    const dataType = request.query.type as string;
    
    if (dataType === "realtime") {
        const [flow, level] = await Promise.all([
            fetchVigicruesData("Q"),
            fetchVigicruesData("H"),
        ]);
        const message = (flow > 0) ? "200 OK: Vigicrues" : "WARN: Vigicrues Offline";
        response.status(200).json({ data: {flow, level}, message: message });

    } else if (dataType === "watertemp") {
        const data = getSeasonalWaterTemp();
        response.status(200).json(data);
    } else {
        response.status(400).send("Type inconnu.");
    }
});

/**
 * 2. SCHEDULER DATA (Data Hoarder)
 * Enregistre les données brutes toutes les heures
 */
export const recordHourlyEnvironment = onSchedule(
    { schedule: "10 * * * *", timeZone: "Europe/Paris" },
    async (event) => {
      try {
        const now = new Date();
        const docId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}00`;
  
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,precipitation,weather_code,wind_speed_10m&timezone=Europe%2FParis`;
        
        const [weatherRes, riverLevel] = await Promise.all([
            axios.get(weatherUrl),
            fetchVigicruesData("H")
        ]);
  
        const weatherData = weatherRes.data.current;
  
        const dataToSave = {
          timestamp: admin.firestore.Timestamp.now(),
          date_id: docId,
          location: { lat: LAT, lon: LON },
          weather: {
              temp_c: weatherData.temperature_2m,
              precipitation_mm: weatherData.precipitation,
              wind_kph: weatherData.wind_speed_10m,
              condition_code: weatherData.weather_code
          },
          river: {
              level: riverLevel,
              station: STATION_CODE_HYDRO
          }
        };
  
        await db.collection("environmental_logs").doc(docId).set(dataToSave);
        logger.info(`Données enregistrées : ${docId}`);
  
      } catch (error) {
        logger.error("Erreur recordHourlyEnvironment", error);
      }
    }
);

/**
 * 3. SCHEDULER AI (Le Coach Pêche)
 * Analyse les données une fois par jour (ex: 6h00 du matin) et génère un conseil.
 */
export const generateDailyFishingBrief = onSchedule(
    { schedule: "0 6 * * *", timeZone: "Europe/Paris" }, // Tous les jours à 06h00
    async (event) => {
        logger.info("IA: Génération du briefing pêche...");
        try {
            // 1. Récupérer les conditions actuelles
            const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,precipitation,weather_code,wind_speed_10m&timezone=Europe%2FParis`;
            const [weatherRes, riverLevel] = await Promise.all([
                axios.get(weatherUrl),
                fetchVigicruesData("H")
            ]);
            const w = weatherRes.data.current;

            // 2. Construire le Prompt pour Gemini
            const prompt = `
            Tu es un expert en pêche aux carnassiers en Seine (région parisienne).
            Voici les conditions actuelles :
            - Niveau eau (Seine): ${riverLevel} m
            - Météo: Code ${w.weather_code} (WMO code)
            - Température air: ${w.temperature_2m}°C
            - Vent: ${w.wind_speed_10m} km/h
            - Précipitations: ${w.precipitation} mm
            
            Analyse ces conditions. Donne-moi un conseil court (3 phrases max) :
            1. Est-ce un bon jour pour pêcher ?
            2. Quel type de leurre utiliser ? (Couleur/Type)
            3. Une zone à privilégier (bordure, cassure, calme) ?
            Réponds sur un ton motivant mais réaliste.
            `;

            // 3. Appeler Gemini
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.candidates?.[0]?.content?.parts?.[0]?.text || "Pas de conseil disponible pour le moment.";

            // 4. Sauvegarder le briefing dans Firestore
            const now = new Date();
            const docId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            
            await db.collection("fishing_briefs").doc(docId).set({
                date: docId,
                created_at: admin.firestore.Timestamp.now(),
                content: text,
                conditions_snapshot: {
                    temp: w.temperature_2m,
                    river_level: riverLevel
                }
            });

            logger.info("IA: Briefing généré et sauvegardé !");

        } catch (error) {
            logger.error("IA: Erreur lors de la génération", error);
        }
    }
);