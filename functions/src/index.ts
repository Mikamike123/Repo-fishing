import * as admin from "firebase-admin";
import { setGlobalOptions } from "firebase-functions/v2";

// Configuration globale pour la région Europe
setGlobalOptions({ region: "europe-west1", maxInstances: 10 });

// Initialisation de l'application (Nécessaire pour les fonctions exportées ci-dessous)
if (!admin.apps.length) { admin.initializeApp(); }

// --------------------------------------------------------------------------
// NETTOYAGE EFFECTUÉ : DÉCOMMISSIONNEMENT DU "GOLDEN SECTOR" (NANTERRE)
// --------------------------------------------------------------------------
// Les fonctions suivantes ont été supprimées pour arrêter l'écriture 
// dans la collection 'environmental_logs' :
// - recordHourlyEnvironment (Cron HH:10)
// - enrichWaterTempEWMA (Cron HH:15)
// - manualWaterTempRepair (HTTP)
// - enrichBioscoresHourly (Cron HH:20)
// --------------------------------------------------------------------------

// --- EXPORTS DES FONCTIONS ACTIVES (ARCHITECTURE UNIVERSELLE) ---

// 1. Fonction Vision (Analyse d'images par IA)
export * from "./vision";

// 2. Fonction Cleanup (Nettoyage automatique des sessions/images orphelines)
export * from "./cleanup";

// 3. Moteur Universel (Récupération du contexte Météo/Hydro historique à la demande)
export { getHistoricalContext } from "./historical";
// Ajout fonctinonnalité Coach
export { askFishingCoach } from "./coach";

// 4. Maintenance (Tâches planifiées : suppression conversations histo avec coach AI)
export * from "./maintenance";

// 5. Gamification & Statistiques (Surcouche passive)
export * from "./notations";

export * from "./storageCleanup"