// components/SessionCard.tsx
import React from 'react';
import { 
    MapPin, Fish, Trash2, Edit2, User, Calendar, AlertOctagon,
    Maximize2, Zap, Activity
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
    const env = session.envSnapshot as FullEnvironmentalSnapshot;
    const isOwner = session.userId === currentUserId;
    const isSimulated = env?.metadata?.calculationMode === 'ZERO_HYDRO';
    
    const GOLDEN_SECTOR_ID = import.meta.env.VITE_GOLDEN_SECTOR_ID; 

    const allowedSpecies = (session as any).speciesIds || ['Sandre', 'Brochet', 'Perche', 'Black-Bass'];
    const allSessionPhotos = session.catches
        .filter(c => c.photoUrls && c.photoUrls.length > 0)
        .map(c => c.photoUrls![0]);

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
        const tooltip = `${meta.label}: ${meta.description}${meta.formula ? ` (${meta.formula})` : ''}`;

        return (
            <div 
                title={tooltip}
                className={`${themes[meta.theme] || 'bg-stone-50'} flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[10px] font-black shrink-0 transition-transform hover:scale-105 active:scale-95`}
            >
                <Icon size={12} className="opacity-60 shrink-0" />
                <div className="flex flex-col leading-none">
                    <span className="text-[7px] opacity-50 uppercase tracking-tighter">
                        {meta.label} {isEstimated && <span className="italic text-[6px]">est.</span>}
                    </span>
                    <span>{value}{customUnit || meta.unit}</span>
                </div>
            </div>
        );
    };

    return (
        <div onClick={() => onClick && onClick(session)} className={`relative rounded-[2.5rem] p-6 border transition-all cursor-pointer group ${isOwner ? 'bg-white border-stone-100 shadow-organic hover:shadow-xl' : 'bg-[#F5F4F1] border-stone-200/60'}`}>
            
            <div className="flex justify-between items-start mb-4">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-stone-800 font-black text-sm uppercase truncate">
                        {isOwner ? (
                            <>
                                <MapPin size={14} className="text-amber-500 shrink-0" />
                                {session.locationName ? `${session.locationName} - ` : ''}{session.spotName}
                            </>
                        ) : (
                            session.userPseudo
                        )}
                        {isSimulated && (
                            <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-600 text-[8px] rounded-md flex items-center gap-0.5">
                                <Zap size={8} fill="currentColor" /> SIMULÉ
                            </span>
                        )}
                    </div>
                    <div className="text-[10px] font-bold text-stone-400 mt-0.5 flex items-center gap-2">
                        <Calendar size={10} /> {new Date(session.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })} • {session.startTime}-{session.endTime}
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {isOwner && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            <button onClick={(e) => { e.stopPropagation(); onEdit?.(session); }} className="p-2 bg-stone-50 hover:bg-amber-50 rounded-full border border-stone-100"><Edit2 size={12}/></button>
                            <button onClick={(e) => { e.stopPropagation(); onDelete?.(session.id); }} className="p-2 bg-stone-50 hover:bg-rose-50 rounded-full border border-stone-100"><Trash2 size={12}/></button>
                        </div>
                    )}
                    <div className="w-10 h-10 rounded-full border-2 border-white overflow-hidden shadow-sm bg-stone-100 flex items-center justify-center">
                        {session.userAvatar ? <img src={session.userAvatar} className="w-full h-full object-cover" alt="Avatar" /> : <User size={18} className="text-stone-300" />}
                    </div>
                </div>
            </div>

            {allSessionPhotos.length > 0 && (
                <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide">
                    {allSessionPhotos.map((url, idx) => (
                        <div key={idx} className="relative h-20 bg-stone-50/50 rounded-2xl overflow-hidden border border-stone-100 shadow-sm shrink-0 group/photo">
                            <img src={url} className="h-full w-auto block" alt={`Prise ${idx + 1}`} loading="lazy" />
                            <div className="absolute inset-0 bg-black/5 opacity-0 group-hover/photo:opacity-100 transition-opacity flex items-center justify-center">
                                <Maximize2 size={14} className="text-stone-600" />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex flex-wrap items-center gap-2 mb-5">
                {/* Rendu des indicateurs Météo */}
                {Object.entries(WEATHER_METADATA).map(([key, meta]) => {
                    let val = env?.weather?.[meta.dataKey as keyof typeof env.weather];
                    let customUnit = undefined;
                    
                    if (key === 'wind') {
                        customUnit = ` km/h ${getWindDir(env?.weather?.windDirection)}`;
                    }

                    return (
                        <MiniEnvTile 
                            key={key}
                            meta={meta} 
                            value={val !== undefined ? Math.round(val as number) : '--'} 
                            customUnit={customUnit}
                        />
                    );
                })}

                {/* Rendu des indicateurs Hydro */}
                {Object.entries(HYDRO_METADATA).map(([key, meta]) => {
                    // Masquage strict flow/level si hors Golden Sector
                    if ((key === 'flow' || key === 'level') && session.locationId !== GOLDEN_SECTOR_ID) return null;

                    let val = env?.hydro?.[meta.dataKey as keyof typeof env.hydro];
                    if (val === undefined || val === null) return null;

                    let displayVal: string | number = val as number;
                    if (key === 'waterTemp' || key === 'turbidity' || key === 'oxygen') {
                        displayVal = (val as number).toFixed(1);
                    } else if (key === 'flow') {
                        displayVal = ( (val as number) / 1000 ).toFixed(1);
                    } else {
                        displayVal = Math.round(val as number);
                    }

                    return (
                        <MiniEnvTile 
                            key={key}
                            meta={meta} 
                            value={displayVal} 
                            isEstimated={isSimulated || key === 'oxygen' || key === 'waves'}
                        />
                    );
                })}
            </div>

            {session.notes && (
                <div className="mb-5 px-4 py-3 bg-amber-50/30 rounded-2xl border border-amber-100/50 relative italic text-sm text-stone-600 leading-snug">
                    <div className="absolute -top-2 left-4 px-2 bg-white text-[8px] font-black text-amber-500 uppercase tracking-widest border border-amber-100 rounded-full">Observation</div>
                    "{session.notes}"
                </div>
            )}

            <div className="flex flex-wrap gap-2 mb-5">
                {session.catches.map(fish => (
                    <div key={fish.id} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[10px] font-black ${getSpeciesColor(fish.species as SpeciesType)} shadow-sm`}>
                        <Fish size={10} /> {fish.species} {fish.size}cm
                    </div>
                ))}
                {session.misses.map(miss => (
                    <div key={miss.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-rose-100 bg-rose-50 text-rose-700 text-[10px] font-black shadow-sm">
                        <AlertOctagon size={10} /> {miss.type}
                    </div>
                ))}
                {session.catches.length === 0 && session.misses.length === 0 && (
                    <span className="text-[10px] font-bold text-stone-300 uppercase tracking-widest">Capot</span>
                )}
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-stone-50">
                <div className="flex flex-wrap gap-4">
                    {allowedSpecies.map((label: string) => {
                        if (session.locationId === GOLDEN_SECTOR_ID && label === 'Black-Bass') return null;
                        const scoreKey = SPECIES_MAP[label];
                        const scoreValue = (env?.scores as any)?.[scoreKey];
                        if (scoreValue === undefined || scoreValue === null) return null;

                        return (
                            <div key={label} className="flex flex-col">
                                <span className="text-[8px] font-black text-stone-300 uppercase tracking-tighter">
                                    {label === 'Black-Bass' ? 'Bass' : label}
                                </span>
                                <div className="flex items-center gap-1 text-[10px] font-black text-stone-600">
                                    <Activity size={10} className={scoreValue > 50 ? "text-emerald-500" : "text-amber-500"} />
                                    {Math.round(scoreValue)}
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className={`text-[10px] font-black px-3 py-1 rounded-full ${session.feelingScore >= 7 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
                    FEELING: {session.feelingScore}/10
                </div>
            </div>
        </div>
    );
};

export default SessionCard;