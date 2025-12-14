// functions/src/index.ts (Vigicrues TR + Fallback Température Saisonnière - CORRIGÉ ESLINT)

import {setGlobalOptions} from "firebase-functions";
import {onRequest} from "firebase-functions/https";
import * as logger from "firebase-functions/logger";
import axios, {AxiosResponse} from "axios";

setGlobalOptions({maxInstances: 10});

// --- CONFIGURATION ---
const STATION_CODE_HYDRO = "F700000103"; // Paris-Austerlitz (Référence Débit)
const VIGICRUES_BASE_URL = "https://www.vigicrues.gouv.fr/services/observations.json";

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

// 1. Récupération Débit/Niveau (Vigicrues - TEMPS RÉEL)
const fetchVigicruesData = async (grandeur: "Q" | "H"): Promise<number> => {
    const url = `${VIGICRUES_BASE_URL}?CdStationHydro=${STATION_CODE_HYDRO}&GrdSerie=${grandeur}&FormatDate=iso`;
    try {
        const response: AxiosResponse<VigicruesResult> = await axios.get(url);
        const observations = response.data?.Serie?.ObssHydro;
        if (!observations || observations.length === 0) return 0;
        
        // Dernier point de mesure
        return observations[observations.length - 1].ResObsHydro;
    } catch (error: any) {
        logger.error(`Erreur Vigicrues (${grandeur}): ${error.message}`);
        return 0;
    }
};

// 2. Estimation Température (Modèle Mathématique Seine)
const getSeasonalWaterTemp = (): {date: string, temperature: number, unit: string} => {
    const now = new Date();
    const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 1000 / 60 / 60 / 24);
    
    // Modèle sinusoïdal calé sur la Seine (Min ~5°C en Fév, Max ~24°C en Août)
    const average = 14.5;
    const amplitude = 9.5;
    const phaseShift = 110; // Décalage pour pic en été

    const tempEstim = average + amplitude * Math.sin(2 * Math.PI * (dayOfYear - phaseShift) / 365);
    
    return {
        date: now.toISOString().split("T")[0],
        temperature: parseFloat(tempEstim.toFixed(1)), // Arrondi à 1 décimale
        unit: "°C (Est.)", // On indique que c'est une estimation
    };
};

// --- POINT D'ENTRÉE ---

export const fetchHubeauData = onRequest(async (request, response) => {
    
    response.set("Access-Control-Allow-Origin", "*");
    response.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    
    if (request.method === "OPTIONS") {
        response.status(204).send("");
        return;
    }

    const dataType = request.query.type as string;
    
    if (dataType === "realtime") {
        // Vigicrues pour le débit (Critique)
        const [flow, level] = await Promise.all([
            fetchVigicruesData("Q"),
            fetchVigicruesData("H"),
        ]);
        
        const message = (flow > 0) ? "200 OK: Vigicrues Online" : "WARN: Vigicrues Offline";

        response.status(200).json({
            data: {flow, level},
            message: message,
        });

    } else if (dataType === "watertemp") {
        // Fallback mathématique immédiat (Plus d'erreur 404)
        const data = getSeasonalWaterTemp();
        response.status(200).json(data);
    } else {
        response.status(400).send("Type inconnu.");
    }
});