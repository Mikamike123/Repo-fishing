// types.ts - Architecture Cible Complète (v4.5 - RAG & Observatoire)

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

// --- STRUCTURES ENVIRONNEMENTALES DÉTAILLÉES (Observables) ---

export interface WeatherSnapshot {
  temperature: number;      // °C
  pressure: number;         // hPa
  windSpeed: number;        // km/h
  windDir: number;          // °
  precip: number;           // mm
  cloudCover: number;       // %
  conditionCode: number;    // Code WMO
}

export interface HydroSnapshot {
  flowRaw: number;          // L/s (Donnée brute Vigicrues)
  flowLagged: number;       // m3/s (Débit corrigé pour le spot)
  level: number;            // mm
  waterTemp: number | null; // °C (Modèle EWMA)
  turbidityIdx: number;     // 0-1 (Indice de clarté)
}

export interface BioScoreSnapshot {
  sandre: number;           // 0-100
  brochet: number;          // 0-100
  perche: number;           // 0-100
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
    sourceLogId: string;     // ID document format YYYY-MM-DD_HH00
    calculationDate: any;    // updatedAt du log Firestore
  };
}

// --- ARSENAL & RÉFÉRENTIELS ---

// NOUVEAU : Entité Secteur (Location)
export interface Location extends BaseEntity {
  label: string;
  description?: string;
  isFavorite?: boolean; // Gestion des favoris (Max 3 actifs)
  coordinates?: { lat: number; lng: number }; // AJOUT : Coordonnées GPS du secteur
}

export interface Spot extends BaseEntity {
  label: string; 
  type?: 'Fleuve' | 'Etang' | 'Canal' | 'Lac' | 'Rivière' | 'Mer'; 
  coordinates?: { lat: number; lng: number };
  locationId: string; // MODIFICATION : Lien OBLIGATOIRE vers un Secteur parent
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
  date: string;              // YYYY-MM-DD
  startTime: string;         // HH:mm
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
    locations: Location[]; // Nouvelle liste chargée au démarrage
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

// --- GAMIFICATION (ORACLE SEASON v1) ---

export interface YearlySnapshot {
  year: number;
  levelReached: number;
  xpTotal: number;
  sessionCount: number;
  fishCount: number;
  weeksWithStreak: number; // Nombre de semaines où l'objectif (2 sessions) a été tenu
  topCatch?: Catch;        // Le poisson "MVP" de l'année
}

export interface UserStats {
  userId: string;
  history: Record<number, YearlySnapshot>; // Clé = année (2023, 2024...)
  currentLevel: number;
  currentXP: number;
  xpToNextLevel: number;
}