import React, { useState, useMemo, useEffect } from 'react';
import { 
    Clock, Trophy, Users, User as UserIcon, Flame, MapPin, ChevronDown 
} from 'lucide-react';
import { Session, RefLureType, RefColor, Location, WeatherSnapshot } from '../types';
import SessionCard from './SessionCard';
import SessionDetailModal from './SessionDetailModal';
import { useCurrentConditions } from '../lib/hooks';
import { RecordsGrid } from './RecordsGrid';
import { buildUserHistory, getNextLevelCap } from '../lib/gamification';
import { fetchUniversalWeather } from '../lib/universal-weather-service';
import { useWaterTemp } from '../lib/useWaterTemp'; // Import du Moteur Zero-Hydro
import { useArsenal } from '../lib/useArsenal';     // Pour la sauvegarde (handleEditItem)
import { calculateUniversalBioScores, BioContext } from '../lib/bioScoreEngine'; // <--- NOUVEAU MOTEUR

// Import des widgets extraits
import { 
    getWindDir, getWeatherIcon, 
    SpeciesScore, DataTile, 
    ActivityIcon, CloudIcon, WindIcon, DropletsIcon, GaugeIcon, ThermometerIcon 
} from './DashboardWidgets';

// ID du document "Gold Standard" (Nanterre - Défaut) pour fallback de sécurité
const GOLD_STANDARD_ID = "WYAjhoUeeikT3mS0hjip";

// --- CONFIGURATION DES ESPÈCES (Mapping ID -> Affichage/Clés) ---
const SPECIES_CONFIG: Record<string, { label: string; key: string; color: string; borderColor: string }> = {
    'Sandre': { label: 'Sandre', key: 'sandre', color: 'text-amber-600', borderColor: 'border-amber-400' },
    'Brochet': { label: 'Brochet', key: 'brochet', color: 'text-stone-600', borderColor: 'border-stone-400' },
    'Perche': { label: 'Perche', key: 'perche', color: 'text-emerald-600', borderColor: 'border-emerald-400' },
    'Black-Bass': { label: 'Black-Bass', key: 'black_bass', color: 'text-lime-600', borderColor: 'border-lime-400' },
    'Silure': { label: 'Silure', key: 'silure', color: 'text-slate-700', borderColor: 'border-slate-500' },
};

interface DashboardProps {
    sessions: Session[];
    onDeleteSession: (id: string) => void;
    onEditSession: (session: Session) => void;
    onMagicDiscovery: (draft: any) => void;
    userName?: string;
    currentUserId: string;
    lureTypes: RefLureType[];
    colors: RefColor[];
    locations: Location[]; 
}

