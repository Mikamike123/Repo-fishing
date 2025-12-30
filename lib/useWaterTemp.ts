// lib/useWaterTemp.ts
import { useState, useEffect } from 'react';
import { Location } from '../types';
import { solveAir2Water } from './zeroHydroEngine';
import { fetchWeatherHistory } from './universal-weather-service';

const THROTTLE_HOURS = 6;
const COLD_START_DAYS = 30;
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

            if (hoursSinceSync !== null && hoursSinceSync < THROTTLE_HOURS && location.lastCalculatedTemp !== undefined) {
                setWaterTemp(location.lastCalculatedTemp);
                return;
            }

            setLoading(true);
            let computedTemp = location.lastCalculatedTemp;

            try {
                if (hoursSinceSync === null || hoursSinceSync > (INCREMENTAL_THRESHOLD_DAYS * 24)) {
                    const history = await fetchWeatherHistory(location.coordinates!.lat, location.coordinates!.lng, COLD_START_DAYS);
                    if (history && history.length > 0) {
                        computedTemp = solveAir2Water(history, location.morphology!.typeId, location.morphology!.bassin);
                    }
                } else {
                    const daysMissing = Math.ceil(hoursSinceSync / 24);
                    const history = await fetchWeatherHistory(location.coordinates!.lat, location.coordinates!.lng, daysMissing + 1);
                    if (history && history.length > 0 && location.lastCalculatedTemp !== undefined) {
                        computedTemp = solveAir2Water(history, location.morphology!.typeId, location.morphology!.bassin, location.lastCalculatedTemp);
                    }
                }

                if (computedTemp !== undefined && !isNaN(computedTemp)) {
                    setWaterTemp(computedTemp);
                    const locLabel = (location as any).label || location.name || "Secteur";
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