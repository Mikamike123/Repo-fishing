import React, { useState, useMemo } from 'react';
import { 
    Clock, Droplets, Wind, Activity, Cloud, Sun, CloudSun, 
    CloudRain, Thermometer, Gauge, Trophy, Users, User as UserIcon, Flame 
} from 'lucide-react';
import { Session } from '../types';
import SessionCard from './SessionCard';
import SessionDetailModal from './SessionDetailModal';
import { useCurrentConditions } from '../lib/hooks';
import { RecordsGrid } from './RecordsGrid';
import { buildUserHistory, getNextLevelCap } from '../lib/gamification';

// --- HELPERS VISUELS ---
const getWindDir = (deg?: number) => {
    if (deg === undefined) return '';
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
    return directions[Math.round(deg / 45) % 8];
};

const getWeatherIcon = (clouds: number) => {
    if (clouds < 20) return <Sun size={20} className="text-amber-500" />;
    if (clouds < 60) return <CloudSun size={20} className="text-stone-400" />;
    if (clouds < 90) return <Cloud size={20} className="text-stone-500" />;
    return <CloudRain size={20} className="text-stone-600" />;
};

interface DashboardProps {
    sessions: Session[];
    onDeleteSession: (id: string) => void;
    onEditSession: (session: Session) => void;
    userName?: string;
    currentUserId: string;
}

