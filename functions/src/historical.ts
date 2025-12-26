// functions/src/historical.ts
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

const KH = 0.0067487; // Coefficient k horaire pour k_jour = 0.15

// BASELINE SAISONNIÈRE (Moyennes observées sur fleuve type Seine)
// Permet d'initialiser le modèle à J-30 avec une valeur réaliste.
const MONTHLY_WATER_TEMP_BASELINE: { [key: number]: number } = {
    0: 5.5,   // Janvier
    1: 6.0,   // Février
    2: 8.5,   // Mars
    3: 11.5,  // Avril
    4: 15.0,  // Mai
    5: 18.5,  // Juin
    6: 21.0,  // Juillet
    7: 22.5,  // Août
    8: 20.0,  // Septembre
    9: 16.5,  // Octobre
    10: 11.0, // Novembre
    11: 7.0   // Décembre
};

// CONSTANTES TURBIDITÉ (Selon Spec Partie III - Profil Z_RIVER / Urbain)
const TURBIDITY_CONSTANTS = {
    ALPHA_SED: 2.5,  // Facteur conversion mm -> NTU
    BETA: 0.8,       // Coefficient ruissellement (0.8 = Urbain/Agricole)
    K_DECAY: 0.6,    // Taux décroissance journalier (Rivière dynamique)
    BASE_NTU: 5.0,   // Turbidité de fond (Eau "claire" par défaut)
    MAX_NTU: 80.0    // Plafond pour normalisation (Considéré comme "Chocolat")
};

/**
 * RÉCUPÉRATION CONTEXTE HISTORIQUE (CALLABLE)
 * Récupère 30j de météo passée pour simuler l'inertie thermique de l'eau
 * et recalcule les bioscores à la volée.
 */
export const getHistoricalContext = onCall({ region: "europe-west1" }, async (request) => {
    
    // -----------------------------------------------------------
    // MODE DEV : Auth désactivée temporairement
    /*
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Vous devez être connecté.");
    }
    */
    // -----------------------------------------------------------

    const { date, hour, lat, lon } = request.data;
    
    if (!date || hour === undefined || !lat || !lon) {
        throw new HttpsError("invalid-argument", "Date, hour, lat et lon requis.");
    }

    const targetDateIso = `${date}T${hour.toString().padStart(2, '0')}:00`;
    const targetDateObj = new Date(`${targetDateIso}:00`);
    const now = new Date();
    
    if (targetDateObj > now) return null;

    try {
        // 1. PLAGE DE DONNÉES (J-30)
        // Nécessaire pour l'inertie thermique (30j) et la turbidité (7j)
        const endDateObj = new Date(targetDateObj);
        const startDateObj = new Date(targetDateObj);
        startDateObj.setDate(startDateObj.getDate() - 30);
        
        const formatDate = (d: Date) => d.toISOString().split('T')[0];
        const startStr = formatDate(startDateObj);
        const endStr = formatDate(endDateObj);

        // 2. APPEL OPEN-METEO ARCHIVE
        const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${startStr}&end_date=${endStr}&hourly=temperature_2m,surface_pressure,wind_speed_10m,wind_direction_10m,precipitation,cloud_cover,weather_code&timezone=Europe%2FParis`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Open-Meteo Error: ${response.statusText}`);
        const data = await response.json();
        
        const hourly = data.hourly;
        if (!hourly || !hourly.time) throw new Error("Données horaires incomplètes");

        // 3. REPERAGE DE L'INDEX CIBLE
        const targetIndex = hourly.time.findIndex((t: string) => t === targetDateIso);
        if (targetIndex === -1) throw new Error("Date cible introuvable dans les données");

        // --- MOTEUR THERMIQUE (EWMA) ---
        const startMonth = startDateObj.getMonth();
        let currentWaterTemp = MONTHLY_WATER_TEMP_BASELINE[startMonth] || 10; 

        for (let i = 1; i <= targetIndex; i++) {
             let sumAir = 0;
             let count = 0;
             const startBack = Math.max(0, i - 72);
             for(let k = startBack; k <= i; k++) {
                 const t = hourly.temperature_2m[k];
                 if (t !== null && t !== undefined) { sumAir += t; count++; }
             }
             const avgAir72 = count > 0 ? sumAir / count : (hourly.temperature_2m[i] || currentWaterTemp);
             currentWaterTemp = currentWaterTemp + KH * (avgAir72 - currentWaterTemp);
        }

        // --- MOTEUR OPTIQUE (TURBIDITÉ) ---
        // On calcule la turbidité basée sur les pluies des 7 derniers jours avant la cible
        const calculatedTurbidityIdx = calculateTurbidityFromHistory(hourly.precipitation, targetIndex);

        // 4. EXTRACTION DONNÉES INSTANTANÉES
        const idx = targetIndex;
        const weatherSnapshot = {
            temperature: hourly.temperature_2m[idx],
            pressure: hourly.surface_pressure[idx],
            windSpeed: hourly.wind_speed_10m[idx],
            windDirection: hourly.wind_direction_10m[idx],
            precip: hourly.precipitation[idx],
            clouds: hourly.cloud_cover[idx],
            conditionCode: hourly.weather_code[idx]
        };

        // 5. CALCUL BIOSCORES (Avec la vraie turbidité calculée !)
        const computed = calculateBioscoresLocal({
            Tw: currentWaterTemp,
            press: weatherSnapshot.pressure,
            prevPress: idx >= 3 ? hourly.surface_pressure[idx - 3] : weatherSnapshot.pressure,
            wind: weatherSnapshot.windSpeed,
            cloud: weatherSnapshot.clouds,
            turbidityIdx: calculatedTurbidityIdx, // Valeur dynamique injectée
            docId: `${date}_${hour.toString().padStart(2, '0')}00`
        });

        // 6. RETOUR
        return {
            weather: weatherSnapshot,
            hydro: {
                flowRaw: 0,
                flowLagged: 0,
                level: 0,
                waterTemp: parseFloat(currentWaterTemp.toFixed(2)),
                turbidityIdx: parseFloat(calculatedTurbidityIdx.toFixed(2)), 
            },
            scores: {
                sandre: computed.sandre,
                brochet: computed.brochet,
                perche: computed.perche
            },
            metadata: {
                sourceLogId: "archive_open_meteo_recalc",
                calculationDate: new Date().toISOString()
            }
        };

    } catch (e: any) {
        logger.error("Erreur getHistoricalContext", e);
        throw new HttpsError("internal", e.message);
    }
});

