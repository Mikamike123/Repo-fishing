// types.ts - Architecture Cible Complète (v4.5 - RAG & Observatoire)

// --- ENTITÉS DE BASE ---
export interface BaseEntity {
  id: string;
  userId: string;
  createdAt?: any;
  updatedAt?: any;
  active: boolean; 
  userPseudo?: string;
  userAvatar?: string;
}

// --- STRUCTURES ENVIRONNEMENTALES DÉTAILLÉES (Observables) ---

export interface WeatherSnapshot {
  temperature: number;      // °C [cite: 63]
  pressure: number;         // hPa [cite: 64]
  windSpeed: number;        // km/h [cite: 65]
  windDir: number;          // ° [cite: 66]
  precip: number;           // mm [cite: 67]
  cloudCover: number;       // % [cite: 68]
  conditionCode: number;    // Code WMO [cite: 69]
}

export interface HydroSnapshot {
  flowRaw: number;          // L/s (Donnée brute Vigicrues) [cite: 73]
  flowLagged: number;       // m3/s (Débit corrigé pour le spot) [cite: 80]
  level: number;            // mm [cite: 72]
  waterTemp: number | null; // °C (Modèle EWMA) [cite: 75]
  turbidityIdx: number;     // 0-1 (Indice de clarté) [cite: 81]
}

export interface BioScoreSnapshot {
  sandre: number;           // 0-100 [cite: 86]
  brochet: number;          // 0-100 [cite: 87]
  perche: number;           // 0-100 [cite: 88]
}

/**
 * Snapshot complet de l'observatoire à un instant T.
 * Utilisé pour le Dashboard (Direct) et le stockage (Historique).
 */
export interface FullEnvironmentalSnapshot {
  weather: WeatherSnapshot;
  hydro: HydroSnapshot;
  scores: BioScoreSnapshot;
  metadata: {
    sourceLogId: string;     // ID document format YYYY-MM-DD_HH00 [cite: 48]
    calculationDate: any;    // updatedAt du log Firestore [cite: 55]
  };
}

// --- ARSENAL & RÉFÉRENTIELS ---

export interface Spot extends BaseEntity {
  label: string; 
  type?: 'Fleuve' | 'Etang' | 'Canal' | 'Lac' | 'Rivière' | 'Mer'; 
  coordinates?: { lat: number; lng: number };
}
export type Zone = Spot;

export interface Setup extends BaseEntity {
  label: string; 
  description?: string;
}

export interface Technique extends BaseEntity {
  label: string; 
}

export interface RefLureType extends BaseEntity { label: string; }
export interface RefColor extends BaseEntity { label: string; }
export interface RefSize extends BaseEntity { label: string; }
export interface RefWeight extends BaseEntity { label: string; }

export interface Lure extends BaseEntity {
  brand: string;
  model: string;
  typeId?: string;
  colorId?: string;
}

export type SpeciesType = 'Brochet' | 'Sandre' | 'Perche' | 'Black-Bass' | 'Silure' | 'Chevesne' | 'Truite' | 'Aspe' | 'Bar' | 'Inconnu';

// --- ÉVÉNEMENTS DE PÊCHE ---

export interface Catch {
  id: string;
  species: SpeciesType;
  size: number;
  weight?: number;
  
  techniqueId: string;
  technique: string;
  setupId: string;
  setup: string;
  
  lureName: string;
  lureTypeId?: string;
  lureColorId?: string;
  lureSizeId?: string;
  lureWeightId?: string;
  
  spotId: string;
  spotName: string;
  
  timestamp: any; 
  photoUrls?: string[];

  // Stockage définitif des indicateurs au moment de la prise
  envSnapshot?: FullEnvironmentalSnapshot | null; 
}

export interface Miss {
  id: string;
  type: 'Décroché' | 'Touche Ratée' | 'Suivi' | 'Casse' | 'Coupe' | 'Inconnu';
  speciesSupposed: SpeciesType | 'Inconnu';
  estimation: 'Petit' | 'Moyen' | 'Lourd' | 'Monstre' | 'Inconnu';
  location: string; 
  spotId: string;
  spotName: string;     
  timestamp: any;
  lureName?: string;
  lureTypeId?: string;
  lureColorId?: string;
  lureSizeId?: string;
  lureWeightId?: string;

  // Stockage définitif des indicateurs au moment du raté
  envSnapshot?: FullEnvironmentalSnapshot | null;
}

export interface Session extends BaseEntity {
  date: string;              // YYYY-MM-DD [cite: 144]
  startTime: string;         // HH:mm [cite: 145]
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

  // Snapshot environnemental fixé au début de la session
  envSnapshot?: FullEnvironmentalSnapshot | null;
}

// --- APPLICATION & PROFIL ---

export interface AppData {
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