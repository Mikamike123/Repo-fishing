// components/SessionCard.tsx - Version 8.7 (Normalization & Smart Avatar Feed)
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
    isActuallyNight?: boolean; 
    authorAvatarUrl?: string; // Michael : La "FK" résolue pour le Multi-User v10.6
}

/**
 * Michael : Mini-composant interne pour un avatar résilient dans le flux
 */
const AuthorAvatar: React.FC<{ url?: string; isActuallyNight?: boolean }> = ({ url, isActuallyNight }) => {
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(!!url);

    return (
        <div className={`w-12 h-12 rounded-full border-2 overflow-hidden shadow-md flex items-center justify-center shrink-0 ${
            isActuallyNight ? 'border-stone-800 bg-stone-900' : 'border-white bg-stone-100'
        }`}>
            {loading && <div className="absolute w-10 h-10 animate-pulse bg-stone-400/20 rounded-full" />}
            
            {!url || error ? (
                <User size={24} className={isActuallyNight ? 'text-stone-700' : 'text-stone-300'} />
            ) : (
                <img 
                    src={url} 
                    className={`w-full h-full object-cover transition-opacity duration-300 ${loading ? 'opacity-0' : 'opacity-100'}`} 
                    alt="Avatar" 
                    onLoad={() => setLoading(false)}
                    onError={() => { setError(true); setLoading(false); }}
                />
            )}
        </div>
    );
};

const getWindDir = (deg?: number) => {
    if (deg === undefined) return '';
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
    return directions[Math.round(deg / 45) % 8];
};

