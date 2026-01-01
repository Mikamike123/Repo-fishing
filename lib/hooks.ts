// lib/hooks.ts
// [NETTOYAGE] Ce fichier contenait la logique de récupération des "environmental_logs" (Vigicrues Legacy).
// Désormais, toutes les données environnementales passent par :
// 1. universal-weather-service.ts (Météo temps réel & historique)
// 2. oracle-service.ts (Prévision & Simulation Hydro Universelle)
// 3. historical.ts (Cloud Function pour l'archivage)

import { useState, useEffect } from 'react';

// --- HISTORIQUE GRAPHIQUE (UNIVERSAL OPEN-METEO) ---
// Ce hook reste utile car il interroge l'API Archive d'Open-Meteo pour les analyses passées.
// Il n'a aucune dépendance à la collection 'environmental_logs'.

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
    // 1. Clause de garde
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
        const maxAllowedDateStr = now.toISOString().split('T')[0];
        
        const startStr = startDate.toISOString().split('T')[0];
        let endStr = endDate.toISOString().split('T')[0];

        if (endStr > maxAllowedDateStr) {
            endStr = maxAllowedDateStr;
        }

        if (startStr > endStr) {
            setLoading(false);
            return;
        }

        const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=${startStr}&end_date=${endStr}&hourly=temperature_2m,precipitation,wind_speed_10m,surface_pressure,cloud_cover&timezone=Europe%2FParis`;

        const res = await fetch(url);
        
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