const Dashboard: React.FC<DashboardProps> = ({ 
    sessions, onDeleteSession, onEditSession, onMagicDiscovery, 
    userName, currentUserId, lureTypes, colors, locations 
}) => {
    // 1. Récupération des conditions Oracle en direct (Hook Base Nanterre)
    // On renomme 'scores' en 'nanterreScores' pour éviter la confusion
    // 'computed' contient les tendances (pression, turbidité) utiles pour les calculs locaux
    const { weather: nanterreWeather, hydro, scores: nanterreScores, computed, isLoading: isBaseLoading } = useCurrentConditions();
    
    // Récupération du handler pour sauvegarder la température calculée (Hybrid Sync)
    const { handleEditItem } = useArsenal(currentUserId);

    // --- LOGIQUE SÉLECTEUR MÉTÉO ---

    // A. Identifier le secteur par défaut (Gold Standard)
    // On cherche soit le flag isDefault (si ajouté en base), soit l'ID connu
    const defaultLocation = useMemo(() => {
        return locations.find(l => (l as any).isDefault === true) 
            || locations.find(l => l.id === GOLD_STANDARD_ID)
            || locations[0]; // Fallback ultime
    }, [locations]);

    // B. Préparer la liste des options (Défaut + Favoris actifs, sans doublons)
    const availableLocations = useMemo(() => {
        const favorites = locations.filter(l => l.active && l.isFavorite && l.id !== defaultLocation?.id).slice(0, 3);
        
        // On place le défaut en premier, suivi des favoris
        return defaultLocation ? [defaultLocation, ...favorites] : favorites;
    }, [locations, defaultLocation]);

    // State pour la location active (Initialisé avec l'ID du défaut)
    const [activeLocationId, setActiveLocationId] = useState<string>(defaultLocation?.id || "");

    // Mise à jour de l'ID actif si le defaultLocation est chargé tardivement (async)
    useEffect(() => {
        if (!activeLocationId && defaultLocation) {
            setActiveLocationId(defaultLocation.id);
        }
    }, [defaultLocation, activeLocationId]);
    
    // State pour la météo affichée
    const [displayedWeather, setDisplayedWeather] = useState<WeatherSnapshot | null>(null);
    const [isWeatherLoading, setIsWeatherLoading] = useState(false);

    // Détermine si on est sur le "Gold Standard" (Pour afficher les Bioscores et Hydro qui sont liés à la Seine)
    const isReferenceLocation = activeLocationId === defaultLocation?.id;

    // --- MOTEUR ZERO-HYDRO (Hook) ---
    // On identifie l'objet Location complet ciblé
    const targetLocation = useMemo(() => 
        locations.find(l => l.id === activeLocationId) || defaultLocation || null, 
    [locations, activeLocationId, defaultLocation]);

    // Appel du hook de calcul (ne fera rien si targetLocation est null ou incomplet)
    const { waterTemp: calculatedWaterTemp, loading: isCalculatedTempLoading } = useWaterTemp(targetLocation, handleEditItem);

    // --- CALCUL DES BIOSCORES (DYNAMIQUE) ---
    const displayedScores = useMemo(() => {
        // Cas 1 : Nanterre (Référence) -> On prend les scores pré-calculés du Backend
        if (isReferenceLocation) return nanterreScores;

        // Cas 2 : Autre lieu -> On calcule à la volée avec le moteur Universel
        // On a besoin de la météo locale ET de la température d'eau calculée
        if (displayedWeather && calculatedWaterTemp !== null) {
            
            // On utilise les tendances régionales de Nanterre (computed) comme proxy
            // car la pression et la turbidité sont souvent homogènes à l'échelle de l'IDF
            const regionalProxy: BioContext = {
                waterTemp: calculatedWaterTemp,
                cloudCover: displayedWeather.clouds,
                windSpeed: displayedWeather.windSpeed,
                // Le gradient 3h (ex: -1.2 hPa) est issu de l'observatoire
                pressureTrend: computed?.pressure_gradient_3h || 0, 
                // L'indice de turbidité (0-1) est issu de l'observatoire
                turbidity: computed?.turbidity_idx || 0.5 
            };

            return calculateUniversalBioScores(regionalProxy);
        }

        // En attendant le chargement, on ne retourne rien (le composant gérera le loading)
        return null;
    }, [isReferenceLocation, nanterreScores, displayedWeather, calculatedWaterTemp, computed]);

    // --- DÉTERMINATION DES ESPÈCES À AFFICHER ---
    const activeSpeciesList = useMemo(() => {
        // Si Nanterre : Trio fixe historique
        if (isReferenceLocation) {
            return ['Sandre', 'Brochet', 'Perche'];
        }
        // Sinon : Espèces configurées sur le secteur (ou fallback trio si vide)
        if (targetLocation?.speciesIds && targetLocation.speciesIds.length > 0) {
            return targetLocation.speciesIds;
        }
        return ['Sandre', 'Brochet', 'Perche']; // Fallback par défaut
    }, [isReferenceLocation, targetLocation]);

    // EFFET : Mise à jour de la météo quand on change de source
    useEffect(() => {
        const updateWeather = async () => {
            // Si on est sur le secteur de référence, on utilise les données du Hook (Nanterre Live)
            if (isReferenceLocation || !activeLocationId) {
                setDisplayedWeather(nanterreWeather);
                setIsWeatherLoading(false);
            } else {
                // Sinon (Mode Custom), on va chercher la météo universelle
                const targetLoc = locations.find(l => l.id === activeLocationId);
                
                if (targetLoc && targetLoc.coordinates) {
                    setIsWeatherLoading(true);
                    const customData = await fetchUniversalWeather(targetLoc.coordinates.lat, targetLoc.coordinates.lng);
                    setDisplayedWeather(customData);
                    setIsWeatherLoading(false);
                } else {
                    // Fallback sécurité
                    setDisplayedWeather(nanterreWeather);
                }
            }
        };

        updateWeather();
    }, [activeLocationId, nanterreWeather, locations, isReferenceLocation]);

    const isLoading = isBaseLoading || isWeatherLoading;

    // --- DONNÉES GAMIFICATION ---
    const currentYear = new Date().getFullYear();
    const [feedFilter, setFeedFilter] = useState<'all' | 'my'>('my');

    const filteredFeedSessions = useMemo(() => {
        const base = feedFilter === 'my' 
            ? sessions.filter(s => s.userId === currentUserId)
            : sessions;
        return base.slice(0, 5);
    }, [sessions, feedFilter, currentUserId]);

    const currentSeasonStats = useMemo(() => {
        const userSessions = sessions.filter(s => s.userId === currentUserId);
        const history = buildUserHistory(userSessions);
        return history[currentYear] || { 
            year: currentYear, levelReached: 1, xpTotal: 0, 
            sessionCount: 0, fishCount: 0, weeksWithStreak: 0 
        };
    }, [sessions, currentUserId, currentYear]);

    const nextLevelXP = getNextLevelCap(currentSeasonStats.levelReached);
    const progressPercent = Math.min(100, (currentSeasonStats.xpTotal / nextLevelXP) * 100);
    const xpRemaining = nextLevelXP - currentSeasonStats.xpTotal;

    const [selectedSession, setSelectedSession] = useState<Session | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    const handleOpenDetail = (session: Session) => {
        setSelectedSession(session);
        setIsDetailOpen(true);
    };

    // Logique d'affichage finale de la température d'eau
    // Si Nanterre : Source Hydro (Observatoire)
    // Si Autre : Source Calculée (Zero-Hydro)
    const displayWaterTemp = isReferenceLocation ? hydro?.waterTemp : calculatedWaterTemp;
    // Loading state : Si on est sur le custom, on attend que le calcul Zero-Hydro soit fini
    const displayWaterLoading = isReferenceLocation ? isBaseLoading : isCalculatedTempLoading;

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            
            {/* 1. PROGRESSION DYNAMIQUE */}
            <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4 relative z-10">
                    <div>
                        <div className="flex items-center space-x-2 mb-1">
                            <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-500 text-[10px] font-bold tracking-wider uppercase">
                                Saison {currentYear}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 text-[10px] font-bold tracking-wider uppercase flex items-center">
                                <Flame size={10} className="mr-1" />
                                {currentSeasonStats.weeksWithStreak} Semaines validées
                            </span>
                        </div>
                        <h2 className="text-2xl font-black text-stone-800">
                            Niveau {currentSeasonStats.levelReached}
                        </h2>
                        <p className="text-sm text-stone-500 font-medium">
                            {currentSeasonStats.xpTotal.toLocaleString()} XP <span className="text-stone-300">/ {nextLevelXP.toLocaleString()} XP</span>
                        </p>
                    </div>
                    
                    <div className="hidden md:block text-right">
                         <div className="text-xs font-bold text-stone-400 uppercase tracking-widest">Performance</div>
                         <div className="text-stone-800 font-bold">{currentSeasonStats.fishCount} Poissons / {currentSeasonStats.sessionCount} Sorties</div>
                    </div>
                </div>

                <div className="h-3 w-full bg-stone-100 rounded-full overflow-hidden relative z-10">
                    <div 
                        className="h-full bg-gradient-to-r from-amber-300 via-orange-400 to-rose-500 transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(251,146,60,0.4)]"
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
                <div className="mt-2 text-xs text-stone-400 text-right w-full font-mono">
                   {xpRemaining.toLocaleString()} XP requis pour le niveau suivant
                </div>
            </div>

            {/* 2. ÉTAT DU SPOT (SÉLECTEUR DROPDOWN) */}
            <div className="bg-white rounded-[2rem] p-1 shadow-organic border border-stone-100 overflow-hidden relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -mr-10 -mt-10"></div>
                
                <div className="p-6 relative z-10">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                        <h3 className="text-lg font-bold text-stone-800 flex items-center gap-2">
                            <ActivityIcon /> 
                            {isReferenceLocation ? 'Météo Nanterre (Ref)' : 'Météo Secteur'}
                        </h3>

                        {/* SÉLECTEUR LISTE DÉROULANTE (DROPDOWN) */}
                        <div className="relative w-full sm:w-auto min-w-[200px]">
                            {/* Icône gauche */}
                            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-stone-400">
                                <MapPin size={16} />
                            </div>
                            
                            <select
                                value={activeLocationId}
                                onChange={(e) => setActiveLocationId(e.target.value)}
                                className="appearance-none w-full bg-stone-50 border border-stone-200 text-stone-700 font-bold text-sm rounded-2xl py-3 pl-10 pr-10 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all cursor-pointer shadow-sm hover:bg-stone-100"
                            >
                                {availableLocations.map(loc => (
                                    <option key={loc.id} value={loc.id}>
                                        {loc.label} {(loc as any).isDefault || loc.id === GOLD_STANDARD_ID ? '(Défaut)' : ''}
                                    </option>
                                ))}
                                {availableLocations.length === 0 && (
                                    <option value="">Aucun secteur actif</option>
                                )}
                            </select>

                            {/* Chevron personnalisé droite */}
                            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-stone-400">
                                <ChevronDown size={16} strokeWidth={3} />
                            </div>
                        </div>
                    </div>

                    {/* INDICATEUR D'ACTIVITÉ (Bioscores DYNAMIQUES) */}
                    {/* On utilise grid-cols-3 par défaut, mais ça s'adaptera si moins d'espèces */}
                    <div className="grid grid-cols-3 gap-4 mb-8 relative justify-center">
                        {activeSpeciesList.map(speciesId => {
                            // Récupération de la config (couleur, label)
                            const config = SPECIES_CONFIG[speciesId] || { 
                                label: speciesId, 
                                key: speciesId.toLowerCase(), 
                                color: 'text-stone-400', 
                                borderColor: 'border-stone-300' 
                            };
                            
                            // Récupération du score dans l'objet dynamique
                            // On cast 'displayedScores' en 'any' pour l'accès dynamique sécurisé
                            const scoreValue = displayedScores ? (displayedScores as any)[config.key] : undefined;

                            return (
                                <SpeciesScore 
                                    key={speciesId}
                                    label={config.label} 
                                    score={scoreValue} 
                                    color={config.color} 
                                    borderColor={config.borderColor} 
                                    loading={isBaseLoading} 
                                />
                            );
                        })}

                        {/* Disclaimer dynamique */}
                        {!isReferenceLocation && (
                             <div className="absolute -bottom-6 left-0 right-0 text-center">
                                <span className="text-[9px] text-stone-400 bg-stone-50 px-2 py-0.5 rounded-full border border-stone-100">
                                    Scores localisés (Météo Site + Hydro Régionale)
                                </span>
                             </div>
                        )}
                        {isReferenceLocation && (
                             <div className="absolute -bottom-6 left-0 right-0 text-center">
                                <span className="text-[9px] text-stone-400 bg-stone-50 px-2 py-0.5 rounded-full border border-stone-100">
                                    Scores calculés sur ref. Seine (Nanterre)
                                </span>
                             </div>
                        )}
                    </div>

                    {/* GRILLE MÉTÉO DYNAMIQUE */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-8">
                        {/* TEMPÉRATURE (DYNAMIQUE) */}
                        <DataTile 
                            label="Air °C" 
                            value={displayedWeather?.temperature !== undefined ? Math.round(displayedWeather.temperature) : '--'} 
                            unit="" 
                            icon={displayedWeather ? getWeatherIcon(displayedWeather.clouds) : <CloudIcon />} 
                            color="bg-rose-50 text-rose-900" 
                            loading={isLoading} 
                        />
                        
                        {/* VENT (DYNAMIQUE) */}
                        <DataTile 
                            label="Vent" 
                            value={displayedWeather?.windSpeed !== undefined ? Math.round(displayedWeather.windSpeed) : '--'} 
                            unit={displayedWeather?.windDirection !== undefined ? `km/h ${getWindDir(displayedWeather.windDirection)}` : 'km/h'} 
                            icon={<WindIcon />} 
                            color="bg-stone-100 text-stone-600" 
                            loading={isLoading} 
                        />

                        {/* PRESSION (DYNAMIQUE) */}
                        <DataTile 
                            label="Pression" 
                            value={displayedWeather?.pressure !== undefined ? Math.round(displayedWeather.pressure) : '--'} 
                            unit="hPa" 
                            icon={<GaugeIcon />} 
                            color="bg-indigo-50 text-indigo-900" 
                            loading={isLoading} 
                        />

                        {/* HYDRO (CONDITIONNEL : Seulement pour Nanterre) */}
                        {isReferenceLocation && (
                            <DataTile 
                                label="Débit (Seine)" 
                                value={hydro?.flowLagged !== undefined ? Math.round(hydro.flowLagged) : '--'} 
                                unit="m³/s" 
                                icon={<DropletsIcon />} 
                                color="bg-cyan-50 text-cyan-900" 
                                loading={isBaseLoading} 
                            />
                        )}
                        
                        {/* EAU (DYNAMIQUE: OBSERVATOIRE OU ZERO-HYDRO) */}
                        <DataTile 
                            label={isReferenceLocation ? "Eau (Seine)" : "Eau (Estimée)"} 
                            value={displayWaterTemp !== undefined && displayWaterTemp !== null ? displayWaterTemp.toFixed(1) : '--'} 
                            unit="°C" 
                            icon={<ThermometerIcon />} 
                            color="bg-orange-50 text-orange-900" 
                            loading={displayWaterLoading} 
                        />
                    </div>
                </div>
            </div>

            {/* 3. VOS TROPHÉES (RECORDS GRID) */}
            <div className="bg-white rounded-[2.5rem] p-8 border border-stone-100 shadow-organic space-y-8">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="font-black text-stone-800 flex items-center gap-2">
                        <Trophy className="text-amber-500" size={20} /> Vos Trophées
                    </h3>
                    <span className="text-[9px] font-black bg-stone-100 text-stone-400 px-2 py-1 rounded-full uppercase tracking-tighter">Performance</span>
                </div>
                
                <RecordsGrid 
                    sessions={sessions.filter(s => s.userId === currentUserId && new Date(s.date).getFullYear() === new Date().getFullYear())} 
                    title={`Saison ${new Date().getFullYear()}`} 
                />

                <RecordsGrid 
                    sessions={sessions.filter(s => s.userId === currentUserId)} 
                    title="Tous les temps (Hall of Fame)" 
                    isGold={true}
                />
            </div>

            {/* 4. FIL D'ACTUALITÉ */}
            <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                    <h3 className="text-stone-800 font-bold text-lg flex items-center gap-2">
                        <Clock size={20} className="text-stone-400" /> Fil d'Actualité
                    </h3>

                    <div className="flex items-center gap-3">
                        {/* SELECTEUR DE FLUX */}
                        <div className="flex bg-stone-100 p-1 rounded-xl border border-stone-200 shadow-inner">
                            <button 
                                onClick={() => setFeedFilter('all')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${feedFilter === 'all' ? 'bg-white text-amber-600 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
                            >
                                <Users size={12} /> TOUS
                            </button>
                            <button 
                                onClick={() => setFeedFilter('my')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${feedFilter === 'my' ? 'bg-white text-amber-600 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
                            >
                                <UserIcon size={12} /> MES SESSIONS
                            </button>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    {filteredFeedSessions.map(session => (
                        <SessionCard 
                            key={session.id} 
                            session={session} 
                            onDelete={onDeleteSession} 
                            onEdit={onEditSession} 
                            onClick={handleOpenDetail} 
                            currentUserId={currentUserId}
                        />
                    ))}
                    {filteredFeedSessions.length === 0 && (
                        <div className="text-center py-10 text-stone-400 italic bg-stone-50 rounded-[2.5rem] border border-dashed border-stone-200">
                            {feedFilter === 'my' ? "Vous n'avez pas encore de sessions enregistrées." : "Le calme plat sur le réseau..."}
                        </div>
                    )}
                </div>
            </div>

            <SessionDetailModal 
                session={selectedSession} 
                isOpen={isDetailOpen} 
                onClose={() => setIsDetailOpen(false)} 
            />
        </div>
    );
};

export default Dashboard;