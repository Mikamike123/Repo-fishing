// components/DashboardLiveTab.tsx - Version 11.0.0 (Consistency & Color Harmonization)
// Michael : Harmonisation couleur Perche (#a855f7) et tri immuable des bioscores.

import React, { useMemo } from 'react';
import OracleHero from './OracleHero';
import { 
    getWindDir, getWeatherIcon, getTileTheme,
    SpeciesScore, SpeciesScoreGrid, DataTile, ActivityIcon 
} from './DashboardWidgets';
import { WEATHER_METADATA, HYDRO_METADATA } from '../constants/indicators';
import { ChevronDown, MapPin } from 'lucide-react';
import { OracleDataPoint } from '../types'; 

// Michael : Harmonisation des couleurs avec OracleChart
const SPECIES_CONFIG: Record<string, { label: string; key: string; hexColor: string }> = {
    'Sandre': { label: 'Sandre', key: 'sandre', hexColor: '#f59e0b' },
    'Brochet': { label: 'Brochet', key: 'brochet', hexColor: '#10b981' },
    'Perche': { label: 'Perche', key: 'perche', hexColor: '#a855f7' }, // Violet Améthyste synchronisé
    'Black-Bass': { label: 'Black-Bass', key: 'blackbass', hexColor: '#6366f1' }, // Indigo synchronisé
    'Silure': { label: 'Silure', key: 'silure', hexColor: '#4b5563' }, 
};

// Michael : Définition de l'ordre d'affichage maître
const SPECIES_MASTER_ORDER = ['Sandre', 'Brochet', 'Perche', 'Black-Bass', 'Silure'];

export const DashboardLiveTab: React.FC<any> = ({ 
    uniqueLocationsList, oracleData, isOracleLoading, activeLocationId, 
    onLocationSelect, displayLocations, targetLocation, displayedWeather, isLoading,
    onLocationClick, activeLocationLabel,
    isActuallyNight 
}) => {
    // Michael : Extraction du point "Maintenant" avec la précision v8.4
    const liveOraclePoint = useMemo(() => {
        if (!oracleData || !oracleData.length) return null;
        const nowTs = Date.now();
        return oracleData.reduce((prev: OracleDataPoint, curr: OracleDataPoint) => 
            Math.abs(curr.timestamp - nowTs) < Math.abs(prev.timestamp - nowTs) ? curr : prev
        );
    }, [oracleData]);

    const isRiver = targetLocation?.morphology?.typeId === 'Z_RIVER' || targetLocation?.morphology?.typeId === 'Z_MED';
    
    // Michael : Application de l'ordre immuable tout en respectant le filtrage par secteur
    const activeSpeciesList = useMemo(() => {
        const sectorSpecies = (targetLocation?.speciesIds && targetLocation.speciesIds.length > 0)
            ? targetLocation.speciesIds
            : ['Sandre', 'Brochet', 'Perche', 'Black-Bass']; // Valeurs par défaut
        
        // On filtre l'ordre maître par les espèces présentes dans le secteur
        return SPECIES_MASTER_ORDER.filter(speciesId => sectorSpecies.includes(speciesId));
    }, [targetLocation]);

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
            default: return '--';
        }
    };

    return (
        <div className="space-y-4 animate-in slide-in-from-left duration-500">
            {/* Oracle Graph 72h */}
            <OracleHero 
                locations={uniqueLocationsList} 
                dataPoints={oracleData} 
                isLoading={isOracleLoading} 
                activeLocationId={activeLocationId} 
                onLocationChange={onLocationSelect}
                isActuallyNight={isActuallyNight}
            />

            {/* Carte principale Live */}
            <div className={`rounded-[2rem] p-1 shadow-organic border overflow-hidden relative mx-2 transition-all duration-500 oracle-card-press ${
                isActuallyNight ? 'bg-[#1c1917] border-stone-800 shadow-none' : 'bg-white border-stone-100'
            }`}>
                <div className="p-6 relative z-10">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                        <h3 className={`text-lg font-bold flex items-center gap-2 ${isActuallyNight ? 'text-stone-100' : 'text-stone-800'}`}>
                            <ActivityIcon /> Météo & Hydro Live
                        </h3>
                        
                        <div className="relative w-full sm:w-auto min-w-[180px] transition-all oracle-btn-press">
                            <select 
                                value={activeLocationId} 
                                onChange={(e) => onLocationSelect(e.target.value)} 
                                className={`appearance-none w-full border font-bold text-xs rounded-xl py-2.5 pl-9 pr-8 focus:outline-none cursor-pointer shadow-sm transition-all ${
                                    isActuallyNight 
                                        ? 'bg-stone-900 border-stone-800 text-stone-200 hover:bg-stone-800' 
                                        : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                                }`}
                            >
                                {displayLocations.map((loc: any) => (
                                    <option key={loc.id} value={loc.id}>{loc.label}</option>
                                ))}
                            </select>
                            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-emerald-500"><MapPin size={14} /></div>
                            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-stone-400"><ChevronDown size={14} /></div>
                        </div>
                    </div>

                    <SpeciesScoreGrid>
                        {activeSpeciesList.map((speciesId: string) => {
                            const config = SPECIES_CONFIG[speciesId] || { label: speciesId, key: speciesId.toLowerCase(), hexColor: '#a8a29e' };
                            return (
                                <SpeciesScore 
                                    key={speciesId} 
                                    label={config.label} 
                                    score={liveOraclePoint ? (liveOraclePoint as any)[config.key] : undefined} 
                                    hexColor={config.hexColor} 
                                    loading={isLoading}
                                    isActuallyNight={isActuallyNight}
                                />
                            );
                        })}
                    </SpeciesScoreGrid>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-6">
                        {Object.entries(WEATHER_METADATA).map(([key, meta]) => {
                            let unit = meta.unit;
                            if (key === 'wind' && displayedWeather) unit = ` km/h ${getWindDir(displayedWeather.windDirection)}`;
                            return (
                                <DataTile 
                                    key={key} 
                                    label={meta.label} 
                                    value={getVal(key)} 
                                    unit={unit} 
                                    icon={key === 'tempAir' && displayedWeather ? getWeatherIcon(displayedWeather.clouds) : <meta.icon size={16} />} 
                                    color={getTileTheme(meta.theme, isActuallyNight)} 
                                    loading={isLoading} 
                                    description={meta.description}
                                    isActuallyNight={isActuallyNight}
                                />
                            );
                        })}
                        {Object.entries(HYDRO_METADATA).map(([key, meta]) => {
                            const val = getVal(key);
                            if (val === null || (key === 'flowIndex' && !isRiver)) return null;
                            let displayUnit = meta.unit;
                            if (key === 'flowIndex') {
                                const status = (liveOraclePoint as any)?.flowStatus || (liveOraclePoint as any)?.metadata?.flowStatus;
                                if (status) displayUnit = `% (${status})`;
                            }
                            return (
                                <DataTile 
                                    key={key} 
                                    label={meta.label} 
                                    value={val} 
                                    unit={displayUnit} 
                                    icon={<meta.icon size={16} />} 
                                    color={getTileTheme(meta.theme, isActuallyNight)} 
                                    loading={isLoading} 
                                    description={meta.description} 
                                    isActuallyNight={isActuallyNight}
                                />
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardLiveTab;