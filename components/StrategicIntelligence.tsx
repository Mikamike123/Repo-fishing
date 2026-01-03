import React, { useMemo } from 'react';
import { Target, Zap, Waves, Thermometer, Gauge, AlertTriangle, Trophy, MapPin, Anchor, BarChart3 } from 'lucide-react';
import { getDeepStrategicData } from '../lib/analytics-service';
import { Session, AppData } from '../types';

interface StrategicIntelligenceProps {
    sessions: Session[];
    userId: string;
    arsenal: AppData;
    hideHeader?: boolean; // Michael : Option pour éviter les doubles titres
}

const StrategicIntelligence: React.FC<StrategicIntelligenceProps> = ({ sessions, userId, arsenal, hideHeader = false }) => {
    const stats = useMemo(() => getDeepStrategicData(sessions, userId, arsenal), [sessions, userId, arsenal]);

    if (!stats) return null;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Michael : On masque l'en-tête interne uniquement si hideHeader est true */}
            {!hideHeader && (
                <div className="flex items-center gap-3 px-2">
                    <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600"><Target size={20} /></div>
                    <div>
                        <h3 className="text-xl font-black text-stone-800 tracking-tighter uppercase italic">Intelligence Stratégique</h3>
                        <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">Analyse prédictive • {stats.sessionCount} sessions analysées</p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. CARDE RENDEMENT (CPUE) */}
                <div className="bg-white p-6 rounded-[2.5rem] border border-stone-100 shadow-sm">
                    <h4 className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Zap size={12} className="text-amber-500" /> Rendement horaire
                    </h4>
                    <div className="flex items-end gap-2 mb-1">
                        <span className="text-4xl font-black text-stone-800 tracking-tighter">{stats.cpue.toFixed(2)}</span>
                        <span className="text-sm font-bold text-stone-400 mb-1.5 text-emerald-600">poissons / h</span>
                    </div>
                    <p className="text-[10px] text-stone-500 font-bold uppercase tracking-wide">Efficacité pondérée par la récence</p>
                </div>

                {/* 2. CARDE CONVERSION */}
                <div className="bg-white p-6 rounded-[2.5rem] border border-stone-100 shadow-sm">
                    <h4 className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <BarChart3 size={12} className="text-blue-500" /> Taux de Conversion
                    </h4>
                    <div className="flex items-end gap-2 mb-1">
                        <span className="text-4xl font-black text-stone-800 tracking-tighter">{stats.conversion.toFixed(1)}<span className="text-lg">%</span></span>
                    </div>
                    <p className="text-xs text-stone-500 leading-tight">
                        Ferrages réussis : <span className="font-black text-stone-900">{stats.conversion.toFixed(0)}%</span> des touches.
                    </p>
                </div>

                {/* 3. CARDE ZONES OR (Pressure/Temp) */}
                <div className="bg-stone-900 p-6 rounded-[2.5rem] shadow-xl text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Waves size={80} /></div>
                    <h4 className="text-[10px] font-black text-stone-50 uppercase tracking-widest mb-4 relative z-10">Zones de Confiance (Or)</h4>
                    <div className="grid grid-cols-2 gap-4 relative z-10">
                        <div className="flex items-center gap-2">
                            <Gauge size={16} className="text-blue-400" />
                            <div>
                                <div className="text-lg font-black tracking-tighter">{stats.goldenPressure} <span className="text-[8px] font-bold opacity-50">hPa</span></div>
                                <div className="text-[8px] uppercase font-bold text-stone-500">Pression</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Thermometer size={16} className="text-orange-400" />
                            <div>
                                <div className="text-lg font-black tracking-tighter">{stats.thermalWindow} <span className="text-[8px] font-bold opacity-50">°C</span></div>
                                <div className="text-[8px] uppercase font-bold text-stone-500">Eau favorite</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 4. CARDE SPOT MASTER */}
                <div className="bg-white p-6 rounded-[2.5rem] border border-stone-100 shadow-sm flex flex-col justify-between">
                    <h4 className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <MapPin size={12} className="text-emerald-500" /> Secteur Master
                    </h4>
                    <div className="text-2xl font-black text-stone-800 tracking-tighter uppercase italic truncate mb-1">
                        {stats.topSpot}
                    </div>
                    <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest">Secteur au rendement maximum</p>
                </div>

                {/* 5. LEURRE MASTER (Avec compteur de captures) */}
                <div className="bg-amber-50 p-6 rounded-[2.5rem] border border-amber-100 shadow-sm">
                    <h4 className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <Trophy size={12} /> Leurre Master
                    </h4>
                    <div className="text-2xl font-black text-amber-900 tracking-tighter uppercase italic leading-tight mb-1">
                        {stats.topLure}
                    </div>
                    <div className="inline-flex items-center px-2 py-0.5 bg-amber-200 text-amber-800 rounded-full text-[9px] font-black uppercase tracking-wider">
                        {stats.topLureCount} captures validées
                    </div>
                </div>

                {/* 6. TECHNIQUE MASTER & NEMESIS */}
                <div className="bg-stone-50 p-6 rounded-[2.5rem] border border-stone-100 shadow-sm">
                    <div className="flex flex-col gap-4">
                        <div>
                            <h4 className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                                <Anchor size={12} className="text-stone-600" /> Technique Master
                            </h4>
                            <div className="text-xl font-black text-stone-800 tracking-tighter uppercase italic">{stats.topTech}</div>
                        </div>
                        <div className="pt-3 border-t border-stone-200/50">
                            <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1 flex items-center gap-2">
                                <AlertTriangle size={12} /> Nemesis
                            </h4>
                            <div className="text-lg font-black text-rose-900 tracking-tighter uppercase italic leading-none">{stats.nemesis}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StrategicIntelligence;