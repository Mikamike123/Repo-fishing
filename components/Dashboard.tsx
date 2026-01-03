// components/Dashboard.tsx - Version 9.3 (Auth Compatible)
import React, { useState, useMemo, useEffect } from 'react';
import { 
    Activity, Target, ScrollText, MapPin, ChevronDown, Flame, Trophy 
} from 'lucide-react';
import { Session, RefLureType, RefColor, Location, WeatherSnapshot, AppData } from '../types';
import { buildUserHistory, getNextLevelCap } from '../lib/gamification';
import { fetchUniversalWeather } from '../lib/universal-weather-service';
import { OracleDataPoint } from '../lib/oracle-service'; 

import { DashboardLiveTab } from './DashboardLiveTab';
import { DashboardTacticsTab } from './DashboardTacticsTab';
import { DashboardActivityTab } from './DashboardActivityTab';
import { RecordsGrid } from './RecordsGrid'; 

type DashboardTab = 'live' | 'tactics' | 'activity' | 'experience';

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
    activeLocationId: string;
    setActiveLocationId: (id: string) => void;
    oracleData: OracleDataPoint[]; 
    isOracleLoading: boolean;
    activeLocationLabel: string;
    availableLocations: Location[]; 
    onLocationClick: () => void;
    onLocationSelect: (id: string) => void;
    arsenalData: AppData;
}

const Dashboard: React.FC<DashboardProps> = (props) => {
    // Michael : Extraction de toutes les propriétés pour éviter les erreurs "undefined"
    const { 
        sessions, currentUserId, locations, activeLocationId, setActiveLocationId, 
        oracleData, isOracleLoading, onDeleteSession, onEditSession,
        activeLocationLabel, onLocationClick, onLocationSelect, arsenalData,
        onMagicDiscovery, userName 
    } = props;

    const [activeTab, setActiveTab] = useState<DashboardTab>('live');
    const [displayedWeather, setDisplayedWeather] = useState<WeatherSnapshot | null>(null);
    const [isWeatherLoading, setIsWeatherLoading] = useState(false);

    const uniqueLocationsMap = useMemo(() => {
        const map = new Map<string, Location>();
        locations.forEach(l => { if (l.id && !map.has(l.id)) map.set(l.id, l); });
        return map;
    }, [locations]);

    const uniqueLocationsList = useMemo(() => Array.from(uniqueLocationsMap.values()), [uniqueLocationsMap]);
    
    const defaultLocation = useMemo(() => 
        uniqueLocationsList.find((l: any) => l.isDefault === true) || uniqueLocationsList[0]
    , [uniqueLocationsList]);

    const displayLocations = useMemo(() => {
        const favorites = locations.filter(l => l.active && l.isFavorite);
        if (favorites.length === 0 && defaultLocation) return [defaultLocation];
        return favorites;
    }, [locations, defaultLocation]);

    useEffect(() => { 
        if (!activeLocationId) {
            const firstFav = locations.find(l => l.active && l.isFavorite);
            if (firstFav) setActiveLocationId(firstFav.id); 
            else if (defaultLocation) setActiveLocationId(defaultLocation.id);
        }
    }, [defaultLocation, activeLocationId, setActiveLocationId, locations]);

    const targetLocation = useMemo(() => uniqueLocationsMap.get(activeLocationId) || defaultLocation || null, [uniqueLocationsMap, activeLocationId, defaultLocation]);

    useEffect(() => {
        const updateWeather = async () => {
            if (!targetLocation || !targetLocation.coordinates) return;
            setIsWeatherLoading(true);
            try {
                const customData = await fetchUniversalWeather(targetLocation.coordinates.lat, targetLocation.coordinates.lng);
                setDisplayedWeather(customData);
            } catch (e) { console.error("Weather error dashboard", e); }
            finally { setIsWeatherLoading(false); }
        };
        updateWeather();
    }, [activeLocationId, targetLocation]);

    const isLoading = isWeatherLoading || isOracleLoading;

    return (
        <div className="space-y-4 animate-in fade-in duration-500 pb-20">
            {/* 1. NAVIGATION HAUTE */}
            <div className="flex bg-stone-100/50 p-1.5 rounded-[2rem] border border-stone-100 mx-2">
                <TabButton active={activeTab === 'live'} onClick={() => setActiveTab('live')} icon={<Activity size={18} />} label="Live" color="amber" />
                <TabButton active={activeTab === 'tactics'} onClick={() => setActiveTab('tactics')} icon={<Target size={18} />} label="Tactique" color="emerald" />
                <TabButton active={activeTab === 'activity'} onClick={() => setActiveTab('activity')} icon={<ScrollText size={18} />} label="Fil d'actu" color="indigo" />
                <TabButton active={activeTab === 'experience'} onClick={() => setActiveTab('experience')} icon={<Trophy size={18} />} label="Expérience" color="rose" />
            </div>

            <main className="px-1">
                {activeTab === 'live' && (
                    <DashboardLiveTab 
                        uniqueLocationsList={uniqueLocationsList}
                        oracleData={oracleData}
                        isOracleLoading={isOracleLoading}
                        activeLocationId={activeLocationId}
                        onLocationSelect={onLocationSelect}
                        displayLocations={displayLocations}
                        targetLocation={targetLocation}
                        displayedWeather={displayedWeather}
                        isLoading={isLoading}
                        onLocationClick={onLocationClick}
                        activeLocationLabel={activeLocationLabel}
                        onMagicDiscovery={onMagicDiscovery}
                    />
                )}

                {activeTab === 'tactics' && (
                    <DashboardTacticsTab sessions={sessions} currentUserId={currentUserId} arsenalData={arsenalData} />
                )}

                {activeTab === 'activity' && (
                    <DashboardActivityTab sessions={sessions} currentUserId={currentUserId} onDeleteSession={onDeleteSession} onEditSession={onEditSession} />
                )}

                {activeTab === 'experience' && (
                    <div className="space-y-6 animate-in slide-in-from-right duration-500">
                        <ProgressionHeader sessions={sessions} currentUserId={currentUserId} />
                        <TrophiesSection sessions={sessions} currentUserId={currentUserId} />
                    </div>
                )}
            </main>
        </div>
    );
};

