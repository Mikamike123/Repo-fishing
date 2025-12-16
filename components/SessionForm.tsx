import React, { useState, useMemo, useEffect } from 'react';
import { 
    Calendar, 
    Clock, 
    MapPin, 
    Anchor, 
    Activity, 
    Save, 
    Wind, 
    Droplets, 
    CloudSun,
    AlertTriangle,
    CheckCircle2,
    Leaf,
    Fish,
    Plus,
    X,
    AlertOctagon,
    Thermometer 
} from 'lucide-react';
import { calculateBioScore } from '../lib/algorithms';

// Remplacement de la simulation par le service réel
import { getRealtimeEnvironmentalConditions, getRealtimeWaterTemp } from '../lib/environmental-service';

import { BioConditions, ZoneType, Catch, Miss, SpeciesType, TechniqueType, Session, WeatherSnapshot, HydroSnapshot } from '../types';
import CatchDialog from './CatchDialog';
import MissDialog from './MissDialog';


interface SessionFormProps {
    onAddSession: (session: Session) => void;
    availableZones: string[];
    availableSetups: string[];
    availableTechniques: string[];
}

// Gamification Logic (Inchangé)
const getTrophyIcon = (species: SpeciesType, size: number) => {
    if (species === 'Perche' && size >= 40) return '💎';
    if (species === 'Perche' && size >= 30) return '👑';
    
    if (species === 'Sandre' && size >= 80) return '💎';
    if (species === 'Sandre' && size >= 60) return '👑';
    
    if (species === 'Brochet' && size >= 100) return '💎';
    if (species === 'Brochet' && size >= 70) return '👑';

    if (species === 'Silure' && size >= 150) return '💎';
    if (species === 'Silure' && size >= 100) return '👑';

    return null;
};

// Robust ID Generator (Inchangé)
const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        try {
            return crypto.randomUUID();
        } catch (e) {
            // Fallback
        }
    }
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
};

