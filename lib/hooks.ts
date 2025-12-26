// lib/hooks.ts
import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { FullEnvironmentalSnapshot } from '../types';

export interface LatestEnvironment {
  weather: FullEnvironmentalSnapshot['weather'] | null;
  hydro: FullEnvironmentalSnapshot['hydro'] | null;
  scores: FullEnvironmentalSnapshot['scores'] | null;
  // AJOUT : On expose les données brutes calculées (pression gradient, turbidité)
  // pour permettre au Dashboard de faire ses calculs locaux "Zero-Hydro"
  computed: any | null; 
  isLoading: boolean;
}

export const useLatestEnvironment = (): LatestEnvironment => {
  const [data, setData] = useState<LatestEnvironment>({
    weather: null, hydro: null, scores: null, computed: null, isLoading: true,
  });

  useEffect(() => {
    // On récupère les 2 derniers logs pour gérer le délai d'enrichissement (H+10 à H+20)
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

        // LOGIQUE DE REPLI (FALLBACK) :
        // Si le log le plus récent n'a pas encore de scores (en cours de calcul), 
        // on utilise le document précédent pour ne pas afficher de zéros à Michael.
        const hasScores = latestDoc.computed?.score_sandre > 0;
        const d = hasScores ? latestDoc : (previousDoc || latestDoc);
        
        setData({
          weather: {
            temperature: d.weather?.temp || 0,
            pressure: d.weather?.pressure || 0,
            windSpeed: d.weather?.windSpeed || 0,
            // CORRECTION DE TYPE : Mapping windDir (DB) -> windDirection (Interface)
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
          // AJOUT : Transmission de l'objet computed complet
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