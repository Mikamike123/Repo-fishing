// lib/hooks.ts
import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

export interface CurrentConditions {
  weather: any;
  hydro: any;
  isLoading: boolean;
}

export const useCurrentConditions = (): CurrentConditions => {
  const [data, setData] = useState<CurrentConditions>({
    weather: null,
    hydro: null,
    isLoading: true,
  });

  useEffect(() => {
    // Écoute temps réel du dernier log environnemental (La "seule source de vérité")
    const q = query(
      collection(db, 'environmental_logs'),
      orderBy('timestamp', 'desc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const docData = snapshot.docs[0].data();
        setData({
          weather: docData.weather || null,
          hydro: docData.hydro || null,
          isLoading: false,
        });
      } else {
        setData({ weather: null, hydro: null, isLoading: false });
      }
    }, (error) => {
      console.error("Erreur Hook useCurrentConditions:", error);
      setData((prev) => ({ ...prev, isLoading: false }));
    });

    return () => unsubscribe();
  }, []);

  return data;
};