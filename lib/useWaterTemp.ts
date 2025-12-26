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
        // SÉCURITÉ STRICTE (Fix Error 400)
        // On vérifie que location existe ET que les coordonnées sont bien des nombres
        if (!location || !location.coordinates || typeof location.coordinates.lat !== 'number' || typeof location.coordinates.lng !== 'number' || !location.morphology) {
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
                    // console.log("❄️ Zero-Hydro: Cold Start (Simulation 30 jours)...");
                    
                    const history = await fetchWeatherHistory(
                        location.coordinates!.lat, 
                        location.coordinates!.lng, 
                        COLD_START_DAYS
                    );
                    
                    if (history.length > 0) {
                        computedTemp = solveAir2Water(
                            history, 
                            location.morphology!.typeId,
                            location.morphology!.bassin
                        );
                    }
                } 
                
                // --- STRATÉGIE 3 : INCREMENTAL SYNC ---
                else {
                    const daysMissing = Math.ceil(hoursSinceSync / 24);
                    // console.log(`⚡ Zero-Hydro: Incremental Sync (${daysMissing} jours)...`);

                    const history = await fetchWeatherHistory(
                        location.coordinates!.lat, 
                        location.coordinates!.lng, 
                        daysMissing + 1 
                    );

                    if (history.length > 0 && location.lastCalculatedTemp !== undefined) {
                        computedTemp = solveAir2Water(
                            history, 
                            location.morphology!.typeId,
                            location.morphology!.bassin,
                            location.lastCalculatedTemp
                        );
                    }
                }

                // --- PERSISTANCE & MISE À JOUR ---
                if (computedTemp !== undefined && !isNaN(computedTemp)) {
                    setWaterTemp(computedTemp);
                    
                    // On utilise 'label' ou 'name' pour le log
                    const locLabel = (location as any).label || location.name || "Secteur";
                    
                    onUpdateLocation('locations', location.id, locLabel, {
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

    }, [location?.id]); // On relance uniquement si l'ID du lieu change

    return { waterTemp, loading };
};