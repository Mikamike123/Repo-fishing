// src/lib/zeroHydroEngine.ts

import { MorphologyID, BassinType } from '../types';

// --- CONSTANTES PHYSIQUES CALIBRÉES (V4.5) ---
const MORPHO_PARAMS: Record<MorphologyID, { delta: number; mu: number }> = {
    // Étang : Réagit vite, suit l'air de près
    'Z_POND':  { delta: 4,  mu: 0.8 }, 
    
    // Lac Moyen : Inertie modérée
    'Z_MED':   { delta: 15, mu: 1.5 }, 
    
    // Grand Lac : Enorme inertie, très décorrélé de l'air instantané
    'Z_DEEP':  { delta: 40, mu: 3.5 }, 
    
    // Rivière : Calibrage "Seine" (Volume important + Courant)
    // Delta augmenté de 6 à 14 pour éviter la chute brutale en hiver
    'Z_RIVER': { delta: 14,  mu: 0.6 }  
};

const PHI = 172; // Déphasage saisonnier (Solstice d'été ~21 Juin)

// Correction thermique pour les milieux anthropisés (Urban Heat Island)
// La Seine est chauffée par la ville (rejets, béton) : +1.8°C en moyenne annuelle
const BASSIN_OFFSET: Record<BassinType, number> = {
    'URBAIN': 1.2,   // Paris/Banlieue : Fort réchauffement artificiel
    'AGRICOLE': 0.5, // Champs : Peu d'effet
    'NATUREL': 0.0   // Forêt : Pas de correction
};

interface DailyWeather {
    date: string;
    avgTemp: number;
}

/**
 * Récupère l'historique météo via Open-Meteo Archive
 * @param lat Latitude
 * @param lng Longitude
 * @param daysNumber Nombre de jours à récupérer en arrière
 */
export const fetchWeatherHistory = async (lat: number, lng: number, daysNumber: number): Promise<DailyWeather[]> => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - daysNumber);

    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    // Utilisation de l'API Archive pour la fiabilité historique
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=${formatDate(startDate)}&end_date=${formatDate(endDate)}&daily=temperature_2m_mean&timezone=Europe%2FParis`;

    try {
        const res = await fetch(url);
        const data = await res.json();

        if (!data.daily || !data.daily.time) return [];

        return data.daily.time.map((time: string, index: number) => ({
            date: time,
            avgTemp: data.daily.temperature_2m_mean[index]
        }));
    } catch (error) {
        console.error("Erreur Open-Meteo:", error);
        return [];
    }
};

/**
 * Résout l'équation différentielle Air2Water (Méthode d'Euler) avec correction Urbaine
 * @param weatherHistory Tableau des températures de l'air
 * @param morphoType Type de milieu (Z_RIVER, etc.)
 * @param bassinType Type de bassin (URBAIN, etc.) pour l'offset thermique
 * @param initialWaterTemp (Optionnel) Température de départ T(t-1)
 */
export const solveAir2Water = (
    weatherHistory: DailyWeather[],
    morphoType: MorphologyID,
    bassinType: BassinType, // <--- NOUVEAU PARAMÈTRE
    initialWaterTemp?: number
): number => {
    const params = MORPHO_PARAMS[morphoType] || MORPHO_PARAMS['Z_RIVER'];
    const offset = BASSIN_OFFSET[bassinType] || 0;
    
    const { delta, mu } = params;

    // Condition initiale
    let waterTemp = initialWaterTemp ?? weatherHistory[0].avgTemp;

    // Boucle de simulation (Pas de temps = 1 jour)
    weatherHistory.forEach((day, index) => {
        // On évite le calcul pour le premier jour si on vient de l'initialiser avec l'air
        if (index === 0 && initialWaterTemp === undefined) return;

        const dayOfYear = getDayOfYear(new Date(day.date));
        
        // Terme Saisonnier
        const solarTerm = mu * Math.sin((2 * Math.PI * (dayOfYear - PHI)) / 365);
        
        // Équation Différentielle : dTw/dt = (1/delta) * (Tair - Tw) + Solar
        const dTw_dt = (1 / delta) * (day.avgTemp - waterTemp) + solarTerm;

        waterTemp += dTw_dt;
    });

    // Application finale de l'offset urbain (Calibration Seine)
    // On l'ajoute à la fin pour simuler l'apport calorique constant de la ville
    const finalTemp = waterTemp + offset;

    return Number(finalTemp.toFixed(1));
};

// Helper utilitaire
const getDayOfYear = (date: Date): number => {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
};