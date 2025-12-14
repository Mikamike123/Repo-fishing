// types.ts - Version CONSOLIDÉE et Corrigée (Final)

import { Timestamp } from "firebase/firestore";

// Weather data snapshot from Open-Meteo
export interface WeatherSnapshot {
    temperature: number;
    pressure: number; // hPa
    clouds: number; // % 0-100
    windSpeed: number; // km/h
}

// Hydrology data snapshot from Hubeau (Austerlitz)
export interface HydroSnapshot {
    flow: number; // m3/s
    level: number; // m <<< Ajouté pour supporter la Hauteur d'eau
    waterTemp?: number | null; // <<< NOUVEAU : Ajout de la température de l'eau
}

// Combined conditions for the Bio Oracle
export interface BioConditions {
    date: Date;
    currentWeather: WeatherSnapshot;
    currentHydro: HydroSnapshot;
    pressureTMinus3h: number; // For Delta P
    flowTMinus24h: number; // For Delta Q
    sunrise: Date;
    sunset: Date;
}

// Relaxed types to allow dynamic user configuration
export type ZoneType = string;
export type TechniqueType = string;

export type SpeciesType = 'Sandre' | 'Perche' | 'Brochet' | 'Silure' | 'Chevesne' | 'Aspe';

export interface Catch {
    id: string;
    species: SpeciesType;
    size: number;
    technique: TechniqueType;
    lure: string;
    zone: ZoneType; 
    timestamp: Date;
}

export interface Miss {
    id: string;
    type: 'Décroché' | 'Casse' | 'Touche Ratée' | 'Suivi' | 'Inconnu';
    speciesSupposed: SpeciesType | 'Inconnu';
    estimation: 'Inconnu' | 'Petit' | 'Moyen' | 'Lourd' | 'Monstre';
    location: string;
    zone: ZoneType; 
    timestamp: Date;
}


// --- DÉFINITION UNIQUE ET CONSOLIDÉE DE SESSION ---
export interface Session {
    id: string;
    date: string; // YYYY-MM-JJ pour le state/formulaire
    
    // Champs essentiels (non optionnels)
    zone: ZoneType;
    setup: string;
    feelingScore: number;
    catchCount: number; // Dérivé de catches.length
    
    // NOUVEAUX CHAMPS ENVIRONNEMENTAUX CAPTURÉS
    waterTemp: number | null; 
    cloudCoverage: number | null; 
    
    // Les tableaux doivent toujours être présents, mais peuvent être vides
    techniquesUsed: string[];
    catches: Catch[];
    misses: Miss[];
    
    // Champs optionnels ou historiques
    // CORRECTION CRITIQUE : Accepter null explicitement pour éviter ts(2322)
    startTime?: string;
    endTime?: string;
    durationMinutes?: number;
    weather?: WeatherSnapshot | null; // <<< CORRIGÉ
    hydro?: HydroSnapshot | null;     // <<< CORRIGÉ
    bioScore?: number;
    notes?: string;
    weatherDescription?: string;
}
// --- FIN DÉFINITION UNIQUE ---


// --- Structure pour le document de configuration de l'Arsenal ---
export interface ArsenalConfig {
    zones: string[];
    setups: string[];
    techniques: string[];
    lastUpdated?: Date; 
}

export type OracleScore = number | null;