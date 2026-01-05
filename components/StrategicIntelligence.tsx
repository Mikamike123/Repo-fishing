// components/StrategicIntelligence.tsx - Version 10.0.0 (Night Ops Strategy Room)
import React, { useMemo } from 'react';
import { Target, Zap, Waves, Thermometer, Gauge, AlertTriangle, Trophy, MapPin, Anchor, BarChart3 } from 'lucide-react';
import { getDeepStrategicData } from '../lib/analytics-service';
import { Session, AppData } from '../types';

interface StrategicIntelligenceProps {
    sessions: Session[];
    userId: string;
    arsenal: AppData;
    hideHeader?: boolean; // Michael : Option pour éviter les doubles titres
    isActuallyNight?: boolean; // Pilier V8.0
}

const StrategicIntelligence: React.FC<StrategicIntelligenceProps> = ({ 
    sessions, 
    userId, 
    arsenal, 
    hideHeader = false,
    isActuallyNight // Michael : Activation du thème furtif
}) => {
    const stats = useMemo(() => getDeepStrategicData(sessions, userId, arsenal), [sessions, userId, arsenal]);

    if (!stats) return null;

    // Styles dynamiques V8.0
    const cardBase = isActuallyNight ? "bg-[#1c1917] border-stone-800 shadow-none" : "bg-white border-stone-100 shadow-sm";
    const textTitle = isActuallyNight ? "text-stone-100" : "text-stone-800";
    const textMuted = isActuallyNight ? "text-stone-500" : "text-stone-400";

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Michael : En-tête avec switch de couleur Night Ops */}
            {!hideHeader && (
                <div className="flex items-center gap-3 px-2">
                    <div className={`p-2 rounded-lg transition-colors ${
                        isActuallyNight ? 'bg-emerald-950/30 text-emerald-400' : 'bg-emerald-100 text-emerald-600'
                    }`}>
                        <Target size={20} />
                    </div>
                    <div>
                        <h3 className={`text-xl font-black tracking-tighter uppercase italic ${textTitle}`}>Intelligence Stratégique</h3>
                        <p className={`text-[10px] font-bold uppercase tracking-widest ${textMuted}`}>Analyse prédictive • {stats.sessionCount} sessions analysées</p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. CARDE RENDEMENT (CPUE) */}
                <div className={`${cardBase} p-6 rounded-[2.5rem] border transition-colors duration-500`}>
                    <h4 className={`text-[10px] font-black uppercase tracking-widest mb-4 flex items-center gap-2 ${textMuted}`}>
                        <Zap size={12} className="text-amber-500" /> Rendement horaire
                    </h4>
                    <div className="flex items-end gap-2 mb-1">
                        <span className={`text-4xl font-black tracking-tighter ${textTitle}`}>{stats.cpue.toFixed(2)}</span>
                        <span className="text-sm font-bold mb-1.5 text-emerald-600">poissons / h</span>
                    </div>
                    <p className={`text-[10px] font-bold uppercase tracking-wide ${isActuallyNight ? 'text-stone-600' : 'text-stone-500'}`}>Efficacité pondérée par la récence</p>
                </div>

                {/* 2. CARDE CONVERSION */}
                <div className={`${cardBase} p-6 rounded-[2.5rem] border transition-colors duration-500`}>
                    <h4 className={`text-[10px] font-black uppercase tracking-widest mb-4 flex items-center gap-2 ${textMuted}`}>
                        <BarChart3 size={12} className="text-blue-500" /> Taux de Conversion
                    </h4>
                    <div className="flex items-end gap-2 mb-1">
                        <span className={`text-4xl font-black tracking-tighter ${textTitle}`}>{stats.conversion.toFixed(1)}<span className="text-lg">%</span></span>
                    </div>
                    <p className={`text-xs leading-tight ${isActuallyNight ? 'text-stone-400' : 'text-stone-500'}`}>
                        Ferrages réussis : <span className={`font-black ${isActuallyNight ? 'text-stone-200' : 'text-stone-900'}`}>{stats.conversion.toFixed(0)}%</span> des touches.
                    </p>
                </div>

                {/* 3. CARDE ZONES OR (Pressure/Temp) */}
                <div className={`p-6 rounded-[2.5rem] shadow-xl relative overflow-hidden transition-colors duration-500 ${
                    isActuallyNight ? 'bg-[#1c1917] border border-stone-800' : 'bg-stone-900 text-white'
                }`}>
                    <div className={`absolute top-0 right-0 p-4 opacity-10 ${isActuallyNight ? 'text-stone-600' : 'text-white'}`}><Waves size={80} /></div>
                    <h4 className={`text-[10px] font-black uppercase tracking-widest mb-4 relative z-10 ${isActuallyNight ? 'text-amber-500' : 'text-stone-50'}`}>Zones de Confiance (Or)</h4>
                    <div className="grid grid-cols-2 gap-4 relative z-10">
                        <div className="flex items-center gap-2">
                            <Gauge size={16} className="text-blue-400" />
                            <div>
                                <div className={`text-lg font-black tracking-tighter ${isActuallyNight ? 'text-stone-100' : 'text-white'}`}>{stats.goldenPressure} <span className="text-[8px] font-bold opacity-50">hPa</span></div>
                                <div className={`text-[8px] uppercase font-bold ${isActuallyNight ? 'text-stone-500' : 'text-stone-500'}`}>Pression</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Thermometer size={16} className="text-orange-400" />
                            <div>
                                <div className={`text-lg font-black tracking-tighter ${isActuallyNight ? 'text-stone-100' : 'text-white'}`}>{stats.thermalWindow} <span className="text-[8px] font-bold opacity-50">°C</span></div>
                                <div className={`text-[8px] uppercase font-bold ${isActuallyNight ? 'text-stone-500' : 'text-stone-500'}`}>Eau favorite</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 4. CARDE SPOT MASTER */}
                <div className={`${cardBase} p-6 rounded-[2.5rem] border flex flex-col justify-between transition-colors duration-500`}>
                    <h4 className={`text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-2 ${textMuted}`}>
                        <MapPin size={12} className="text-emerald-500" /> Secteur Master
                    </h4>
                    <div className={`text-2xl font-black tracking-tighter uppercase italic truncate mb-1 ${textTitle}`}>
                        {stats.topSpot}
                    </div>
                    <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest">Secteur au rendement maximum</p>
                </div>

                {/* 5. LEURRE MASTER (Ambiance Night Ops) */}
                <div className={`p-6 rounded-[2.5rem] border shadow-sm transition-colors duration-500 ${
                    isActuallyNight ? 'bg-amber-950/10 border-amber-900/20' : 'bg-amber-50 border-amber-100'
                }`}>
                    <h4 className={`text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-2 ${isActuallyNight ? 'text-amber-500' : 'text-amber-600'}`}>
                        <Trophy size={12} /> Leurre Master
                    </h4>
                    <div className={`text-2xl font-black tracking-tighter uppercase italic leading-tight mb-1 ${
                        isActuallyNight ? 'text-amber-100' : 'text-amber-900'
                    }`}>
                        {stats.topLure}
                    </div>
                    <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                        isActuallyNight ? 'bg-amber-900/40 text-amber-300' : 'bg-amber-200 text-amber-800'
                    }`}>
                        {stats.topLureCount} captures validées
                    </div>
                </div>

                {/* 6. TECHNIQUE MASTER & NEMESIS */}
                <div className={`p-6 rounded-[2.5rem] border shadow-sm transition-colors duration-500 ${
                    isActuallyNight ? 'bg-stone-900/40 border-stone-800' : 'bg-stone-50 border-stone-100'
                }`}>
                    <div className="flex flex-col gap-4">
                        <div>
                            <h4 className={`text-[10px] font-black uppercase tracking-widest mb-1 flex items-center gap-2 ${textMuted}`}>
                                <Anchor size={12} className={isActuallyNight ? 'text-stone-400' : 'text-stone-600'} /> Technique Master
                            </h4>
                            <div className={`text-xl font-black tracking-tighter uppercase italic ${textTitle}`}>{stats.topTech}</div>
                        </div>
                        <div className={`pt-3 border-t ${isActuallyNight ? 'border-stone-800' : 'border-stone-200/50'}`}>
                            <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1 flex items-center gap-2">
                                <AlertTriangle size={12} /> Nemesis
                            </h4>
                            <div className={`text-lg font-black tracking-tighter uppercase italic leading-none ${
                                isActuallyNight ? 'text-rose-400' : 'text-rose-900'
                            }`}>{stats.nemesis}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StrategicIntelligence;