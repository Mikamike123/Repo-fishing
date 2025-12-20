import React from 'react';
import { 
    MapPin, Fish, Trash2, Edit2, 
    Droplets, Thermometer, Cloud, Sun, CloudSun, CloudRain, Activity, Image as ImageIcon, Wind, Gauge, User, Lock, Calendar 
} from 'lucide-react'; 
import { Session, SpeciesType } from '../types';

interface SessionCardProps {
    session: Session;
    onDelete?: (id: string) => void;
    onEdit?: (session: Session) => void;
    onClick?: (session: Session) => void;
    currentUserId: string;
}

// --- HELPERS ---
const getWindDir = (deg?: number) => {
    if (deg === undefined) return '';
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
    return directions[Math.round(deg / 45) % 8];
};

const getWeatherIcon = (clouds: number) => {
    if (clouds < 20) return <Sun size={14} className="text-amber-500" />;
    if (clouds < 60) return <CloudSun size={14} className="text-stone-400" />;
    if (clouds < 90) return <Cloud size={14} className="text-stone-500" />;
    return <CloudRain size={14} className="text-stone-600" />;
};

const getSpeciesColor = (species: SpeciesType) => {
    switch (species) {
        case 'Sandre': return 'bg-amber-100 text-amber-800 border-amber-200';
        case 'Perche': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
        case 'Brochet': return 'bg-stone-200 text-stone-700 border-stone-300';
        case 'Silure': return 'bg-slate-800 text-slate-100 border-slate-700';
        default: return 'bg-stone-100 text-stone-600 border-stone-200';
    }
};

