import React, { useMemo, useState, useEffect } from 'react';
import { 
    Wind, Droplets, CloudSun, Database, Activity, Trophy, ArrowRight, Clock, 
    Thermometer, AlertCircle, Sun, CloudRain, Cloud, MapPin, Trash2
} from 'lucide-react'; 
import { calculateBioScore } from '../lib/algorithms';

// NOUVEAUX IMPORTS : Remplacement de la simulation par le service réel
import { getRealtimeEnvironmentalConditions, getRealtimeWaterTemp } from '../lib/environmental-service';

// IMPORTS TYPES ET COMPOSANTS
import { Session, WeatherSnapshot, HydroSnapshot, BioConditions } from '../types';
import SessionCard from './SessionCard';
import SessionDetailModal from './SessionDetailModal'; 
import { WaterTempData } from '../lib/hubeau-service'; 


interface DashboardProps {
    sessions: Session[];
    onDeleteSession: (id: string) => void;
}

// --- COMPOSANT : ALERTE D'INFORMATION DE PUBLICATION (Réutilisé pour le pop-up) ---
const DataInfoPopup: React.FC<{ message: string; show: boolean; onClose: () => void }> = ({ message, show, onClose }) => (
    show ? (
        <div className="absolute z-50 top-6 right-0 w-80 p-3 bg-white border border-stone-200 rounded-lg shadow-xl text-xs text-stone-700 text-left animate-in fade-in slide-in-from-top-2">
            <p className="font-bold mb-1">Source Hubeau :</p>
            <p className="whitespace-normal">{message}</p> 
            <button 
                onClick={onClose} 
                className="mt-2 text-indigo-500 hover:text-indigo-700 font-medium"
            >
                Fermer
            </button>
        </div>
    ) : null
);
// --- FIN COMPOSANT ALERTE ---


