import React, { useState, useEffect } from 'react';
import { X, Check, Fish, Ruler, Sparkles, Crown, MapPin, Clock, Image as ImageIcon, Link as LinkIcon, Trash2 } from 'lucide-react';
import { SpeciesType, TechniqueType, ZoneType } from '../types';

interface CatchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  // Mise à jour de la signature pour inclure photoUrls
  onSave: (data: { species: SpeciesType; size: number; technique: TechniqueType; lure: string; zone: ZoneType; time: string; photoUrls: string[] }) => void;
  initialZone: ZoneType;
  availableZones: string[];
  availableTechniques: string[];
  sessionDate: string;
  sessionStartTime: string;
  sessionEndTime: string;
}

const SPECIES_CONFIG: Record<string, { max: number; smallLimit: number; trophyLimit: number }> = {
  'Perche':   { max: 60,  smallLimit: 20, trophyLimit: 40 },
  'Chevesne': { max: 70,  smallLimit: 30, trophyLimit: 50 },
  'Sandre':   { max: 100, smallLimit: 40, trophyLimit: 80 },
  'Brochet':  { max: 130, smallLimit: 50, trophyLimit: 90 },
  'Silure':   { max: 250, smallLimit: 80, trophyLimit: 150 }, 
  'Aspe':     { max: 100, smallLimit: 40, trophyLimit: 70 },
};
const DEFAULT_CONFIG = { max: 100, smallLimit: 30, trophyLimit: 60 };

