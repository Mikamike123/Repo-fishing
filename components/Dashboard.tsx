import React, { useState } from 'react';
import { Clock, MapPin, Droplets, Wind, TrendingUp, Calendar, ArrowRight, Gauge, Activity } from 'lucide-react'; 
import { Session } from '../types';
import SessionCard from './SessionCard';
import SessionDetailModal from './SessionDetailModal';
import { getRealtimeEnvironmentalConditions, getRealtimeWaterTemp } from '../lib/environmental-service';

// --- HELPER DIRECTION VENT ---
const getWindDir = (deg?: number) => {
    if (deg === undefined) return '';
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
    return directions[Math.round(deg / 45) % 8];
};

interface DashboardProps {
    sessions: Session[];
    onDeleteSession: (id: string) => void;
    onEditSession: (session: Session) => void;
    // AJOUT DE LA PROPRIÉTÉ MANQUANTE
    userName?: string; 
}

const Dashboard: React.FC<DashboardProps> = ({ sessions, onDeleteSession, onEditSession, userName }) => {
    // États pour le live
    const [realtimeWeather, setRealtimeWeather] = useState<any>(null);
    const [realtimeHydro, setRealtimeHydro] = useState<any>(null);
    const [waterTempData, setWaterTempData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hydroInfoMessage, setHydroInfoMessage] = useState<string | null>(null);

    // États pour le détail
    const [selectedSession, setSelectedSession] = useState<Session | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    React.useEffect(() => {
        const loadRealtimeData = async () => {
            setIsLoading(true);
            try {
                const [env, temp] = await Promise.all([
                    getRealtimeEnvironmentalConditions(),
                    getRealtimeWaterTemp(null)
                ]);

                setRealtimeWeather(env.weather);
                setRealtimeHydro(env.hydro);
                setHydroInfoMessage(env.hydroMessage);
                setWaterTempData(temp);
            } catch (error) {
                console.error("Dashboard: Erreur chargement", error);
            } finally {
                setIsLoading(false);
            }
        };
        loadRealtimeData();
    }, []);

    // Calculs stats simples
    const totalCatches = sessions.reduce((acc, s) => acc + (s.catches?.length || 0), 0);
    const recentSessions = sessions.slice(0, 3);

    // Calcul Bio Score simplifié (Moyenne Feeling)
    const averageFeeling = sessions.length > 0 
        ? Math.round(sessions.reduce((acc, s) => acc + s.feelingScore, 0) / sessions.length * 10) 
        : 50;

    const handleOpenDetail = (session: Session) => {
        setSelectedSession(session);
        setIsDetailOpen(true);
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            {/* EN-TÊTE PROFIL */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-stone-100">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h2 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">
                            {/* Utilisation du userName ici */}
                            Salut, <span className="text-amber-500">{userName || 'Pêcheur'}</span> !
                        </h2>
                        <div className="flex items-center gap-2">
                            <TrophyIcon className="text-amber-500" />
                            <span className="text-xl font-black text-stone-800">Soldat du Quai</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <span className="text-3xl font-black text-stone-200">LVL 3</span>
                    </div>
                </div>
                <div>
                    <div className="flex justify-between text-xs font-bold text-stone-400 mb-2">
                        <span>XP</span>
                        <span>350 / 500</span>
                    </div>
                    <div className="h-3 bg-stone-100 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500 rounded-full" style={{ width: '70%' }}></div>
                    </div>
                </div>
            </div>

            {/* LIVE CONDITIONS */}
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

                    <div className="flex flex-col items-center justify-center mb-8">
                         <div className="relative w-40 h-40 flex items-center justify-center">
                            <div className="absolute inset-0 border-[12px] border-stone-50 rounded-full"></div>
                            <div className="absolute inset-0 border-[12px] border-amber-400 rounded-full border-t-transparent animate-[spin_10s_linear_infinite]" style={{ transform: 'rotate(-45deg)' }}></div>
                            <div className="text-center z-10">
                                <span className="block text-5xl font-black text-amber-600 tracking-tighter">{averageFeeling}</span>
                                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mt-1">Score Bio</span>
                            </div>
                         </div>
                         <div className="mt-4 px-4 py-1.5 bg-amber-50 border border-amber-100 rounded-full text-xs font-bold text-amber-700">
                            Condition : Moyen
                         </div>
                    </div>

                    {/* GRILLE 5 COLONNES (Responsive) */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                        {/* AIR TEMP */}
                        <DataTile 
                            label="Air °C" 
                            value={realtimeWeather?.temperature ? Math.round(realtimeWeather.temperature) : '--'} 
                            unit="" 
                            icon={<CloudIcon />} 
                            color="bg-rose-50 text-rose-900" 
                            loading={isLoading}
                        />

                        {/* VENT */}
                        <DataTile 
                            label="Vent" 
                            value={realtimeWeather?.windSpeed ? Math.round(realtimeWeather.windSpeed) : '--'} 
                            unit={realtimeWeather?.windDirection !== undefined ? `km/h ${getWindDir(realtimeWeather.windDirection)}` : 'km/h'}
                            icon={<WindIcon />} 
                            color="bg-stone-100 text-stone-600" 
                            loading={isLoading}
                        />

                        {/* PRESSION */}
                        <DataTile 
                            label="Pression" 
                            value={realtimeWeather?.pressure ? Math.round(realtimeWeather.pressure) : '--'} 
                            unit="hPa" 
                            icon={<GaugeIcon />} 
                            color="bg-indigo-50 text-indigo-900" 
                            loading={isLoading}
                        /> 

                        {/* DEBIT */}
                        <DataTile 
                            label="+5.0 m³/s" // Simulé
                            value={realtimeHydro?.flow} 
                            unit="" 
                            icon={<DropletsIcon />} 
                            color="bg-cyan-50 text-cyan-900" 
                            loading={isLoading}
                            info={hydroInfoMessage}
                        />

                        {/* EAU TEMP */}
                        <DataTile 
                            label="(J-1)" 
                            value={waterTempData?.temperature} 
                            unit="°C" 
                            icon={<ThermometerIcon />} 
                            color="bg-orange-50 text-orange-900" 
                            loading={isLoading}
                        />
                    </div>
                </div>
            </div>

            {/* HISTORIQUE RÉCENT */}
            <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                    <h3 className="text-stone-800 font-bold text-lg flex items-center gap-2">
                        <Clock size={20} className="text-stone-400" />
                        Historique Récent
                    </h3>
                </div>
                
                <div className="space-y-4">
                    {recentSessions.map(session => (
                        <SessionCard 
                            key={session.id} 
                            session={session} 
                            onDelete={onDeleteSession}
                            onEdit={onEditSession}
                            onClick={handleOpenDetail} 
                        />
                    ))}
                    {sessions.length === 0 && (
                        <div className="text-center py-10 text-stone-400 italic bg-stone-50 rounded-2xl border border-dashed border-stone-200">
                            Aucune session récente.
                        </div>
                    )}
                </div>
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

// Petits composants helpers
const TrophyIcon = ({className}: {className?: string}) => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>;
const ActivityIcon = () => <TrendingUp className="text-emerald-500" size={24} />;
const CloudIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.5 19c0-3.037-2.463-5.5-5.5-5.5S6.5 15.963 6.5 19 8.963 24.5 12 24.5s5.5-2.463 5.5-5.5z"/><path d="M12 2.5a5.5 5.5 0 0 0-5.32 6.88A5.5 5.5 0 0 0 12 13.5a5.5 5.5 0 0 0 5.32-4.12A5.5 5.5 0 0 0 12 2.5z"/></svg>;
const WindIcon = () => <Wind size={16} />;
const DropletsIcon = () => <Droplets size={16} />;
const MapPinIcon = () => <MapPin size={16} />;
const GaugeIcon = () => <Gauge size={16} />;
const ThermometerIcon = () => <div className="flex justify-center"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/></svg></div>;

const DataTile = ({ label, value, unit, icon, color, loading, info }: any) => (
    <div className={`flex flex-col items-center justify-center p-3 rounded-2xl border border-stone-50 ${color.split(' ')[0]} bg-opacity-30`}>
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