// types.ts - Architecture Cible Complète (v5.0 - Simulation Déterministe)

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
  userAvatar?: string;
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
  flowLagged: number;       
  level: number;            
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