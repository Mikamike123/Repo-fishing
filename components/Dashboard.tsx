// components/Dashboard.tsx - Version 9.8 (UI Optimization for PWA & Mobile Visibility)
import React, { useState, useMemo, useEffect } from 'react';
import { 
    Activity, Target, ScrollText, MapPin, ChevronDown, Flame, Trophy 
} from 'lucide-react';
import { Session, RefLureType, RefColor, Location, WeatherSnapshot, AppData, UserProfile, OracleDataPoint } from '../types';
import { buildUserHistory, getNextLevelCap } from '../lib/gamification';

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
    // Michael : Ajout de la prop pour recevoir la météo unifiée de App.tsx
    displayedWeather: WeatherSnapshot | null;
}

const Dashboard: React.FC<DashboardProps> = (props) => {
    const { 
        activeTab: propTab, onTabChange, userProfile,
        sessions, currentUserId, locations, activeLocationId, setActiveLocationId, 
        oracleData, isOracleLoading, onDeleteSession, onEditSession,
        activeLocationLabel, onLocationClick, onLocationSelect, arsenalData,
        onMagicDiscovery, userName,
        displayedWeather // Michael : Récupération depuis les props
    } = props;

    const [activeTab, setActiveTab] = useState<DashboardTab>(propTab || 'live');

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

    // Michael : Le calcul de isLoading est simplifié car isOracleLoading porte désormais les deux états de charge
    const isLoading = isOracleLoading;

    return (
        <div className="space-y-4 animate-in fade-in duration-500 pb-20">
            {/* Michael : Sélecteur d'onglets optimisé pour la visibilité PWA */}
            <div className="flex bg-stone-200/50 p-1.5 rounded-[2rem] border border-stone-200 mx-1">
                <TabButton active={activeTab === 'live'} onClick={() => handleTabChange('live')} icon={<Activity size={20} />} label="Live" color="amber" />
                <TabButton active={activeTab === 'tactics'} onClick={() => handleTabChange('tactics')} icon={<Target size={20} />} label="Tactique" color="emerald" />
                <TabButton active={activeTab === 'activity'} onClick={() => handleTabChange('activity')} icon={<ScrollText size={20} />} label="Actu" color="indigo" />
                <TabButton active={activeTab === 'experience'} onClick={() => handleTabChange('experience')} icon={<Trophy size={20} />} label="Exp" color="rose" />
            </div>

            <main className="px-0">
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
                        <ProgressionHeader 
                            sessions={sessions} 
                            currentUserId={currentUserId} 
                            userName={userName} 
                            lastXpGain={userProfile?.lastXpGain} 
                            lastXpYear={userProfile?.lastXpYear}
                        />
                        <TrophiesSection sessions={sessions} currentUserId={currentUserId} />
                    </div>
                )}
            </main>
        </div>
    );
};

const ProgressionHeader: React.FC<any> = ({ sessions, currentUserId, userName, lastXpGain, lastXpYear }) => {
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
            />
            
            <div className="mt-4 bg-emerald-50/50 rounded-2xl p-4 border border-emerald-100 flex justify-between items-center">
                <div>
                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block">Assiduité Saison</span>
                    <span className="text-xl font-black text-emerald-800">{stats.weeksWithStreak} Semaines</span>
                </div>
                <Flame size={24} className="text-emerald-500 fill-emerald-500/20" />
            </div>
        </div>
    );
};

const TrophiesSection: React.FC<any> = ({ sessions, currentUserId }) => (
    <div className="bg-white rounded-[2.5rem] p-8 border border-stone-100 shadow-organic space-y-8 mx-1">
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
        // Michael : Couleurs plus vives et contrastées pour une lecture en extérieur
        amber: active ? "bg-white text-amber-600 shadow-md scale-105" : "text-stone-500 hover:text-stone-700",
        emerald: active ? "bg-white text-emerald-600 shadow-md scale-105" : "text-stone-500 hover:text-stone-700",
        indigo: active ? "bg-white text-indigo-600 shadow-md scale-105" : "text-stone-500 hover:text-stone-700",
        rose: active ? "bg-white text-rose-600 shadow-md scale-105" : "text-stone-500 hover:text-stone-700",
    };
    return (
        <button 
            onClick={onClick} 
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-2xl text-[11px] font-black uppercase tracking-tighter transition-all duration-300 ${themes[color]}`}
        >
            {icon} 
            <span className="text-[9px] font-black leading-none">{label}</span>
        </button>
    );
};

export default Dashboard;