const Dashboard: React.FC<DashboardProps> = ({ sessions, onDeleteSession }) => {
    // --- ÉTATS DONNÉES RÉELLES & CHARGEMENT ---
    const [realtimeWeather, setRealtimeWeather] = useState<WeatherSnapshot | null>(null);
    const [realtimeHydro, setRealtimeHydro] = useState<HydroSnapshot | null>(null);
    const [waterTempData, setWaterTempData] = useState<WaterTempData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    
    // ÉTATS UX
    const [waterTempInfoMessage, setWaterTempInfoMessage] = useState<string | null>(null); 
    const [showWaterTempInfo, setShowWaterTempInfo] = useState(false); 
    
    // NOUVEAUX ÉTATS POUR L'HYDRO
    const [hydroInfoMessage, setHydroInfoMessage] = useState<string | null>(null); 
    const [showHydroInfo, setShowHydroInfo] = useState(false); 

    // --- ÉTATS MODAL DÉTAIL SESSION ---
    const [selectedSession, setSelectedSession] = useState<Session | null>(null); 
    const [isDetailOpen, setIsDetailOpen] = useState(false); 

    // --- CHARGEMENT DES CONDITIONS RÉELLES AU MONTAGE ---
    useEffect(() => {
        const loadRealtimeData = async () => {
            setIsLoading(true);
            
            // 1. Charger Météo/Hydro Temps Réel (Nanterre/Austerlitz)
            const { weather, hydro, hydroMessage } = await getRealtimeEnvironmentalConditions();
            setRealtimeWeather(weather);
            setRealtimeHydro(hydro);
            setHydroInfoMessage(hydroMessage); 
            
            // 2. Charger Température de l'Eau (J-1)
            let tempMsg: string | null = null;
            const tempResult = await getRealtimeWaterTemp(null);
            
            if (tempResult) {
                setWaterTempData(tempResult);
            } else {
                tempMsg = "La donnée J-1 de Température n'est pas encore publiée (mise à jour vers 11h-midi) ou l'API Hubeau n'a rien renvoyé.";
            }
            
            setWaterTempInfoMessage(tempMsg); 
            setIsLoading(false);
        };
        loadRealtimeData();
    }, []);

    // --- VALEURS DÉRIVÉES (Calcul basé sur les données réelles) ---
    const deltaP = 1.0; 
    const deltaQ = 5.0;
    
    const bioConditions: BioConditions = useMemo(() => {
        return {
            date: new Date(),
            currentWeather: realtimeWeather || { temperature: 0, pressure: 0, clouds: 0, windSpeed: 0 },
            currentHydro: realtimeHydro || { flow: 0, level: 0 },
            pressureTMinus3h: realtimeWeather ? realtimeWeather.pressure - deltaP : 0, 
            flowTMinus24h: realtimeHydro ? realtimeHydro.flow - deltaQ : 0,           
            sunrise: new Date(), // Mock
            sunset: new Date(),  // Mock
        };
    }, [realtimeWeather, realtimeHydro]);

    const bioScore = useMemo(() => {
        return calculateBioScore(bioConditions);
    }, [bioConditions]);

    // Derived Values for UI
    const deltaPDisplay = (bioConditions.currentWeather.pressure - bioConditions.pressureTMinus3h).toFixed(1);
    const deltaQDisplay = (bioConditions.currentHydro.flow - bioConditions.flowTMinus24h).toFixed(1);


    // Get recent sessions (last 2)
    const recentSessions = useMemo(() => {
        return [...sessions]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 2);
    }, [sessions]);

    // Color & Text Helpers
    const getScoreTheme = (score: number) => {
        if (score >= 60) return {
            color: 'text-emerald-600',
            bg: 'bg-emerald-50',
            border: 'border-emerald-100',
            ring: 'ring-emerald-500/20',
            label: 'Excellent'
        };
        if (score >= 30) return {
            color: 'text-amber-600',
            bg: 'bg-amber-50',
            border: 'border-amber-100',
            ring: 'ring-amber-500/20',
            label: 'Moyen'
        };
        return {
            color: 'text-rose-600',
            bg: 'bg-rose-50',
            border: 'border-rose-100',
            ring: 'ring-rose-500/20',
            label: 'Mauvais'
        };
    };

    const theme = getScoreTheme(bioScore);

    const getWeatherIcon = (clouds: number) => {
        if (clouds < 20) return <Sun size={16} className="text-amber-500 mb-2" />;
        if (clouds < 60) return <CloudSun size={16} className="text-stone-400 mb-2" />;
        return <Cloud size={16} className="text-stone-500 mb-2" />;
    };
    
    // Rendu spécifique pour la tuile de Température de l'Eau (avec bulle d'info)
    const renderWaterTempWidget = () => {
        const temp = waterTempData?.temperature;
        const tempColor = temp !== null && temp !== undefined ? 'text-orange-900' : 'text-stone-400';
        const tempBg = temp !== null && temp !== undefined ? 'bg-orange-50 border-orange-100' : 'bg-stone-50 border-stone-100';
        
        return (
            <div className={`min-w-[80px] flex-1 rounded-2xl p-2 flex flex-col items-center text-center border ${tempBg} h-[72px] justify-center relative snap-center`}>
                {isLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-stone-400 border-t-transparent"></div>
                ) : (
                    <>
                        <Thermometer size={16} className="text-orange-500 mb-2" />
                        <span className={`text-xs font-bold ${tempColor}`}>
                            {temp !== null && temp !== undefined ? temp.toFixed(1) + ' °C' : 'N/A'}
                        </span>
                        <span className="text-[10px] text-orange-500 font-medium leading-none mt-1">
                            {temp !== null && temp !== undefined ? '(J-1)' : 'Temp. Eau'}
                        </span>
                    </>
                )}
                
                {waterTempInfoMessage && (
                    <div className="absolute top-1 right-1">
                        <button
                            type="button"
                            onClick={() => setShowWaterTempInfo(!showWaterTempInfo)}
                            className="p-1 text-stone-400 hover:text-stone-600 transition"
                        >
                            <AlertCircle size={14} />
                        </button>
                        <DataInfoPopup message={waterTempInfoMessage} show={showWaterTempInfo} onClose={() => setShowWaterTempInfo(false)} />
                    </div>
                )}
            </div>
        );
    }

    // Fonction pour afficher le bouton d'info sur les tuiles Hydro
    const renderHydroInfoButton = () => {
        if (hydroInfoMessage) {
            return (
                <div className="absolute top-1 right-1">
                    <button
                        type="button"
                        onClick={() => setShowHydroInfo(!showHydroInfo)}
                        className="p-1 text-stone-400 hover:text-stone-600 transition"
                    >
                        <AlertCircle size={14} />
                    </button>
                    {/* Le même popup affichera le message Hydro */}
                    <DataInfoPopup message={hydroInfoMessage} show={showHydroInfo} onClose={() => setShowHydroInfo(false)} />
                </div>
            );
        }
        return null;
    }

    // HANDLER OUVERTURE DÉTAIL
    const handleOpenDetail = (session: Session) => {
        setSelectedSession(session);
        setIsDetailOpen(true);
    };
    
    return (
        <div className="space-y-6 pb-24 animate-in fade-in duration-500">
            
            {/* SECTION A: HEADER PROFIL (GAMIFICATION) */}
            <div className="bg-white rounded-3xl p-6 shadow-organic border border-stone-100">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h2 className="text-stone-400 text-xs font-bold uppercase tracking-widest mb-1">Grade Actuel</h2>
                        <div className="flex items-center gap-2">
                            <Trophy className="text-amber-500" size={20} />
                            <span className="text-xl font-bold text-stone-800 tracking-tight">Soldat du Quai</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <span className="text-2xl font-black text-stone-200">LVL 3</span>
                    </div>
                </div>
                
                {/* XP Bar */}
                <div className="space-y-2">
                    <div className="flex justify-between text-xs font-medium text-stone-500">
                        <span>XP</span>
                        <span>350 / 500</span>
                    </div>
                    <div className="h-2 w-full bg-stone-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-amber-400 to-amber-500 w-[70%] rounded-full shadow-sm" />
                    </div>
                </div>
            </div>


            {/* SECTION B: ORACLE BIO (LIVE) */}
            <div className={`relative overflow-hidden rounded-[2rem] p-8 shadow-soft border ${theme.border} bg-white`}>
                <div className={`absolute top-0 right-0 w-64 h-64 ${theme.bg} rounded-bl-full opacity-50 pointer-events-none -mr-16 -mt-16`} />

                <div className="relative z-10">
                    <div className="flex justify-between items-start mb-6">
                        <div className="flex items-center gap-2">
                            <Activity className={theme.color} size={20} />
                            <h3 className="text-stone-800 font-bold text-lg">État du Spot (Nanterre)</h3>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-white shadow-sm border ${theme.border} ${theme.color}`}>
                            En Direct
                        </span>
                    </div>

                    <div className="flex flex-col items-center justify-center mb-8">
                        <div className={`relative flex items-center justify-center w-40 h-40 rounded-full border-[6px] ${theme.bg} ${theme.border} shadow-inner mb-4`}>
                            <div className="text-center">
                                <span className={`block text-5xl font-black tracking-tighter ${theme.color}`}>{isLoading ? '--' : bioScore}</span>
                                <span className={`text-xs font-bold uppercase tracking-wide opacity-60 ${theme.color}`}>Score Bio</span>
                            </div>
                        </div>
                        <p className={`text-sm font-medium ${theme.color} bg-white px-4 py-1 rounded-full shadow-sm border ${theme.border}`}>
                            Condition : {isLoading ? 'Chargement...' : theme.label}
                        </p>
                    </div>

                    {/* Sub-Indicators - RESPONSIVE FIX (Scroll sur mobile, Grille sur Desktop) */}
                    <div className="flex overflow-x-auto pb-2 gap-3 snap-x md:grid md:grid-cols-5 md:pb-0 scrollbar-hide">
                        
                        {/* 1. Température Air */}
                        <div className="min-w-[80px] flex-1 bg-red-50 rounded-2xl p-2 flex flex-col items-center text-center border border-red-100 h-[72px] justify-center snap-center">
                            {getWeatherIcon(realtimeWeather?.clouds ?? 0)}
                            <span className="text-xs font-bold text-red-900">
                                {isLoading ? '...' : realtimeWeather?.temperature?.toFixed(1) ?? 'N/A'}
                            </span>
                            <span className="text-[10px] text-red-500 font-medium leading-none mt-1">
                                Air °C
                            </span>
                        </div>
                        
                        {/* 2. Pression */}
                        <div className="min-w-[80px] flex-1 bg-indigo-50 rounded-2xl p-2 flex flex-col items-center text-center border border-indigo-100 h-[72px] justify-center snap-center">
                            <Wind size={16} className="text-indigo-500 mb-2" />
                            <span className="text-xs font-bold text-indigo-900">
                                {isLoading ? '...' : realtimeWeather?.pressure?.toFixed(0) ?? 'N/A'}
                            </span>
                            <span className={`text-[10px] font-bold ${Number(deltaPDisplay) > 0 ? 'text-indigo-400' : 'text-indigo-600'} leading-none`}>
                                {isLoading ? '---' : `${Number(deltaPDisplay) > 0 ? '+' : ''}${deltaPDisplay} hPa`}
                            </span>
                        </div>
                        
                        {/* 3. Débit */}
                        <div className="min-w-[80px] flex-1 bg-cyan-50/50 rounded-2xl p-2 flex flex-col items-center text-center border border-cyan-100 h-[72px] justify-center relative snap-center">
                            <Droplets size={16} className="text-cyan-500 mb-2" />
                            <span className="text-xs font-bold text-cyan-900">
                                {isLoading ? '...' : realtimeHydro?.flow?.toFixed(0) ?? 'N/A'}
                            </span>
                            <span className={`text-[10px] font-bold ${Number(deltaQDisplay) > 0 ? 'text-cyan-400' : 'text-cyan-600'} leading-none`}>
                                {isLoading ? '---' : `${Number(deltaQDisplay) > 0 ? '+' : ''}${deltaQDisplay} m³/s`}
                            </span>
                            {renderHydroInfoButton()}
                        </div>
                        
                        {/* 4. Niveau */}
                        <div className="min-w-[80px] flex-1 bg-blue-50 rounded-2xl p-2 flex flex-col items-center text-center border border-blue-100 h-[72px] justify-center relative snap-center">
                            <MapPin size={16} className="text-blue-500 mb-2" />
                            <span className="text-xs font-bold text-blue-900">
                                {isLoading ? '...' : realtimeHydro?.level?.toFixed(2) ?? 'N/A'}
                            </span>
                            <span className="text-[10px] text-blue-500 font-medium leading-none mt-1">
                                Niveau m
                            </span>
                            {renderHydroInfoButton()}
                        </div>

                        {/* 5. Température Eau */}
                        {renderWaterTempWidget()}
                    </div>
                    {/* --- FIN GRILLE --- */}
                    
                </div>
            </div>

            {/* SECTION C: HISTORIQUE RÉCENT */}
            <div className="space-y-4">
                <h3 className="text-stone-800 font-bold text-lg px-2 flex items-center gap-2">
                    <Clock size={20} className="text-stone-400" />
                    Historique Récent
                </h3>
                
                {recentSessions.length > 0 ? (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {recentSessions.map(session => (
                            <div 
                                key={session.id} 
                                onClick={() => handleOpenDetail(session)}
                                className="cursor-pointer transition-transform hover:scale-[1.01] active:scale-[0.99]"
                            >
                                <SessionCard session={session} onDelete={onDeleteSession} />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="border border-dashed border-stone-300 rounded-3xl p-8 flex flex-col items-center text-center bg-stone-50/50">
                        <div className="bg-white p-4 rounded-full shadow-sm border border-stone-100 mb-4">
                            <Database size={24} className="text-stone-300" />
                        </div>
                        <h3 className="text-stone-500 font-bold mb-1">Oracle Historique</h3>
                        <p className="text-sm text-stone-400 max-w-xs mx-auto">
                            Base de données en construction. Enregistrez plus de sessions pour activer les prédictions IA.
                        </p>
                        <div className="mt-4 h-1.5 w-24 bg-stone-200 rounded-full overflow-hidden">
                            <div className="h-full bg-stone-300 w-[15%]" />
                        </div>
                    </div>
                )}
            </div>

            {/* MODAL DÉTAIL */}
            <SessionDetailModal 
                session={selectedSession} 
                isOpen={isDetailOpen} 
                onClose={() => setIsDetailOpen(false)} 
            />
        </div>
    );
};

export default Dashboard;