const ProgressionHeader: React.FC<any> = ({ sessions, currentUserId }) => {
    const currentYear = new Date().getFullYear();
    const stats = useMemo(() => {
        const userSessions = sessions.filter((s: any) => s.userId === currentUserId);
        return buildUserHistory(userSessions)[currentYear] || { year: currentYear, levelReached: 1, xpTotal: 0, sessionCount: 0, fishCount: 0, weeksWithStreak: 0 };
    }, [sessions, currentUserId, currentYear]);
    const nextXP = getNextLevelCap(stats.levelReached);
    const progress = Math.min(100, (stats.xpTotal / nextXP) * 100);

    return (
        <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-sm relative overflow-hidden mx-2">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4 relative z-10">
                <div>
                    <div className="flex items-center space-x-2 mb-1">
                        <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-500 text-[10px] font-bold tracking-wider uppercase">Saison {currentYear}</span>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 text-[10px] font-bold tracking-wider uppercase flex items-center"><Flame size={10} className="mr-1" />{stats.weeksWithStreak} Semaines validées</span>
                    </div>
                    <h2 className="text-2xl font-black text-stone-800 tracking-tighter uppercase italic">Niveau {stats.levelReached}</h2>
                    <p className="text-sm text-stone-500 font-medium">{stats.xpTotal.toLocaleString()} XP <span className="text-stone-300">/ {nextXP.toLocaleString()} XP</span></p>
                </div>
                <div className="text-right">
                    <div className="text-[10px] font-bold text-stone-400 uppercase tracking-widest leading-none">Performance</div>
                    <div className="text-stone-800 font-black text-lg">{stats.fishCount} <span className="text-xs text-stone-400">Poissons</span></div>
                </div>
            </div>
            <div className="h-3 w-full bg-stone-100 rounded-full overflow-hidden relative z-10">
                <div className="h-full bg-gradient-to-r from-amber-300 via-orange-400 to-rose-500 transition-all duration-1000 ease-out" style={{ width: `${progress}%` }} />
            </div>
        </div>
    );
};

const TrophiesSection: React.FC<any> = ({ sessions, currentUserId }) => (
    <div className="bg-white rounded-[2.5rem] p-8 border border-stone-100 shadow-organic space-y-8 mx-2">
        <div className="flex items-center justify-between mb-2">
            <h3 className="font-black text-stone-800 flex items-center gap-2"><Trophy className="text-amber-500" size={20} /> Vos Trophées</h3>
            <span className="text-[9px] font-black bg-stone-100 text-stone-400 px-2 py-1 rounded-full uppercase tracking-tighter">Performance</span>
        </div>
        <RecordsGrid sessions={sessions.filter((s: any) => s.userId === currentUserId && new Date(s.date).getFullYear() === new Date().getFullYear())} title={`Saison ${new Date().getFullYear()}`} />
        <RecordsGrid sessions={sessions.filter((s: any) => s.userId === currentUserId)} title="Hall of Fame" isGold={true} />
    </div>
);

const TabButton = ({ active, onClick, icon, label, color }: any) => {
    const themes: any = {
        amber: active ? "bg-white text-amber-600 shadow-sm" : "text-stone-400 hover:text-stone-600",
        emerald: active ? "bg-white text-emerald-600 shadow-sm" : "text-stone-400 hover:text-stone-600",
        indigo: active ? "bg-white text-indigo-600 shadow-sm" : "text-stone-400 hover:text-stone-600",
        rose: active ? "bg-white text-rose-600 shadow-sm" : "text-stone-400 hover:text-stone-600",
    };
    return (
        <button onClick={onClick} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-[10px] sm:text-[11px] font-black uppercase tracking-tighter transition-all duration-300 ${themes[color]}`}>
            {icon} <span className="hidden sm:inline">{label}</span>
        </button>
    );
};

export default Dashboard;