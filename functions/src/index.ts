// functions/src/index.ts (Vigicrues Optimisé + Fallback Température Saisonnière)

import {setGlobalOptions} from "firebase-functions";
import {onRequest} from "firebase-functions/https";
import * as logger from "firebase-functions/logger";
import axios, {AxiosResponse} from "axios";

setGlobalOptions({maxInstances: 10});

// --- CONFIGURATION ---
const STATION_CODE_HYDRO = "F700000103"; 
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

const fetchVigicruesData = async (grandeur: "Q" | "H"): Promise<number> => {
    // AJOUT DU PARAMÈTRE MaxObs=200 : 
    // On limite aux ~200 derniers points (suffisant pour avoir le TR et le J-1h/J-24h)
    const url = `${VIGICRUES_BASE_URL}?CdStationHydro=${STATION_CODE_HYDRO}&GrdSerie=${grandeur}&FormatDate=iso&MaxObs=200`;
    
    try {
        const response: AxiosResponse<VigicruesResult> = await axios.get(url);
        const observations = response.data?.Serie?.ObssHydro;
        
        if (!observations || observations.length === 0) return 0;
        
        // On récupère toujours le DERNIER point pour le temps réel
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
        const [flow, level] = await Promise.all([
            fetchVigicruesData("Q"),
            fetchVigicruesData("H"),
        ]);
        
        const message = (flow > 0) ? "200 OK: Vigicrues (Limited)" : "WARN: Vigicrues Offline";

        response.status(200).json({
            data: {flow, level},
            message: message,
        });

    } else if (dataType === "watertemp") {
        const data = getSeasonalWaterTemp();
        response.status(200).json(data);
    } else {
        response.status(400).send("Type inconnu.");
    }
});