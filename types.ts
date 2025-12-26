// types.ts - Architecture Cible Complète (v4.7 - Stabilisation & Zero-Hydro)

// --- ENTITÉS DE BASE ---
export interface BaseEntity {
  id: string;
  userId: string;           // Clé de cloisonnement (Row Level Security)
  createdAt?: any;          // Timestamp Firestore
  updatedAt?: any;          // Timestamp Firestore
  active: boolean;          // Le pivot du Soft Delete : false = archivé
  displayOrder: number;     // Pour le tri personnalisé
  userPseudo?: string;
  userAvatar?: string;
}

// --- ÉNUMÉRATIONS MÉTIER ---
export type SpeciesType = 'Brochet' | 'Sandre' | 'Perche' | 'Black-Bass' | 'Silure' | 'Chevesne' | 'Truite' | 'Aspe' | 'Bar' | 'Inconnu';

// --- STRUCTURES ENVIRONNEMENTALES ---

export interface WeatherSnapshot {
  temperature: number;      // °C
  pressure: number;         // hPa
  windSpeed: number;        // km/h
  windDirection: number;    // ° (Restauré pour compatibilité)
  precip: number;           // mm
  clouds: number;           // % (Restauré pour compatibilité)
  conditionCode: number;    // Code WMO
  irradiance?: number;      // [Zero-Hydro] : Rayonnement solaire (W/m2)
}

export interface HydroSnapshot {
  flowRaw: number;          // L/s (Donnée brute Vigicrues)
  flowLagged: number;       // m3/s (Débit corrigé pour le spot)
  level: number;            // mm
  waterTemp: number | null; // °C (Modèle EWMA ou Zero-Hydro)
  turbidityIdx: number;     // 0-1 (Indice de clarté)
}

export interface BioScoreSnapshot {
  sandre: number;           // 0-100
  brochet: number;          // 0-100
  perche: number;           // 0-100
  blackbass?: number;       // [Zero-Hydro]
}

export interface FullEnvironmentalSnapshot {
  weather: WeatherSnapshot;
  hydro: HydroSnapshot;
  scores: BioScoreSnapshot;
  metadata: {
    sourceLogId?: string;
    calculationDate: any;   
    calculationMode?: 'OBSERVATORY' | 'ZERO_HYDRO';
  };
}

// --- ARSENAL & RÉFÉRENTIELS ---

export type MorphologyID = 'Z_RIVER' | 'Z_POND' | 'Z_MED' | 'Z_DEEP';
export type DepthCategoryID = 'Z_LESS_3' | 'Z_3_15' | 'Z_MORE_15';
export type BassinType = 'URBAIN' | 'AGRICOLE' | 'NATUREL';

export interface LocationMorphology {
  typeId: MorphologyID;      
  depthId: DepthCategoryID;  
  bassin: BassinType;        
}

export interface Location extends BaseEntity {
  label: string;
  description?: string;
  isFavorite?: boolean;
  coordinates?: { lat: number; lng: number };
  morphology?: LocationMorphology;
  speciesIds?: string[];
  // --- AJOUTS ZÉRO-HYDRO (HYBRID SYNC) ---
  lastCalculatedTemp?: number;   // Mémoire thermique (T_water à l'instant t-1)
  lastSyncDate?: string;         // Horodatage du dernier calcul (ISO String)    
}

export interface Spot extends BaseEntity {
  label: string;
  type?: 'Fleuve' | 'Etang' | 'Canal' | 'Rivière';
  coordinates?: { lat: number; lng: number };
  locationId: string;       
}

// ALIAS DE COMPATIBILITÉ (Pour corriger l'erreur Zone)
export type Zone = Spot;

export interface Setup extends BaseEntity {
  label: string;
  description?: string;
}

export interface Technique extends BaseEntity {
  label: string; 
}

// --- CATALOGUE LEURRES ---

export interface RefLureType extends BaseEntity { label: string; }
export interface RefColor extends BaseEntity { label: string; }
export interface RefSize extends BaseEntity { label: string; }
export interface RefWeight extends BaseEntity { label: string; }

export interface Lure extends BaseEntity {
  brand: string;
  model: string;
  typeId?: string;
  colorId?: string;
  sizeId?: string;
  weightId?: string;
  imageUrl?: string;
  isFavorite?: boolean;
}

// --- SESSIONS & PRISES ---

export interface Catch {
  id: string;
  species: string; 
  size: number;
  lureName: string;
  lureTypeId?: string;
  lureColorId?: string;
  lureSizeId?: string;
  lureWeightId?: string;
  time: string;
  technique: string;
  techniqueId?: string;
  spotName: string;
  spotId: string;
  photoUrls?: string[];
  notes?: string;
  released?: boolean;
  userId?: string;
  
  // RESTAURATION DES CHAMPS MANQUANTS
  timestamp?: any; 
  weatherSnapshot?: WeatherSnapshot;
  envSnapshot?: FullEnvironmentalSnapshot; 
}

export interface Miss {
  id: string;
  type: 'Touche' | 'Décroché' | 'Coupe' | 'Suivi';
  lureName: string;
  time: string;
  spotId: string;
  userId?: string;
}

export interface Session extends BaseEntity {
  date: string;
  startTime: string;
  endTime: string;   
  durationMinutes: number;
  spotId: string;   
  spotName: string; 
  setupId: string;
  setupName: string;
  feelingScore: number;
  catchCount: number;
  notes: string;
  catches: Catch[];
  misses: Miss[];
  techniquesUsed: string[];
  envSnapshot?: FullEnvironmentalSnapshot | null;
}

// --- APPLICATION ---

export interface AppData {
    locations: Location[];
    spots: Spot[];
    setups: Setup[];
    techniques: Technique[];
    lureTypes: RefLureType[];
    colors: RefColor[];
    sizes: RefSize[];
    weights: RefWeight[];
    lures: Lure[]; 
}

export interface UserProfile {
  id: string; 
  pseudo: string;
  createdAt: any;
  avatarBase64?: string;
}

export interface BioConditions {
  date: Date;
  sunrise: Date;
  sunset: Date;
  currentWeather: WeatherSnapshot;
  currentHydro: HydroSnapshot;
  pressureTMinus3h: number;
  flowTMinus24h: number;
}

// --- GAMIFICATION (ORACLE SEASON v1) ---

export interface YearlySnapshot {
  year: number;
  levelReached: number;
  xpTotal: number;
  sessionCount: number;
  fishCount: number;
  weeksWithStreak: number;
  
  // Le poisson record de l'année (Synchronisé avec gamification.ts)
  topCatch?: Catch; 
  
  // Champs pour compatibilité future (v4.5+)
  topLure?: string | null;
  topTechnique?: string | null;
}

export type UserHistory = Record<number, YearlySnapshot>;