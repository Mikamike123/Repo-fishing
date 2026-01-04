import React from 'react';
import { 
    X, Calendar, Clock, Anchor, Activity, CloudSun, Fish, Trophy, 
    Wind, Droplets, Image as ImageIcon, Gauge, Thermometer, 
    Waves, Eye, CloudRain, AlertOctagon, Maximize2, MapPin 
} from 'lucide-react';
import { Session, SpeciesType } from '../types';
// [ALIGNEMENT] Import des référentiels pour la cohérence UI avec SessionCard
import { WEATHER_METADATA, HYDRO_METADATA } from '../constants/indicators';

const getWindDir = (deg?: number) => {
    if (deg === undefined) return '';
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
    return directions[Math.round(deg / 45) % 8];
};

interface SessionDetailModalProps {
    session: Session | null;
    isOpen: boolean;
    onClose: () => void;
}

const SessionDetailModal: React.FC<SessionDetailModalProps> = ({ session, isOpen, onClose }) => {
    if (!isOpen || !session) return null;

    const env = session.envSnapshot;
    // Détection du mode simulé pour l'affichage éventuel (optionnel ici mais gardé pour cohérence)
    const isSimulated = env?.metadata?.calculationMode === 'ZERO_HYDRO' || (env?.metadata?.calculationMode as any) === 'ULTREIA_CALIBRATED';

    const formatCatchTime = (c: any) => {
        if (c.time) return c.time;
        try {
            if (!c.timestamp) return "--:--";
            if (typeof c.timestamp === 'object' && 'seconds' in c.timestamp) {
                return new Date(c.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
            const date = new Date(c.timestamp);
            return isNaN(date.getTime()) ? "--:--" : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch { return "--:--"; }
    };

    const getScoreColor = (val: number) => {
        if (val > 60) return "text-emerald-500";
        if (val > 30) return "text-amber-500";
        return "text-stone-400";
    };

    const getSpeciesColor = (species: SpeciesType) => {
        switch (species) {
            case 'Sandre': return 'bg-amber-100 text-amber-800 border-amber-200';
            case 'Perche': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
            case 'Brochet': return 'bg-stone-200 text-stone-700 border-stone-300';
            default: return 'bg-stone-100 text-stone-600 border-stone-200';
        }
    };

    const openPhotoLink = (url: string) => { if (url) window.open(url, '_blank'); };

    const DataTile = ({ icon: Icon, label, value, unit, theme }: any) => {
        const themes: any = {
            amber: "bg-amber-50/60 border-amber-100 text-amber-800 icon-text-amber-400",
            rose: "bg-rose-50/60 border-rose-100 text-rose-800 icon-text-rose-400",
            indigo: "bg-indigo-50/60 border-indigo-100 text-indigo-800 icon-text-indigo-400",
            blue: "bg-blue-50/60 border-blue-100 text-blue-800 icon-text-blue-400",
            cyan: "bg-cyan-50/60 border-cyan-100 text-cyan-800 icon-text-cyan-400",
            orange: "bg-orange-50/60 border-orange-100 text-orange-800 icon-text-orange-400",
            emerald: "bg-emerald-50/60 border-emerald-100 text-emerald-800 icon-text-emerald-400",
            slate: "bg-slate-50/60 border-slate-100 text-slate-800 icon-text-slate-400"
        };
        const currentTheme = themes[theme] || "bg-white border-stone-100 text-stone-700 icon-text-stone-300";
        const iconClass = currentTheme.split(' icon-text-')[1];
        const containerClass = currentTheme.split(' icon-text-')[0];

        // Protection contre l'affichage vide
        if (value === undefined || value === null || value === '--') return null;

        return (
            <div className={`${containerClass} p-3 rounded-2xl border shadow-sm flex flex-col items-center justify-center text-center transition-transform hover:scale-[1.02]`}>
                <Icon size={16} className={`${iconClass} mb-1`} />
                <div className="text-[8px] font-black opacity-60 uppercase tracking-tighter mb-0.5">{label}</div>
                <div className="text-sm font-black">
                    {value}
                    <span className="text-[10px] ml-0.5 font-bold opacity-50">{unit}</span>
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 bg-stone-900/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-4xl bg-[#fdfbf7] rounded-[2rem] shadow-2xl max-h-[96vh] flex flex-col border border-stone-200 relative overflow-hidden">
                
                {/* HEADER ULTRA-SLIM (V9.8) */}
                <div className="relative bg-stone-800 px-5 py-3 text-white shrink-0 border-b border-white/5">
                    {/* Ligne 1 : Badge + Date + Fermeture */}
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-amber-500 text-white text-[8px] font-black uppercase rounded-full">Oracle Fish</span>
                            <span className="text-stone-400 text-[9px] font-bold uppercase tracking-widest">
                                {new Date(session.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                            </span>
                        </div>
                        <button onClick={onClose} className="p-1.5 bg-white/10 hover:bg-white/20 rounded-full transition-all active:scale-90">
                            <X size={16} />
                        </button>
                    </div>

                    {/* Ligne 2 : Spot @ Secteur */}
                    <h2 className="text-xl font-black tracking-tighter uppercase leading-tight mb-2 truncate pr-6">
                        {session.spotName} <span className="text-emerald-400 opacity-40 ml-1">@ {session.locationName || "Secteur"}</span>
                    </h2>

                    {/* Ligne 3 : Métadonnées Session + Scores en badges fins */}
                    <div className="flex items-center justify-between">
                        <div className="flex gap-3 text-[9px] font-black text-stone-400 uppercase tracking-wider">
                            <div className="flex items-center gap-1"><Clock size={10} className="text-amber-400/60"/> {session.startTime}-{session.endTime}</div>
                            <div className="flex items-center gap-1"><Activity size={10} className="text-emerald-400/60"/> FEELING {session.feelingScore}/10</div>
                            <div className="hidden sm:flex items-center gap-1"><Anchor size={10} className="text-stone-500"/> {session.setupName}</div>
                        </div>

                        {/* Scores ultra-compacts */}
                        <div className="flex gap-3 bg-black/40 px-3 py-1 rounded-full border border-white/5">
                            {[
                                { k: 'sandre', l: 'S' },
                                { k: 'brochet', l: 'B' },
                                { k: 'perche', l: 'P' }
                            ].map(sp => (
                                <div key={sp.k} className="flex items-center gap-1.5">
                                    <span className="text-[7px] font-black text-stone-500 uppercase">{sp.l}</span>
                                    <span className={`text-xs font-black ${getScoreColor((env?.scores as any)?.[sp.k] || 0)}`}>
                                        {(env?.scores as any)?.[sp.k]?.toFixed(0) || '--'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* CONTENT (DÉROULANT) */}
                <div className="p-5 space-y-6 overflow-y-auto bg-stone-50/50 flex-1">
                    
                    <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* ATMOSPHÈRE */}
                        <div className="space-y-3">
                            <h3 className="text-[9px] font-black text-stone-400 uppercase tracking-[0.2em] flex items-center gap-2 ml-1">
                                <CloudSun size={12} /> Atmosphère
                            </h3>
                            <div className="grid grid-cols-3 gap-2">
                                {Object.entries(WEATHER_METADATA).map(([key, meta]) => {
                                    let val = env?.weather?.[meta.dataKey as keyof typeof env.weather];
                                    let unit = meta.unit;
                                    if (key === 'wind') unit = `km/h ${getWindDir(env?.weather?.windDirection)}`;
                                    
                                    return (
                                        <DataTile 
                                            key={key}
                                            label={meta.label} 
                                            value={val !== undefined ? Math.round(val as number) : null} 
                                            unit={unit} 
                                            icon={meta.icon} 
                                            theme={meta.theme} 
                                        />
                                    );
                                })}
                            </div>
                        </div>

                        {/* HYDROLOGIE */}
                        <div className="space-y-3">
                            <h3 className="text-[9px] font-black text-stone-400 uppercase tracking-[0.2em] flex items-center gap-2 ml-1">
                                <Waves size={12} /> Hydrologie
                            </h3>
                            <div className="grid grid-cols-3 gap-2">
                                {Object.entries(HYDRO_METADATA).map(([key, meta]) => {
                                    if (key === 'level') return null;
                                    let val = env?.hydro?.[meta.dataKey as keyof typeof env.hydro];
                                    if (val === undefined || val === null) return null;

                                    let displayVal: string | number = val as number;
                                    let unit = meta.unit;

                                    if (key === 'waterTemp' || key === 'turbidity' || key === 'oxygen' || key === 'waves') {
                                        displayVal = (val as number).toFixed(1);
                                    } else if (key === 'flow' || key === 'flowIndex') {
                                        displayVal = Math.round(val as number);
                                        unit = (env?.metadata as any)?.flowStatus ? `% (${(env?.metadata as any).flowStatus})` : '%';
                                    }

                                    return (
                                        <DataTile 
                                            key={key}
                                            label={meta.label} 
                                            value={displayVal} 
                                            unit={unit} 
                                            icon={meta.icon} 
                                            theme={meta.theme}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    </section>

                    {/* ÉVÉNEMENTS (PRISES + RATÉS) */}
                    <section className="space-y-4">
                        <h3 className="text-[9px] font-black text-stone-400 uppercase tracking-[0.2em] flex items-center gap-2 ml-1">
                            <Fish size={12} /> Événements ({session.catches.length + session.misses.length})
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {session.catches.map((c) => (
                                <div key={c.id} className="bg-white p-4 rounded-[1.5rem] border border-stone-100 shadow-sm flex flex-col gap-3">
                                    <div className="flex justify-between items-start">
                                        <div className="flex gap-2 items-center">
                                            <div className="px-2 py-0.5 bg-stone-50 rounded-lg text-[9px] font-black text-stone-500">{formatCatchTime(c)}</div>
                                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${getSpeciesColor(c.species as SpeciesType)}`}>{c.species}</span>
                                            {c.size >= 60 && <Trophy size={14} className="text-amber-500" />}
                                        </div>
                                        <span className="text-2xl font-black text-stone-800 tracking-tighter">{c.size}<span className="text-xs text-stone-400 ml-0.5">cm</span></span>
                                    </div>

                                    {c.photoUrls && c.photoUrls.length > 0 && (
                                        <div className="relative w-full rounded-xl overflow-hidden cursor-pointer shadow-sm border border-stone-50 bg-stone-50" onClick={() => openPhotoLink(c.photoUrls![0])}>
                                            <img src={c.photoUrls[0]} alt={`Prise ${c.species}`} className="w-full h-auto block" />
                                        </div>
                                    )}
                                    
                                    <div className="flex items-center justify-between pt-3 border-t border-stone-50">
                                        <div className="flex flex-col gap-0.5">
                                            <div className="flex items-center gap-1.5 text-[9px] font-bold text-stone-600 uppercase"><Anchor size={10} className="text-stone-300"/> {c.technique}</div>
                                            <div className="flex items-center gap-1.5 text-[9px] font-bold text-amber-600 uppercase"><Fish size={10} className="text-amber-300"/> {c.lureName}</div>
                                        </div>
                                        {c.photoUrls && c.photoUrls.length > 1 && (
                                            <div className="flex gap-1">
                                                {c.photoUrls.slice(1, 3).map((url, idx) => (
                                                    <button key={idx} onClick={(e) => { e.stopPropagation(); openPhotoLink(url); }} className="w-8 h-8 bg-blue-50 text-blue-600 rounded-xl transition-all flex items-center justify-center">
                                                        <ImageIcon size={14} />
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {session.misses.map((m) => (
                                <div key={m.id} className="bg-rose-50/30 p-4 rounded-[1.5rem] border border-rose-100 shadow-sm">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex gap-2 items-center">
                                            <div className="px-2 py-0.5 bg-white rounded-lg text-[9px] font-black text-rose-400">{formatCatchTime(m)}</div>
                                            <span className="px-2 py-0.5 bg-rose-500 text-white rounded-md text-[9px] font-black uppercase shadow-sm">RATÉ</span>
                                        </div>
                                        <AlertOctagon className="text-rose-500" size={18} />
                                    </div>
                                    <div className="text-[11px] font-black text-rose-800 uppercase tracking-tight">{m.type}</div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* OBSERVATIONS */}
                    {session.notes && (
                        <section className="space-y-3 pb-4">
                            <h3 className="text-[9px] font-black text-stone-400 uppercase tracking-[0.2em] flex items-center gap-2 ml-1">
                                <ImageIcon size={12} /> Observations Michael
                            </h3>
                            <div className="bg-amber-50/20 p-5 rounded-[1.5rem] border border-amber-100/50 text-stone-600 text-xs leading-relaxed font-medium italic">
                                "{session.notes}"
                            </div>
                        </section>
                    )}
                </div>
                
                {/* FOOTER */}
                <div className="p-3 bg-white border-t border-stone-100 text-center shrink-0">
                    <span className="text-[7px] font-black text-stone-300 uppercase tracking-widest">Oracle Fish v4.8.8 • Precision Fisheries Archive</span>
                </div>
            </div>
        </div>
    );
};

export default SessionDetailModal;