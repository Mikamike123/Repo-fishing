import React from 'react';
import { 
    MapPin, Fish, Trash2, Edit2, 
    Droplets, Thermometer, Cloud, Sun, CloudSun, CloudRain, Activity 
} from 'lucide-react';
import { Session, SpeciesType } from '../types';

interface SessionCardProps {
    session: Session;
    onDelete?: (id: string) => void;
    onEdit?: (session: Session) => void;
    onClick?: (session: Session) => void;
}

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

const SessionCard: React.FC<SessionCardProps> = ({ session, onDelete, onEdit, onClick }) => {
    const dateObj = new Date(session.date);

    return (
        <div 
            onClick={() => onClick && onClick(session)}
            className="relative bg-white rounded-2xl p-5 shadow-organic border border-stone-100 hover:border-amber-200 transition-all cursor-pointer group"
        >
            <div className="absolute top-3 right-3 z-40 flex gap-2">
                {onEdit && (
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onEdit(session); }}
                        className="p-2 bg-white/90 hover:bg-amber-50 text-stone-300 hover:text-amber-600 rounded-full transition-all shadow-sm border border-transparent hover:border-amber-100"
                    >
                        <Edit2 size={16} />
                    </button>
                )}
                {onDelete && (
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onDelete(session.id); }}
                        className="p-2 bg-white/90 hover:bg-rose-50 text-stone-300 hover:text-rose-600 rounded-full transition-all shadow-sm border border-transparent hover:border-rose-100"
                    >
                        <Trash2 size={16} />
                    </button>
                )}
            </div>

            <div className="flex justify-between items-start mb-4 pb-3 border-b border-stone-50 mr-20">
                <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center justify-center bg-stone-50 rounded-xl w-12 h-12 border border-stone-100 flex-shrink-0">
                        <span className="text-[10px] uppercase font-bold text-stone-400 leading-none">{dateObj.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')}</span>
                        <span className="text-xl font-black text-stone-800 leading-none">{dateObj.getDate()}</span>
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5 text-stone-800 font-bold text-sm uppercase">
                            <MapPin size={14} className="text-amber-500" />
                            {/* CORRECTION V3.1 : Utilisation unique de spotName (App.tsx a géré le mapping) */}
                            {session.spotName || 'Spot Inconnu'}
                        </div>
                        <div className="text-[10px] font-medium text-stone-400 mt-1">
                             {session.startTime} - {session.endTime} • {session.setupName}
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center space-x-2 text-xs font-bold whitespace-nowrap hidden sm:flex">
                    <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 text-blue-900">
                        {session.weather?.temperature !== undefined ? getWeatherIcon(session.weather.clouds) : <Cloud size={14} />}
                        <span>{session.weather?.temperature !== undefined ? `${Math.round(session.weather.temperature)}°C` : 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-orange-50 text-orange-700">
                        <Thermometer size={14} className="text-orange-500" />
                        <span>{session.waterTemp ? `${session.waterTemp.toFixed(1)}°C` : 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-cyan-50 text-cyan-700">
                        <Droplets size={14} className="text-cyan-500" />
                        <span>{session.hydro?.flow ? `${session.hydro.flow.toFixed(0)}m³/s` : 'N/A'}</span>
                    </div>
                </div>
            </div>

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
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-stone-100">
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