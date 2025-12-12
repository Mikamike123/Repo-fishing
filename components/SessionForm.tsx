import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Anchor, 
  Activity, 
  Save, 
  Wind, 
  Droplets, 
  CloudSun,
  AlertTriangle,
  CheckCircle2,
  Leaf,
  Fish,
  Plus,
  X,
  AlertOctagon
} from 'lucide-react';
import { calculateBioScore } from '../lib/algorithms';
import { getSimulatedConditions } from '../lib/simulation';
import { BioConditions, ZoneType, Catch, Miss, SpeciesType, TechniqueType, Session } from '../types';
import CatchDialog from './CatchDialog';
import MissDialog from './MissDialog';

interface SessionFormProps {
  onAddSession: (session: Session) => void;
  availableZones: string[];
  availableSetups: string[];
  availableTechniques: string[];
}

// Gamification Logic
const getTrophyIcon = (species: SpeciesType, size: number) => {
  if (species === 'Perche' && size >= 40) return '💎';
  if (species === 'Perche' && size >= 30) return '👑';
  
  if (species === 'Sandre' && size >= 80) return '💎';
  if (species === 'Sandre' && size >= 60) return '👑';
  
  if (species === 'Brochet' && size >= 100) return '💎';
  if (species === 'Brochet' && size >= 70) return '👑';

  if (species === 'Silure' && size >= 150) return '💎';
  if (species === 'Silure' && size >= 100) return '👑';

  return null;
};

// Robust ID Generator
const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch (e) {
      console.warn("crypto.randomUUID failed, using fallback");
    }
  }
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
};

