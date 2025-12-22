// lib/environmental-service.ts
import { fetchNanterreWeather } from './open-meteo-service';
import { fetchHydroRealtime, fetchWaterTempJMinus1, updateWaterTempCache, getCachedWaterTemp } from './hubeau-service';
import { WeatherSnapshot, HydroSnapshot, FullEnvironmentalSnapshot } from '../types'; 
import { db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const CACHE_NAME = 'environmental_live';

export const getRealtimeEnvironmentalConditions = async () => {
    const cacheRef = doc(db, 'cache', CACHE_NAME);
    try {
        const snap = await getDoc(cacheRef);
        if (snap.exists() && Date.now() / 1000 - snap.data().timestamp < 1800) {
            return snap.data();
        }
    } catch (e) { console.warn("Cache error"); }

    const [weatherRaw, hydroRawResult] = await Promise.all([
        fetchNanterreWeather(),
        fetchHydroRealtime()
    ]);

    const rawHydro = hydroRawResult?.data as any;
    const hydroResult: HydroSnapshot = {
        flowRaw: (rawHydro?.flow || 0) * 1000,
        flowLagged: rawHydro?.flow || 0,
        level: rawHydro?.level || 0,
        waterTemp: null,
        turbidityIdx: 0
    };

    const weatherResult: WeatherSnapshot | null = weatherRaw ? {
        temperature: weatherRaw.temperature,
        pressure: weatherRaw.pressure,
        windSpeed: weatherRaw.windSpeed,
        windDir: (weatherRaw as any).windDirection || 0,
        cloudCover: (weatherRaw as any).clouds || 0,
        precip: 0,
        conditionCode: 0
    } : null;

    const result = { weather: weatherResult, hydro: hydroResult, timestamp: Date.now() / 1000 };
    try { await setDoc(cacheRef, result); } catch (e) { console.error(e); }
    return result;
};

// Machine à remonter le temps pour les Dialogs
export const getHistoricalSnapshot = async (date: string, time: string): Promise<FullEnvironmentalSnapshot | null> => {
    try {
        const hour = time.split(':')[0];
        const docId = `${date}_${hour}00`;
        const snap = await getDoc(doc(db, 'environmental_logs', docId));

        if (snap.exists()) {
            const d = snap.data();
            return {
                weather: {
                    temperature: d.weather?.temp || 0,
                    pressure: d.weather?.pressure || 0,
                    windSpeed: d.weather?.windSpeed || 0,
                    windDir: d.weather?.windDir || 0,
                    precip: d.weather?.precip || 0,
                    cloudCover: d.weather?.cloudCover || 0,
                    conditionCode: d.weather?.condition_code || 0
                },
                hydro: {
                    flowRaw: d.hydro?.flow || 0,
                    flowLagged: d.computed?.flow_lagged || 0,
                    level: d.hydro?.level || 0,
                    waterTemp: d.hydro?.waterTemp || null,
                    turbidityIdx: d.computed?.turbidity_idx || 0
                },
                scores: {
                    sandre: d.computed?.score_sandre || 0,
                    brochet: d.computed?.score_brochet || 0,
                    perche: d.computed?.score_perche || 0
                },
                metadata: { sourceLogId: snap.id, calculationDate: d.updatedAt || d.timestamp }
            };
        }
        return null;
    } catch (e) { return null; }
};