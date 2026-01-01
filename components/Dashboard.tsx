// components/Dashboard.tsx - Version 8.1 (Zero-Standard & No-Surcharge)

import React, { useState, useMemo, useEffect } from 'react';
import { 
    Clock, Trophy, Users, User as UserIcon, Flame, MapPin, ChevronDown 
} from 'lucide-react';
import { Session, RefLureType, RefColor, Location, WeatherSnapshot } from '../types';
import SessionCard from './SessionCard';
import SessionDetailModal from './SessionDetailModal';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import { useCurrentConditions } from '../lib/hooks';
import { RecordsGrid } from './RecordsGrid';
import { buildUserHistory, getNextLevelCap } from '../lib/gamification';
import { fetchUniversalWeather } from '../lib/universal-weather-service';
import { OracleDataPoint } from '../lib/oracle-service'; 
import OracleHero from './OracleHero';
import { WEATHER_METADATA, HYDRO_METADATA } from '../constants/indicators';

import { 
    getWindDir, getWeatherIcon, getTileTheme,
    SpeciesScore, SpeciesScoreGrid, DataTile, 
    ActivityIcon, CloudIcon, WindIcon, DropletsIcon, GaugeIcon, ThermometerIcon 
} from './DashboardWidgets';

const SPECIES_CONFIG: Record<string, { label: string; key: string; hexColor: string }> = {
    'Sandre': { label: 'Sandre', key: 'sandre', hexColor: '#f59e0b' },
    'Brochet': { label: 'Brochet', key: 'brochet', hexColor: '#10b981' },
    'Perche': { label: 'Perche', key: 'perche', hexColor: '#f43f5e' },
    'Black-Bass': { label: 'Black-Bass', key: 'blackbass', hexColor: '#8b5cf6' },
    'Silure': { label: 'Silure', key: 'silure', hexColor: '#4b5563' }, 
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
    activeLocationId: string;
    setActiveLocationId: (id: string) => void;
    oraclePoints: OracleDataPoint[];
    isOracleLoading: boolean;
}

const Dashboard: React.FC<DashboardProps> = (props) => {
    const { 
        sessions, currentUserId, locations, 
        activeLocationId, setActiveLocationId, oraclePoints, isOracleLoading,
        onDeleteSession, onEditSession
    } = props;

    // Conditions de base (Cache Nanterre)
    const { weather: baseWeather, hydro: baseHydro, isLoading: isBaseLoading } = useCurrentConditions();
    
    const [displayedWeather, setDisplayedWeather] = useState<WeatherSnapshot | null>(null);
    const [isWeatherLoading, setIsWeatherLoading] = useState(false);
    const [selectedSession, setSelectedSession] = useState<Session | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [sessionIdToDelete, setSessionIdToDelete] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const uniqueLocationsMap = useMemo(() => {
        const map = new Map<string, Location>();
        locations.forEach(l => { if (l.id && !map.has(l.id)) map.set(l.id, l); });
        return map;
    }, [locations]);

    const uniqueLocationsList = useMemo(() => Array.from(uniqueLocationsMap.values()), [uniqueLocationsMap]);
    
    // On prend le secteur par défaut de l'utilisateur ou le premier trouvé
    const defaultLocation = useMemo(() => 
        uniqueLocationsList.find((l: any) => l.isDefault === true) || uniqueLocationsList[0]
    , [uniqueLocationsList]);

    const availableLocations = useMemo(() => {
        const final: Location[] = [];
        const seen = new Set<string>();
        if (defaultLocation) { final.push(defaultLocation); seen.add(defaultLocation.id); }
        uniqueLocationsList.filter(l => l.active && l.isFavorite).forEach(fav => {
            if (final.length < 4 && !seen.has(fav.id)) { final.push(fav); seen.add(fav.id); }
        });
        return final;
    }, [uniqueLocationsList, defaultLocation]);

    useEffect(() => { if (!activeLocationId && defaultLocation) setActiveLocationId(defaultLocation.id); }, [defaultLocation, activeLocationId]);

    const targetLocation = useMemo(() => uniqueLocationsMap.get(activeLocationId) || defaultLocation || null, [uniqueLocationsMap, activeLocationId, defaultLocation]);

    // Extraction exclusive de l'Oracle Live (plus de surcharge via sessions[0])
    const liveOraclePoint = useMemo(() => {
        if (!oraclePoints || !oraclePoints.length) return null;
        const nowTs = Date.now();
        return oraclePoints.reduce((prev, curr) => Math.abs(curr.timestamp - nowTs) < Math.abs(prev.timestamp - nowTs) ? curr : prev);
    }, [oraclePoints]);

    useEffect(() => {
        const updateWeather = async () => {
            if (!targetLocation) return;
            setIsWeatherLoading(true);
            const customData = await fetchUniversalWeather(targetLocation.coordinates!.lat, targetLocation.coordinates!.lng);
            setDisplayedWeather(customData);
            setIsWeatherLoading(false);
        };
        updateWeather();
    }, [activeLocationId, targetLocation]);

    const isLoading = isBaseLoading || isWeatherLoading || isOracleLoading;

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            <ProgressionHeader sessions={sessions} currentUserId={currentUserId} />
            <OracleHero locations={uniqueLocationsList} />

            <LiveStatusSection 
                activeLocationId={activeLocationId}
                setActiveLocationId={setActiveLocationId}
                availableLocations={availableLocations}
                targetLocation={targetLocation}
                // Plus de fallback sessions[0] ici pour éviter l'écart 99 vs 22 trompeur
                liveScores={liveOraclePoint} 
                displayedWeather={displayedWeather}
                isLoading={isLoading}
                baseHydro={baseHydro}
                liveOraclePoint={liveOraclePoint}
            />

            <TrophiesSection sessions={sessions} currentUserId={currentUserId} />
            <ActivityFeed sessions={sessions} currentUserId={currentUserId} onDelete={(id: string) => { setSessionIdToDelete(id); setIsDeleteConfirmOpen(true); }} onEdit={onEditSession} onSelect={(s: Session) => { setSelectedSession(s); setIsDetailOpen(true); }} deletingId={deletingId} />
            <SessionDetailModal session={selectedSession} isOpen={isDetailOpen} onClose={() => setIsDetailOpen(false)} />
            <DeleteConfirmDialog isOpen={isDeleteConfirmOpen} onClose={() => { setIsDeleteConfirmOpen(false); setSessionIdToDelete(null); }} onConfirm={() => { if (sessionIdToDelete) { setIsDeleteConfirmOpen(false); setDeletingId(sessionIdToDelete); setTimeout(() => { onDeleteSession(sessionIdToDelete); setDeletingId(null); setSessionIdToDelete(null); }, 300); } }} />
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
        <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4 relative z-10">
                <div>
                    <div className="flex items-center space-x-2 mb-1">
                        <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-500 text-[10px] font-bold tracking-wider uppercase">Saison {currentYear}</span>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 text-[10px] font-bold tracking-wider uppercase flex items-center"><Flame size={10} className="mr-1" />{stats.weeksWithStreak} Semaines validées</span>
                    </div>
                    <h2 className="text-2xl font-black text-stone-800">Niveau {stats.levelReached}</h2>
                    <p className="text-sm text-stone-500 font-medium">{stats.xpTotal.toLocaleString()} XP <span className="text-stone-300">/ {nextXP.toLocaleString()} XP</span></p>
                </div>
                <div className="hidden md:block text-right"><div className="text-xs font-bold text-stone-400 uppercase tracking-widest">Performance</div><div className="text-stone-800 font-bold">{stats.fishCount} Poissons / {stats.sessionCount} Sorties</div></div>
            </div>
            <div className="h-3 w-full bg-stone-100 rounded-full overflow-hidden relative z-10"><div className="h-full bg-gradient-to-r from-amber-300 via-orange-400 to-rose-500 transition-all duration-1000 ease-out" style={{ width: `${progress}%` }} /></div>
        </div>
    );
};