const SessionForm: React.FC<SessionFormProps> = ({ 
    onAddSession, 
    availableZones, 
    availableSetups, 
    availableTechniques 
}) => {
    // Form State (Général)
    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [startTime, setStartTime] = useState<string>("08:00");
    const [endTime, setEndTime] = useState<string>("11:00");
    const [zone, setZone] = useState<string>(availableZones[0] || "Default");
    const [setup, setSetup] = useState<string>(availableSetups[0] || "Default");
    const [feeling, setFeeling] = useState<number>(5);

    // NOUVEL ÉTAT pour l'erreur de validation horaire
    const [timeError, setTimeError] = useState<string | null>(null);

    // Catch & Miss State (Inchangé)
    const [catches, setCatches] = useState<Catch[]>([]);
    const [misses, setMisses] = useState<Miss[]>([]);
    const [isCatchModalOpen, setIsCatchModalOpen] = useState(false);
    const [isMissModalOpen, setIsMissModalOpen] = useState(false);

    // --- ÉTATS ENVIRONNEMENTAUX EN TEMPS RÉEL/HISTORIQUE ---
    const [waterTemp, setWaterTemp] = useState<number | null>(null);
    const [cloudCoverage, setCloudCoverage] = useState<number | null>(null);
    
    const [realtimeWeather, setRealtimeWeather] = useState<WeatherSnapshot | null>(null);
    const [realtimeHydro, setRealtimeHydro] = useState<HydroSnapshot | null>(null);
    
    const [isLoadingEnv, setIsLoadingEnv] = useState(true);
    // --- FIN ÉTATS ENVIRONNEMENTAUX ---

    // Ensure zone/setup defaults are valid if lists change (Inchangé)
    useEffect(() => {
        if (availableZones.length > 0 && !availableZones.includes(zone)) {
            setZone(availableZones[0]);
        }
        if (availableSetups.length > 0 && !availableSetups.includes(setup)) {
            setSetup(availableSetups[0]);
        }
    }, [availableZones, availableSetups, zone, setup]);

    // --- LOGIQUE DE PRÉ-CHARGEMENT ENVIRONNEMENTAL (Déclenché par la date) ---
    useEffect(() => {
        const loadEnvironmentalData = async () => {
            setIsLoadingEnv(true);
            setWaterTemp(null); 
            setCloudCoverage(null); 
            setRealtimeWeather(null);
            setRealtimeHydro(null);

            const sessionDate = new Date(date);
            const today = new Date();
            const isPastSession = sessionDate.setHours(0,0,0,0) < today.setHours(0,0,0,0); 

            try {
                // 1. Récupération Météo/Hydro Temps Réel (pour le Score Bio et la Hauteur/Débit)
                const { weather, hydro } = await getRealtimeEnvironmentalConditions();
                
                // 2. Récupération Température de l'Eau (Conditionnelle)
                const tempResult = await getRealtimeWaterTemp(isPastSession ? date : null);

                // 3. Mise à jour des états
                setRealtimeWeather(weather);
                setRealtimeHydro(hydro);
                setWaterTemp(tempResult ? tempResult.temperature : null);
                setCloudCoverage(weather ? weather.clouds : null); // La couverture vient de la météo Nanterre
                
            } catch (error) {
                console.error("Erreur lors de la récupération des données environnementales réelles:", error);
                setRealtimeWeather(null);
                setRealtimeHydro(null);
                setWaterTemp(null);
                setCloudCoverage(null);
            } finally {
                setIsLoadingEnv(false);
            }
        };

        loadEnvironmentalData();
    }, [date]); // Déclenchement sur changement de date

    // Derived Conditions (Calcul du BioScore basé sur les VRAIES données ou null si chargement/échec)
    const bioConditions: BioConditions | null = useMemo(() => {
        if (!realtimeWeather || !realtimeHydro || isLoadingEnv) return null;

        // NOTE: Simulation des deltas (pressT-3h et flowT-24h) car les APIs temps réel ne fournissent pas d'historique facile.
        const deltaP = 1.0; 
        const deltaQ = 5.0;

        return {
            date: new Date(),
            currentWeather: realtimeWeather,
            currentHydro: realtimeHydro,
            pressureTMinus3h: realtimeWeather.pressure - deltaP, 
            flowTMinus24h: realtimeHydro.flow - deltaQ,           
            sunrise: new Date(), 
            sunset: new Date(), 
        };
    }, [realtimeWeather, realtimeHydro, isLoadingEnv]);

    const bioScore = useMemo(() => {
        return bioConditions ? calculateBioScore(bioConditions) : 0;
    }, [bioConditions]);
    
    // Valeurs pour le rendu du panneau latéral (Delta/Flow/Pressure)
    const deltaPDisplay = bioConditions ? (bioConditions.currentWeather.pressure - bioConditions.pressureTMinus3h).toFixed(1) : '--';
    const deltaQDisplay = bioConditions ? (bioConditions.currentHydro.flow - bioConditions.flowTMinus24h).toFixed(1) : '--';


    // Handler (Inchangé dans sa structure)
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setTimeError(null); // Reset erreur

        // Sécurité : On force la vérification des données avant l'envoi pour éviter le N/A dans le modal
        if (isLoadingEnv) {
            return; // Le bouton est désactivé de toute façon
        }

        // --- VALIDATION HORAIRE ---
        // Comparaison lexicographique simple de chaînes "HH:MM" qui fonctionne très bien pour ce format
        if (endTime <= startTime) {
            setTimeError("L'heure de fin doit être postérieure à l'heure de début.");
            return; // Bloque la soumission
        }
        // --------------------------

        const start = new Date(`1970-01-01T${startTime}:00`);
        const end = new Date(`1970-01-01T${endTime}:00`);
        const durationMs = end.getTime() - start.getTime();
        const durationMinutes = Math.max(0, Math.floor(durationMs / 60000));

        // Data Integrity: Constructing the full session payload
        const newSession: Session = {
            id: generateId(),
            date: date,
            startTime,
            endTime,
            durationMinutes,
            zone: zone,
            setup: setup,
            feelingScore: feeling,
            
            // CRITICAL: Saving Environmental Snapshots
            weather: realtimeWeather, 
            hydro: realtimeHydro,     // C'est ici que ça se joue pour le Modal
            bioScore: bioScore,
            waterTemp: waterTemp,     // C'est ici que ça se joue pour le Modal
            cloudCoverage: cloudCoverage,

            // Champs de tableaux
            catches: catches,
            misses: misses,
            catchCount: catches.length,
            techniquesUsed: [], 
            notes: '', 
        };
        
        // Simulate API Delay
        setTimeout(() => {
            onAddSession(newSession);
        }, 500);
    };

    // --- HANDLER CATCH (Support de l'heure & Photos) ---
    // UPDATE: Ajout de photoUrls dans la signature
    const handleAddCatch = (data: { species: SpeciesType; size: number; technique: TechniqueType; lure: string; zone: ZoneType; time: string; photoUrls: string[] }) => {
        const fullDate = new Date(`${date}T${data.time}:00`);
        // On retire 'time' car on utilise le timestamp complet, mais on garde photoUrls
        const { time, ...catchData } = data; 

        const newCatch: Catch = {
            id: Math.random().toString(36).substr(2, 9),
            ...catchData, // Cela inclut photoUrls
            timestamp: fullDate
        };
        setCatches([...catches, newCatch]);
    };

    const handleRemoveCatch = (id: string) => {
        setCatches(catches.filter(c => c.id !== id));
    };

    // --- HANDLER MISS MODIFIÉ (Support de l'heure) ---
    const handleAddMiss = (data: Omit<Miss, 'id' | 'timestamp'> & { time: string }) => {
        const fullDate = new Date(`${date}T${data.time}:00`);
        const { time, ...missData } = data; // On retire 'time' propre

        const newMiss: Miss = {
            id: Math.random().toString(36).substr(2, 9),
            ...missData,
            timestamp: fullDate
        };
        setMisses([...misses, newMiss]);
    };
    
    const handleRemoveMiss = (id: string) => {
        setMisses(misses.filter(m => m.id !== id));
    };

    // Styles Helpers (Inchangés)
    const getScoreColor = (score: number) => {
        if (score >= 70) return 'text-emerald-700';
        if (score >= 40) return 'text-amber-700';
        return 'text-orange-800';
    };

    const getScoreBg = (score: number) => {
        if (score >= 70) return 'bg-emerald-50 border-emerald-100';
        if (score >= 40) return 'bg-amber-50 border-amber-100';
        return 'bg-orange-50 border-orange-100';
    };

    const getScoreIcon = (score: number) => {
        if (score >= 70) return <CheckCircle2 size={18} className="text-emerald-600" />;
        if (score >= 40) return <Leaf size={18} className="text-amber-600" />;
        return <AlertTriangle size={18} className="text-orange-600" />;
    };

    const getDeltaColorClass = (delta: string, baseColor: string, reverse: boolean = false) => {
        const d = Number(delta);
        if (isNaN(d)) return 'text-stone-500';
        const isFavorable = reverse ? d <= 0 : d > 0;
        if (isFavorable) return `text-${baseColor}-700 bg-${baseColor}-100`;
        return 'text-stone-500 bg-stone-100';
    };

    const pressureColorClass = getDeltaColorClass(deltaPDisplay, 'emerald', true); 
    const flowColorClass = getDeltaColorClass(deltaQDisplay, 'cyan', true);      


    return (
        <div className="w-full max-w-5xl mx-auto pb-24">
            <CatchDialog 
                isOpen={isCatchModalOpen} 
                onClose={() => setIsCatchModalOpen(false)} 
                onSave={handleAddCatch}
                initialZone={zone}
                availableZones={availableZones}
                availableTechniques={availableTechniques}
                sessionDate={date}
                sessionStartTime={startTime}
                sessionEndTime={endTime} // Passe l'heure de fin pour validation
            />
            
            <MissDialog
                isOpen={isMissModalOpen}
                onClose={() => setIsMissModalOpen(false)}
                onSave={handleAddMiss}
                initialZone={zone}
                availableZones={availableZones}
                sessionStartTime={startTime}
                sessionEndTime={endTime} // Passe l'heure de fin pour validation
            />

            <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-organic border border-stone-100 overflow-hidden">
                
                {/* Header */}
                <div className="bg-white px-8 py-6 border-b border-stone-100 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-stone-800 tracking-tight">Nouvelle Session</h2>
                        <p className="text-sm text-stone-500 mt-1">Enregistrement et analyse post-session</p>
                    </div>
                    <div className="h-10 w-10 bg-stone-50 text-stone-400 rounded-xl flex items-center justify-center border border-stone-100">
                        <Anchor size={20} />
                    </div>
                </div>

                <div className="flex flex-col lg:flex-row">
                    
                    {/* Main Form Fields */}
                    <div className="flex-1 p-8 space-y-8">
                        
                        {/* SECTION DATE & CRÉNEAU - Responsive Fix */}
                        {/* grid-cols-1 sur mobile (empilé) -> md:grid-cols-2 sur tablette/pc (côte à côte) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-2">
                                    <Calendar size={14} /> Date
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Calendar className="text-stone-400" size={20} />
                                    </div>
                                    <input 
                                        type="date" 
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                        onClick={(e) => e.currentTarget.showPicker()}
                                        className="w-full h-14 bg-white border border-stone-200 rounded-xl pl-10 pr-4 text-lg font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all appearance-none cursor-pointer"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-2">
                                    <Clock size={14} /> Créneau
                                </label>
                                {/* Ajout d'une bordure rouge si erreur */}
                                <div className={`flex gap-3 items-center p-1 rounded-xl ${timeError ? 'bg-red-50 border border-red-200' : ''}`}>
                                    <div className="relative flex-1">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Clock className="text-stone-400" size={18} />
                                        </div>
                                        {/* FIX: Padding réduit (pl-8) et texte responsive pour éviter la coupure sur mobile */}
                                        <input 
                                            type="time" 
                                            value={startTime}
                                            onChange={(e) => {
                                                setStartTime(e.target.value);
                                                setTimeError(null); // Reset erreur à la modif
                                            }}
                                            onClick={(e) => e.currentTarget.showPicker()}
                                            className="w-full h-14 bg-white border border-stone-200 rounded-xl pl-8 pr-1 text-base sm:text-lg font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all appearance-none text-center cursor-pointer"
                                        />
                                    </div>
                                    <span className="text-stone-300 font-bold">-</span>
                                    <div className="relative flex-1">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Clock className="text-stone-400" size={18} />
                                        </div>
                                        <input 
                                            type="time" 
                                            value={endTime}
                                            onChange={(e) => {
                                                setEndTime(e.target.value);
                                                setTimeError(null); // Reset erreur à la modif
                                            }}
                                            onClick={(e) => e.currentTarget.showPicker()}
                                            className={`w-full h-14 bg-white border ${timeError ? 'border-red-400 text-red-600' : 'border-stone-200 text-stone-800'} rounded-xl pl-8 pr-1 text-base sm:text-lg font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all appearance-none text-center cursor-pointer`}
                                        />
                                    </div>
                                </div>
                                {/* Message d'erreur sous les inputs */}
                                {timeError && (
                                    <p className="text-xs text-red-500 font-bold ml-1">{timeError}</p>
                                )}
                            </div>
                        </div>

                        {/* SECTION ZONE & SETUP - Harmonisé md:grid-cols-2 */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-2">
                                    <MapPin size={14} /> Zone de départ / Principale
                                </label>
                                <div className="relative">
                                    <select 
                                        value={zone}
                                        onChange={(e) => setZone(e.target.value)}
                                        className="w-full appearance-none bg-stone-50 border border-stone-200 text-stone-700 rounded-xl px-4 py-3 pr-8 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-medium"
                                    >
                                        {availableZones.map(z => (
                                            <option key={z} value={z}>{z}</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-stone-400">
                                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-2">
                                    <Anchor size={14} /> Setup
                                </label>
                                <div className="relative">
                                    <select 
                                        value={setup}
                                        onChange={(e) => setSetup(e.target.value)}
                                        className="w-full appearance-none bg-stone-50 border border-stone-200 text-stone-700 rounded-xl px-4 py-3 pr-8 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-medium"
                                    >
                                        {availableSetups.map(s => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-stone-400">
                                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 pt-2 border-b border-stone-100 pb-8">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-2">
                                    <Activity size={14} /> Feeling Global
                                </label>
                                <span className="text-sm font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-lg">
                                    {feeling} / 10
                                </span>
                            </div>
                            <input 
                                type="range" 
                                min="1" 
                                max="10" 
                                value={feeling}
                                onChange={(e) => setFeeling(Number(e.target.value))}
                                className="w-full h-2 bg-stone-100 rounded-lg appearance-none cursor-pointer accent-amber-500 hover:accent-amber-600 transition-all"
                            />
                        </div>

                        {/* --- LIVEWELL (VIVIER) SECTION --- */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-end">
                                <label className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-2">
                                    <Fish size={14} /> Tableau de chasse
                                </label>
                                {misses.length > 0 && (
                                    <span className="text-xs font-medium text-stone-400 bg-stone-100 px-2 py-1 rounded-full">
                                        {misses.length} Raté(s)
                                    </span>
                                )}
                            </div>

                            {/* Action Buttons */}
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    type="button"
                                    onClick={() => setIsCatchModalOpen(true)}
                                    className="flex items-center justify-center gap-2 py-3 px-4 bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-md shadow-amber-500/20 font-bold transition-transform active:scale-95 text-sm sm:text-base"
                                >
                                    <Plus size={18} /> Ajouter Prise
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsMissModalOpen(true)}
                                    className="flex items-center justify-center gap-2 py-3 px-4 bg-stone-50 hover:bg-stone-100 text-stone-600 border border-stone-200 rounded-xl font-medium transition-colors active:scale-95 text-sm sm:text-base"
                                >
                                    <AlertOctagon size={18} className="text-stone-400" /> Signaler Raté
                                </button>
                            </div>

                            {/* Horizontal Carousels */}
                            <div className="space-y-4 mt-2">
                                
                                {/* Empty State */}
                                {catches.length === 0 && misses.length === 0 && (
                                    <div className="text-center py-6 border border-dashed border-stone-200 rounded-2xl bg-stone-50/50">
                                        <Fish className="mx-auto text-stone-300 mb-2" size={24} />
                                        <p className="text-sm text-stone-400 font-medium">Vivier vide... pour l'instant.</p>
                                    </div>
                                )}

                                {/* Catches Carousel */}
                                {catches.length > 0 && (
                                    <div className="flex overflow-x-auto gap-3 pb-2 scrollbar-hide snap-x">
                                        {catches.map((catchItem) => {
                                            const trophy = getTrophyIcon(catchItem.species, catchItem.size);
                                            return (
                                                <div key={catchItem.id} className="relative flex-shrink-0 w-24 h-24 bg-white border border-stone-100 rounded-2xl shadow-organic p-2 flex flex-col justify-between items-center text-center snap-center animate-in zoom-in-50 duration-300">
                                                    <button 
                                                        onClick={() => handleRemoveCatch(catchItem.id)}
                                                        className="absolute top-1 right-1 p-1 text-stone-300 hover:text-red-400 rounded-full transition-colors"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                    <div className="mt-1 h-7 w-7 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600">
                                                        <Fish size={14} />
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-[11px] text-stone-700 leading-tight">
                                                            {catchItem.species} {trophy}
                                                        </div>
                                                        <div className="text-[10px] text-stone-400 font-medium">
                                                            {catchItem.size} cm
                                                        </div>
                                                        {/* Petit indicateur d'heure sur la card */}
                                                        <div className="text-[9px] text-amber-500 font-bold mt-0.5">
                                                            {catchItem.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Misses Carousel */}
                                {misses.length > 0 && (
                                    <div className="flex overflow-x-auto gap-3 pb-2 scrollbar-hide snap-x">
                                        {misses.map((miss) => (
                                            <div key={miss.id} className="relative flex-shrink-0 w-24 h-24 bg-stone-50 border border-dashed border-stone-200 rounded-2xl p-2 flex flex-col justify-between items-center text-center snap-center opacity-80 animate-in zoom-in-50 duration-300">
                                                <button 
                                                    onClick={() => handleRemoveMiss(miss.id)}
                                                    className="absolute top-1 right-1 p-1 text-stone-300 hover:text-red-400 rounded-full transition-colors"
                                                >
                                                    <X size={12} />
                                                </button>
                                                <div className="mt-1 text-red-300">
                                                    <AlertOctagon size={14} />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-[10px] text-stone-600 leading-tight truncate w-full">
                                                        {miss.type}
                                                    </div>
                                                    <div className="text-[9px] text-stone-400 uppercase tracking-wide truncate w-full">
                                                        {miss.speciesSupposed !== 'Inconnu' ? miss.speciesSupposed : 'Inconnu'}
                                                    </div>
                                                    {/* Petit indicateur d'heure pour les ratés */}
                                                    <div className="text-[9px] text-red-400 font-bold mt-0.5">
                                                        {miss.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        {/* --- END LIVEWELL --- */}

                    </div>

                    {/* Right Panel: Auto Conditions (The Bot) */}
                    <div className="w-full lg:w-80 bg-[#fdfbf7] border-l border-stone-100 p-8 flex flex-col justify-between relative">
                        {/* Decorative background element */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-bl-full pointer-events-none"></div>

                        <div className="relative">
                            <h3 className="text-sm font-bold text-stone-800 uppercase tracking-wide mb-6 flex items-center gap-2">
                                <CloudSun size={16} className="text-stone-400" />
                                Aperçu Conditions
                            </h3>
                            
                            {/* Dynamic Score Card */}
                            <div className={`rounded-2xl p-6 mb-6 border ${getScoreBg(bioScore)} transition-colors duration-500 shadow-sm`}>
                                <div className="flex justify-between items-start mb-3">
                                    <span className={`text-xs font-bold uppercase ${getScoreColor(bioScore)} tracking-wider opacity-80`}>Score Bio</span>
                                    {getScoreIcon(bioScore)}
                                </div>
                                <div className="flex items-baseline gap-1">
                                    <span className={`text-5xl font-black ${getScoreColor(bioScore)} tracking-tight`}>{bioScore}</span>
                                    <span className={`text-lg font-medium ${getScoreColor(bioScore)} opacity-70`}>/100</span>
                                </div>
                                <p className={`text-xs mt-3 font-medium leading-relaxed ${getScoreColor(bioScore)} opacity-90`}>
                                    {bioScore >= 70 ? "Activité théorique forte. Conditions idéales pour le Sandre." :
                                        bioScore >= 40 ? "Conditions mitigées. Cherchez les variations." :
                                        "Conditions difficiles. Le poisson risque d'être calé."}
                                </p>
                            </div>

                            {/* Data Points */}
                            <div className="space-y-4">
                                
                                {/* 1. Pression (Nanterre) */}
                                <div className="flex justify-between items-center text-sm p-3 bg-white rounded-xl border border-stone-100 shadow-sm">
                                    <div className="flex flex-col">
                                        <span className="text-stone-500 flex items-center gap-2 text-xs font-medium uppercase"><Wind size={12} /> Pression</span>
                                        <span className="font-semibold text-stone-700">{realtimeWeather?.pressure?.toFixed(0) ?? 'N/A'} hPa</span>
                                    </div>
                                    <div className={`text-xs font-mono font-medium px-2 py-1 rounded ${pressureColorClass}`}>
                                        {isLoadingEnv ? '...' : `${Number(deltaPDisplay) > 0 ? '+' : ''}${deltaPDisplay}`}
                                    </div>
                                </div>
                                
                                {/* 2. Débit (Austerlitz) */}
                                <div className="flex justify-between items-center text-sm p-3 bg-white rounded-xl border border-stone-100 shadow-sm">
                                    <div className="flex flex-col">
                                        <span className="text-stone-500 flex items-center gap-2 text-xs font-medium uppercase"><Droplets size={12} /> Débit</span>
                                        <span className="font-semibold text-stone-700">{realtimeHydro?.flow?.toFixed(2) ?? 'N/A'} m³/s</span>
                                    </div>
                                    <div className={`text-xs font-mono font-medium px-2 py-1 rounded ${flowColorClass}`}>
                                        {isLoadingEnv ? '...' : `${Number(deltaQDisplay) > 0 ? '+' : ''}${deltaQDisplay}`}
                                    </div>
                                </div>
                                
                                {/* 3. Température de l'Eau (Austerlitz) */}
                                <div className="flex justify-between items-center text-sm p-3 bg-white rounded-xl border border-stone-100 shadow-sm">
                                    <div className="flex flex-col">
                                        <span className="text-stone-500 flex items-center gap-2 text-xs font-medium uppercase">
                                            <Thermometer size={12} /> Temp. Eau
                                        </span>
                                        {isLoadingEnv ? (
                                            <span className="font-semibold text-stone-400 flex items-center gap-2">
                                                <div className="animate-spin rounded-full h-3 w-3 border-2 border-stone-300 border-t-transparent"></div>
                                                Chargement...
                                            </span>
                                        ) : waterTemp !== null ? (
                                            <span className="font-semibold text-orange-700">{waterTemp.toFixed(1)} °C</span>
                                        ) : (
                                            <span className="font-semibold text-stone-400">N/A</span>
                                        )}
                                    </div>
                                    {waterTemp !== null && (
                                        <div className="text-xs font-mono font-medium px-2 py-1 rounded bg-orange-100 text-orange-700">
                                            {new Date(date).setHours(0,0,0,0) < new Date().setHours(0,0,0,0) ? 'Historique' : 'J-1'}
                                        </div>
                                    )}
                                </div>
                                
                                {/* 4. Couverture Nuageuse (Nanterre) */}
                                <div className="flex justify-between items-center text-sm p-3 bg-white rounded-xl border border-stone-100 shadow-sm">
                                    <div className="flex flex-col">
                                        <span className="text-stone-500 flex items-center gap-2 text-xs font-medium uppercase">
                                            <CloudSun size={12} /> Couverture Nuageuse
                                        </span>
                                        {cloudCoverage !== null ? (
                                            <span className="font-semibold text-stone-700">{cloudCoverage.toFixed(0)}%</span>
                                        ) : (
                                            <span className="font-semibold text-stone-400">N/A</span>
                                        )}
                                    </div>
                                    <div className="text-xs font-mono font-medium px-2 py-1 rounded bg-stone-100 text-stone-500">
                                        Météo
                                    </div>
                                </div>

                                {/* 5. Hauteur d'eau / Niveau (Austerlitz) - NOUVEAU */}
                                <div className="flex justify-between items-center text-sm p-3 bg-white rounded-xl border border-stone-100 shadow-sm">
                                    <div className="flex flex-col">
                                        <span className="text-stone-500 flex items-center gap-2 text-xs font-medium uppercase">
                                            <Droplets size={12} className='rotate-90' /> Niveau
                                        </span>
                                        {realtimeHydro?.level !== undefined ? (
                                            <span className="font-semibold text-blue-700">{realtimeHydro.level.toFixed(2)} m</span>
                                        ) : (
                                            <span className="font-semibold text-stone-400">N/A</span>
                                        )}
                                    </div>
                                    <div className="text-xs font-mono font-medium px-2 py-1 rounded bg-blue-100 text-blue-700">
                                        Hydro
                                    </div>
                                </div>
                                
                            </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-stone-200">
                            <button 
                                type="submit"
                                disabled={isLoadingEnv}
                                className={`w-full font-bold py-4 px-6 rounded-xl shadow-lg transition-all transform flex items-center justify-center gap-2 
                                    ${isLoadingEnv 
                                        ? 'bg-stone-300 text-stone-500 cursor-not-allowed' 
                                        : 'bg-stone-800 hover:bg-stone-900 text-white shadow-stone-800/20 hover:-translate-y-0.5 active:scale-95'
                                    }`}
                            >
                                {isLoadingEnv ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-stone-500 border-t-transparent"></div>
                                        Chargement Données...
                                    </>
                                ) : (
                                    <>
                                        <Save size={18} />
                                        Terminer la Session
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default SessionForm;