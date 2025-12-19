// scripts/backfill.ts

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import axios from 'axios'; // On garde axios juste pour OpenMeteo qui est gentil
import * as path from 'path';
import * as fs from 'fs';

// --- CONFIGURATION ---
const START_DATE = '2023-05-01';
// const END_DATE = new Date().toISOString().split('T')[0]; // MODE PROD (Commenté)
const END_DATE = '2023-05-03'; // MODE TEST (Actif)
const COLLECTION_NAME = 'environmental_logs';

const LAT = 48.90;
const LNG = 2.21;
const HYDRO_STATION_CODE = 'F700000103';

// --- INITIALISATION FIREBASE ---
const serviceAccountPath = path.join(process.cwd(), 'scripts', 'serviceAccountKey.json');
if (!fs.existsSync(serviceAccountPath)) {
    console.error("❌ ERREUR : serviceAccountKey.json introuvable.");
    process.exit(1);
}
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// --- TYPES ---
interface HourlyLog {
    id: string;
    timestamp: Timestamp;
    weather: {
        temp: number;
        pressure: number;
        windSpeed: number;
        windDir: number;
        cloudCover: number;
    };
    hydro: {
        flow: number;
        level: number;
    };
    source: 'backfill';
}

// --- FONCTIONS API ---

// 1. Météo (Open-Meteo) - Axios marche bien ici
async function fetchWeatherHistory(date: string) {
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${LAT}&longitude=${LNG}&start_date=${date}&end_date=${date}&hourly=temperature_2m,surface_pressure,cloud_cover,wind_speed_10m,wind_direction_10m&timezone=Europe%2FParis`;
    try {
        const res = await axios.get(url);
        return res.data.hourly;
    } catch (e) {
        console.error(`❌ Erreur Météo ${date}`);
        return null;
    }
}

// 2. Hydro (Hubeau) - ON PASSE EN FETCH NATIF + HEADERS SIMPLES
async function fetchHydroHistory(date: string, grandeur: 'Q' | 'H') {
    const nextDay = new Date(new Date(date).getTime() + 86400000).toISOString().split('T')[0];
    const url = `https://hubeau.eaufrance.fr/api/v1/hydrometrie/observations_tr?code_entite=${HYDRO_STATION_CODE}&date_debut_obs=${date}&date_fin_obs=${nextDay}&grandeur_hydro=${grandeur}&size=1000`;

    try {
        // Utilisation de fetch natif (Node 18+)
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data: any = await response.json();
        return data.data; 
    } catch (e: any) {
        console.error(`❌ Erreur Hydro (${grandeur}) ${date}: ${e.message}`);
        return [];
    }
}

// --- HELPER ---
function findClosestValue(observations: any[], targetHour: number, dateStr: string): number {
    if (!observations || observations.length === 0) return 0;
    let closest = observations[0];
    let minDiff = Infinity;
    for (const obs of observations) {
        const obsDate = new Date(obs.date_obs);
        const obsHour = obsDate.getHours(); 
        const diff = Math.abs(obsHour - targetHour);
        const obsMinutes = obsDate.getMinutes();
        const totalTimeDiff = (diff * 60) + obsMinutes;
        if (totalTimeDiff < minDiff) {
            minDiff = totalTimeDiff;
            closest = obs;
        }
    }
    if (minDiff > 120) return 0;
    return closest.resultat_obs;
}

// --- MAIN LOOP SÉQUENTIELLE ---
async function runBackfill() {
    console.log(`🚀 Démarrage (Mode Doux) de ${START_DATE} à ${END_DATE}...`);
    
    let currentDate = new Date(START_DATE);
    const end = new Date(END_DATE);

    while (currentDate <= end) {
        const dateStr = currentDate.toISOString().split('T')[0];
        console.log(`\n📅 Traitement du ${dateStr}...`);

        // ÉTAPE 1 : MÉTÉO
        const weatherData = await fetchWeatherHistory(dateStr);
        if (!weatherData) {
            console.warn(`⚠️ Pas de météo, skip.`);
            currentDate.setDate(currentDate.getDate() + 1);
            continue;
        }

        // ÉTAPE 2 : HYDRO DÉBIT (Q)
        // Petite pause avant de taper Hubeau
        await new Promise(r => setTimeout(r, 500)); 
        const flowData = await fetchHydroHistory(dateStr, 'Q');

        // ÉTAPE 3 : HYDRO NIVEAU (H)
        // Pause entre les deux appels Hubeau pour éviter le flag "Robot"
        await new Promise(r => setTimeout(r, 1000)); 
        const levelData = await fetchHydroHistory(dateStr, 'H');

        // ÉTAPE 4 : SAUVEGARDE
        const batch = db.batch();
        let count = 0;

        for (let h = 0; h < 24; h++) {
            const hourStr = h.toString().padStart(2, '0');
            const docId = `${dateStr}_${hourStr}00`;
            const docRef = db.collection(COLLECTION_NAME).doc(docId);

            const weather = {
                temp: weatherData.temperature_2m[h],
                pressure: weatherData.surface_pressure[h],
                windSpeed: weatherData.wind_speed_10m[h],
                windDir: weatherData.wind_direction_10m[h],
                cloudCover: weatherData.cloud_cover[h]
            };

            const flow = findClosestValue(flowData, h, dateStr);
            const level = findClosestValue(levelData, h, dateStr);

            const logData: HourlyLog = {
                id: docId,
                timestamp: Timestamp.fromDate(new Date(`${dateStr}T${hourStr}:00:00`)),
                weather,
                hydro: { flow, level },
                source: 'backfill'
            };

            batch.set(docRef, logData);
            count++;
        }

        await batch.commit();
        console.log(`✅ ${count} heures enregistrées.`);

        // Jour suivant
        currentDate.setDate(currentDate.getDate() + 1);
    }

    console.log("\n🎉 BACKFILL TERMINÉ !");
    process.exit(0);
}

runBackfill();