const Dashboard: React.FC<DashboardProps> = ({ sessions, onDeleteSession, onEditSession, userName, currentUserId }) => {
    // 1. Récupération des conditions Oracle en direct
    const { weather, hydro, scores, isLoading } = useCurrentConditions();
    const currentYear = new Date().getFullYear();

    // 2. État du filtre News Feed (Défaut : 'my' pour Mes Sessions)
    const [feedFilter, setFeedFilter] = useState<'all' | 'my'>('my');

    // 3. Logique de filtrage du Fil d'Actualité
    const filteredFeedSessions = useMemo(() => {
        const base = feedFilter === 'my' 
            ? sessions.filter(s => s.userId === currentUserId)
            : sessions;
        return base.slice(0, 5); // Affiche les 5 plus récentes après filtrage
    }, [sessions, feedFilter, currentUserId]);

    // 4. CALCUL GAMIFICATION (ORACLE SEASON)
    // On remplace l'ancien calcul simple par le moteur complet
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

    // Gestion du Modal
    const [selectedSession, setSelectedSession] = useState<Session | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    const handleOpenDetail = (session: Session) => {
        setSelectedSession(session);
        setIsDetailOpen(true);
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            
            {/* 1. PROGRESSION DYNAMIQUE (ORACLE SEASON PANEL) */}
            {/* Remplacement de ExperienceBar par le Dashboard Gamification */}
            <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-sm relative overflow-hidden">
                {/* Background décoratif subtil */}
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

                {/* Barre d'XP */}
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

            {/* 2. ÉTAT DU SPOT (Nanterre) */}
            <div className="bg-white rounded-[2rem] p-1 shadow-organic border border-stone-100 overflow-hidden relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -mr-10 -mt-10"></div>
                
                <div className="p-6 relative z-10">
                    <div className="flex justify-between items-center mb-8">
                        <h3 className="text-lg font-bold text-stone-800 flex items-center gap-2">
                            <ActivityIcon /> État du Spot (Nanterre)
                        </h3>
                        <span className="px-3 py-1 bg-amber-50 text-amber-600 text-[10px] font-black uppercase tracking-wider rounded-full border border-amber-100 animate-pulse">
                            En Direct
                        </span>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-8">
                        <SpeciesScore label="Sandre" score={scores?.sandre} color="text-amber-600" borderColor="border-amber-400" loading={isLoading} />
                        <SpeciesScore label="Brochet" score={scores?.brochet} color="text-stone-600" borderColor="border-stone-400" loading={isLoading} />
                        <SpeciesScore label="Perche" score={scores?.perche} color="text-emerald-600" borderColor="border-emerald-400" loading={isLoading} />
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                        <DataTile label="Air °C" value={weather?.temperature !== undefined ? Math.round(weather.temperature) : '--'} unit="" icon={weather ? getWeatherIcon(weather.cloudCover) : <CloudIcon />} color="bg-rose-50 text-rose-900" loading={isLoading} />
                        <DataTile label="Vent" value={weather?.windSpeed !== undefined ? Math.round(weather.windSpeed) : '--'} unit={weather?.windDir !== undefined ? `km/h ${getWindDir(weather.windDir)}` : 'km/h'} icon={<WindIcon />} color="bg-stone-100 text-stone-600" loading={isLoading} />
                        <DataTile label="Pression" value={weather?.pressure !== undefined ? Math.round(weather.pressure) : '--'} unit="hPa" icon={<GaugeIcon />} color="bg-indigo-50 text-indigo-900" loading={isLoading} />
                        <DataTile label="Débit" value={hydro?.flowLagged !== undefined ? Math.round(hydro.flowLagged) : '--'} unit="m³/s" icon={<DropletsIcon />} color="bg-cyan-50 text-cyan-900" loading={isLoading} />
                        <DataTile label="Eau" value={hydro?.waterTemp ? hydro.waterTemp.toFixed(1) : '--'} unit="°C" icon={<ThermometerIcon />} color="bg-orange-50 text-orange-900" loading={isLoading} />
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

            {/* 4. FIL D'ACTUALITÉ AVEC TOGGLE */}
            <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                    <h3 className="text-stone-800 font-bold text-lg flex items-center gap-2">
                        <Clock size={20} className="text-stone-400" /> Fil d'Actualité
                    </h3>

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

// --- COMPOSANTS INTERNES ---
const SpeciesScore = ({ label, score, color, borderColor, loading }: any) => (
    <div className="flex flex-col items-center">
        <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center">
            <div className="absolute inset-0 border-8 border-stone-50 rounded-full"></div>
            <div 
                className={`absolute inset-0 border-8 ${borderColor} rounded-full border-t-transparent transition-all duration-1000`} 
                style={{ transform: `rotate(${(score || 0) * 3.6 - 45}deg)`, opacity: loading ? 0.3 : 1 }}
            ></div>
            <div className="text-center z-10">
                {loading ? (
                    <div className="h-6 w-8 bg-stone-100 rounded animate-pulse mx-auto"></div>
                ) : (
                    <span className={`block text-2xl font-black ${color} tracking-tighter`}>
                        {score !== undefined ? Math.round(score) : '0'}
                    </span>
                )}
            </div>
        </div>
        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mt-2">{label}</span>
    </div>
);

const ActivityIcon = () => <Activity className="text-emerald-500" size={24} />;
const CloudIcon = () => <Cloud size={16} />;
const WindIcon = () => <Wind size={16} />;
const DropletsIcon = () => <Droplets size={16} />;
const GaugeIcon = () => <Gauge size={16} />;
const ThermometerIcon = () => <div className="flex justify-center"><Thermometer size={16} /></div>;

const DataTile = ({ label, value, unit, icon, color, loading }: any) => (
    <div className={`flex flex-col items-center justify-center p-3 rounded-2xl border border-stone-50 ${color.split(' ')[0]} bg-opacity-30 relative`}>
        <div className={`mb-1 ${color.split(' ')[1]}`}>{icon}</div>
        {loading ? (
            <div className="h-4 w-8 bg-stone-200/50 rounded animate-pulse my-1"></div>
        ) : (
            <div className="text-sm font-black text-stone-800 leading-tight text-center">
                {value !== undefined && value !== null ? value : '--'}
                <span className="text-[10px] font-medium ml-0.5 text-stone-500">{unit}</span>
            </div>
        )}
        <div className="text-[9px] font-bold uppercase text-stone-400 mt-0.5">{label}</div>
    </div>
);

export default Dashboard;