import React from 'react';
import { 
    X, Calendar, Clock, Anchor, Activity, CloudSun, Fish, Trophy, 
    Wind, Droplets, Image as ImageIcon, Gauge, Thermometer, 
    Waves, Eye, CloudRain, AlertOctagon 
} from 'lucide-react';
import { Session, SpeciesType } from '../types';

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

    return (
      <div className={`${containerClass} p-3 rounded-2xl border shadow-sm flex flex-col items-center justify-center text-center transition-transform hover:scale-[1.02]`}>
        <Icon size={16} className={`${iconClass} mb-1`} />
        <div className="text-[8px] font-black opacity-60 uppercase tracking-tighter mb-0.5">{label}</div>
        <div className="text-sm font-black">
          {value !== undefined && value !== null ? value : '--'}
          <span className="text-[10px] ml-0.5 font-bold opacity-50">{unit}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-[#fdfbf7] rounded-[2.5rem] shadow-2xl max-h-[95vh] flex flex-col border border-stone-200 relative overflow-hidden">
        
        {/* HEADER */}
        <div className="relative bg-stone-800 p-8 text-white shrink-0">
          <button onClick={onClose} className="absolute top-6 right-6 z-50 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all">
            <X size={24} />
          </button>
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-amber-500 text-white text-[10px] font-black uppercase rounded-full shadow-lg shadow-amber-500/20">Archive Oracle</span>
                <span className="text-stone-400 text-xs font-bold flex items-center gap-1 uppercase tracking-tighter">
                  <Calendar size={14} /> {new Date(session.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </span>
              </div>
              <h2 className="text-4xl font-black tracking-tighter uppercase leading-none">{session.spotName || 'Spot Inconnu'}</h2>
              <div className="flex flex-wrap gap-4 text-xs font-bold text-stone-300 uppercase tracking-wide pt-2">
                <div className="flex items-center gap-1.5"><Clock size={14} className="text-amber-400"/> {session.startTime} - {session.endTime}</div>
                <div className="flex items-center gap-1.5"><Anchor size={14} className="text-amber-400"/> {session.setupName}</div>
                <div className="flex items-center gap-1.5"><Activity size={14} className="text-emerald-400"/> Feeling {session.feelingScore}/10</div>
              </div>
            </div>

            <div className="flex gap-2 bg-black/20 p-4 rounded-3xl border border-white/5">
                {[
                  { label: 'Sandre', val: env?.scores?.sandre },
                  { label: 'Brochet', val: env?.scores?.brochet },
                  { label: 'Perche', val: env?.scores?.perche }
                ].map(s => (
                  <div key={s.label} className="flex flex-col items-center px-3 border-r last:border-0 border-white/10">
                    <span className="text-[8px] font-black text-stone-400 uppercase">{s.label}</span>
                    <span className={`text-lg font-black ${getScoreColor(s.val || 0)}`}>{s.val?.toFixed(0) || '--'}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* CONTENT */}
        <div className="p-6 space-y-8 overflow-y-auto bg-stone-50/50">
          
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* ATMOSPHÈRE */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] flex items-center gap-2 ml-1">
                <CloudSun size={14} /> Atmosphère
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <DataTile label="Couverture" value={env?.weather?.cloudCover} unit="%" icon={CloudSun} theme="slate" />
                <DataTile label="Temp. Air" value={env?.weather?.temperature ? Math.round(env.weather.temperature) : null} unit="°C" icon={Thermometer} theme="rose" />
                <DataTile label="Pression" value={env?.weather?.pressure?.toFixed(0)} unit="hPa" icon={Gauge} theme="indigo" />
                <DataTile label="Vitesse Vent" value={env?.weather?.windSpeed ? Math.round(env.weather.windSpeed) : null} unit="km/h" icon={Wind} theme="amber" />
                <DataTile label="Direction" value={getWindDir(env?.weather?.windDir)} unit="" icon={Wind} theme="amber" />
                <DataTile label="Précip." value={env?.weather?.precip} unit="mm" icon={CloudRain} theme="blue" />
              </div>
            </div>

            {/* HYDROLOGIE */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] flex items-center gap-2 ml-1">
                <Waves size={14} /> Hydrologie
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <DataTile label="Temp. Eau" value={env?.hydro?.waterTemp?.toFixed(1)} unit="°C" icon={Thermometer} theme="orange" />
                <DataTile label="Débit" value={env?.hydro?.flowLagged?.toFixed(0)} unit="m³/s" icon={Droplets} theme="cyan" />
                <DataTile label="Niveau" value={env?.hydro?.level} unit="mm" icon={Waves} theme="slate" />
                <DataTile label="Clarté (Idx)" value={env?.hydro?.turbidityIdx?.toFixed(2)} unit="" icon={Eye} theme="emerald" />
                <div className="col-span-2 bg-stone-100/40 rounded-2xl flex items-center justify-center p-3 border border-stone-200/50">
                  <div className="text-center">
                    <div className="text-[8px] font-black text-stone-400 uppercase tracking-tighter mb-0.5">Snapshot ID</div>
                    <div className="text-[10px] font-bold text-stone-500 font-mono">{env?.metadata?.sourceLogId || 'N/A'}</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* TABLEAU D'ÉVÉNEMENTS (PRISES + RATÉS) */}
          <section className="space-y-4">
            <h3 className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] flex items-center gap-2 ml-1">
              <Fish size={14} /> Événements de Session ({session.catches.length + session.misses.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Affichage des Prises */}
              {session.catches.map((c) => (
                <div key={c.id} className="bg-white p-5 rounded-[2rem] border border-stone-100 shadow-sm hover:border-amber-200 transition-colors">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex gap-2 items-center">
                      <div className="px-3 py-1 bg-stone-50 rounded-xl text-[10px] font-black text-stone-500">{formatCatchTime(c)}</div>
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${getSpeciesColor(c.species)}`}>{c.species}</span>
                      {c.size >= 60 && <Trophy size={16} className="text-amber-500" />}
                    </div>
                    <span className="text-3xl font-black text-stone-800 tracking-tighter">{c.size}<span className="text-sm text-stone-400 ml-0.5">cm</span></span>
                  </div>
                  
                  <div className="flex items-center justify-between pt-4 border-t border-stone-50">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-stone-600 uppercase">
                            <Anchor size={12} className="text-stone-300"/> {c.technique}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-amber-600 uppercase">
                            <Fish size={12} className="text-amber-300"/> {c.lureName}
                        </div>
                    </div>

                    {c.photoUrls && c.photoUrls.length > 0 && (
                        <div className="flex gap-1.5">
                            {c.photoUrls.map((url, idx) => (
                                <button key={idx} onClick={(e) => { e.stopPropagation(); openPhotoLink(url); }} className="w-10 h-10 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-2xl transition-all flex items-center justify-center shadow-sm">
                                    <ImageIcon size={18} />
                                </button>
                            ))}
                        </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Affichage des Ratés */}
              {session.misses.map((m) => (
                <div key={m.id} className="bg-rose-50/30 p-5 rounded-[2rem] border border-rose-100 shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                      <div className="flex gap-2 items-center">
                        <div className="px-3 py-1 bg-white rounded-xl text-[10px] font-black text-rose-400">{formatCatchTime(m)}</div>
                        <span className="px-2.5 py-1 bg-rose-500 text-white rounded-lg text-[10px] font-black uppercase shadow-sm">RATÉ</span>
                      </div>
                      <AlertOctagon className="text-rose-500" size={24} />
                  </div>
                  <div className="text-sm font-black text-rose-800 uppercase tracking-tight mb-2">{m.type}</div>
                  {/* Le message "enregistré dans les archives" a été supprimé ici pour épurer le design */}
                </div>
              ))}

              {session.catches.length === 0 && session.misses.length === 0 && (
                <div className="col-span-full py-12 text-center bg-white/50 rounded-[2rem] border border-stone-200 border-dashed italic text-stone-400">Capot intégral.</div>
              )}
            </div>
          </section>

          {/* OBSERVATIONS */}
          {session.notes && (
            <section className="space-y-4">
              <h3 className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] flex items-center gap-2 ml-1">
                <ImageIcon size={14} /> Observations Michael
              </h3>
              <div className="bg-amber-50/20 p-6 rounded-[2rem] border border-amber-100/50 text-stone-600 text-sm leading-relaxed font-medium italic shadow-inner">
                "{session.notes}"
              </div>
            </section>
          )}
        </div>
        
        <div className="p-4 bg-white border-t border-stone-100 text-center">
            <span className="text-[8px] font-black text-stone-300 uppercase tracking-widest">Seine Oracle v4.5 RAG-Ready • Precision Fisheries Archive</span>
        </div>
      </div>
    </div>
  );
};

export default SessionDetailModal;