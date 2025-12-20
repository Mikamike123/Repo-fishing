// types.ts - Architecture Cible Complète (V3.1)

// --- ENTITÉS DE BASE (ARSENAL) ---
export interface BaseEntity {
  id: string;
  userId: string;
  createdAt?: any;
  updatedAt?: any;
  active: boolean; 
  userPseudo?: string; // <--- AJOUT
  userAvatar?: string; // <--- AJOUT
}

// 1. SPOTS (ex-Zones) : Plus précis
export interface Spot extends BaseEntity {
  label: string; // Ex: "Spot A - Proche ruine béton"
  type?: 'Fleuve' | 'Etang' | 'Canal' | 'Lac' | 'Rivière' | 'Mer'; 
  coordinates?: { lat: number; lng: number };
}
export type Zone = Spot; // Alias de rétrocompatibilité pour la transition

// 2. SETUP (Combos)
export interface Setup extends BaseEntity {
  label: string; // Ex: "Spinning L / Stradic"
  description?: string;
}

// 3. TECHNIQUES (Actions de pêche)
export interface Technique extends BaseEntity {
  label: string; // Ex: "Contact Fond - Grattage"
}

// --- NOUVELLES COLLECTIONS DE RÉFÉRENCE (V3.1) ---

// 4. CATÉGORIES DE LEURRES (ref_lure_types)
export interface RefLureType extends BaseEntity {
  label: string; // Ex: "Vibrant - Shad", "Topwater - Popper"
}

// 5. COULEURS (ref_colors)
export interface RefColor extends BaseEntity {
  label: string; // Ex: "Flashy - Chartreuse", "Naturel - Ablette"
}

// 6. TAILLES (ref_sizes)
export interface RefSize extends BaseEntity {
  label: string; // Ex: "2\" - 3\"", "5\"+"
}

// 7. POIDS (ref_weights)
export interface RefWeight extends BaseEntity {
  label: string; // Ex: "5 - 9g", "10 - 14g"
}

// L'inventaire précis des leurres (Optionnel si on utilise juste les Ref en saisie rapide)
export interface Lure extends BaseEntity {
  brand: string;
  model: string;
  typeId?: string; // Lien vers RefLureType
  colorId?: string; // Lien vers RefColor
}

// --- TYPES UTILITAIRES ---
export type SpeciesType = 'Brochet' | 'Sandre' | 'Perche' | 'Black-Bass' | 'Silure' | 'Chevesne' | 'Truite' | 'Aspe' | 'Bar' | 'Inconnu';

// --- MÉTÉO & HYDRO (Snapshot) ---
export interface WeatherSnapshot {
  temperature: number;
  pressure: number;
  clouds: number;
  windSpeed: number;
  windDirection?: number;
}

export interface HydroSnapshot {
  flow: number;
  level: number;
  waterTemp?: number | null; 
}

// --- LES PRISES (Catch) ---
export interface Catch {
  id: string;
  species: SpeciesType;
  
  // Mesures
  size: number; // cm
  weight?: number; // kg
  
  // Relations contextuelles (IDs) & Snapshots (Noms pour l'historique)
  techniqueId: string;
  technique: string;
  
  setupId: string;
  setup: string;
  
  // Détail Leurre V3.1
  lureName: string; // Nom libre ou concaténé
  lureTypeId?: string;
  lureColorId?: string;
  lureSizeId?: string;
  lureWeightId?: string;
  
  spotId: string; // Ex-Zone
  spotName: string;
  
  timestamp: any; // Date précise de la prise
  photoUrls?: string[];
}

// --- LES RATÉS (Miss) ---
export interface Miss {
  id: string;
  type: 'Décroché' | 'Touche Ratée' | 'Suivi' | 'Casse' | 'Coupe' | 'Inconnu';
  speciesSupposed: SpeciesType | 'Inconnu';
  estimation: 'Petit' | 'Moyen' | 'Lourd' | 'Monstre' | 'Inconnu';
  location: string; 
  spotId: string;
  spotName: string;     
  timestamp: any;
  lureName?: string; // Champ commentaire/modèle
  lureTypeId?: string;
  lureColorId?: string;
  lureSizeId?: string;
  lureWeightId?: string;
}

// --- LA SESSION ---
export interface Session extends BaseEntity {
  date: string;
  startTime: string; 
  endTime: string;   
  durationMinutes: number;

  spotId: string;   
  spotName: string; // Snapshot V3
  
  setupId: string;
  setupName: string; // Snapshot V3

  feelingScore: number;
  catchCount: number;
  notes: string;

  catches: Catch[];
  misses: Miss[];
  techniquesUsed: string[];

  weather?: WeatherSnapshot | null;
  hydro?: HydroSnapshot | null;
  waterTemp?: number | null;
  
  bioScore?: number;
}

// --- CONFIGURATION GLOBALE (État App) ---
export interface AppData {
    spots: Spot[];
    setups: Setup[];
    techniques: Technique[];
    // Nouvelles refs
    lureTypes: RefLureType[];
    colors: RefColor[];
    sizes: RefSize[];
    weights: RefWeight[];
    // Legacy inventory
    lures: Lure[]; 
}

export interface UserProfile {
  id: string; // Correspondra au userId (ex: 'user_1')
  pseudo: string;
  createdAt: any;
  avatarBase64?: string; // AJOUT : Pour stocker l'image encodée
}

