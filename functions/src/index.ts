// functions/src/index.ts (CORRIGÉ pour reconnaître les types 'realtime' et 'watertemp')

import { setGlobalOptions } from "firebase-functions";
import { onRequest } from "firebase-functions/https";
import * as logger from "firebase-functions/logger";
import axios, { AxiosResponse } from 'axios'; 

// Configuration globale pour le contrôle des coûts
setGlobalOptions({ maxInstances: 10 });

// --- CONSTANTES HUBEAUD & TYPES CÔTÉ SERVEUR ---
const STATION_CODE = 'F700000103'; 
const BASE_HUB_URL = 'https://hubeau.eaufrance.fr/api/v1/';

// L'endpoint Hydrométrie inclut désormais la Température de l'eau (T)
const HYDRO_GLOBAL_ENDPOINT = `${BASE_HUB_URL}hydrometrie/observations_tr?code_station=${STATION_CODE}&grandeur_hydro=QmJ&grandeur_hydro=H&grandeur_hydro=T&sort=desc&size=3`;

// Types mis à jour pour inclure la Température dans le Snapshot, si elle est présente.
interface HydroSnapshot {
    flow: number;
    level: number;
    waterTemp: number | null; 
}
interface WaterTempData {
    date: string;
    temperature: number;
    unit: string; 
}
interface HydroResult {
    data: HydroSnapshot; 
    message: string; 
}
// --------------------------------------------------


/**
 * Récupère le Débit (QmJ), la Hauteur (H) et la Température (T) via Hubeau Hydrométrie.
 * @param isPast Si true, cherche les données d'hier pour la Température de l'eau.
 */
const fetchHubeauHydroData = async (isPast: boolean): Promise<HydroResult> => {
    
    let queryUrl = HYDRO_GLOBAL_ENDPOINT;
    
    if (isPast) {
        // Pour les données de la veille (Température J-1)
        const date = new Date();
        // Nous allons décaler la date au jour précédent, car Hubeau est souvent en J-1.
        date.setDate(date.getDate() - 1); 
        const dateString = date.toISOString().split('T')[0];
        // Cherche uniquement les observations faites hier.
        queryUrl = `${HYDRO_GLOBAL_ENDPOINT}&date_min=${dateString}&date_max=${dateString}`;
        
        logger.info(`Appel Hubeau J-1 pour la Température : ${queryUrl}`);
    } else {
        // Pour les données temps réel (Débit/Niveau)
        logger.info(`Appel Hubeau Temps Réel (Hydro/Température) : ${queryUrl}`);
    }
    
    try {
        const response: AxiosResponse<any> = await axios.get(queryUrl);
        const observations = response.data.data || [];
        
        if (observations.length === 0) {
            const dateInfo = isPast ? 'J-1' : 'Temps Réel';
            logger.warn(`Hubeau Hydrométrie: Aucune observation trouvée pour ${dateInfo}.`);
            return { 
                data: { flow: 0, level: 0, waterTemp: null }, 
                message: `INFO 200: Données ${dateInfo} indisponibles ou vides.`
            };
        }

        let flow: number | undefined;
        let level: number | undefined;
        let waterTemp: number | undefined;
        let tempDate: string | undefined; // Pour capturer la date de l'observation T

        // On parcourt les observations pour extraire les trois grandeurs
        for (const obs of observations) {
            const val = parseFloat(obs.resultat_obs);
            
            if (obs.grandeur_hydro === 'QmJ' && flow === undefined && !isNaN(val)) {
                flow = val;
            }
            if (obs.grandeur_hydro === 'H' && level === undefined && !isNaN(val)) {
                level = val;
            }
            // Capture la date de l'observation T
            if (obs.grandeur_hydro === 'T' && waterTemp === undefined && !isNaN(val)) {
                waterTemp = val;
                tempDate = obs.date_obs ? obs.date_obs.split('T')[0] : undefined;
            }
            
            // Si on a les trois, on peut s'arrêter (optimisation)
            if (flow !== undefined && level !== undefined && waterTemp !== undefined) {
                break; 
            }
        }

        const hydroSnapshot: HydroSnapshot = {
            flow: flow ?? 0, 
            level: level ?? 0,
            waterTemp: waterTemp ?? null, // Utilise null si T n'est pas trouvé
        };
        
        logger.info(`Résultat Hubeau (T/H/Q) : Débit=${hydroSnapshot.flow}, Niveau=${hydroSnapshot.level}, Température=${hydroSnapshot.waterTemp} (Obs. Date: ${tempDate || 'N/A'})`);
        
        return { 
            data: hydroSnapshot, 
            message: "200 OK: Données récupérées et fusionnées."
        };

    } catch (error: any) {
        const status = error.response ? error.response.status : 'N/A';
        const errorMessage = `Hubeau: ${error.message}`;
        logger.error(`Erreur Cloud Function lors de l'appel Hubeau Hydrométrie (Code ${status}):`, errorMessage);
        
        return { 
            data: { flow: 0, level: 0, waterTemp: null }, 
            message: `ERREUR CF (Code ${status}): ${errorMessage}`
        }; 
    }
};


/**
 * Point de terminaison unique pour le Front-end pour toutes les requêtes Hubeau.
 * @type ('realtime' pour Hydro/Temp Actuel, 'watertemp' pour Temp J-1)
 */
export const fetchHubeauData = onRequest(async (request, response) => {
    
    response.set('Access-Control-Allow-Origin', '*'); 
    response.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    
    if (request.method === 'OPTIONS') {
        response.status(204).send('');
        return;
    }

    const dataType = request.query.type as string;
    
    // --- CORRECTION CRITIQUE: Vérification des nouveaux types ---
    if (dataType === 'realtime') {
        // Logique pour Débit et Niveau (Temps Réel)
        const result = await fetchHubeauHydroData(false); // Temps réel
        
        // On renvoie seulement flow, level, et le message
        response.status(200).json({
            data: { flow: result.data.flow, level: result.data.level },
            message: result.message
        });

    } else if (dataType === 'watertemp') {
        // Logique pour la Température de l'Eau (J-1)
        const result = await fetchHubeauHydroData(true); // J-1
        
        if (result.data.waterTemp !== null) {
            // Si la température J-1 est trouvée, on la formate pour la structure WaterTempData du Front-end
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            
            const waterTempData: WaterTempData = {
                date: yesterday.toISOString().split('T')[0],
                temperature: result.data.waterTemp,
                unit: '°C'
            };
            response.status(200).json(waterTempData);
        } else {
            // Si J-1 n'est pas disponible, on renvoie null
            response.status(200).json(null);
        }
        
    } else {
        // Type non supporté (y compris les anciens 'temp' et 'hydro')
        response.status(400).send(`Type de donnée Hubeau non supporté. Utilisez "realtime" ou "watertemp".`);
    }
});