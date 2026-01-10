// lib/useWaterTemp.ts - Version 8.8 (Cold-Start Systematic Sync)
// Michael : Suppression du mode incrémental pour garantir une convergence absolue avec le backend.

import { useState, useEffect } from 'react';
import { Location } from '../types';
import { solveAir2Water } from './zeroHydroEngine';
import { fetchWeatherHistory } from './universal-weather-service';

// Michael : THROTTLE_HOURS à 6 pour éviter de saturer Firestore et l'API météo
const THROTTLE_HOURS = 6;

// Michael : 45 jours est le "Golden Standard" pour que le modèle de relaxation 
// oublie totalement son état initial (Baseline) et colle à la réalité du terrain.
const COLD_START_DAYS = 45; 

export const useWaterTemp = (
    location: Location | null,
    onUpdateLocation: (col: string, id: string, label: string, extraData: any) => void
) => {
    const [waterTemp, setWaterTemp] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Validation stricte des coordonnées et de la morphologie Michael
        if (!location || !location.coordinates || typeof location.coordinates.lat !== 'number' || typeof location.coordinates.lng !== 'number' || !location.morphology) {
            setWaterTemp(null);
            return;
        }

        const syncWaterTemp = async () => {
            const now = new Date();
            const lastSync = location.lastSyncDate ? new Date(location.lastSyncDate) : null;
            const hoursSinceSync = lastSync ? (now.getTime() - lastSync.getTime()) / (1000 * 60 * 60) : null;

            // Michael : Gestion du cache local. Si on est dans la fenêtre des 6h, on ne sollicite pas l'API.
            // Comme le calcul initial est désormais ultra-précis (45j), cette valeur persistée est "juste".
            if (hoursSinceSync !== null && hoursSinceSync < THROTTLE_HOURS && location.lastCalculatedTemp !== undefined) {
                setWaterTemp(location.lastCalculatedTemp);
                return;
            }

            setLoading(true);

            try {
                // Michael : Extraction des paramètres morphologiques pour injection dans le moteur v8.8
                const morpho = location.morphology;
                const morphoId = morpho.typeId;
                const bassin = morpho.bassin;
                const depthId = morpho.depthId || 'Z_3_15';

                // Michael : On ignore désormais totalement INCREMENTAL_THRESHOLD_DAYS. 
                // Chaque rafraîchissement est une reconstruction totale sur 45 jours.
                const history = await fetchWeatherHistory(
                    location.coordinates!.lat, 
                    location.coordinates!.lng, 
                    COLD_START_DAYS
                );
                
                if (history && history.length > 0) {
                    // Michael : Appel au moteur solveAir2Water avec la signature v8.8
                    // On passe 'undefined' pour prevTemp pour forcer l'usage de la Smart Baseline à J-45
                    const computedTemp = solveAir2Water(
                        history, 
                        morphoId, 
                        bassin, 
                        depthId, 
                        undefined, 
                        morpho.meanDepth,
                        morpho.surfaceArea,
                        morpho.shapeFactor
                    );

                    if (computedTemp !== undefined && !isNaN(computedTemp)) {
                        setWaterTemp(computedTemp);
                        
                        const locLabel = (location as any).label || location.name || "Secteur";
                        
                        // Michael : On persiste la vérité calculée. 
                        // C'est cette valeur qui sera lue par le Live et les sessions récentes.
                        onUpdateLocation('locations', location.id, locLabel, {
                            lastCalculatedTemp: computedTemp,
                            lastSyncDate: now.toISOString()
                        });
                    }
                }
            } catch (err) {
                console.error("💀 Erreur Critique Sync Michael :", err);
                // Fallback de sécurité sur la dernière valeur connue en cas de crash API
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