const LiveStatusSection: React.FC<any> = ({ 
    activeLocationId, setActiveLocationId, availableLocations, targetLocation,
    liveScores, displayedWeather, isLoading, baseHydro, liveOraclePoint
}) => {
    const isRiver = targetLocation?.morphology?.typeId === 'Z_RIVER';
    const activeSpeciesList = targetLocation?.morphology?.speciesIds || ['Sandre', 'Brochet', 'Perche'];

    const getVal = (key: string) => {
        if (!displayedWeather && !liveOraclePoint) return '--';
        switch(key) {
            case 'tempAir': return displayedWeather ? Math.round(displayedWeather.temperature) : '--';
            case 'pressure': return displayedWeather ? Math.round(displayedWeather.pressure) : '--';
            case 'wind': return displayedWeather ? Math.round(displayedWeather.windSpeed) : '--';
            case 'clouds': return displayedWeather ? Math.round(displayedWeather.clouds) : '--';
            case 'precip': return displayedWeather ? displayedWeather.precip.toFixed(1) : '--';
            case 'waterTemp': return liveOraclePoint?.waterTemp ? Number(liveOraclePoint.waterTemp).toFixed(1) : '--';
            case 'turbidity': return liveOraclePoint?.turbidityNTU ? liveOraclePoint.turbidityNTU.toFixed(1) : '--';
            case 'oxygen': return liveOraclePoint?.dissolvedOxygen ? liveOraclePoint.dissolvedOxygen.toFixed(1) : '--';
            case 'waves': return liveOraclePoint?.waveHeight !== undefined ? liveOraclePoint.waveHeight.toFixed(1) : '--';
            case 'flowIndex': return liveOraclePoint?.flowRaw !== undefined ? Math.round(liveOraclePoint.flowRaw) : '--';
            // Flux réel Hubeau (Seine uniquement)
            case 'flow': return isRiver && baseHydro?.flowLagged !== undefined ? Math.round(baseHydro.flowLagged) : null;
            case 'level': return isRiver && baseHydro?.level !== undefined ? Math.round(baseHydro.level) : null;
            default: return '--';
        }
    };

    return (
        <div className="bg-white rounded-[2rem] p-1 shadow-organic border border-stone-100 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -mr-10 -mt-10"></div>
            <div className="p-6 relative z-10">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                    <h3 className="text-lg font-bold text-stone-800 flex items-center gap-2"><ActivityIcon /> Météo & Hydro Live</h3>
                    <div className="relative w-full sm:w-auto min-w-[200px]">
                        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-stone-400"><MapPin size={16} /></div>
                        <select value={activeLocationId} onChange={(e) => setActiveLocationId(e.target.value)} className="appearance-none w-full bg-stone-50 border border-stone-200 text-stone-700 font-bold text-sm rounded-2xl py-3 pl-10 pr-10 focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer shadow-sm hover:bg-stone-100">
                            {availableLocations.map((loc: Location) => (<option key={loc.id} value={loc.id}>{loc.label} {(loc as any).isDefault ? '(Défaut)' : ''}</option>))}
                        </select>
                        <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-stone-400"><ChevronDown size={16} strokeWidth={3} /></div>
                    </div>
                </div>

                <SpeciesScoreGrid>
                    {activeSpeciesList.map((speciesId: string) => {
                        const config = SPECIES_CONFIG[speciesId] || { label: speciesId, key: speciesId.toLowerCase(), hexColor: '#a8a29e' };
                        const scoreValue = liveScores ? (liveScores as any)[config.key] : undefined;
                        return <SpeciesScore key={speciesId} label={config.label} score={scoreValue} hexColor={config.hexColor} loading={isLoading} />;
                    })}
                </SpeciesScoreGrid>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-8">
                    {Object.entries(WEATHER_METADATA).map(([key, meta]) => {
                        const val = getVal(key);
                        let unit = meta.unit;
                        if (key === 'wind' && displayedWeather) unit = ` km/h ${getWindDir(displayedWeather.windDirection)}`;
                        return <DataTile key={key} label={meta.label} value={val} unit={unit} icon={key === 'tempAir' && displayedWeather ? getWeatherIcon(displayedWeather.clouds) : <meta.icon size={16} />} color={getTileTheme(meta.theme)} loading={isLoading} description={meta.description} />;
                    })}
                    {Object.entries(HYDRO_METADATA).map(([key, meta]) => {
                        const val = getVal(key);
                        if (val === null) return null;
                        if (key === 'flowIndex' && !isRiver) return null;
                        return <DataTile key={key} label={meta.label} value={val} unit={meta.unit} icon={<meta.icon size={16} />} color={getTileTheme(meta.theme)} loading={isLoading} description={meta.description} />;
                    })}
                </div>
            </div>
        </div>
    );
};

