// components/SessionCard.tsx - Version 4.8.13 (Focus Spot & Interactive Zoom)
import React, { useState } from 'react';
import { 
    MapPin, Fish, Trash2, Edit2, User, Calendar, AlertOctagon,
    Maximize2, Activity, Clock, ChevronRight, X
} from 'lucide-react'; 
import { Session, SpeciesType, FullEnvironmentalSnapshot } from '../types';
import { WEATHER_METADATA, HYDRO_METADATA, IndicatorMeta } from '../constants/indicators';

interface SessionCardProps {
    session: Session;
    onDelete?: (id: string) => void;
    onEdit?: (session: Session) => void;
    onClick?: (session: Session) => void;
    currentUserId: string;
}

const getWindDir = (deg?: number) => {
    if (deg === undefined) return '';
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
    return directions[Math.round(deg / 45) % 8];
};

const getSpeciesColor = (species: SpeciesType) => {
    switch (species) {
        case 'Sandre': return 'bg-amber-100 text-amber-800 border-amber-200';
        case 'Perche': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
        case 'Brochet': return 'bg-stone-200 text-stone-700 border-stone-300';
        case 'Black-Bass': return 'bg-green-100 text-green-800 border-green-200';
        default: return 'bg-stone-100 text-stone-600 border-stone-200';
    }
};

const SPECIES_MAP: Record<string, string> = {
    'Sandre': 'sandre',
    'Brochet': 'brochet',
    'Perche': 'perche',
    'Black-Bass': 'blackbass'
};

