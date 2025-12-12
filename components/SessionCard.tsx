import React from 'react';
import { Calendar, Clock, Cloud, Sun, CloudRain, CloudFog, Fish, Trophy, AlertOctagon, MapPin, Activity, CloudSun, Trash2 } from 'lucide-react';
import { Session, SpeciesType } from '../types';

interface SessionCardProps {
  session: Session;
  onDelete?: (id: string) => void;
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

const SessionCard: React.FC<SessionCardProps> = ({ session, onDelete }) => {
  const dateObj = new Date(session.date);
  const isSuccess = session.catchCount > 0;

  return (
    <div className="relative bg-white rounded-2xl p-5 shadow-organic border border-stone-100 hover:shadow-lg hover:border-amber-100 transition-all duration-300 group">
      
      {/* Delete Button (Direct Action - No Confirm for Preview Compatibility) */}
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            // Direct delete call to bypass potential window.confirm blocks in preview
            onDelete(session.id);
          }}
          className="absolute top-3 right-3 z-50 p-2.5 bg-white/80 hover:bg-rose-50 text-stone-400 hover:text-rose-600 rounded-full transition-all shadow-sm border border-transparent hover:border-rose-100 cursor-pointer active:scale-95"
          title="Supprimer la session"
        >
          <Trash2 size={18} className="pointer-events-none" />
        </button>
      )}

      {/* A. EN-TÊTE (Contexte) */}
      <div className="flex justify-between items-start mb-4 pb-3 border-b border-stone-50 mr-10"> {/* Margin-right increased to avoid overlap */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center justify-center bg-stone-50 rounded-xl w-12 h-12 border border-stone-100">
             <span className="text-[10px] uppercase font-bold text-stone-400 leading-none">{dateObj.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')}</span>
             <span className="text-xl font-black text-stone-800 leading-none">{dateObj.getDate()}</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-stone-800 font-bold text-sm">
               <MapPin size={14} className="text-amber-500" />
               {session.zone}
            </div>
            <div className="flex items-center gap-2 mt-1">
               <span className="text-[10px] font-medium text-stone-400 bg-stone-50 px-2 py-0.5 rounded-md border border-stone-100">
                  {session.startTime} - {session.endTime}
               </span>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-1">
           <div className="flex items-center gap-1.5 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100">
              {getWeatherIcon(session.weather.clouds)}
              <span className="text-xs font-bold text-blue-900">{Math.round(session.weather.temperature)}°C</span>
           </div>
           <span className="text-[10px] font-bold text-stone-300 flex items-center gap-1">
             <Clock size={10} /> {session.durationMinutes} min
           </span>
        </div>
      </div>

      {/* B. RÉSULTAT (Le Verdict) */}
      <div className="min-h-[3rem] mb-4">
        {isSuccess ? (
          <div className="flex flex-wrap gap-2">
            {session.catches.map((fish) => (
              <div 
                key={fish.id} 
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold shadow-sm ${getSpeciesColor(fish.species)}`}
              >
                <Fish size={12} />
                <span>{fish.species}</span>
                <span className="opacity-60 text-[10px]">|</span>
                <span>{fish.size}</span>
              </div>
            ))}
            {/* Medals/Badges Logic Placeholder */}
            {session.catches.some(c => c.size > 60) && (
               <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-50 border border-yellow-200 text-yellow-700 text-[10px] font-bold">
                 <Trophy size={10} /> BIG
               </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-stone-400 bg-stone-50/50 p-2 rounded-lg border border-dashed border-stone-200">
            <Fish size={16} className="text-stone-300" />
            <span className="text-xs font-medium italic">Pas de prise (Capot)</span>
          </div>
        )}
        
        {/* Misses Indicator */}
        {session.misses.length > 0 && (
           <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-rose-400">
              <AlertOctagon size={10} />
              {session.misses.length} Occasion(s) manquée(s)
           </div>
        )}
      </div>

      {/* C. FOOTER (Analyse) */}
      <div className="flex justify-between items-center pt-3 border-t border-stone-100">
        <div className="flex gap-4">
          <div className="flex flex-col">
            <span className="text-[9px] uppercase font-bold text-stone-400">Score Bio</span>
            <div className="flex items-center gap-1">
               <Activity size={12} className={session.bioScore > 50 ? "text-emerald-500" : "text-amber-500"} />
               <span className="text-sm font-bold text-stone-700">{session.bioScore}/100</span>
            </div>
          </div>
          <div className="w-px h-8 bg-stone-100 mx-1"></div>
          <div className="flex flex-col">
            <span className="text-[9px] uppercase font-bold text-stone-400">Score Réel</span>
            <span className={`text-sm font-bold ${isSuccess ? 'text-stone-800' : 'text-stone-300'}`}>
              {session.catchCount} Fish
            </span>
          </div>
        </div>
      </div>

    </div>
  );
};

export default SessionCard;