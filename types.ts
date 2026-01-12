// types.ts - Architecture Cible Complète (v8.1 - Atomic Snapshot)
export const SCHEMA_VERSION = 8.1;

// --- ENTITÉS DE BASE ---
export interface BaseEntity {
  name: string;
  id: string;
  userId: string;           
  createdAt?: any;          
  updatedAt?: any;          
  active: boolean;          
  displayOrder: number;     
  userPseudo?: string;
  isFavorite?: boolean;   
  coordinates?: {         
      lat: number;
      lng: number;
  };
}

// --- ÉNUMÉRATIONS MÉTIER ---
export type SpeciesType = 'Brochet' | 'Sandre' | 'Perche' | 'Black-Bass' | 'Silure' | 'Chevesne' | 'Truite' | 'Aspe' | 'Bar' | 'Inconnu';

// --- STRUCTURES ENVIRONNEMENTALES ---

export interface WeatherSnapshot {
  temperature: number;      
  pressure: number;         
  windSpeed: number;        
  windDirection: number;    
  precip: number;           
  clouds: number;           
  conditionCode: number;    
  irradiance?: number;      
}

export interface HydroSnapshot {
  flowRaw: number;                    
  waterTemp: number | null; 
  tFond?: number;            
  turbidityIdx?: number;
  turbidityNTU?: number;     // Ajouté pour le moteur Universel     
  dissolvedOxygen?: number; 
  waveHeight?: number;       
}

export interface BioScoreSnapshot {
  sandre: number;           
  brochet: number;          
  perche: number;           
  blackbass?: number;       
}
// [AJOUT] Michael : Interface pour les points du graphique et la météo unifiée
export interface OracleDataPoint {
  timestamp: number;
  hourLabel: string;
  isForecast: boolean;
  
  // Données Hydro simulées
  waterTemp: number;
  tFond: number;
  turbidityNTU: number;
  dissolvedOxygen: number;
  waveHeight: number;
  flowRaw: number;
  flowStatus?: 'Montée' | 'Décrue' | 'Stable';

  // [NOUVEAU] Données Météo brutes (pour alimenter le Live)
  airTemp: number; 
  pressure: number;
  clouds: number;
  windSpeed: number;
  windDirection: number;
  precip: number;
  conditionCode: number;

  // BioScores
  sandre: number;
  brochet: number;
  perche: number;
  blackbass: number;
  bestScore: number;
}
export interface FullEnvironmentalSnapshot {
  weather: WeatherSnapshot;
  hydro: HydroSnapshot;
  scores: BioScoreSnapshot;
  metadata: {
    sourceLogId?: string;
    calculationDate: any;   
    calculationMode?: 'OBSERVATORY' | 'ZERO_HYDRO' | 'ULTREIA_CALIBRATED';
    flowStatus?: 'Montée' | 'Décrue' | 'Stable';
    morphologyType?: MorphologyID;
    schemaVersion: number; // [NOUVEAU] Garantit l'intégrité v8.1
  };
}

// --- ARSENAL & RÉFÉRENTIELS ---

export type MorphologyID = 'Z_RIVER' | 'Z_POND' | 'Z_MED' | 'Z_DEEP';
export type DepthCategoryID = 'Z_LESS_3' | 'Z_3_15' | 'Z_MORE_15';
export type BassinType = 'URBAIN' | 'AGRICOLE' | 'PRAIRIE' | 'FORESTIER';

export interface LocationMorphology {
  typeId: MorphologyID;      
  depthId: DepthCategoryID;  
  bassin: BassinType;  
  /** Profondeur moyenne en mètres (v5.0) */
  meanDepth?: number;
  /** Surface en m2 (v5.0) */
  surfaceArea?: number;      
  /** Facteur de forme (v5.0) */
  shapeFactor?: number;            
}

export interface Location extends BaseEntity {
  label: string;
  description?: string;
  isFavorite?: boolean;
  coordinates?: { lat: number; lng: number };
  morphology?: LocationMorphology;
  speciesIds?: string[];
  lastCalculatedTemp?: number;   
  lastSyncDate?: string;  
  lastSnapshot?: FullEnvironmentalSnapshot; // [NOUVEAU] Le bloc atomique persistant           
}

export interface Spot extends BaseEntity {
  label: string;
  type?: 'Fleuve' | 'Etang' | 'Canal' | 'Rivière';
  coordinates?: { lat: number; lng: number };
  locationId: string;       
}

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
  lureTypeId?: string;   
  lureColorId?: string;  
  lureSizeId?: string;   
  lureWeightId?: string; 
  envSnapshot?: FullEnvironmentalSnapshot;
}

export interface Session extends BaseEntity {
  date: string;
  startTime: string;
  endTime: string;   
  durationMinutes: number;
  locationId: string;    
  locationName: string;
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
  readBy?: string[];   // Michael : Liste des UIDs ayant lu la session
  hiddenBy?: string[]; // Michael : Liste des UIDs ayant purgé la session du feed
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
  avatarUrl?: string;
  lastXpGain?: number;
  lastXpYear?: number;
  xpTotal?: number;      // Ajouté pour la persistance
  levelReached?: number; // Ajouté pour la persistance
  pendingLevelUp?: boolean; // Le "Drapeau" de notification
  themePreference?: 'light' | 'night' | 'auto'; // Michael : Pour la gestion visuelle
  notificationsEnabled?: boolean;              // Michael : État des alertes push
  fcmToken?: string;                           // Michael : Le jeton unique du téléphone
  lastTokenUpdate?: string;                    // Michael : Date de dernière mise à jour
  homeAnchor?: { lat: number; lng: number };  // Michael : Point d'ancrage GPS personnel
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

// --- GAMIFICATION ---

export interface YearlySnapshot {
  year: number;
  levelReached: number;
  xpTotal: number;
  sessionCount: number;
  fishCount: number;
  weeksWithStreak: number;
  topCatch?: Catch; 
  topLure?: string | null;
  topTechnique?: string | null;
}

export type UserHistory = Record<number, YearlySnapshot>;