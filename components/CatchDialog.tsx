import React, { useState, useEffect } from 'react';
import { X, Check, Fish, Ruler, Sparkles, Crown, MapPin } from 'lucide-react';
import { SpeciesType, TechniqueType, ZoneType } from '../types';

interface CatchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { species: SpeciesType; size: number; technique: TechniqueType; lure: string; zone: ZoneType }) => void;
  initialZone: ZoneType;
  availableZones: string[];
  availableTechniques: string[];
}

// Configuration des seuils par espèce (en cm)
const SPECIES_CONFIG: Record<string, { max: number; smallLimit: number; trophyLimit: number }> = {
  'Perche':   { max: 60,  smallLimit: 15, trophyLimit: 30 },
  'Chevesne': { max: 70,  smallLimit: 15, trophyLimit: 35 },
  'Sandre':   { max: 100, smallLimit: 40, trophyLimit: 70 },
  'Brochet':  { max: 130, smallLimit: 50, trophyLimit: 80 },
  'Silure':   { max: 250, smallLimit: 60, trophyLimit: 100 }, 
  'Aspe':     { max: 100, smallLimit: 40, trophyLimit: 70 },
};

const DEFAULT_CONFIG = { max: 100, smallLimit: 30, trophyLimit: 60 };

const CatchDialog: React.FC<CatchDialogProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  initialZone,
  availableZones,
  availableTechniques
}) => {
  const [species, setSpecies] = useState<SpeciesType>('Sandre');
  const [size, setSize] = useState<number>(45);
  const [technique, setTechnique] = useState<string>(availableTechniques[0] || 'Linéaire');
  const [lure, setLure] = useState<string>('');
  const [zone, setZone] = useState<string>(initialZone);

  // Sync state with props when dialog opens or initialZone changes
  useEffect(() => {
    if (isOpen) {
      setZone(initialZone);
      // Ensure technique is valid
      if (availableTechniques.length > 0 && !availableTechniques.includes(technique)) {
        setTechnique(availableTechniques[0]);
      }
    }
  }, [isOpen, initialZone, availableTechniques, technique]);

  // Récupérer la config actuelle
  const config = SPECIES_CONFIG[species] || DEFAULT_CONFIG;

  // Ajustement intelligent de la taille au changement d'espèce
  useEffect(() => {
    if (size > config.max) {
      setSize(config.max);
    }
  }, [species, config.max]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ species, size, technique, lure, zone });
    setLure('');
    onClose();
  };

  // Logique de Status
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
      {/* Bottom Sheet Container */}
      <div className="w-full max-w-lg bg-[#FAF9F6] rounded-t-3xl sm:rounded-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] border-t sm:border border-stone-200 overflow-hidden animate-in slide-in-from-bottom duration-300">
        
        {/* Header */}
        <div className="bg-white px-6 py-4 border-b border-stone-100 flex justify-between items-center">
          <div className="flex items-center gap-2 text-amber-600">
            <Sparkles size={20} />
            <h3 className="font-bold text-lg tracking-tight text-stone-800">Nouvelle Prise</h3>
          </div>
          <button onClick={onClose} className="p-2 text-stone-400 hover:bg-stone-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 pb-8 sm:pb-6">
          
          {/* Espèce & Technique Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-stone-400">Espèce</label>
              <select 
                value={species}
                onChange={(e) => setSpecies(e.target.value as SpeciesType)}
                className="w-full bg-white border border-stone-200 text-stone-700 rounded-xl px-3 py-3 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium appearance-none transition-all text-sm"
              >
                <option value="Sandre">Sandre</option>
                <option value="Perche">Perche</option>
                <option value="Brochet">Brochet</option>
                <option value="Silure">Silure</option>
                <option value="Chevesne">Chevesne</option>
                <option value="Aspe">Aspe</option>
              </select>
            </div>
            <div className="space-y-2">
               <label className="text-xs font-bold uppercase tracking-wider text-stone-400">Technique</label>
               <select 
                value={technique}
                onChange={(e) => setTechnique(e.target.value)}
                className="w-full bg-white border border-stone-200 text-stone-700 rounded-xl px-3 py-3 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium appearance-none transition-all text-sm"
              >
                {availableTechniques.map(t => (
                   <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Dynamic Size Slider */}
          <div className="space-y-4 bg-white p-5 rounded-2xl border border-stone-100 shadow-sm relative overflow-hidden">
            {/* Status Badge */}
            <div className={`absolute top-0 right-0 px-3 py-1 rounded-bl-xl border-l border-b text-[10px] uppercase flex items-center gap-1.5 shadow-sm ${statusColor}`}>
              <StatusIcon size={12} />
              {statusLabel}
            </div>

            <div className="flex justify-between items-end pr-20">
              <label className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-2 mb-1">
                <Ruler size={14} /> Taille
              </label>
              <div className="flex items-baseline gap-1">
                 <span className="text-5xl font-black text-stone-800 tracking-tighter transition-all duration-100">
                  {size}
                </span>
                <span className="text-sm font-bold text-stone-400 mb-2">cm</span>
              </div>
            </div>
            
            <input 
              type="range" 
              min="10" 
              max={config.max} 
              step="1"
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              className="w-full h-3 bg-stone-100 rounded-full appearance-none cursor-pointer accent-amber-500 hover:accent-amber-600 transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            />
            
            <div className="flex justify-between text-[10px] text-stone-300 font-bold uppercase tracking-widest px-1">
              <span>10cm</span>
              <span className="text-stone-200">|</span>
              <span>{Math.floor(config.max / 2)}cm</span>
              <span className="text-stone-200">|</span>
              <span>{config.max}cm</span>
            </div>
          </div>

          {/* Zone Selector (Power Fishing) */}
           <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-2">
                <MapPin size={14} /> Zone Exacte
              </label>
              <select 
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                className="w-full bg-white border border-stone-200 text-stone-700 rounded-xl px-3 py-3 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium appearance-none transition-all text-sm"
              >
                {availableZones.map(z => (
                   <option key={z} value={z}>{z}</option>
                ))}
              </select>
          </div>

          {/* Lure Input */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-2">
              <Fish size={14} /> Leurre / Appât
            </label>
            <input 
              type="text" 
              placeholder="Ex: One Up 3' Color 24"
              value={lure}
              onChange={(e) => setLure(e.target.value)}
              className="w-full bg-white border border-stone-200 text-stone-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-medium placeholder-stone-300 text-sm"
            />
          </div>

          {/* Action Button */}
          <button 
            type="submit"
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2 transition-all transform active:scale-95"
          >
            <Check size={20} strokeWidth={3} />
            Ajouter au vivier
          </button>

        </form>
      </div>
    </div>
  );
};

export default CatchDialog;