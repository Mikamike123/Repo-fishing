import React from 'react';
import { X, Calendar, Clock, Anchor, Activity, CloudSun, Fish, AlertOctagon, Trophy, Image as ImageIcon, ExternalLink } from 'lucide-react';
import { Session, SpeciesType } from '../types';

interface SessionDetailModalProps {
  session: Session | null;
  isOpen: boolean;
  onClose: () => void;
}

const SessionDetailModal: React.FC<SessionDetailModalProps> = ({ session, isOpen, onClose }) => {
  if (!isOpen || !session) return null;

  const dateObj = new Date(session.date);
  const getSpeciesColor = (species: SpeciesType) => {
      switch (species) {
          case 'Sandre': return 'bg-amber-100 text-amber-800 border-amber-200';
          case 'Perche': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
          case 'Brochet': return 'bg-stone-200 text-stone-700 border-stone-300';
          case 'Silure': return 'bg-slate-800 text-slate-100 border-slate-700';
          default: return 'bg-stone-100 text-stone-600 border-stone-200';
      }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      
      <div className="w-[95%] sm:w-full max-w-2xl bg-[#fdfbf7] rounded-3xl shadow-2xl max-h-[85vh] flex flex-col border border-stone-200 relative overflow-hidden">
        
        {/* HEADER */}
        <div className="relative bg-stone-800 p-5 sm:p-6 text-white shrink-0">
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/20 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
            
            <button 
                onClick={onClose} 
                className="absolute top-3 right-3 sm:top-4 sm:right-4 z-50 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors backdrop-blur-md cursor-pointer active:scale-95"
            >
                <X size={20} className="text-white" />
            </button>
            
            <div className="relative z-10">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                    <span className="px-2.5 py-0.5 bg-amber-500 text-white text-[10px] font-bold uppercase tracking-widest rounded-full shadow-lg shadow-amber-500/20">
                        Terminée
                    </span>
                    <span className="text-stone-400 text-xs sm:text-sm font-medium flex items-center gap-1">
                        <Calendar size={14} /> {dateObj.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                </div>
                
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight mb-3 sm:mb-4 truncate pr-8">{session.zone}</h2>
                
                <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs sm:text-sm font-medium text-stone-300">
                    <div className="flex items-center gap-1.5"><Clock size={14} className="text-amber-400"/> {session.startTime} - {session.endTime}</div>
                    <div className="flex items-center gap-1.5"><Anchor size={14} className="text-amber-400"/> {session.setup}</div>
                    <div className="flex items-center gap-1.5"><Activity size={14} className="text-emerald-400"/> Feeling {session.feelingScore}/10</div>
                </div>
            </div>
        </div>

        {/* CONTENU SCROLLABLE */}
        <div className="p-5 sm:p-6 space-y-6 sm:space-y-8 overflow-y-auto">
            
            {/* 1. Conditions Environnementales */}
            <section>
                <h3 className="text-xs sm:text-sm font-bold text-stone-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <CloudSun size={16} /> Conditions
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-white p-3 rounded-xl border border-stone-100 shadow-sm text-center">
                        <div className="text-stone-400 text-[10px] uppercase font-bold mb-1">Ciel</div>
                        <div className="font-bold text-stone-700 text-sm sm:text-base">{session.weather?.clouds ?? 'N/A'}%</div>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-stone-100 shadow-sm text-center">
                        <div className="text-stone-400 text-[10px] uppercase font-bold mb-1">Air</div>
                        <div className="font-bold text-stone-700 text-sm sm:text-base">{session.weather?.temperature?.toFixed(1) ?? 'N/A'}°C</div>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-stone-100 shadow-sm text-center">
                        <div className="text-stone-400 text-[10px] uppercase font-bold mb-1">Eau (J-1)</div>
                        <div className="font-bold text-orange-600 text-sm sm:text-base">{session.waterTemp !== null && session.waterTemp !== undefined ? session.waterTemp.toFixed(1) : 'N/A'}°C</div>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-stone-100 shadow-sm text-center">
                        <div className="text-stone-400 text-[10px] uppercase font-bold mb-1">Débit</div>
                        <div className="font-bold text-cyan-600 text-sm sm:text-base">{session.hydro?.flow !== undefined ? session.hydro.flow.toFixed(0) : 'N/A'} m³/s</div>
                    </div>
                </div>
            </section>

            {/* 2. Tableau de Chasse (Timeline) */}
            <section>
                <div className="flex justify-between items-end mb-4">
                    <h3 className="text-xs sm:text-sm font-bold text-stone-400 uppercase tracking-widest flex items-center gap-2">
                        <Fish size={16} /> Prises ({session.catches?.length || 0})
                    </h3>
                </div>

                {session.catches && session.catches.length > 0 ? (
                    <div className="space-y-3">
                        {session.catches.map((c) => (
                            <div key={c.id} className="bg-white p-3 sm:p-4 rounded-xl border border-stone-100 shadow-sm flex flex-col gap-3">
                                
                                <div className="flex items-start sm:items-center gap-3 sm:gap-4">
                                    {/* Heure */}
                                    <div className="flex flex-col items-center justify-center w-10 h-10 sm:w-12 sm:h-12 bg-stone-50 rounded-lg border border-stone-100 shrink-0">
                                        <span className="text-[10px] sm:text-xs font-bold text-stone-500">
                                            {c.timestamp instanceof Object && 'toDate' in c.timestamp 
                                                ? (c.timestamp as any).toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
                                                : new Date(c.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
                                            }
                                        </span>
                                    </div>

                                    {/* Détails */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2 mb-1">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase whitespace-nowrap ${getSpeciesColor(c.species)}`}>
                                                {c.species}
                                            </span>
                                            <span className="font-black text-base sm:text-lg text-stone-800">{c.size} cm</span>
                                            {c.size > 60 && <Trophy size={14} className="text-yellow-500 shrink-0" />}
                                        </div>
                                        <div className="text-[10px] sm:text-xs text-stone-400 truncate">
                                            {c.technique} • {c.lure || 'Leurre inconnu'} • {c.zone}
                                        </div>
                                    </div>
                                </div>

                                {/* NOUVEAU: Affichage des boutons photos si présents */}
                                {c.photoUrls && c.photoUrls.length > 0 && (
                                    <div className="flex gap-2 pt-2 border-t border-stone-50">
                                        {c.photoUrls.map((url, idx) => (
                                            <a 
                                                key={idx} 
                                                href={url} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors"
                                            >
                                                <ImageIcon size={14} />
                                                <span>Photo {idx + 1}</span>
                                                <ExternalLink size={10} />
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center p-6 bg-stone-50 rounded-xl border border-dashed border-stone-200 text-stone-400 text-xs sm:text-sm">
                        Aucune prise enregistrée (Capot).
                    </div>
                )}
            </section>

            {/* 3. Les Ratés */}
            {session.misses && session.misses.length > 0 && (
                <section>
                    <h3 className="text-xs sm:text-sm font-bold text-rose-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <AlertOctagon size={16} /> Occasions Manquées
                    </h3>
                    <div className="space-y-2">
                        {session.misses.map((m) => (
                            <div key={m.id} className="flex items-center justify-between bg-rose-50/50 p-3 rounded-lg border border-rose-100">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="w-10 text-center text-[10px] sm:text-xs font-bold text-rose-400/70 border-r border-rose-200 pr-2 shrink-0">
                                        {m.timestamp instanceof Object && 'toDate' in m.timestamp 
                                            ? (m.timestamp as any).toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
                                            : new Date(m.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
                                        }
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <div className="flex items-center gap-2">
                                            <AlertOctagon size={14} className="text-rose-400 shrink-0" />
                                            <span className="text-xs sm:text-sm font-medium text-stone-700 truncate">{m.type}</span>
                                        </div>
                                        <span className="text-[10px] text-stone-400 truncate ml-5">({m.speciesSupposed})</span>
                                    </div>
                                </div>
                                <span className="text-[10px] sm:text-xs font-bold text-rose-400 whitespace-nowrap ml-2">{m.estimation}</span>
                            </div>
                        ))}
                    </div>
                </section>
            )}

        </div>
      </div>
    </div>
  );
};

export default SessionDetailModal;