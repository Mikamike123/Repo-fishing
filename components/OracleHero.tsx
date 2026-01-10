// components/OracleHero.tsx - Version 17.0.0
// Michael : Restauration accès Comparer et filtrage intelligent des espèces.

import React, { useState, useEffect, useMemo } from 'react';
import { ChevronDown, Zap, MapPin, BarChart2, Target, ShieldCheck } from 'lucide-react';
import OracleChart, { ChartMode, TargetSpecies } from './OracleChart';
import { fetchOracleChartData } from '../lib/oracle-service';
import { Location, OracleDataPoint } from '../types';

interface OracleHeroProps {
    locations: Location[];
    dataPoints?: OracleDataPoint[];
    isLoading?: boolean;
    activeLocationId?: string;
    onLocationChange?: (id: string) => void;
    isActuallyNight?: boolean; 
}

const OracleHero: React.FC<OracleHeroProps> = ({ 
    locations, 
    dataPoints, 
    isLoading,
    activeLocationId,
    onLocationChange,
    isActuallyNight 
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [internalLoading, setInternalLoading] = useState(false);
    const [mode, setMode] = useState<ChartMode>('single');
    const [targetSpecies, setTargetSpecies] = useState<TargetSpecies>('sandre'); 
    const [cache, setCache] = useState<Record<string, OracleDataPoint[]>>({});

    const calculateConfidence = (timestamp: number): number => {
        const now = Date.now();
        const diffHours = (timestamp - now) / (1000 * 3600);
        if (diffHours <= 0) return 100;
        if (diffHours <= 48) return 100 - (diffHours * 0.1);
        if (diffHours <= 120) return 95 - ((diffHours - 48) * 0.3);
        return Math.max(40, Math.round(74 - ((diffHours - 120) * 0.15)));
    };

    const getSafeCoordinates = (loc: any) => {
        if (loc.coordinates && typeof loc.coordinates.lat === 'number') return loc.coordinates;
        if (loc.coordinates && loc.coordinates.coordinates && typeof loc.coordinates.coordinates.lat === 'number') return loc.coordinates.coordinates;
        return null;
    };

    const getSpeciesKeys = (loc: Location) => {
        if (!loc?.speciesIds || loc.speciesIds.length === 0) return ['sandre', 'brochet', 'perche', 'blackbass'];
        const mapping: Record<string, string> = { 'Sandre': 'sandre', 'Brochet': 'brochet', 'Perche': 'perche', 'Black-Bass': 'blackbass' };
        return loc.speciesIds.map(id => mapping[id] || id.toLowerCase());
    };

    const validLocations = useMemo(() => {
        const withCoords = locations.filter(l => getSafeCoordinates(l) !== null);
        const map = new Map();
        withCoords.forEach(l => { if (!map.has(l.id)) map.set(l.id, l); });
        return Array.from(map.values()) as Location[];
    }, [locations]);

    const favorites = useMemo(() => {
        const favs = validLocations.filter((l: any) => l.isFavorite === true);
        return favs.length > 0 ? favs.slice(0, 3) : validLocations.slice(0, 3);
    }, [validLocations]);

    const effectiveLocId = activeLocationId || (favorites.length > 0 ? favorites[0].id : '');
    const selectedLocation = useMemo(() => validLocations.find(l => l.id === effectiveLocId), [validLocations, effectiveLocId]);

    const loadData = async (locsToLoad: Location[]) => {
        setInternalLoading(true);
        const newCache = { ...cache };
        await Promise.all(locsToLoad.map(async (loc) => {
            if (newCache[loc.id]) return;
            const coords = getSafeCoordinates(loc);
            if (coords) {
                try {
                    const points = await fetchOracleChartData(coords.lat, coords.lng, loc.morphology);
                    newCache[loc.id] = points;
                } catch (e) { console.error(`Erreur Oracle pour ${loc.label || loc.name}`, e); }
            }
        }));
        setCache(newCache);
        setInternalLoading(false);
    };

    useEffect(() => { if (mode === 'compare' && isExpanded) loadData(favorites); }, [mode, favorites, isExpanded]);

    const formattedChartData = useMemo(() => {
        if (mode === 'single') {
            if (!dataPoints || !selectedLocation) return [];
            const allowed = getSpeciesKeys(selectedLocation);
            return dataPoints.map(pt => {
                const filtered: any = { time: pt.timestamp, waterTemp: pt.waterTemp, dissolvedOxygen: pt.dissolvedOxygen, turbidityNTU: pt.turbidityNTU, confidence: calculateConfidence(pt.timestamp) };
                allowed.forEach(k => { if ((pt as any)[k] !== undefined) filtered[k] = (pt as any)[k]; });
                return filtered;
            });
        } else {
            const baseData = cache[favorites[0]?.id];
            if (!baseData) return [];
            return baseData.map((pt, index) => {
                const mergedPoint: any = { time: pt.timestamp, confidence: calculateConfidence(pt.timestamp) };
                favorites.forEach(loc => {
                    const locData = cache[loc.id];
                    if (locData && locData[index]) {
                        const baseLabel = (loc as any).label || loc.name || 'Secteur';
                        const uniqueKey = `${baseLabel} (${loc.id.substring(0, 3)})`;
                        mergedPoint[uniqueKey] = (locData[index] as any)[targetSpecies];
                        mergedPoint[`${uniqueKey}_waterTemp`] = locData[index].waterTemp;
                        mergedPoint[`${uniqueKey}_dissolvedOxygen`] = locData[index].dissolvedOxygen;
                        mergedPoint[`${uniqueKey}_turbidityNTU`] = locData[index].turbidityNTU;
                    }
                });
                return mergedPoint;
            });
        }
    }, [mode, cache, favorites, targetSpecies, dataPoints, selectedLocation]);

    const containerBg = isActuallyNight ? "bg-[#1c1917] border-stone-800 shadow-none" : "bg-white border-stone-100 shadow-sm";
    const titleColor = isActuallyNight ? "text-stone-100" : "text-stone-800";
    const subTitleColor = isActuallyNight ? "text-stone-400" : "text-stone-500";

    return (
        <div className={`mb-4 rounded-2xl p-0.5 border overflow-hidden transition-all duration-300 ${containerBg}`}>
            <div className="p-3 flex items-center justify-between cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="flex items-center gap-4 flex-1">
                    <div className={`p-3 rounded-2xl text-white shadow-lg transition-colors ${mode === 'compare' ? 'bg-gradient-to-br from-indigo-500 to-purple-600' : 'bg-indigo-600'}`}>
                        {mode === 'compare' ? <BarChart2 size={24} /> : <Zap size={24} />}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className={`text-lg font-black leading-none tracking-tight ${titleColor}`}>{mode === 'compare' ? 'COMPARATIF' : 'ORACLE PRO'}</h2>
                            {isExpanded && favorites.length > 1 && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setMode(mode === 'single' ? 'compare' : 'single'); }}
                                    className={`text-[10px] px-3 py-1 rounded-full font-bold uppercase border ${isActuallyNight ? 'bg-stone-800 border-stone-700 text-stone-400' : 'bg-stone-100 border-stone-200 text-stone-500'}`}
                                >
                                    {mode === 'single' ? 'Comparer' : 'Secteur'}
                                </button>
                            )}
                        </div>
                        <div className={`flex items-center gap-1 mt-1 text-sm font-medium ${subTitleColor}`}>
                            {mode === 'single' ? (
                                <>
                                    <MapPin size={12} className="opacity-60" />
                                    <span className="truncate max-w-[150px]">{(selectedLocation as any)?.label || selectedLocation?.name}</span>
                                </>
                            ) : (
                                <>
                                    <Target size={12} className="opacity-60" />
                                    <span>Cible : <span className="uppercase font-bold">{targetSpecies}</span></span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
                <div className={`p-2 rounded-full transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''} ${isActuallyNight ? 'bg-stone-800 text-stone-500' : 'bg-stone-50 text-stone-400'}`}><ChevronDown size={20} /></div>
            </div>

            {isExpanded && (
                <div className="px-1 pb-2 animate-in fade-in slide-in-from-top-2">
                    <div className={`h-px w-full my-2 ${isActuallyNight ? 'bg-stone-800' : 'bg-stone-200'}`}></div>
                    
                    {mode === 'single' && favorites.length > 1 && (
                        <div className="flex overflow-x-auto gap-2 mb-4 pb-1 scrollbar-hide px-2">
                            {favorites.map(loc => (
                                <button key={loc.id} onClick={() => onLocationChange && onLocationChange(loc.id)} className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all border ${effectiveLocId === loc.id ? (isActuallyNight ? 'bg-indigo-900/40 text-indigo-300 border-indigo-800' : 'bg-indigo-600 text-white border-indigo-600') : (isActuallyNight ? 'bg-stone-900 text-stone-400 border-stone-800' : 'bg-white text-stone-500 border-stone-100')}`}>
                                    {(loc as any).label || loc.name}
                                </button>
                            ))}
                        </div>
                    )}

                    {mode === 'compare' && (
                        <div className={`flex gap-2 mb-4 justify-center p-1.5 rounded-xl border w-fit mx-auto ${isActuallyNight ? 'bg-stone-900 border-stone-800' : 'bg-stone-50 border-stone-100'}`}>
                            {(['sandre', 'brochet', 'perche', 'blackbass'] as TargetSpecies[]).map(species => (
                                <button key={species} onClick={() => setTargetSpecies(species)} className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${targetSpecies === species ? (isActuallyNight ? 'bg-stone-800 text-stone-100 border-stone-700' : 'bg-white text-stone-800 shadow-sm border border-stone-200') : 'text-stone-400'}`}>
                                    {species}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="w-full">
                        <OracleChart 
                            date={new Date()} 
                            lat={selectedLocation ? getSafeCoordinates(selectedLocation)?.lat : undefined} 
                            lng={selectedLocation ? getSafeCoordinates(selectedLocation)?.lng : undefined} 
                            externalData={formattedChartData} 
                            isActuallyNight={isActuallyNight} 
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default OracleHero;