const CatchDialog: React.FC<CatchDialogProps> = ({ 
  isOpen, onClose, onSave, initialZone, availableZones, availableTechniques, sessionStartTime, sessionEndTime
}) => {
  const [species, setSpecies] = useState<SpeciesType>('Sandre');
  const [size, setSize] = useState<number>(45);
  const [technique, setTechnique] = useState<string>(availableTechniques[0] || 'Linéaire');
  const [lure, setLure] = useState<string>('');
  const [zone, setZone] = useState<string>(initialZone);
  const [time, setTime] = useState<string>(sessionStartTime); 
  
  // Gestion des Photos (URLs)
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [currentUrlInput, setCurrentUrlInput] = useState<string>('');

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setZone(initialZone);
      setTime(sessionStartTime);
      setPhotoUrls([]); // Reset photos
      setCurrentUrlInput('');
      setError(null);
    }
  }, [isOpen, initialZone, sessionStartTime]);

  const config = SPECIES_CONFIG[species] || DEFAULT_CONFIG;

  // Gestion ajout URL
  const handleAddUrl = () => {
      if (!currentUrlInput.trim()) return;
      if (photoUrls.length >= 2) {
          setError("Max 2 photos autorisées.");
          return;
      }
      // Validation basique d'URL (optionnel mais recommandé)
      if (!currentUrlInput.startsWith('http')) {
          setError("Le lien doit commencer par http:// ou https://");
          return;
      }

      setPhotoUrls([...photoUrls, currentUrlInput.trim()]);
      setCurrentUrlInput('');
      setError(null);
  };

  const handleRemoveUrl = (index: number) => {
      const newUrls = [...photoUrls];
      newUrls.splice(index, 1);
      setPhotoUrls(newUrls);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation Horaire
    if (time < sessionStartTime) {
        setError(`Impossible: La session commence à ${sessionStartTime}`);
        return;
    }
    if (time > sessionEndTime) {
        setError(`Impossible: La session termine à ${sessionEndTime}`);
        return;
    }

    onSave({ species, size, technique, lure, zone, time, photoUrls });
    setLure('');
    onClose();
  };

  if (!isOpen) return null;

  // Logique Status (Inchangée)
  let statusLabel = "Maillé";
  let statusColor = "text-emerald-600 bg-emerald-50 border-emerald-100";
  let StatusIcon = Check;
  if (size < config.smallLimit) {
    statusLabel = "Juvénile";
    statusColor = "text-stone-400 bg-stone-100 border-stone-200";
    StatusIcon = Fish;
  } else if (size >= config.trophyLimit) {
    statusLabel = "TROPHÉE";
    statusColor = "text-amber-600 bg-amber-50 border-amber-100 font-bold tracking-widest";
    StatusIcon = Crown;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-0 sm:p-4 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#FAF9F6] rounded-t-3xl sm:rounded-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] border-t sm:border border-stone-200 overflow-hidden animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto">
        
        <div className="bg-white px-6 py-4 border-b border-stone-100 flex justify-between items-center sticky top-0 z-10">
          <div className="flex items-center gap-2 text-amber-600">
            <Sparkles size={20} />
            <h3 className="font-bold text-lg tracking-tight text-stone-800">Nouvelle Prise</h3>
          </div>
          <button onClick={onClose} className="p-2 text-stone-400 hover:bg-stone-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 pb-8 sm:pb-6">
          
          {/* Ligne 1 : Heure & Zone */}
          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-2">
                    <Clock size={14} /> Heure
                </label>
                <input 
                    type="time" 
                    value={time}
                    onChange={(e) => {
                        setTime(e.target.value);
                        setError(null);
                    }}
                    className={`w-full bg-white border ${error && error.includes('Impossible') ? 'border-red-300 bg-red-50' : 'border-stone-200'} text-stone-700 rounded-xl px-3 py-3 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium text-center text-sm`}
                />
             </div>
             <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-2">
                <MapPin size={14} /> Zone
              </label>
              <select 
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                className="w-full bg-white border border-stone-200 text-stone-700 rounded-xl px-3 py-3 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium appearance-none transition-all text-sm"
              >
                {availableZones.map(z => (<option key={z} value={z}>{z}</option>))}
              </select>
            </div>
          </div>
          
          {/* Ligne 2 : Espèce & Technique */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-stone-400">Espèce</label>
              <select 
                value={species}
                onChange={(e) => setSpecies(e.target.value as SpeciesType)}
                className="w-full bg-white border border-stone-200 text-stone-700 rounded-xl px-3 py-3 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium appearance-none transition-all text-sm"
              >
                {Object.keys(SPECIES_CONFIG).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-2">
               <label className="text-xs font-bold uppercase tracking-wider text-stone-400">Technique</label>
               <select 
                value={technique}
                onChange={(e) => setTechnique(e.target.value)}
                className="w-full bg-white border border-stone-200 text-stone-700 rounded-xl px-3 py-3 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium appearance-none transition-all text-sm"
              >
                {availableTechniques.map(t => (<option key={t} value={t}>{t}</option>))}
              </select>
            </div>
          </div>

          {/* Slider Taille */}
          <div className="space-y-4 bg-white p-5 rounded-2xl border border-stone-100 shadow-sm relative overflow-hidden">
            <div className={`absolute top-0 right-0 px-3 py-1 rounded-bl-xl border-l border-b text-[10px] uppercase flex items-center gap-1.5 shadow-sm ${statusColor}`}>
               <StatusIcon size={12} /> {statusLabel}
            </div>
            <div className="flex justify-between items-end pr-20">
              <label className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-2 mb-1"><Ruler size={14} /> Taille</label>
              <div className="flex items-baseline gap-1">
                 <span className="text-5xl font-black text-stone-800 tracking-tighter transition-all duration-100">{size}</span>
                <span className="text-sm font-bold text-stone-400 mb-2">cm</span>
               </div>
            </div>
            <input type="range" min="10" max={config.max} step="1" value={size} onChange={(e) => setSize(Number(e.target.value))} className="w-full h-3 bg-stone-100 rounded-full appearance-none cursor-pointer accent-amber-500 hover:accent-amber-600 transition-all" />
          </div>

          {/* Leurre */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-2"><Fish size={14} /> Leurre / Appât</label>
            <input type="text" placeholder="Ex: One Up 3' Color 24" value={lure} onChange={(e) => setLure(e.target.value)} className="w-full bg-white border border-stone-200 text-stone-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-medium placeholder-stone-300 text-sm" />
          </div>

          {/* SECTION PHOTOS GOOGLE - NOUVEAU */}
          <div className="space-y-3 pt-2 border-t border-stone-100">
             <label className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-2">
                <ImageIcon size={14} /> Photos (Lien Google Photos)
             </label>
             
             {/* Liste des liens ajoutés */}
             {photoUrls.length > 0 && (
                 <div className="space-y-2 mb-2">
                     {photoUrls.map((url, idx) => (
                         <div key={idx} className="flex items-center gap-2 bg-blue-50 border border-blue-100 p-2 rounded-lg text-xs text-blue-700 overflow-hidden">
                             <LinkIcon size={12} className="shrink-0" />
                             <span className="truncate flex-1">{url}</span>
                             <button type="button" onClick={() => handleRemoveUrl(idx)} className="p-1 hover:bg-blue-100 rounded text-blue-500">
                                 <Trash2 size={14} />
                             </button>
                         </div>
                     ))}
                 </div>
             )}

             {/* Input Ajout */}
             {photoUrls.length < 2 && (
                 <div className="flex gap-2">
                    <input 
                        type="text" 
                        placeholder="Collez le lien de partage ici..." 
                        value={currentUrlInput}
                        onChange={(e) => setCurrentUrlInput(e.target.value)}
                        className="flex-1 bg-white border border-stone-200 text-stone-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                    <button 
                        type="button" 
                        onClick={handleAddUrl}
                        disabled={!currentUrlInput}
                        className="px-3 py-2 bg-stone-100 text-stone-600 rounded-xl text-xs font-bold hover:bg-stone-200 disabled:opacity-50"
                    >
                        Ajouter
                    </button>
                 </div>
             )}
             <p className="text-[10px] text-stone-400 italic">Astuce: Utilisez "Créer un lien" dans Google Photos et collez-le ici.</p>
          </div>

          {/* Message d'erreur global */}
          {error && <p className="text-xs text-red-500 font-bold text-center bg-red-50 p-2 rounded-lg border border-red-100">{error}</p>}

          <button type="submit" className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2 transition-all transform active:scale-95">
            <Check size={20} strokeWidth={3} /> Ajouter au vivier
          </button>

        </form>
      </div>
    </div>
  );
};

export default CatchDialog;