const SessionCard: React.FC<SessionCardProps> = ({ session, onDelete, onEdit, onClick, currentUserId }) => {
    const dateObj = new Date(session.date);
    const totalPhotos = session.catches?.reduce((acc, c) => acc + (c.photoUrls?.length || 0), 0) || 0;
    
    // EST-CE MA SESSION ?
    const isOwner = session.userId === currentUserId;

    return (
        <div 
            onClick={() => onClick && onClick(session)}
            className={`
                relative rounded-[2rem] p-5 border transition-all cursor-pointer group
                ${isOwner 
                    ? 'bg-white border-stone-100 hover:border-amber-200 shadow-organic' 
                    : 'bg-[#F5F4F1] border-stone-200/60 hover:border-stone-300 shadow-none opacity-95'
                }
            `}
        >
            {/* --- HEADER CARTE --- */}
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-stone-50/50">
                
                {/* 1. GAUCHE : TEXTES & INFOS */}
                <div className="flex-1 min-w-0 pr-4">
                    {/* TITRE PRINCIPAL : SPOT (Moi) ou PSEUDO (Autre) */}
                    <div className="flex items-center gap-1.5 text-stone-800 font-bold text-sm uppercase truncate">
                        {isOwner ? (
                            <>
                                <MapPin size={14} className="text-amber-500 shrink-0" />
                                <span className="truncate">{session.spotName || 'Spot Inconnu'}</span>
                            </>
                        ) : (
                            <>
                                <span className="text-stone-700 truncate">{session.userPseudo || 'Pêcheur Inconnu'}</span>
                            </>
                        )}
                    </div>

                    {/* SOUS-TITRE : DATE (Pour tous) + DÉTAILS */}
                    <div className="text-[10px] font-medium text-stone-400 mt-1 truncate flex items-center gap-1.5">
                            {/* DATE TOUJOURS VISIBLE */}
                            <span className={`flex items-center gap-1 ${isOwner ? 'text-amber-600/80 font-bold' : 'text-stone-500'}`}>
                                <Calendar size={10} />
                                {dateObj.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                            </span>
                            
                            <span>•</span>
                            <span>{session.startTime}-{session.endTime}</span>
                            
                            {isOwner ? (
                                <>
                                    <span>•</span>
                                    <span className="truncate max-w-[120px]">{session.setupName}</span>
                                </>
                            ) : (
                                <>
                                    <span>•</span>
                                    <span className="truncate max-w-[120px]">{session.spotName}</span>
                                </>
                            )}
                    </div>
                </div>

                {/* 2. DROITE : ACTIONS & AVATAR (POUR TOUS) */}
                <div className="flex items-center gap-3 flex-shrink-0">
                    
                    {/* BOUTONS D'ACTION (Seulement si Owner) */}
                    {isOwner ? (
                        <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            {onEdit && (
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); onEdit(session); }}
                                    className="p-2 bg-white hover:bg-amber-50 text-stone-300 hover:text-amber-600 rounded-full border border-stone-100 hover:border-amber-200 shadow-sm transition-all"
                                >
                                    <Edit2 size={14} />
                                </button>
                            )}
                            {onDelete && (
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); onDelete(session.id); }}
                                    className="p-2 bg-white hover:bg-rose-50 text-stone-300 hover:text-rose-600 rounded-full border border-stone-100 hover:border-rose-200 shadow-sm transition-all"
                                >
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>
                    ) : (
                        // Petit cadenas discret pour les autres
                        <div className="hidden sm:flex text-stone-300">
                            <Lock size={12} />
                        </div>
                    )}

                    {/* AVATAR : TOUJOURS VISIBLE MAINTENANT */}
                    <div className={`w-12 h-12 rounded-full border-2 shadow-sm flex items-center justify-center overflow-hidden flex-shrink-0 ${isOwner ? 'border-amber-200 bg-amber-50 ring-2 ring-amber-50' : 'border-white bg-white'}`}>
                        {session.userAvatar ? (
                            <img src={session.userAvatar} alt="User" className="w-full h-full object-cover" />
                        ) : (
                            <User size={20} className={isOwner ? "text-amber-400" : "text-stone-300"} />
                        )}
                    </div>
                </div>
            </div>
            
            {/* BARRE MÉTÉO */}
            <div className="flex items-center gap-2 text-xs font-bold whitespace-nowrap overflow-x-auto scrollbar-hide mb-4 pb-1">
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 text-blue-900 shrink-0">
                    {session.weather?.temperature !== undefined ? getWeatherIcon(session.weather.clouds) : <Cloud size={14} />}
                    <span>{session.weather?.temperature !== undefined ? `${Math.round(session.weather.temperature)}°C` : 'N/A'}</span>
                </div>
                {session.weather?.windSpeed !== undefined && (
                    <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-stone-100 text-stone-600 shrink-0">
                        <Wind size={14} className="text-stone-400" />
                        <span>{Math.round(session.weather.windSpeed)} {getWindDir(session.weather.windDirection)}</span>
                    </div>
                )}
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-orange-50 text-orange-700 shrink-0">
                    <Thermometer size={14} className="text-orange-500" />
                    <span>{session.waterTemp ? `${session.waterTemp.toFixed(1)}°C` : 'N/A'}</span>
                </div>
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-cyan-50 text-cyan-700 shrink-0">
                    <Droplets size={14} className="text-cyan-500" />
                    <span>{session.hydro?.flow ? `${session.hydro.flow.toFixed(0)}` : 'N/A'}</span>
                </div>
            </div>

            {/* TAGS POISSONS */}
            <div className="flex flex-wrap gap-2 mb-4">
                {session.catches.length > 0 ? (
                    session.catches.map(fish => (
                        <div key={fish.id} className={`flex items-center gap-1.5 px-2 py-1 rounded-full border text-[10px] font-bold ${getSpeciesColor(fish.species)}`}>
                            <Fish size={10} /> {fish.species} {fish.size}cm
                        </div>
                    ))
                ) : (
                    <span className="text-[10px] italic text-stone-400 bg-stone-50 px-3 py-1 rounded-lg">Capot</span>
                )}
                
                {totalPhotos > 0 && (
                    <div className="flex items-center gap-1 px-2 py-1 rounded-full border border-blue-100 bg-blue-50 text-blue-600 text-[10px] font-bold">
                        <ImageIcon size={10} /> {totalPhotos}
                    </div>
                )}
            </div>

            {/* FOOTER */}
            <div className="flex justify-between items-center pt-3 border-t border-stone-100/50">
                <div className="flex flex-col">
                    <span className="text-[9px] uppercase font-bold text-stone-400">Score Bio</span>
                    <div className="flex items-center gap-1">
                        <Activity size={12} className={session.bioScore && session.bioScore > 50 ? "text-emerald-500" : "text-amber-500"} />
                        <span className="text-xs font-bold text-stone-700">{session.bioScore ?? '--'}/100</span>
                    </div>
                </div>
                <div className={`text-[10px] font-bold px-3 py-1 rounded-full ${session.feelingScore >= 7 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                    Feeling: {session.feelingScore}/10
                </div>
            </div>
        </div>
    );
};

export default SessionCard;