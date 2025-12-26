import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { FullEnvironmentalSnapshot } from '../types';

// --- PARTIE 1 : ENVIRONNEMENT LIVE ---

export interface LatestEnvironment {
  weather: FullEnvironmentalSnapshot['weather'] | null;
  hydro: FullEnvironmentalSnapshot['hydro'] | null;
  scores: FullEnvironmentalSnapshot['scores'] | null;
  computed: any | null; 
  isLoading: boolean;
}

export const useLatestEnvironment = (): LatestEnvironment => {
  const [data, setData] = useState<LatestEnvironment>({
    weather: null, hydro: null, scores: null, computed: null, isLoading: true,
  });

  useEffect(() => {
    const q = query(
      collection(db, 'environmental_logs'),
      orderBy('__name__', 'desc'), 
      limit(2)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const docs = snapshot.docs.map(d => d.data());
        const latestDoc = docs[0];
        const previousDoc = docs[1];

        const hasScores = latestDoc.computed?.score_sandre > 0;
        const d = hasScores ? latestDoc : (previousDoc || latestDoc);
        
        setData({
          weather: {
            temperature: d.weather?.temp || 0,
            pressure: d.weather?.pressure || 0,
            windSpeed: d.weather?.windSpeed || 0,
            windDirection: d.weather?.windDir || 0, 
            clouds: d.weather?.cloudCover || 0,
            precip: d.weather?.precip || 0,
            conditionCode: d.weather?.condition_code || 0
          },
          hydro: {
            waterTemp: d.hydro?.waterTemp || null,
            level: d.hydro?.level || 0,
            flowRaw: d.hydro?.flow || 0,
            flowLagged: d.computed?.flow_lagged || 0,
            turbidityIdx: d.computed?.turbidity_idx || 0
          },
          scores: {
            sandre: d.computed?.score_sandre || 0,
            brochet: d.computed?.score_brochet || 0,
            perche: d.computed?.score_perche || 0,
          },
          computed: d.computed || null,
          isLoading: false,
        });
      } else {
        setData((prev) => ({ ...prev, isLoading: false }));
      }
    });

    return () => unsubscribe();
  }, []);

  return data;
};

export const useCurrentConditions = useLatestEnvironment;

// --- PARTIE 2 : HISTORIQUE GRAPHIQUE (SÉCURISÉ) ---

export interface HistoricalDataPoint {
  time: number;
  temperature_2m: number;
  precipitation: number;
  wind_speed_10m: number;
  surface_pressure: number;
  cloud_cover: number;
}

export const useHistoricalWeather = (
  lat: number | undefined, 
  lng: number | undefined, 
  date: Date,
  options: { enabled?: boolean } = { enabled: true }
) => {
  const [data, setData] = useState<HistoricalDataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 1. Clause de garde : On ne fait rien si les coords manquent ou si le hook est désactivé
    if (lat === undefined || lng === undefined || !date || options.enabled === false) return;

    const fetchHistory = async () => {
      setLoading(true);
      setError(null);
      try {
        const startDate = new Date(date);
        startDate.setDate(startDate.getDate() - 1);
        
        let endDate = new Date(date);
        endDate.setDate(endDate.getDate() + 2);

        // 2. SÉCURITÉ DATE : On empêche de demander le futur à l'API Archive
        const now = new Date();
        const maxAllowedDateStr = now.toISOString().split('T')[0]; // Date du jour format YYYY-MM-DD
        
        const startStr = startDate.toISOString().split('T')[0];
        let endStr = endDate.toISOString().split('T')[0];

        // Si la date de fin demandée est dans le futur, on la ramène à aujourd'hui
        if (endStr > maxAllowedDateStr) {
            endStr = maxAllowedDateStr;
        }

        // Si après correction, le début est après la fin (ex: tout est dans le futur), on annule l'appel
        if (startStr > endStr) {
            // console.log("ℹ️ [useHistoricalWeather] Plage 100% future, appel Archive annulé.");
            setLoading(false);
            return;
        }

        const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=${startStr}&end_date=${endStr}&hourly=temperature_2m,precipitation,wind_speed_10m,surface_pressure,cloud_cover&timezone=Europe%2FParis`;

        const res = await fetch(url);
        
        // Gestion silencieuse des erreurs 400 (souvent dues aux dates limites)
        if (!res.ok) {
           if (res.status === 400) {
             console.warn(`⚠️ Météo Historique : Date hors limites ignorée (${startStr} au ${endStr})`);
             return; 
           }
           throw new Error(`Erreur API (${res.status})`);
        }

        const json = await res.json();
        
        if (json.hourly && json.hourly.time) {
            const points: HistoricalDataPoint[] = json.hourly.time.map((t: string, i: number) => ({
                time: new Date(t).getTime(),
                temperature_2m: json.hourly.temperature_2m[i],
                precipitation: json.hourly.precipitation[i],
                wind_speed_10m: json.hourly.wind_speed_10m[i],
                surface_pressure: json.hourly.surface_pressure[i],
                cloud_cover: json.hourly.cloud_cover[i],
            }));
            setData(points);
        }
      } catch (err) {
        console.error(err);
        setError("Impossible de charger l'historique météo");
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [lat, lng, date, options.enabled]);

  return { data, loading, error };
};