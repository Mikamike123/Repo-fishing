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
  level: number; // m
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
  zone: ZoneType; // Power Fishing: Catch location might differ from session start
  timestamp: Date;
}

export interface Miss {
  id: string;
  type: 'Décroché' | 'Casse' | 'Touche Ratée' | 'Suivi' | 'Inconnu';
  speciesSupposed: SpeciesType | 'Inconnu'; // SFD Compliance
  estimation: 'Inconnu' | 'Petit' | 'Moyen' | 'Lourd' | 'Monstre';
  location: string;
  zone: ZoneType; // Power Fishing: Miss location might differ from session start
  timestamp: Date;
}

// Historical Session Entity
export interface Session {
  id: string;
  date: Date;
  startTime: string;
  endTime: string;
  zone: ZoneType;
  durationMinutes: number;
  setup: string;
  feelingScore: number;
  weather: WeatherSnapshot;
  hydro: HydroSnapshot;
  bioScore: number;
  catches: Catch[];
  misses: Miss[];
  catchCount: number;
}

export type OracleScore = number | null; // null represents "N/A" for data score