const SessionForm: React.FC<SessionFormProps> = ({ 
  onAddSession, 
  availableZones, 
  availableSetups, 
  availableTechniques 
}) => {
  // Form State
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState<string>("08:00");
  const [endTime, setEndTime] = useState<string>("11:00");
  const [zone, setZone] = useState<string>(availableZones[0] || "Default");
  const [setup, setSetup] = useState<string>(availableSetups[0] || "Default");
  const [feeling, setFeeling] = useState<number>(5);

  // Catch & Miss State
  const [catches, setCatches] = useState<Catch[]>([]);
  const [misses, setMisses] = useState<Miss[]>([]);
  const [isCatchModalOpen, setIsCatchModalOpen] = useState(false);
  const [isMissModalOpen, setIsMissModalOpen] = useState(false);

  // Ensure zone/setup defaults are valid if lists change
  useEffect(() => {
    if (availableZones.length > 0 && !availableZones.includes(zone)) {
        setZone(availableZones[0]);
    }
    if (availableSetups.length > 0 && !availableSetups.includes(setup)) {
        setSetup(availableSetups[0]);
    }
  }, [availableZones, availableSetups, zone, setup]);

  // Derived Conditions
  const conditions = useMemo(() => {
    return getSimulatedConditions(date, startTime);
  }, [date, startTime]);

  const bioScore = useMemo(() => {
    return calculateBioScore(conditions);
  }, [conditions]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Calculate duration in minutes
    const start = new Date(`1970-01-01T${startTime}:00`);
    const end = new Date(`1970-01-01T${endTime}:00`);
    const durationMs = end.getTime() - start.getTime();
    const durationMinutes = Math.max(0, Math.floor(durationMs / 60000));

    // Data Integrity: Constructing the full session payload
    const newSession: Session = {
      id: generateId(),
      date: new Date(`${date}T${startTime}`),
      startTime,
      endTime,
      durationMinutes,
      zone: zone,
      setup: setup,
      feelingScore: feeling,
      // CRITICAL: Saving Environmental Snapshots
      weather: conditions.currentWeather,
      hydro: conditions.currentHydro,
      bioScore: bioScore,
      catches: catches,
      misses: misses,
      catchCount: catches.length
    };
    
    // Simulate API Delay
    setTimeout(() => {
        onAddSession(newSession);
    }, 500);
  };

  // Handlers
  const handleAddCatch = (data: { species: SpeciesType; size: number; technique: TechniqueType; lure: string; zone: ZoneType }) => {
    const newCatch: Catch = {
      id: Math.random().toString(36).substr(2, 9),
      ...data,
      timestamp: new Date()
    };
    setCatches([...catches, newCatch]);
  };

  const handleRemoveCatch = (id: string) => {
    setCatches(catches.filter(c => c.id !== id));
  };

  const handleAddMiss = (data: Omit<Miss, 'id' | 'timestamp'>) => {
    const newMiss: Miss = {
      id: Math.random().toString(36).substr(2, 9),
      ...data,
      timestamp: new Date()
    };
    setMisses([...misses, newMiss]);
  };
  
  const handleRemoveMiss = (id: string) => {
    setMisses(misses.filter(m => m.id !== id));
  };

  // Styles Helpers
  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-emerald-700';
    if (score >= 40) return 'text-amber-700';
    return 'text-orange-800';
  };

  const getScoreBg = (score: number) => {
    if (score >= 70) return 'bg-emerald-50 border-emerald-100';
    if (score >= 40) return 'bg-amber-50 border-amber-100';
    return 'bg-orange-50 border-orange-100';
  };

  const getScoreIcon = (score: number) => {
     if (score >= 70) return <CheckCircle2 size={18} className="text-emerald-600" />;
     if (score >= 40) return <Leaf size={18} className="text-amber-600" />;
     return <AlertTriangle size={18} className="text-orange-600" />;
  };

  const deltaP = (conditions.currentWeather.pressure - conditions.pressureTMinus3h).toFixed(1);
  const deltaQ = (conditions.currentHydro.flow - conditions.flowTMinus24h).toFixed(1);

  return (
    <div className="w-full max-w-5xl mx-auto pb-24"> {/* Added padding bottom for Nav Bar */}
      <CatchDialog 
        isOpen={isCatchModalOpen} 
        onClose={() => setIsCatchModalOpen(false)} 
        onSave={handleAddCatch}
        initialZone={zone}
        availableZones={availableZones}
        availableTechniques={availableTechniques}
      />
      
      <MissDialog
        isOpen={isMissModalOpen}
        onClose={() => setIsMissModalOpen(false)}
        onSave={handleAddMiss}
        initialZone={zone}
        availableZones={availableZones}
      />

      <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-organic border border-stone-100 overflow-hidden">
        
        {/* Header */}
        <div className="bg-white px-8 py-6 border-b border-stone-100 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-stone-800 tracking-tight">Nouvelle Session</h2>
            <p className="text-sm text-stone-500 mt-1">Enregistrement et analyse post-session</p>
          </div>
          <div className="h-10 w-10 bg-stone-50 text-stone-400 rounded-xl flex items-center justify-center border border-stone-100">
            <Anchor size={20} />
          </div>
        </div>

        <div className="flex flex-col lg:flex-row">
          
          {/* Main Form Fields */}
          <div className="flex-1 p-8 space-y-8">
            
            {/* BIG TACTILE INPUTS SECTION */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-2">
                  <Calendar size={14} /> Date
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Calendar className="text-stone-400" size={24} />
                  </div>
                  <input 
                    type="date" 
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    onClick={(e) => e.currentTarget.showPicker()}
                    className="w-full h-16 bg-white border border-stone-200 rounded-xl pl-12 pr-4 text-xl font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all appearance-none cursor-pointer"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-2">
                  <Clock size={14} /> Créneau
                </label>
                <div className="flex gap-3 items-center">
                  <div className="relative flex-1">
                     <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                       <Clock className="text-stone-400" size={20} />
                     </div>
                     <input 
                      type="time" 
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      onClick={(e) => e.currentTarget.showPicker()}
                      className="w-full h-16 bg-white border border-stone-200 rounded-xl pl-10 pr-2 text-lg font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all appearance-none text-center cursor-pointer"
                    />
                  </div>
                  <span className="text-stone-300 font-bold">-</span>
                  <div className="relative flex-1">
                     <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                       <Clock className="text-stone-400" size={20} />
                     </div>
                     <input 
                      type="time" 
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      onClick={(e) => e.currentTarget.showPicker()}
                      className="w-full h-16 bg-white border border-stone-200 rounded-xl pl-10 pr-2 text-lg font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all appearance-none text-center cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-2">
                  <MapPin size={14} /> Zone de départ / Principale
                </label>
                <div className="relative">
                  <select 
                    value={zone}
                    onChange={(e) => setZone(e.target.value)}
                    className="w-full appearance-none bg-stone-50 border border-stone-200 text-stone-700 rounded-xl px-4 py-3 pr-8 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-medium"
                  >
                    {availableZones.map(z => (
                      <option key={z} value={z}>{z}</option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-stone-400">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-2">
                  <Anchor size={14} /> Setup
                </label>
                <div className="relative">
                   <select 
                    value={setup}
                    onChange={(e) => setSetup(e.target.value)}
                    className="w-full appearance-none bg-stone-50 border border-stone-200 text-stone-700 rounded-xl px-4 py-3 pr-8 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-medium"
                  >
                    {availableSetups.map(s => (
                       <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                   <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-stone-400">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-2 border-b border-stone-100 pb-8">
              <div className="flex justify-between items-center">
                 <label className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-2">
                  <Activity size={14} /> Feeling Global
                </label>
                <span className="text-sm font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-lg">
                  {feeling} / 10
                </span>
              </div>
              <input 
                type="range" 
                min="1" 
                max="10" 
                value={feeling}
                onChange={(e) => setFeeling(Number(e.target.value))}
                className="w-full h-2 bg-stone-100 rounded-lg appearance-none cursor-pointer accent-amber-500 hover:accent-amber-600 transition-all"
              />
            </div>

            {/* --- LIVEWELL (VIVIER) SECTION --- */}
            <div className="space-y-4">
               <div className="flex justify-between items-end">
                <label className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-2">
                  <Fish size={14} /> Tableau de chasse
                </label>
                {misses.length > 0 && (
                   <span className="text-xs font-medium text-stone-400 bg-stone-100 px-2 py-1 rounded-full">
                     {misses.length} Raté(s)
                   </span>
                )}
               </div>

               {/* Action Buttons */}
               <div className="grid grid-cols-2 gap-4">
                 <button
                    type="button"
                    onClick={() => setIsCatchModalOpen(true)}
                    className="flex items-center justify-center gap-2 py-3 px-4 bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-md shadow-amber-500/20 font-bold transition-transform active:scale-95 text-sm sm:text-base"
                 >
                    <Plus size={18} /> Ajouter Prise
                 </button>
                 <button
                    type="button"
                    onClick={() => setIsMissModalOpen(true)}
                    className="flex items-center justify-center gap-2 py-3 px-4 bg-stone-50 hover:bg-stone-100 text-stone-600 border border-stone-200 rounded-xl font-medium transition-colors active:scale-95 text-sm sm:text-base"
                 >
                    <AlertOctagon size={18} className="text-stone-400" /> Signaler Raté
                 </button>
               </div>

               {/* Horizontal Carousels */}
               <div className="space-y-4 mt-2">
                 
                 {/* Empty State */}
                 {catches.length === 0 && misses.length === 0 && (
                   <div className="text-center py-6 border border-dashed border-stone-200 rounded-2xl bg-stone-50/50">
                     <Fish className="mx-auto text-stone-300 mb-2" size={24} />
                     <p className="text-sm text-stone-400 font-medium">Vivier vide... pour l'instant.</p>
                   </div>
                 )}

                 {/* Catches Carousel */}
                 {catches.length > 0 && (
                   <div className="flex overflow-x-auto gap-3 pb-2 scrollbar-hide snap-x">
                     {catches.map((catchItem) => {
                       const trophy = getTrophyIcon(catchItem.species, catchItem.size);
                       return (
                          <div key={catchItem.id} className="relative flex-shrink-0 w-24 h-24 bg-white border border-stone-100 rounded-2xl shadow-organic p-2 flex flex-col justify-between items-center text-center snap-center animate-in zoom-in-50 duration-300">
                             <button 
                                onClick={() => handleRemoveCatch(catchItem.id)}
                                className="absolute top-1 right-1 p-1 text-stone-300 hover:text-red-400 rounded-full transition-colors"
                             >
                               <X size={12} />
                             </button>
                             <div className="mt-1 h-7 w-7 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600">
                                <Fish size={14} />
                             </div>
                             <div>
                                <div className="font-bold text-[11px] text-stone-700 leading-tight">
                                  {catchItem.species} {trophy}
                                </div>
                                <div className="text-[10px] text-stone-400 font-medium">
                                  {catchItem.size} cm
                                </div>
                             </div>
                          </div>
                       );
                     })}
                   </div>
                 )}

                 {/* Misses Carousel */}
                 {misses.length > 0 && (
                   <div className="flex overflow-x-auto gap-3 pb-2 scrollbar-hide snap-x">
                     {misses.map((miss) => (
                        <div key={miss.id} className="relative flex-shrink-0 w-24 h-24 bg-stone-50 border border-dashed border-stone-200 rounded-2xl p-2 flex flex-col justify-between items-center text-center snap-center opacity-80 animate-in zoom-in-50 duration-300">
                           <button 
                              onClick={() => handleRemoveMiss(miss.id)}
                              className="absolute top-1 right-1 p-1 text-stone-300 hover:text-red-400 rounded-full transition-colors"
                           >
                             <X size={12} />
                           </button>
                           <div className="mt-1 text-red-300">
                              <AlertOctagon size={14} />
                           </div>
                           <div>
                              <div className="font-bold text-[10px] text-stone-600 leading-tight truncate w-full">
                                {miss.type}
                              </div>
                               <div className="text-[9px] text-stone-400 uppercase tracking-wide truncate w-full">
                                {miss.speciesSupposed !== 'Inconnu' ? miss.speciesSupposed : 'Inconnu'}
                              </div>
                           </div>
                        </div>
                     ))}
                   </div>
                 )}
               </div>
            </div>
            {/* --- END LIVEWELL --- */}

          </div>

          {/* Right Panel: Auto Conditions (The Bot) */}
          <div className="w-full lg:w-80 bg-[#fdfbf7] border-l border-stone-100 p-8 flex flex-col justify-between relative">
             {/* Decorative background element */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-bl-full pointer-events-none"></div>

            <div className="relative">
              <h3 className="text-sm font-bold text-stone-800 uppercase tracking-wide mb-6 flex items-center gap-2">
                <CloudSun size={16} className="text-stone-400" />
                Aperçu Conditions
              </h3>
              
              {/* Dynamic Score Card */}
              <div className={`rounded-2xl p-6 mb-6 border ${getScoreBg(bioScore)} transition-colors duration-500 shadow-sm`}>
                <div className="flex justify-between items-start mb-3">
                  <span className={`text-xs font-bold uppercase ${getScoreColor(bioScore)} tracking-wider opacity-80`}>Score Bio</span>
                  {getScoreIcon(bioScore)}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className={`text-5xl font-black ${getScoreColor(bioScore)} tracking-tight`}>{bioScore}</span>
                  <span className={`text-lg font-medium ${getScoreColor(bioScore)} opacity-70`}>/100</span>
                </div>
                <p className={`text-xs mt-3 font-medium leading-relaxed ${getScoreColor(bioScore)} opacity-90`}>
                  {bioScore >= 70 ? "Activité théorique forte. Conditions idéales pour le Sandre." :
                   bioScore >= 40 ? "Conditions mitigées. Cherchez les variations." :
                   "Conditions difficiles. Le poisson risque d'être calé."}
                </p>
              </div>

              {/* Data Points */}
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm p-3 bg-white rounded-xl border border-stone-100 shadow-sm">
                  <div className="flex flex-col">
                     <span className="text-stone-500 flex items-center gap-2 text-xs font-medium uppercase"><Wind size={12} /> Pression</span>
                     <span className="font-semibold text-stone-700">{conditions.currentWeather.pressure} hPa</span>
                  </div>
                  <div className={`text-xs font-mono font-medium px-2 py-1 rounded ${Number(deltaP) <= -1 && Number(deltaP) > -3 ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>
                    {Number(deltaP) > 0 ? '+' : ''}{deltaP}
                  </div>
                </div>
                 <div className="flex justify-between items-center text-sm p-3 bg-white rounded-xl border border-stone-100 shadow-sm">
                   <div className="flex flex-col">
                     <span className="text-stone-500 flex items-center gap-2 text-xs font-medium uppercase"><Droplets size={12} /> Débit</span>
                     <span className="font-semibold text-stone-700">{conditions.currentHydro.flow} m³/s</span>
                  </div>
                   <div className={`text-xs font-mono font-medium px-2 py-1 rounded ${Number(deltaQ) <= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>
                    {Number(deltaQ) > 0 ? '+' : ''}{deltaQ}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-stone-200">
               <button 
                type="submit"
                className="w-full bg-stone-800 hover:bg-stone-900 text-white font-bold py-4 px-6 rounded-xl shadow-lg shadow-stone-800/20 transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2 active:scale-95"
              >
                <Save size={18} />
                Terminer la Session
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default SessionForm;