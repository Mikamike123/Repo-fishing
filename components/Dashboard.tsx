// components/Dashboard.tsx - Version 10.5.0 (Multi-User Registry Support)
import React, { useState, useMemo, useEffect } from 'react';
import { 
    Activity, Target, ScrollText, MapPin, ChevronDown, Flame, Trophy, RefreshCw
} from 'lucide-react';
import { Session, RefLureType, RefColor, Location, WeatherSnapshot, AppData, UserProfile, OracleDataPoint } from '../types';
import { buildUserHistory } from '../lib/gamification';

import { DashboardLiveTab } from './DashboardLiveTab';
import { DashboardTacticsTab } from './DashboardTacticsTab';
import { DashboardActivityTab } from './DashboardActivityTab';
import { RecordsGrid } from './RecordsGrid'; 
import { ExperienceBar } from './ExperienceBar';

type DashboardTab = 'live' | 'tactics' | 'activity' | 'experience';

interface DashboardProps {
    activeTab?: 'live' | 'tactics' | 'activity' | 'experience';
    onTabChange?: (tab: 'live' | 'tactics' | 'activity' | 'experience') => void;
    userProfile: UserProfile | null;
    usersRegistry: Record<string, UserProfile>; // Michael : Ajout du registre pour la Phase de Normalisation v10.6
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
    displayedWeather: WeatherSnapshot | null;
    lastSyncTimestamp?: number;
    isActuallyNight?: boolean;
}

const Dashboard: React.FC<DashboardProps> = (props) => {
    const { 
        activeTab: propTab, onTabChange, userProfile, usersRegistry,
        sessions, currentUserId, locations, activeLocationId, setActiveLocationId, 
        oracleData, isOracleLoading, onDeleteSession, onEditSession,
        activeLocationLabel, onLocationClick, onLocationSelect, arsenalData,
        onMagicDiscovery, userName,
        displayedWeather,
        lastSyncTimestamp,
        isActuallyNight 
    } = props;

    const [activeTab, setActiveTab] = useState<DashboardTab>(propTab || 'live');
    const [syncTimeLabel, setSyncTimeLabel] = useState<string>("--:--:--");

    // Michael : Capture de l'heure exacte de synchro (V8.1 Precision)
    useEffect(() => {
        if (lastSyncTimestamp) {
            const date = new Date(lastSyncTimestamp);
            setSyncTimeLabel(date.toLocaleTimeString('fr-FR', { 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit' 
            }));
        }
    }, [lastSyncTimestamp]);

    useEffect(() => {
        if (propTab) setActiveTab(propTab);
    }, [propTab]);

    const handleTabChange = (tab: DashboardTab) => {
        setActiveTab(tab);
        if (onTabChange) onTabChange(tab);
    };

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

    const isLoading = isOracleLoading;

    return (
        <div className="space-y-4 animate-in fade-in duration-500 pb-20">
            <div className={`flex p-1.5 rounded-[2rem] border mx-1 transition-all duration-500 ${
                isActuallyNight ? 'bg-stone-900/50 border-stone-800' : 'bg-stone-200/50 border-stone-200'
            }`}>
                <TabButton active={activeTab === 'live'} onClick={() => handleTabChange('live')} icon={<Activity size={20} />} label="Live" color="amber" isActuallyNight={isActuallyNight} />
                <TabButton active={activeTab === 'tactics'} onClick={() => handleTabChange('tactics')} icon={<Target size={20} />} label="Tactique" color="emerald" isActuallyNight={isActuallyNight} />
                <TabButton active={activeTab === 'activity'} onClick={() => handleTabChange('activity')} icon={<ScrollText size={20} />} label="Actu" color="indigo" isActuallyNight={isActuallyNight} />
                <TabButton active={activeTab === 'experience'} onClick={() => handleTabChange('experience')} icon={<Trophy size={20} />} label="Exp" color="rose" isActuallyNight={isActuallyNight} />
            </div>

            <main className="px-0">
                {activeTab === 'live' && (
                    <div className="space-y-6">
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
                            isActuallyNight={isActuallyNight}
                        />
                        
                        <div className="flex items-center justify-center gap-2 py-4 opacity-40">
                            <RefreshCw size={10} className={isOracleLoading ? "animate-spin" : ""} />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] italic">
                                Données synchronisées à {syncTimeLabel}
                            </span>
                        </div>
                    </div>
                )}

                {activeTab === 'tactics' && (
                    <DashboardTacticsTab 
                        sessions={sessions} 
                        currentUserId={currentUserId} 
                        arsenalData={arsenalData} 
                        isActuallyNight={isActuallyNight} 
                    />
                )}

                {activeTab === 'activity' && (
                    <DashboardActivityTab 
                        sessions={sessions} 
                        currentUserId={currentUserId} 
                        onDeleteSession={onDeleteSession} 
                        onEditSession={onEditSession}
                        isActuallyNight={isActuallyNight}
                        userProfile={userProfile} 
                        usersRegistry={usersRegistry} // Michael : Le registre arrive enfin à destination
                    />
                )}

                {activeTab === 'experience' && (
                    <div className="space-y-6 animate-in slide-in-from-right duration-500">
                        <ProgressionHeader 
                            sessions={sessions} 
                            currentUserId={currentUserId} 
                            userName={userName} 
                            lastXpGain={userProfile?.lastXpGain} 
                            lastXpYear={userProfile?.lastXpYear}
                            isActuallyNight={isActuallyNight}
                        />
                        <TrophiesSection sessions={sessions} currentUserId={currentUserId} isActuallyNight={isActuallyNight} />
                    </div>
                )}
            </main>
        </div>
    );
};

