import React from 'react';
import { X, Calendar, Clock, Anchor, Activity, CloudSun, Fish, AlertOctagon, Trophy, Wind, Droplets } from 'lucide-react';
import { Session, SpeciesType } from '../types';

interface SessionDetailModalProps {
  session: Session | null;
  isOpen: boolean;
  onClose: () => void;
}

const SessionDetailModal: React.FC<SessionDetailModalProps> = ({ session, isOpen, onClose }) => {
  if (!isOpen || !session) return null;

  // FIX: Fonction de formatage sécurisée pour les prises
  const formatCatchTime = (timestamp: any) => {
    try {
      if (!timestamp) return "--:--";
      // Si c'est un Timestamp Firestore (objet avec seconds)
      if (timestamp && typeof timestamp === 'object' && 'seconds' in timestamp) {
        return new Date(timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      // Si c'est une string ISO ou un objet Date
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return "--:--";
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return "--:--";
    }
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-[#fdfbf7] rounded-3xl shadow-2xl max-h-[90vh] flex flex-col border border-stone-200 relative overflow-hidden">
        <div className="relative bg-stone-800 p-6 text-white shrink-0">
          <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="absolute top-4 right-4 z-50 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-all">
            <X size={20} />
          </button>
          <div className="relative z-10 pr-12">
            <div className="flex items-center gap-3 mb-2">
              <span className="px-2.5 py-0.5 bg-amber-500 text-white text-[10px] font-bold uppercase rounded-full">Session Terminée</span>
              <span className="text-stone-400 text-xs font-medium flex items-center gap-1">
                <Calendar size={14} /> {new Date(session.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </span>
            </div>
            <h2 className="text-3xl font-black tracking-tight mb-4 text-white uppercase">{session.zoneName}</h2>
            <div className="flex flex-wrap gap-4 text-xs font-medium text-stone-300">
              <div className="flex items-center gap-1.5"><Clock size={14} className="text-amber-400"/> {session.startTime} - {session.endTime}</div>
              <div className="flex items-center gap-1.5"><Anchor size={14} className="text-amber-400"/> {session.setupName}</div>
              <div className="flex items-center gap-1.5"><Activity size={14} className="text-emerald-400"/> Feeling {session.feelingScore}/10</div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-8 overflow-y-auto bg-stone-50/30">
          <section>
            <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4 flex items-center gap-2"><CloudSun size={16} /> Conditions Météo & Hydro</h3>
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-white p-3 rounded-2xl border border-stone-100 shadow-sm text-center">
                <div className="text-stone-400 text-[9px] uppercase font-bold mb-1">Ciel</div>
                <div className="font-bold text-stone-700 text-sm">{session.weather?.clouds ?? 'N/A'}%</div>
              </div>
              <div className="bg-white p-3 rounded-2xl border border-stone-100 shadow-sm text-center">
                <div className="text-stone-400 text-[9px] uppercase font-bold mb-1">Pression</div>
                <div className="font-bold text-indigo-600 text-sm">{session.weather?.pressure?.toFixed(0) ?? 'N/A'} hPa</div>
              </div>
              <div className="bg-white p-3 rounded-2xl border border-stone-100 shadow-sm text-center">
                <div className="text-stone-400 text-[9px] uppercase font-bold mb-1">Eau</div>
                <div className="font-bold text-orange-600 text-sm">{session.waterTemp ? `${session.waterTemp.toFixed(1)}°C` : 'N/A'}</div>
              </div>
              <div className="bg-white p-3 rounded-2xl border border-stone-100 shadow-sm text-center">
                <div className="text-stone-400 text-[9px] uppercase font-bold mb-1">Débit</div>
                <div className="font-bold text-cyan-600 text-sm">{session.hydro?.flow ? `${session.hydro.flow.toFixed(0)}m³/s` : 'N/A'}</div>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Fish size={16} /> Tableau de Chasse ({session.catches.length})</h3>
            <div className="space-y-4">
              {session.catches.length > 0 ? session.catches.map((c) => (
                <div key={c.id} className="bg-white p-4 rounded-2xl border border-stone-100 shadow-sm">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex gap-3 items-center">
                      <div className="px-3 py-1 bg-stone-50 rounded-lg text-xs font-bold text-stone-500">
                        {formatCatchTime(c.timestamp)}
                      </div>
                      <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${getSpeciesColor(c.species)}`}>{c.species}</span>
                      {c.size >= 60 && <Trophy size={14} className="text-amber-500" />}
                    </div>
                    <span className="text-2xl font-black text-stone-800">{c.size}cm</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-stone-400 uppercase border-t border-stone-50 pt-3">
                    <div className="flex items-center gap-1.5"><Wind size={12} className="text-stone-300"/> {c.technique}</div>
                    <div className="flex items-center gap-1.5"><Droplets size={12} className="text-stone-300"/> {c.lure || 'Leurre Inconnu'}</div>
                  </div>
                </div>
              )) : <div className="text-center py-8 text-stone-400 italic">Capot.</div>}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default SessionDetailModal;