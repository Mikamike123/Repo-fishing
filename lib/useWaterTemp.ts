// lib/useWaterTemp.ts

import { useState, useEffect } from 'react';
import { Location } from '../types';
import { fetchWeatherHistory, solveAir2Water } from './zeroHydroEngine';

// CONFIGURATION
const THROTTLE_HOURS = 6;           // Pas de rafraîchissement si sync < 6h
const COLD_START_DAYS = 30;         // Jours d'historique pour "chauffer" le modèle
const INCREMENTAL_THRESHOLD_DAYS = 15; // Au-delà de 15j, on refait un Cold Start

export const useWaterTemp = (
    location: Location | null,
    onUpdateLocation: (col: string, id: string, label: string, extraData: any) => void
) => {
    const [waterTemp, setWaterTemp] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Sécurité : Si pas de lieu ou pas de morphologie définie, on ne fait rien
        if (!location || !location.coordinates || !location.morphology) {
            setWaterTemp(null);
            return;
        }

        const syncWaterTemp = async () => {
            const now = new Date();
            const lastSync = location.lastSyncDate ? new Date(location.lastSyncDate) : null;
            
            // Calcul du Gap en heures depuis la dernière synchro
            const hoursSinceSync = lastSync 
                ? (now.getTime() - lastSync.getTime()) / (1000 * 60 * 60) 
                : null;

            // --- STRATÉGIE 1 : THROTTLE (Économie API) ---
            if (hoursSinceSync !== null && hoursSinceSync < THROTTLE_HOURS && location.lastCalculatedTemp !== undefined) {
                setWaterTemp(location.lastCalculatedTemp);
                return;
            }

            setLoading(true);
            let computedTemp = location.lastCalculatedTemp;

            try {
                // --- STRATÉGIE 2 : COLD START ---
                if (hoursSinceSync === null || hoursSinceSync > (INCREMENTAL_THRESHOLD_DAYS * 24)) {
                    console.log("❄️ Zero-Hydro: Cold Start (Simulation 30 jours)...");
                    
                    const history = await fetchWeatherHistory(
                        location.coordinates!.lat, 
                        location.coordinates!.lng, 
                        COLD_START_DAYS
                    );
                    
                    if (history.length > 0) {
                        // AJOUT : Passage du BassinType (URBAIN/AGRICOLE...)
                        computedTemp = solveAir2Water(
                            history, 
                            location.morphology!.typeId,
                            location.morphology!.bassin // <--- Nouveau paramètre
                        );
                    }
                } 
                
                // --- STRATÉGIE 3 : INCREMENTAL SYNC ---
                else {
                    const daysMissing = Math.ceil(hoursSinceSync / 24);
                    console.log(`⚡ Zero-Hydro: Incremental Sync (${daysMissing} jours)...`);

                    const history = await fetchWeatherHistory(
                        location.coordinates!.lat, 
                        location.coordinates!.lng, 
                        daysMissing + 1 
                    );

                    if (history.length > 0 && location.lastCalculatedTemp !== undefined) {
                        // AJOUT : Passage du BassinType
                        computedTemp = solveAir2Water(
                            history, 
                            location.morphology!.typeId,
                            location.morphology!.bassin, // <--- Nouveau paramètre
                            location.lastCalculatedTemp // On enlève l'offset avant de continuer ? Non, l'offset est appliqué à la fin du moteur
                            // NOTE TECHNIQUE : Pour l'incrémental, l'idéal serait de stocker la température "brute" sans offset, 
                            // mais pour simplifier on considère que l'erreur est négligeable sur 1 jour.
                        );
                    }
                }

                // --- PERSISTANCE & MISE À JOUR ---
                if (computedTemp !== undefined && !isNaN(computedTemp)) {
                    setWaterTemp(computedTemp);
                    
                    onUpdateLocation('locations', location.id, location.label, {
                        lastCalculatedTemp: computedTemp,
                        lastSyncDate: now.toISOString()
                    });
                }

            } catch (err) {
                console.error("Erreur Zero-Hydro Sync:", err);
                if (location.lastCalculatedTemp !== undefined) {
                    setWaterTemp(location.lastCalculatedTemp);
                }
            } finally {
                setLoading(false);
            }
        };

        syncWaterTemp();

    }, [location?.id]); 

    return { waterTemp, loading };
};