// --- HELPERS ALGORITHMIQUES ---

/**
 * MOTEUR OPTIQUE (Implémentation Spec Partie III)
 * Calcule l'indice de turbidité (0-1) basé sur l'historique des pluies (7 jours).
 */
function calculateTurbidityFromHistory(precipArray: number[], targetIndex: number): number {
    let currentNTU = TURBIDITY_CONSTANTS.BASE_NTU;
    
    // On remonte 7 jours en arrière (7 * 24h = 168h)
    const hoursBack = 168;
    const startIndex = Math.max(0, targetIndex - hoursBack);

    // On itère jour par jour (pas de 24h) pour appliquer la logique journalière de la spec
    for (let i = startIndex; i <= targetIndex; i += 24) {
        // 1. Somme des pluies sur 24h
        let dailyRain = 0;
        for (let j = 0; j < 24 && (i + j) <= targetIndex; j++) {
            const p = precipArray[i + j];
            if (p) dailyRain += p;
        }

        // 2. Décroissance (Loi de Stokes) : L'eau s'éclaircit
        // NTU(t) = Base + (NTU(t-1) - Base) * exp(-k)
        const excessTurbidity = Math.max(0, currentNTU - TURBIDITY_CONSTANTS.BASE_NTU);
        currentNTU = TURBIDITY_CONSTANTS.BASE_NTU + (excessTurbidity * Math.exp(-TURBIDITY_CONSTANTS.K_DECAY));

        // 3. Accrétion (First Flush) : La pluie trouble l'eau
        // Seuil déclenchement : 2mm
        if (dailyRain > 2.0) {
            const addedNTU = TURBIDITY_CONSTANTS.ALPHA_SED * dailyRain * TURBIDITY_CONSTANTS.BETA;
            currentNTU += addedNTU;
        }
    }

    // Normalisation pour l'indice (0.0 - 1.0)
    // On considère que MAX_NTU (ex: 80) correspond à l'indice 1.0 (Eau marron)
    return Math.min(1.0, currentNTU / TURBIDITY_CONSTANTS.MAX_NTU);
}

function calculateBioscoresLocal(ctx: { Tw: number, press: number, prevPress: number, wind: number, cloud: number, turbidityIdx: number, docId: string }) {
    const { Tw, press, prevPress, wind, cloud, turbidityIdx, docId } = ctx;
    const dP = press - prevPress;
    const lux = calculateSeasonalLux(docId, cloud);
    const windF = Math.min(1.0, Math.max(0.2, 0.2 + 0.8 * (wind / 30)));

    // SANDRE
    const fP_s = 1 / (1 + Math.exp(2.0 * (dP - 0.5)));
    // Spec Partie 5.3.2 : fLT_s dépend de lux et de turbIdx
    const fLT_s = (1 - lux) + lux * Math.tanh(4 * turbidityIdx);
    const fT_s = Math.exp(-Math.pow(Tw - 17, 2) / 128);
    const scoreSandre = 100 * Math.pow(fP_s, 0.4) * Math.pow(fLT_s, 0.4) * Math.pow(fT_s, 0.2);

    // BROCHET
    let scoreBrochet = 0;
    if (Tw <= 24.0) {
        const fT_b = 1 / (1 + Math.exp(0.8 * (Tw - 21)));
        const fVis_b = Math.exp(-2.5 * turbidityIdx); // Pénalité forte si eau trouble
        scoreBrochet = 100 * Math.pow(fT_b, 0.5) * Math.pow(fVis_b, 0.3) * Math.pow(windF, 0.2);
    }

    // PERCHE
    const fT_p = Math.exp(-Math.pow(Tw - 21, 2) / 72);
    const fP_p = Math.max(Math.exp(-2 * Math.abs(dP)), 1 / (1 + Math.exp(3.0 * (dP + 1.5))));
    const scorePerche = 100 * Math.pow(fT_p, 0.5) * Math.pow(fP_p, 0.5);

    return {
        sandre: parseFloat(scoreSandre.toFixed(1)),
        brochet: parseFloat(scoreBrochet.toFixed(1)),
        perche: parseFloat(scorePerche.toFixed(1))
    };
}

function calculateSeasonalLux(docId: string, cloudCover: number): number {
    try {
        const parts = docId.split('_'); 
        let month, hour;
        if (parts.length >= 2) {
            const dateParts = parts[0].split('-');
            month = parseInt(dateParts[1]);
            hour = parseInt(parts[1].substring(0, 2)) + (parseInt(parts[1].substring(2)) / 60);
        } else { return 0.5; }

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