const TrophiesSection: React.FC<any> = ({ sessions, currentUserId }) => (
    <div className="bg-white rounded-[2.5rem] p-8 border border-stone-100 shadow-organic space-y-8">
        <div className="flex items-center justify-between mb-2"><h3 className="font-black text-stone-800 flex items-center gap-2"><Trophy className="text-amber-500" size={20} /> Vos Trophées</h3><span className="text-[9px] font-black bg-stone-100 text-stone-400 px-2 py-1 rounded-full uppercase tracking-tighter">Performance</span></div>
        <RecordsGrid sessions={sessions.filter((s: any) => s.userId === currentUserId && new Date(s.date).getFullYear() === new Date().getFullYear())} title={`Saison ${new Date().getFullYear()}`} />
        <RecordsGrid sessions={sessions.filter((s: any) => s.userId === currentUserId)} title="Hall of Fame" isGold={true} />
    </div>
);

const ActivityFeed: React.FC<any> = ({ sessions, currentUserId, onDelete, onEdit, onSelect, deletingId }) => {
    const [filter, setFilter] = useState<'all' | 'my'>('my');
    const filtered = useMemo(() => (filter === 'my' ? sessions.filter((s: any) => s.userId === currentUserId) : sessions).slice(0, 5), [sessions, filter, currentUserId]);
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
                <h3 className="text-stone-800 font-bold text-lg flex items-center gap-2"><Clock size={20} className="text-stone-400" /> Fil d'Actualité</h3>
                <div className="flex bg-stone-100 p-1 rounded-xl border border-stone-200 shadow-inner">
                    <button onClick={() => setFilter('all')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${filter === 'all' ? 'bg-white text-amber-600 shadow-sm' : 'text-stone-400'}`}><Users size={12} /> TOUS</button>
                    <button onClick={() => setFilter('my')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${filter === 'my' ? 'bg-white text-amber-600 shadow-sm' : 'text-stone-400'}`}><UserIcon size={12} /> MES SESSIONS</button>
                </div>
            </div>
            <div className="space-y-4">
                {filtered.map((s: any) => (
                    <div key={s.id} className={`transition-all duration-300 transform ${deletingId === s.id ? 'opacity-0 scale-95 -translate-y-4 pointer-events-none' : 'opacity-100 scale-100'}`}>
                        <SessionCard session={s} onDelete={onDelete} onEdit={onEdit} onClick={onSelect} currentUserId={currentUserId} />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Dashboard;