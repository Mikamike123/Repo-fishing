// lib/useWaterTemp.ts - Version 5.5 (Alignement Signature & Profondeur)

import { useState, useEffect } from 'react';
import { Location } from '../types';
import { solveAir2Water } from './zeroHydroEngine';
import { fetchWeatherHistory } from './universal-weather-service';

// Michael : THROTTLE_HOURS à 6 pour éviter de saturer Firestore lors des tests répétitifs
const THROTTLE_HOURS = 6;
// Michael : Augmentation de 30 à 45 jours pour une meilleure convergence du modèle Air2Water sur la Seine
const COLD_START_DAYS = 45; 
const INCREMENTAL_THRESHOLD_DAYS = 15;

export const useWaterTemp = (
    location: Location | null,
    onUpdateLocation: (col: string, id: string, label: string, extraData: any) => void
) => {
    const [waterTemp, setWaterTemp] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!location || !location.coordinates || typeof location.coordinates.lat !== 'number' || typeof location.coordinates.lng !== 'number' || !location.morphology) {
            setWaterTemp(null);
            return;
        }

        const syncWaterTemp = async () => {
            const now = new Date();
            const lastSync = location.lastSyncDate ? new Date(location.lastSyncDate) : null;
            const hoursSinceSync = lastSync ? (now.getTime() - lastSync.getTime()) / (1000 * 60 * 60) : null;

            // Michael : Si on a synchronisé récemment, on utilise la valeur persistée pour garantir la continuité thermique
            if (hoursSinceSync !== null && hoursSinceSync < THROTTLE_HOURS && location.lastCalculatedTemp !== undefined) {
                setWaterTemp(location.lastCalculatedTemp);
                return;
            }

            setLoading(true);
            let computedTemp = location.lastCalculatedTemp;

            try {
                // Michael : On extrait les variables de morphologie pour la clarté de l'appel
                const morphoId = location.morphology!.typeId;
                const bassin = location.morphology!.bassin;
                const depthId = location.morphology!.depthId || 'Z_3_15';

                if (hoursSinceSync === null || hoursSinceSync > (INCREMENTAL_THRESHOLD_DAYS * 24)) {
                    // Mode COLD START : Reconstruction profonde de la mémoire thermique
                    const history = await fetchWeatherHistory(location.coordinates!.lat, location.coordinates!.lng, COLD_START_DAYS);
                    if (history && history.length > 0) {
                        // Ajout de depthId en 4ème argument pour s'aligner sur zeroHydroEngine v5.5
                        computedTemp = solveAir2Water(history, morphoId, bassin, depthId);
                    }
                } else {
                    // Mode INCREMENTAL : On ajoute les derniers jours à la mémoire existante (Warm Start)
                    const daysMissing = Math.ceil(hoursSinceSync / 24);
                    const history = await fetchWeatherHistory(location.coordinates!.lat, location.coordinates!.lng, daysMissing + 1);
                    if (history && history.length > 0 && location.lastCalculatedTemp !== undefined) {
                        // lastCalculatedTemp passe en 5ème argument
                        computedTemp = solveAir2Water(history, morphoId, bassin, depthId, location.lastCalculatedTemp);
                    }
                }

                if (computedTemp !== undefined && !isNaN(computedTemp)) {
                    setWaterTemp(computedTemp);
                    const locLabel = (location as any).label || location.name || "Secteur";
                    // Michael : On persiste la donnée pour que le prochain calcul reparte de cette base
                    onUpdateLocation('locations', location.id, locLabel, {
                        lastCalculatedTemp: computedTemp,
                        lastSyncDate: now.toISOString()
                    });
                }
            } catch (err) {
                console.error("Erreur Sync Michael :", err);
                if (location.lastCalculatedTemp !== undefined) setWaterTemp(location.lastCalculatedTemp);
            } finally {
                setLoading(false);
            }
        };

        syncWaterTemp();
    }, [location?.id]);

    return { waterTemp, loading };
};