const getSpeciesColor = (species: SpeciesType, isActuallyNight?: boolean) => {
    if (isActuallyNight) {
        switch (species) {
            case 'Sandre': return 'bg-amber-950/40 text-amber-200 border-amber-900/50';
            case 'Perche': return 'bg-emerald-950/40 text-emerald-200 border-emerald-900/50';
            case 'Brochet': return 'bg-stone-800 text-stone-300 border-stone-700';
            case 'Black-Bass': return 'bg-green-950/40 text-green-200 border-green-900/50';
            default: return 'bg-stone-800 text-stone-400 border-stone-700';
        }
    }
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

const SessionCard: React.FC<SessionCardProps> = ({ session, onDelete, onEdit, onClick, currentUserId, isActuallyNight, authorAvatarUrl }) => {
    const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
    const env = session.envSnapshot as FullEnvironmentalSnapshot;
    const isOwner = session.userId === currentUserId;
    
    const allowedSpecies = (session as any).speciesIds || ['Sandre', 'Brochet', 'Perche', 'Black-Bass'];
    const allSessionPhotos = session.catches
        .filter(c => c.photoUrls && c.photoUrls.length > 0)
        .flatMap(c => c.photoUrls!);

    // Michael : Détection basée sur la metadata portée par la session
    const morphology = (env?.metadata as any)?.morphologyType || (session as any).morphologyId;
    const is9IconMode = ['Z_POND', 'Z_DEEP'].includes(morphology);

    // Michael : On prépare la liste filtrée des indicateurs pour la grille
    const allIndicators = [
        ...Object.entries(WEATHER_METADATA).map(([key, meta]) => ({ key, meta, source: 'weather' })),
        ...Object.entries(HYDRO_METADATA).map(([key, meta]) => ({ key, meta, source: 'hydro' }))
    ].filter(item => {
        if (item.key === 'level') return false;
        // Michael : Règle d'affichage dynamique pour le courant
        if (item.key === 'flowIndex' && is9IconMode) return false;
        return true;
    });

    const MiniEnvTile = ({ meta, value, customUnit, isEstimated }: { 
        meta: IndicatorMeta, 
        value: string | number, 
        customUnit?: string,
        isEstimated?: boolean 
    }) => {
        if (value === undefined || value === null || value === '--') return null;

        const themes: any = isActuallyNight ? {
            rose: "bg-rose-950/30 border-rose-900/40 text-rose-300",
            indigo: "bg-indigo-950/30 border-indigo-900/40 text-indigo-300",
            blue: "bg-blue-950/30 border-blue-900/40 text-blue-300",
            amber: "bg-amber-950/30 border-amber-900/40 text-amber-300",
            orange: "bg-orange-950/30 border-orange-900/40 text-orange-300",
            cyan: "bg-cyan-950/30 border-cyan-900/40 text-cyan-300",
            emerald: "bg-emerald-950/30 border-emerald-900/40 text-emerald-300",
            purple: "bg-purple-950/30 border-purple-900/40 text-purple-300"
        } : {
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
            <div className={`${themes[meta.theme] || (isActuallyNight ? 'bg-stone-800 border-stone-700' : 'bg-stone-50')} flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-black w-full shadow-sm transition-transform active:scale-95`}>
                <Icon size={14} className="opacity-70 shrink-0" />
                <div className="flex flex-col leading-none">
                    <div className="flex items-center gap-1">
                        <span className={`text-[8px] opacity-60 uppercase tracking-tighter font-bold ${isActuallyNight ? 'text-stone-400' : ''}`}>{meta.label}</span>
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
                    isActuallyNight 
                        ? (isOwner ? 'bg-[#1c1917] border-stone-800 shadow-none' : 'bg-stone-950 border-stone-900')
                        : (isOwner ? 'bg-white border-stone-100 shadow-organic hover:shadow-xl' : 'bg-[#F5F4F1] border-stone-200/60')
                }`}
            >
                {/* HEADER : SECTEUR + SPOT */}
                <div className="flex justify-between items-start mb-5">
                    <div className="flex-1 min-w-0">
                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                                <div className={`px-2 py-0.5 border rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1 ${
                                    isActuallyNight ? 'bg-emerald-950/30 text-emerald-400 border-emerald-900/50' : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                }`}>
                                    <MapPin size={10} /> {session.locationName || "Secteur Inconnu"}
                                </div>
                                {!isOwner && <span className={`text-[10px] font-bold italic ${isActuallyNight ? 'text-stone-500' : 'text-stone-400'}`}>par {session.userPseudo}</span>}
                            </div>
                            <h3 className={`text-lg font-black uppercase tracking-tight leading-tight ${isActuallyNight ? 'text-stone-100' : 'text-stone-800'}`}>
                                {session.spotName}
                            </h3>
                        </div>
                        <div className={`text-xs font-bold mt-2 flex items-center gap-3 ${isActuallyNight ? 'text-stone-500' : 'text-stone-400'}`}>
                            <span className="flex items-center gap-1.5"><Calendar size={13} /> {new Date(session.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                            <span className="flex items-center gap-1.5"><Clock size={13} /> {session.startTime}-{session.endTime}</span>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3 ml-2">
                        {isOwner && (
                            <div className="flex gap-1 sm:opacity-0 group-hover:opacity-100 transition-all">
                                <button onClick={(e) => { e.stopPropagation(); onEdit?.(session); }} className={`p-2.5 rounded-full border transition-colors ${isActuallyNight ? 'bg-stone-800 border-stone-700 text-stone-400 hover:bg-amber-900/40 hover:text-amber-400' : 'bg-stone-50 border-stone-100 text-stone-600 hover:bg-amber-100'}`}><Edit2 size={14}/></button>
                                <button onClick={(e) => { e.stopPropagation(); onDelete?.(session.id); }} className={`p-2.5 rounded-full border transition-colors ${isActuallyNight ? 'bg-stone-800 border-stone-700 text-stone-400 hover:bg-rose-900/40 hover:text-rose-400' : 'bg-stone-50 border-stone-100 text-stone-600 hover:bg-rose-100'}`}><Trash2 size={14}/></button>
                            </div>
                        )}
                        {/* Michael : SSOT Avatar - On utilise l'URL passée ou le champ legacy pour la transition */}
                        <AuthorAvatar 
                            url={authorAvatarUrl || (session as any).userAvatar} 
                            isActuallyNight={isActuallyNight} 
                        />
                    </div>
                </div>

                {/* CARROUSSEL PHOTO INTERACTIF */}
                {allSessionPhotos.length > 0 && (
                    <div className="flex gap-3 mb-6 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1 snap-x snap-mandatory">
                        {allSessionPhotos.map((url, idx) => {
                            if (idx > 2) return null;
                            const isLastVisible = idx === 2 && allSessionPhotos.length > 3;

                            return (
                                <div 
                                    key={idx} 
                                    className={`relative h-32 w-48 rounded-2xl overflow-hidden border shadow-sm shrink-0 group/photo snap-center cursor-zoom-in ${isActuallyNight ? 'bg-stone-950 border-stone-800' : 'bg-stone-50 border-stone-100'}`}
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
                             <div className={`flex items-center px-4 italic text-xs shrink-0 snap-center ${isActuallyNight ? 'text-stone-600' : 'text-stone-300'}`}>
                                Swipe pour plus <ChevronRight size={14} />
                             </div>
                        )}
                    </div>
                )}

                {/* ENVIRONNEMENT : Grille dynamique */}
                <div className="grid grid-cols-3 gap-2.5 mb-6 w-full max-w-fit md:max-w-2xl">
                    {allIndicators.map((item) => {
                        const { key, meta, source } = item;
                        const isOxygen = key === 'oxygen';
                        const gridClasses = (isOxygen && !is9IconMode) ? "col-start-2 mt-1" : "";
                        
                        let val: any;
                        let customUnit: string | undefined;
                        let isEstimated = false;

                        if (source === 'weather') {
                            val = env?.weather?.[meta.dataKey as keyof typeof env.weather];
                            if (key === 'wind') customUnit = ` km/h ${getWindDir(env?.weather?.windDirection)}`;
                        } else {
                            val = env?.hydro?.[meta.dataKey as keyof typeof env.hydro];
                            isEstimated = true;
                            if (key === 'flowIndex' && (env?.metadata as any)?.flowStatus) {
                                customUnit = `% (${(env.metadata as any).flowStatus})`;
                            }
                        }

                        if (val === undefined || val === null || val === '--') return null;

                        const displayVal = (key === 'waterTemp' || key === 'turbidity' || key === 'oxygen') 
                            ? (val as number).toFixed(1) 
                            : Math.round(val as number);

                        return (
                            <div key={key} className={gridClasses}>
                                <MiniEnvTile 
                                    meta={meta} 
                                    value={displayVal} 
                                    customUnit={customUnit} 
                                    isEstimated={isEstimated} 
                                />
                            </div>
                        );
                    })}
                </div>

                {/* OBSERVATION */}
                {session.notes && (
                    <div className={`mb-6 px-5 py-4 rounded-[1.5rem] border relative italic text-[13px] leading-relaxed shadow-sm ${
                        isActuallyNight ? 'bg-amber-950/10 border-amber-900/20 text-stone-400' : 'bg-amber-50/40 border-amber-100/50 text-stone-700'
                    }`}>
                        <div className={`absolute -top-2.5 left-6 px-3 text-[9px] font-black uppercase tracking-widest border rounded-full shadow-sm ${
                            isActuallyNight ? 'bg-stone-900 text-amber-500 border-amber-900/50' : 'bg-white text-amber-600 border-amber-100'
                        }`}>Note Michael</div>
                        "{session.notes}"
                    </div>
                )}

                {/* PRISES */}
                <div className="flex flex-wrap gap-2.5 mb-6">
                    {session.catches.map(fish => (
                        <div key={fish.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[11px] font-black shadow-sm ${getSpeciesColor(fish.species as SpeciesType, isActuallyNight)}`}>
                            <Fish size={12} strokeWidth={2.5} /> {fish.species} <span className="opacity-60 ml-0.5">{fish.size}cm</span>
                        </div>
                    ))}
                    {session.misses.map(miss => (
                        <div key={miss.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[11px] font-black shadow-sm ${
                            isActuallyNight ? 'bg-rose-950/30 border-rose-900/50 text-rose-400' : 'border-rose-200 bg-rose-50 text-rose-800'
                        }`}>
                            <AlertOctagon size={12} strokeWidth={2.5} /> {miss.type}
                        </div>
                    ))}
                    {session.catches.length === 0 && session.misses.length === 0 && (
                        <span className={`text-xs font-black uppercase tracking-widest py-1 ${isActuallyNight ? 'text-stone-700' : 'text-stone-300'}`}>Capot intégral</span>
                    )}
                </div>

                {/* FOOTER : Scores Oracle */}
                <div className={`flex justify-between items-center pt-5 border-t ${isActuallyNight ? 'border-stone-800' : 'border-stone-100'}`}>
                    <div className="flex items-center gap-5">
                        {allowedSpecies.map((label: string) => {
                            const scoreKey = SPECIES_MAP[label];
                            const scoreValue = (env?.scores as any)?.[scoreKey];
                            if (scoreValue === undefined || scoreValue === null) return null;
                            return (
                                <div key={label} className="flex flex-col">
                                    <span className={`text-[9px] font-black uppercase tracking-tighter ${isActuallyNight ? 'text-stone-600' : 'text-stone-300'}`}>{label === 'Black-Bass' ? 'Bass' : label}</span>
                                    <div className={`flex items-center gap-1.5 text-xs font-black ${isActuallyNight ? 'text-stone-400' : 'text-stone-600'}`}>
                                        <Activity size={12} className={scoreValue > 50 ? "text-emerald-500" : "text-amber-500"} />
                                        {Math.round(scoreValue)}%
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className={`text-xs font-black px-4 py-1.5 rounded-full shadow-sm border ${
                        session.feelingScore >= 7 
                            ? (isActuallyNight ? 'bg-emerald-950/30 text-emerald-400 border-emerald-900/50' : 'bg-emerald-50 text-emerald-800 border-emerald-100') 
                            : (isActuallyNight ? 'bg-amber-950/30 text-amber-400 border-amber-900/50' : 'bg-amber-50 text-amber-800 border-amber-100')
                    }`}>
                        FEELING: {session.feelingScore}/10
                    </div>
                </div>
            </div>

            {/* LIGHTBOX PLEIN ÉCRAN */}
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