const ProgressionHeader: React.FC<any> = ({ sessions, currentUserId, userName, lastXpGain, lastXpYear, isActuallyNight }) => {
    const currentYear = new Date().getFullYear();
    const stats = useMemo(() => {
        const userSessions = sessions.filter((s: any) => s.userId === currentUserId);
        return buildUserHistory(userSessions)[currentYear] || { year: currentYear, levelReached: 1, xpTotal: 0, sessionCount: 0, fishCount: 0, weeksWithStreak: 0 };
    }, [sessions, currentUserId, currentYear]);

    const isRelevantGain = lastXpYear === currentYear && lastXpGain > 0;

    return (
        <div className="mx-1">
            <ExperienceBar 
                xpTotal={stats.xpTotal} 
                level={stats.levelReached} 
                lastXpGain={isRelevantGain ? lastXpGain : 0} 
                userName={userName}
                variant="full"
                isActuallyNight={isActuallyNight} 
            />
            
            <div className={`mt-4 rounded-2xl p-4 border flex justify-between items-center transition-colors duration-500 ${
                isActuallyNight ? 'bg-emerald-950/20 border-emerald-900/50 text-emerald-400' : 'bg-emerald-50/50 border-emerald-100 text-emerald-800'
            }`}>
                <div>
                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block">Assiduité Saison</span>
                    <span className="text-xl font-black">{stats.weeksWithStreak} Semaines</span>
                </div>
                <Flame size={24} className="text-emerald-500 fill-emerald-500/20" />
            </div>
        </div>
    );
};

const TrophiesSection: React.FC<any> = ({ sessions, currentUserId, isActuallyNight }) => (
    <div className={`rounded-[2.5rem] p-8 border shadow-organic space-y-8 mx-1 transition-colors duration-500 ${
        isActuallyNight ? 'bg-[#1c1917] border-stone-800 shadow-none' : 'bg-white border-stone-100'
    }`}>
        <div className="flex items-center justify-between mb-2">
            <h3 className={`font-black flex items-center gap-2 ${isActuallyNight ? 'text-stone-100' : 'text-stone-800'}`}>
                <Trophy className="text-amber-500" size={20} /> Tes Trophées
            </h3>
            <span className="text-[9px] font-black bg-stone-100/10 text-stone-400 px-2 py-1 rounded-full uppercase tracking-tighter">Performance</span>
        </div>
        <RecordsGrid 
            sessions={sessions.filter((s: any) => s.userId === currentUserId && new Date(s.date).getFullYear() === new Date().getFullYear())} 
            title={`Saison ${new Date().getFullYear()}`} 
            isActuallyNight={isActuallyNight}
        />
        <RecordsGrid 
            sessions={sessions.filter((s: any) => s.userId === currentUserId)} 
            title="Hall of Fame" 
            isGold={true} 
            isActuallyNight={isActuallyNight}
        />
    </div>
);

const TabButton = ({ active, onClick, icon, label, color, isActuallyNight }: any) => {
    const themes: any = {
        amber: active ? (isActuallyNight ? "bg-stone-800 text-amber-500 shadow-lg" : "bg-white text-amber-600 shadow-md") : (isActuallyNight ? "text-stone-500" : "text-stone-500"),
        emerald: active ? (isActuallyNight ? "bg-stone-800 text-emerald-500 shadow-lg" : "bg-white text-emerald-600 shadow-md") : (isActuallyNight ? "text-stone-500" : "text-stone-500"),
        indigo: active ? (isActuallyNight ? "bg-stone-800 text-indigo-400 shadow-lg" : "bg-white text-indigo-600 shadow-md") : (isActuallyNight ? "text-stone-500" : "text-stone-500"),
        rose: active ? (isActuallyNight ? "bg-stone-800 text-rose-400 shadow-lg" : "bg-white text-rose-600 shadow-md") : (isActuallyNight ? "text-stone-500" : "text-stone-500"),
    };
    return (
        <button 
            onClick={onClick} 
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-2xl text-[11px] font-black uppercase tracking-tighter transition-all duration-300 ${active ? 'scale-105' : 'hover:opacity-70'} ${themes[color]}`}
        >
            {icon} 
            <span className="text-[9px] font-black leading-none">{label}</span>
        </button>
    );
};

export default Dashboard;