const SessionCard: React.FC<SessionCardProps> = ({ session, onDelete, onEdit, onClick, currentUserId }) => {
    const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
    const env = session.envSnapshot as FullEnvironmentalSnapshot;
    const isOwner = session.userId === currentUserId;
    
    const allowedSpecies = (session as any).speciesIds || ['Sandre', 'Brochet', 'Perche', 'Black-Bass'];
    const allSessionPhotos = session.catches
        .filter(c => c.photoUrls && c.photoUrls.length > 0)
        .flatMap(c => c.photoUrls!);

    const MiniEnvTile = ({ meta, value, customUnit, isEstimated }: { 
        meta: IndicatorMeta, 
        value: string | number, 
        customUnit?: string,
        isEstimated?: boolean 
    }) => {
        if (value === undefined || value === null || value === '--') return null;

        const themes: any = {
            rose: "bg-rose-50/60 border-rose-100 text-rose-700",
            indigo: "bg-indigo-50/60 border-indigo-100 text-indigo-700",
            blue: "bg-blue-50/60 border-blue-100 text-blue-700",
            amber: "bg-amber-50/60 border-amber-100 text-amber-700",
            orange: "bg-orange-50/60 border-orange-100 text-orange-700",
            cyan: "bg-cyan-50/60 border-cyan-100 text-cyan-700",
            emerald: "bg-emerald-50/60 border-emerald-100 text-emerald-700",
            purple: "bg-purple-50/60 border-purple-100 text-purple-700"
        };

        const Icon = meta.icon;

        return (
            <div className={`${themes[meta.theme] || 'bg-stone-50'} flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-black shrink-0 shadow-sm transition-transform active:scale-95`}>
                <Icon size={14} className="opacity-70 shrink-0" />
                <div className="flex flex-col leading-none">
                    <div className="flex items-center gap-1">
                        <span className="text-[8px] opacity-60 uppercase tracking-tighter font-bold">{meta.label}</span>
                        {isEstimated && <span className="italic text-[7px] opacity-50 font-normal">est.</span>}
                    </div>
                    <span className="mt-0.5">{value}<span className="text-[9px] ml-0.5 opacity-60">{customUnit || meta.unit}</span></span>
                </div>
            </div>
        );
    };

    return (
        <>
            <div 
                onClick={() => onClick && onClick(session)} 
                className={`relative rounded-[2.5rem] p-6 border transition-all cursor-pointer group mb-4 ${
                    isOwner ? 'bg-white border-stone-100 shadow-organic hover:shadow-xl' : 'bg-[#F5F4F1] border-stone-200/60'
                }`}
            >
                {/* HEADER : SECTEUR + SPOT (NON TRONQUÉ) */}
                <div className="flex justify-between items-start mb-5">
                    <div className="flex-1 min-w-0">
                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                                <div className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                                    <MapPin size={10} /> {session.locationName || "Secteur Inconnu"}
                                </div>
                                {!isOwner && <span className="text-[10px] text-stone-400 font-bold italic">par {session.userPseudo}</span>}
                            </div>
                            {/* Michael : text-lg et retrait de truncate pour voir tout le nom du spot */}
                            <h3 className="text-lg font-black text-stone-800 uppercase tracking-tight leading-tight">
                                {session.spotName}
                            </h3>
                        </div>
                        <div className="text-xs font-bold text-stone-400 mt-2 flex items-center gap-3">
                            <span className="flex items-center gap-1.5"><Calendar size={13} /> {new Date(session.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                            <span className="flex items-center gap-1.5"><Clock size={13} /> {session.startTime}-{session.endTime}</span>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3 ml-2">
                        {isOwner && (
                            <div className="flex gap-1 sm:opacity-0 group-hover:opacity-100 transition-all">
                                <button onClick={(e) => { e.stopPropagation(); onEdit?.(session); }} className="p-2.5 bg-stone-50 hover:bg-amber-100 rounded-full border border-stone-100 text-stone-600"><Edit2 size={14}/></button>
                                <button onClick={(e) => { e.stopPropagation(); onDelete?.(session.id); }} className="p-2.5 bg-stone-50 hover:bg-rose-100 rounded-full border border-stone-100 text-stone-600"><Trash2 size={14}/></button>
                            </div>
                        )}
                        <div className="w-12 h-12 rounded-full border-2 border-white overflow-hidden shadow-md bg-stone-100 flex items-center justify-center shrink-0">
                            {session.userAvatar ? <img src={session.userAvatar} className="w-full h-full object-cover" alt="Avatar" /> : <User size={24} className="text-stone-300" />}
                        </div>
                    </div>
                </div>

                {/* CARROUSSEL PHOTO INTERACTIF (h-32) */}
                {allSessionPhotos.length > 0 && (
                    <div className="flex gap-3 mb-6 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1 snap-x snap-mandatory">
                        {allSessionPhotos.map((url, idx) => {
                            if (idx > 2) return null;
                            const isLastVisible = idx === 2 && allSessionPhotos.length > 3;

                            return (
                                <div 
                                    key={idx} 
                                    className="relative h-32 w-48 bg-stone-50 rounded-2xl overflow-hidden border border-stone-100 shadow-sm shrink-0 group/photo snap-center cursor-zoom-in"
                                    onClick={(e) => { e.stopPropagation(); setSelectedPhoto(url); }}
                                >
                                    <img src={url} className="h-full w-full object-cover block" alt={`Prise ${idx + 1}`} loading="lazy" />
                                    
                                    {isLastVisible ? (
                                        <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex flex-col items-center justify-center text-white">
                                            <span className="text-xl font-black">+{allSessionPhotos.length - 2}</span>
                                            <span className="text-[8px] font-bold uppercase tracking-widest">Photos</span>
                                        </div>
                                    ) : (
                                        <div className="absolute inset-0 bg-black/10 opacity-0 group-hover/photo:opacity-100 transition-opacity flex items-center justify-center">
                                            <Maximize2 size={20} className="text-white drop-shadow-md" />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {allSessionPhotos.length > 3 && (
                             <div className="flex items-center px-4 text-stone-300 italic text-xs shrink-0 snap-center">
                                Swipe pour plus <ChevronRight size={14} />
                             </div>
                        )}
                    </div>
                )}

                {/* ENVIRONNEMENT */}
                <div className="flex flex-wrap items-center gap-2.5 mb-6">
                    {Object.entries(WEATHER_METADATA).map(([key, meta]) => {
                        let val = env?.weather?.[meta.dataKey as keyof typeof env.weather];
                        let customUnit = key === 'wind' ? ` km/h ${getWindDir(env?.weather?.windDirection)}` : undefined;
                        return <MiniEnvTile key={key} meta={meta} value={val !== undefined ? Math.round(val as number) : '--'} customUnit={customUnit} />;
                    })}

                    {Object.entries(HYDRO_METADATA).map(([key, meta]) => {
                        if (key === 'level') return null;
                        let val = env?.hydro?.[meta.dataKey as keyof typeof env.hydro];
                        if (val === undefined || val === null) return null;
                        let displayVal: string | number = (key === 'waterTemp' || key === 'turbidity' || key === 'oxygen') ? (val as number).toFixed(1) : Math.round(val as number);
                        let customUnit = (key === 'flowIndex' && (env?.metadata as any)?.flowStatus) ? `% (${(env.metadata as any).flowStatus})` : undefined;
                        return <MiniEnvTile key={key} meta={meta} value={displayVal} customUnit={customUnit} isEstimated={true} />;
                    })}
                </div>

                {/* OBSERVATION */}
                {session.notes && (
                    <div className="mb-6 px-5 py-4 bg-amber-50/40 rounded-[1.5rem] border border-amber-100/50 relative italic text-[13px] text-stone-700 leading-relaxed shadow-sm">
                        <div className="absolute -top-2.5 left-6 px-3 bg-white text-[9px] font-black text-amber-600 uppercase tracking-widest border border-amber-100 rounded-full shadow-sm">Note Michael</div>
                        "{session.notes}"
                    </div>
                )}

                {/* PRISES */}
                <div className="flex flex-wrap gap-2.5 mb-6">
                    {session.catches.map(fish => (
                        <div key={fish.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[11px] font-black ${getSpeciesColor(fish.species as SpeciesType)} shadow-sm`}>
                            <Fish size={12} strokeWidth={2.5} /> {fish.species} <span className="opacity-60 ml-0.5">{fish.size}cm</span>
                        </div>
                    ))}
                    {session.misses.map(miss => (
                        <div key={miss.id} className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-[11px] font-black shadow-sm">
                            <AlertOctagon size={12} strokeWidth={2.5} /> {miss.type}
                        </div>
                    ))}
                    {session.catches.length === 0 && session.misses.length === 0 && (
                        <span className="text-xs font-black text-stone-300 uppercase tracking-widest py-1">Capot intégral</span>
                    )}
                </div>

                {/* FOOTER : Scores Oracle */}
                <div className="flex justify-between items-center pt-5 border-t border-stone-100">
                    <div className="flex items-center gap-5">
                        {allowedSpecies.map((label: string) => {
                            const scoreKey = SPECIES_MAP[label];
                            const scoreValue = (env?.scores as any)?.[scoreKey];
                            if (scoreValue === undefined || scoreValue === null) return null;
                            return (
                                <div key={label} className="flex flex-col">
                                    <span className="text-[9px] font-black text-stone-300 uppercase tracking-tighter">{label === 'Black-Bass' ? 'Bass' : label}</span>
                                    <div className="flex items-center gap-1.5 text-xs font-black text-stone-600">
                                        <Activity size={12} className={scoreValue > 50 ? "text-emerald-500" : "text-amber-500"} />
                                        {Math.round(scoreValue)}%
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className={`text-xs font-black px-4 py-1.5 rounded-full shadow-sm border ${
                        session.feelingScore >= 7 ? 'bg-emerald-50 text-emerald-800 border-emerald-100' : 'bg-amber-50 text-amber-800 border-amber-100'
                    }`}>
                        FEELING: {session.feelingScore}/10
                    </div>
                </div>
            </div>

            {/* LIGHTBOX PLEIN ÉCRAN (Mise à jour Zoom & Tutoiement) */}
            {selectedPhoto && (
                <div 
                    className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col animate-in fade-in duration-300 overflow-hidden"
                    onClick={() => setSelectedPhoto(null)}
                >
                    <div className="p-6 flex justify-between items-center text-white relative z-10">
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60 italic">Visualisation Oracle</span>
                        <button className="p-3 bg-white/10 rounded-full hover:bg-white/20 transition-all active:scale-90">
                            <X size={24} />
                        </button>
                    </div>
                    
                    {/* Michael : Utilisation d'un conteneur qui autorise le zoom natif tactile */}
                    <div className="flex-1 flex items-center justify-center p-4 overflow-auto scrollbar-hide">
                        <img 
                            src={selectedPhoto} 
                            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-in zoom-in duration-500" 
                            style={{ touchAction: 'pinch-zoom' }}
                            alt="Vue plein écran"
                            onClick={(e) => e.stopPropagation()} 
                        />
                    </div>
                    
                    <div className="p-10 text-center text-white/40 text-[10px] font-black uppercase tracking-widest leading-relaxed">
                        Utilise tes deux doigts pour zoomer sur ta prise
                    </div>
                </div>
            )}
        </>
    );
};

export default SessionCard;