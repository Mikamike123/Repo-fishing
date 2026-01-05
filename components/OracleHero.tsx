// components/OracleHero.tsx - Version 10.0.0 (Night Ops & Prop Sync)
import React, { useState, useEffect, useMemo } from 'react';
import { ChevronDown, Zap, Calendar, MapPin, BarChart2, Target, Plus } from 'lucide-react';
import OracleChart, { ChartMode, TargetSpecies } from './OracleChart';
import { fetchOracleChartData } from '../lib/oracle-service';
import { Location, OracleDataPoint } from '../types';

interface OracleHeroProps {
    locations: Location[];
    // Données Live injectées depuis le Dashboard (Source de vérité)
    dataPoints?: OracleDataPoint[];
    isLoading?: boolean;
    // Pilotage du secteur global
    activeLocationId?: string;
    onLocationChange?: (id: string) => void;
    isActuallyNight?: boolean; // Michael : Raccordement au pilier V8.0
}

const OracleHero: React.FC<OracleHeroProps> = ({ 
    locations, 
    dataPoints, 
    isLoading,
    activeLocationId,
    onLocationChange,
    isActuallyNight // Michael : Activation du thème furtif
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [internalLoading, setInternalLoading] = useState(false);
    
    // États de sélection
    const [mode, setMode] = useState<ChartMode>('single');
    const [targetSpecies, setTargetSpecies] = useState<TargetSpecies>('sandre'); 
    
    // Cache interne pour le mode comparatif uniquement
    const [cache, setCache] = useState<Record<string, OracleDataPoint[]>>({});

    // --- HELPER : NORMALISATION COORDONNÉES ---
    const getSafeCoordinates = (loc: any) => {
        if (loc.coordinates && typeof loc.coordinates.lat === 'number') {
            return loc.coordinates;
        }
        if (loc.coordinates && loc.coordinates.coordinates && typeof loc.coordinates.coordinates.lat === 'number') {
            return loc.coordinates.coordinates;
        }
        return null;
    };

    // --- 1. GESTION DES FAVORIS (DÉDOUBLONNAGE) ---
    const validLocations = useMemo(() => {
        const withCoords = locations.filter(l => getSafeCoordinates(l) !== null);
        const map = new Map();
        withCoords.forEach(l => {
            if (!map.has(l.id)) map.set(l.id, l);
        });
        return Array.from(map.values()) as Location[];
    }, [locations]);

    const favorites = useMemo(() => {
        const favs = validLocations.filter((l: any) => l.isFavorite === true);
        return favs.length > 0 ? favs.slice(0, 3) : validLocations.slice(0, 3);
    }, [validLocations]);

    // Détermination de l'ID effectif (Prop ou fallback premier favori)
    const effectiveLocId = activeLocationId || (favorites.length > 0 ? favorites[0].id : '');
    
    // Michael : Récupération du secteur sélectionné pour accéder à sa config d'espèces
    const selectedLocation = useMemo(() => 
        validLocations.find(l => l.id === effectiveLocId)
    , [validLocations, effectiveLocId]);

    // Michael : Détermination des clés de données autorisées (ex: 'brochet') basées sur speciesIds (ex: 'Brochet')
    const allowedKeys = useMemo(() => {
        if (!selectedLocation?.speciesIds || selectedLocation.speciesIds.length === 0) {
            return ['sandre', 'brochet', 'perche']; // Fallback historique
        }
        const mapping: Record<string, string> = {
            'Sandre': 'sandre',
            'Brochet': 'brochet',
            'Perche': 'perche',
            'Black-Bass': 'blackbass'
        };
        return selectedLocation.speciesIds.map(id => mapping[id] || id.toLowerCase());
    }, [selectedLocation]);

    // --- 2. CHARGEMENT DES DONNÉES (INTERNE POUR COMPARATIF) ---
    const loadData = async (locsToLoad: Location[]) => {
        setInternalLoading(true);
        const newCache = { ...cache };
        
        await Promise.all(locsToLoad.map(async (loc) => {
            if (newCache[loc.id]) return;

            const coords = getSafeCoordinates(loc);
            if (coords) {
                try {
                    const points = await fetchOracleChartData(
                        coords.lat, 
                        coords.lng,
                        loc.morphology
                    );
                    newCache[loc.id] = points;
                } catch (e) {
                    console.error(`Erreur Oracle pour ${loc.name}`, e);
                }
            }
        }));

        setCache(newCache);
        setInternalLoading(false);
    };

    useEffect(() => {
        if (mode === 'compare' && isExpanded) loadData(favorites);
    }, [mode, favorites, isExpanded]);

    // --- 3. PRÉPARATION DONNÉES GRAPHIQUE ---
    const formattedChartData = useMemo(() => {
        if (mode === 'single') {
            if (dataPoints && dataPoints.length > 0) {
                return dataPoints.map(pt => {
                    // Michael : On prépare l'objet de base avec les métadonnées
                    const filteredPoint: any = {
                        time: pt.timestamp,
                        dissolvedOxygen: pt.dissolvedOxygen,
                        turbidityNTU: pt.turbidityNTU,
                        waterTemp: pt.waterTemp
                    };
                    
                    // Michael : On n'injecte que les scores autorisés par la config du secteur
                    allowedKeys.forEach(key => {
                        if ((pt as any)[key] !== undefined) {
                            filteredPoint[key] = (pt as any)[key];
                        }
                    });
                    
                    return filteredPoint;
                });
            }
            return [];
        } else {
            // Mode Comparatif (Basé sur le cache interne)
            const baseData = cache[favorites[0]?.id];
            if (!baseData) return [];

            return baseData.map((pt, index) => {
                const mergedPoint: any = { time: pt.timestamp };
                favorites.forEach(loc => {
                    const locData = cache[loc.id];
                    if (locData && locData[index]) {
                        const baseLabel = (loc as any).label || loc.name || 'Secteur';
                        const uniqueKey = `${baseLabel} (${loc.id.substring(0, 3)})`;
                        mergedPoint[uniqueKey] = (locData[index] as any)[targetSpecies];
                    }
                });
                return mergedPoint;
            });
        }
    }, [mode, cache, favorites, targetSpecies, dataPoints, allowedKeys]);

    // --- 4. TEXTES DYNAMIQUES ---
    const selectedCoords = selectedLocation ? getSafeCoordinates(selectedLocation) : null;
    const selectedLocName = selectedLocation 
        ? ((selectedLocation as any).label || selectedLocation.name) 
        : 'Secteur Inconnu';

    const chartTitle = mode === 'single' 
        ? `ORACLE : ${selectedLocName.toUpperCase()}`
        : `COMPARATIF : ${targetSpecies.toUpperCase()}`;
    
    const chartSubTitle = mode === 'single'
        ? 'Analyse Bio-Halieutique (72h)'
        : `Comparaison de l'activité sur ${favorites.length} secteurs`;

    const summaryInfo = useMemo(() => {
        const currentData = (mode === 'single' && dataPoints && dataPoints.length > 0) ? dataPoints : cache[effectiveLocId];
        
        if (!currentData || currentData.length === 0) return null;
        
        const now = Date.now();
        const current = currentData.reduce((prev, curr) => 
            Math.abs(curr.timestamp - now) < Math.abs(prev.timestamp - now) ? curr : prev
        );

        // Michael : On filtre la liste des scores pour la synthèse en haut à gauche
        const scores = [
            { name: 'Sandre', score: current.sandre, key: 'sandre' },
            { name: 'Brochet', score: current.brochet, key: 'brochet' },
            { name: 'Perche', score: current.perche, key: 'perche' },
            { name: 'Black-Bass', score: current.blackbass || 0, key: 'blackbass' }
        ].filter(s => allowedKeys.includes(s.key)); // FILTRAGE ICI

        return scores.sort((a, b) => b.score - a.score)[0];
    }, [cache, effectiveLocId, dataPoints, mode, allowedKeys]);

    if (validLocations.length === 0) return null;

    const effectiveLoading = isLoading || internalLoading;

    // Styles dynamiques V8.0 Soft Night Ops
    const containerBg = isActuallyNight ? "bg-[#1c1917] border-stone-800 shadow-none" : "bg-white border-stone-100 shadow-sm";
    const titleColor = isActuallyNight ? "text-stone-100" : "text-stone-800";
    const subTitleColor = isActuallyNight ? "text-stone-400" : "text-stone-500";
    const pillBg = isActuallyNight ? "bg-stone-900 border-stone-800 text-stone-400" : "bg-white border-stone-100 text-stone-500";
    const activePillBg = isActuallyNight ? "bg-indigo-900/40 text-indigo-300 border-indigo-800 shadow-none" : "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200";

    return (
        <div className={`mb-4 rounded-2xl p-0.5 border overflow-hidden transition-all duration-300 ${containerBg}`}>
            {/* HEADER CLIQUABLE */}
            <div 
                className="p-3 flex items-center justify-between cursor-pointer active:scale-[0.99] transition-transform"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-4 flex-1">
                    <div className={`p-3 rounded-2xl text-white shadow-lg transition-colors ${
                        mode === 'compare' 
                            ? 'bg-gradient-to-br from-indigo-500 to-purple-600 shadow-indigo-200/20' 
                            : 'bg-indigo-600 shadow-indigo-100/20'
                    }`}>
                        {mode === 'compare' ? <BarChart2 size={24} /> : <Zap size={24} />}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className={`text-lg font-black leading-none tracking-tight ${titleColor}`}>
                                {mode === 'compare' ? 'COMPARATIF' : 'ORACLE 72H'}
                            </h2>
                            {isExpanded && favorites.length > 1 && (
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setMode(mode === 'single' ? 'compare' : 'single');
                                    }}
                                    className={`text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-wide transition-colors border ${
                                        isActuallyNight 
                                            ? 'bg-stone-800 border-stone-700 text-stone-400 hover:bg-stone-700' 
                                            : 'bg-stone-100 border-stone-200 text-stone-500 hover:bg-stone-200'
                                    }`}
                                >
                                    {mode === 'single' ? 'Comparer' : 'Vue Secteur'}
                                </button>
                            )}
                        </div>
                        
                        {effectiveLoading && !summaryInfo ? (
                             <div className={`h-3 w-24 rounded animate-pulse mt-2 ${isActuallyNight ? 'bg-stone-800' : 'bg-stone-100'}`}></div>
                        ) : (
                            <div className={`flex items-center gap-1 mt-1 text-sm font-medium ${subTitleColor}`}>
                                {mode === 'single' ? (
                                    <>
                                        <MapPin size={12} className="opacity-60" />
                                        <span className="truncate max-w-[150px]">{selectedLocName}</span>
                                        {summaryInfo && (
                                            <span className={`font-bold ml-1 px-1.5 rounded text-xs ${
                                                isActuallyNight ? 'bg-indigo-950/30 text-indigo-300' : 'bg-indigo-50 text-indigo-600'
                                            }`}>
                                                {summaryInfo.name} {summaryInfo.score.toFixed(0)}%
                                            </span>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <Target size={12} className="opacity-60" />
                                        <span>Cible : <span className={`uppercase font-bold ${isActuallyNight ? 'text-stone-200' : 'text-stone-800'}`}>{targetSpecies}</span></span>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className={`p-2 rounded-full transition-transform duration-300 ${
                    isActuallyNight ? 'bg-stone-800 text-stone-500' : 'bg-stone-50 text-stone-400'
                } ${isExpanded ? 'rotate-180' : ''}`}>
                    <ChevronDown size={20} />
                </div>
            </div>

            {/* CONTENU DÉPLIABLE */}
            {isExpanded && (
                <div className="px-1 pb-2 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className={`h-px w-full bg-gradient-to-r from-transparent to-transparent my-2 ${
                        isActuallyNight ? 'via-stone-800' : 'via-stone-200'
                    }`}></div>
                    
                    {/* CONTROLS (PILLS FIXES) */}
                    {mode === 'single' && favorites.length > 1 && (
                        <div className="flex overflow-x-auto gap-2 mb-4 pb-1 scrollbar-hide">
                            {favorites.map(loc => {
                                const pillLabel = (loc as any).label || loc.name || 'Secteur';
                                const isActive = effectiveLocId === loc.id;
                                return (
                                    <button
                                        key={loc.id}
                                        onClick={() => onLocationChange && onLocationChange(loc.id)}
                                        className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                                            isActive ? activePillBg : pillBg
                                        }`}
                                    >
                                        {pillLabel}
                                    </button>
                                )
                            })}
                        </div>
                    )}

                    {mode === 'compare' && (
                        <div className={`flex gap-2 mb-4 justify-center p-1.5 rounded-xl border w-fit mx-auto overflow-x-auto max-w-full ${
                            isActuallyNight ? 'bg-stone-900 border-stone-800' : 'bg-stone-50 border-stone-100'
                        }`}>
                            {(['sandre', 'brochet', 'perche', 'blackbass'] as TargetSpecies[]).map(species => (
                                <button
                                    key={species}
                                    onClick={() => setTargetSpecies(species)}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase transition-all whitespace-nowrap ${
                                        targetSpecies === species
                                            ? (isActuallyNight ? 'bg-stone-800 text-stone-100 shadow-sm border-stone-700 transform scale-105' : 'bg-white text-stone-800 shadow-sm border border-stone-200 transform scale-105')
                                            : (isActuallyNight ? 'text-stone-500 hover:text-stone-400' : 'text-stone-400 hover:text-stone-600')
                                    }`}
                                >
                                    {species}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="flex justify-between items-center px-1 mb-2">
                        <span className="text-[10px] font-bold tracking-widest text-stone-500 uppercase">H -12h</span>
                        <div className={`h-px flex-1 mx-4 ${isActuallyNight ? 'bg-stone-800' : 'bg-stone-100'}`}></div>
                        <span className={`text-[10px] font-bold tracking-widest uppercase flex items-center gap-1 ${isActuallyNight ? 'text-indigo-400' : 'text-indigo-500'}`}>
                            <Calendar size={10} /> H +72h
                        </span>
                    </div>

                    <div className="w-full">
                        <OracleChart 
                            date={new Date()}
                            lat={selectedCoords?.lat}
                            lng={selectedCoords?.lng}
                            externalData={formattedChartData}
                            title={chartTitle}
                            subTitle={chartSubTitle}
                            isActuallyNight={isActuallyNight} // Michael : On transmet la nuit au graphique final
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default OracleHero;