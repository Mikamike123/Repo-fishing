import React, { useState, useEffect } from 'react';
import { X, Ruler, Sparkles, MapPin, AlertTriangle, Clock, Edit2 } from 'lucide-react';
import { SpeciesType, Zone, Technique, Catch } from '../types';

interface CatchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  initialData?: Catch | null; // Ajout pour l'édition
  availableZones: Zone[];
  availableTechniques: Technique[];
  sessionStartTime: string;
  sessionEndTime: string;
}

const SPECIES_CONFIG: Record<string, { max: number }> = {
  'Perche': { max: 60 }, 'Chevesne': { max: 70 }, 'Sandre': { max: 100 },
  'Brochet': { max: 130 }, 'Silure': { max: 250 }, 'Aspe': { max: 100 },
  'Black-Bass': { max: 65 }, 'Truite': { max: 80 }
};

const CatchDialog: React.FC<CatchDialogProps> = ({ 
  isOpen, onClose, onSave, initialData, availableZones, availableTechniques, sessionStartTime, sessionEndTime 
}) => {
  const [species, setSpecies] = useState<SpeciesType>('Sandre');
  const [size, setSize] = useState<number>(45);
  const [selectedTechId, setSelectedTechId] = useState('');
  const [selectedZoneId, setSelectedZoneId] = useState('');
  const [lure, setLure] = useState('');
  const [time, setTime] = useState(sessionStartTime);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (initialData) {
        // --- MODE ÉDITION : Pré-remplissage ---
        setSpecies(initialData.species);
        setSize(initialData.size);
        setLure(initialData.lure || '');
        
        // Trouver l'ID technique/zone correspondant au libellé si l'ID manque (rétrocompatibilité)
        const tech = availableTechniques.find(t => t.id === initialData.techniqueId || t.label === initialData.technique);
        if (tech) setSelectedTechId(tech.id);

        const zone = availableZones.find(z => z.id === initialData.zoneId || z.label === initialData.zone);
        if (zone) setSelectedZoneId(zone.id);

        // Extraction de l'heure format HH:MM depuis le timestamp
        if (initialData.timestamp) {
            const dateObj = initialData.timestamp instanceof Date 
                ? initialData.timestamp 
                : new Date((initialData.timestamp as any).seconds * 1000);
            setTime(dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
        }
      } else {
        // --- MODE CRÉATION : Défauts ---
        setTime(sessionStartTime);
        setSpecies('Sandre');
        setSize(45);
        setLure('');
        if (availableZones.length > 0) setSelectedZoneId(availableZones[0].id);
        if (availableTechniques.length > 0) setSelectedTechId(availableTechniques[0].id);
      }
    }
  }, [isOpen, initialData, sessionStartTime, availableZones, availableTechniques]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (time < sessionStartTime || time > sessionEndTime) {
      setError(`L'heure doit être comprise entre ${sessionStartTime} et ${sessionEndTime}.`);
      return;
    }

    const zoneObj = availableZones.find(z => z.id === selectedZoneId);
    const techObj = availableTechniques.find(t => t.id === selectedTechId);
    
    onSave({ 
      species, size, 
      lure: lure.trim() || '', 
      time,
      technique: techObj?.label || 'Inconnue', techniqueId: selectedTechId,
      zone: zoneObj?.label || 'Inconnue', zoneId: selectedZoneId
    });
    
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-200 sm:items-center p-4">
      <div className="w-full max-w-lg bg-[#FAF9F6] rounded-3xl shadow-2xl p-6 space-y-5 border border-white/50">
        <div className="flex justify-between items-center border-b border-stone-100 pb-4">
          <h3 className="font-bold text-lg flex items-center gap-2 text-stone-800">
            {initialData ? <><Edit2 className="text-amber-500" size={20}/> Modifier la Prise</> : <><Sparkles className="text-amber-500" size={20}/> Nouvelle Prise</>}
          </h3>
          <button onClick={onClose} className="p-2 text-stone-400 hover:bg-stone-100 rounded-full"><X size={20}/></button>
        </div>

        {error && <div className="bg-rose-50 text-rose-600 p-3 rounded-xl text-xs font-bold flex items-center gap-2 border border-rose-100">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-stone-400 ml-1">Espèce</label>
              <select value={species} onChange={(e) => setSpecies(e.target.value as SpeciesType)} className="w-full p-3 bg-white border border-stone-200 rounded-xl text-sm font-bold text-stone-700 outline-none focus:ring-2 focus:ring-amber-200">
                {Object.keys(SPECIES_CONFIG).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-stone-400 ml-1">Heure</label>
              <input type="time" value={time} onChange={(e) => { setTime(e.target.value); setError(null); }} className="w-full p-3 bg-white border rounded-xl text-sm font-bold text-center outline-none focus:ring-2 focus:ring-amber-200"/>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-stone-400 ml-1">Technique</label>
            <select value={selectedTechId} onChange={(e) => setSelectedTechId(e.target.value)} className="w-full p-3 bg-white border border-stone-200 rounded-xl text-sm font-medium text-stone-700 outline-none focus:ring-2 focus:ring-amber-200">
              {availableTechniques.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-stone-100 space-y-3 shadow-sm">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-black uppercase text-stone-400 flex items-center gap-2"><Ruler size={14}/> Taille</label>
              <span className="text-xl font-black text-stone-800">{size} <span className="text-xs text-stone-400">cm</span></span>
            </div>
            <input type="range" min="10" max={SPECIES_CONFIG[species]?.max || 100} value={size} onChange={(e) => setSize(Number(e.target.value))} className="w-full h-2 bg-stone-100 rounded-lg appearance-none cursor-pointer accent-amber-500" />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-stone-400 ml-1">Spot Précis</label>
            <select value={selectedZoneId} onChange={(e) => setSelectedZoneId(e.target.value)} className="w-full p-3 bg-white border border-stone-200 rounded-xl text-sm font-medium text-stone-700 outline-none focus:ring-2 focus:ring-amber-200">
              {availableZones.map(z => <option key={z.id} value={z.id}>{z.label}</option>)}
            </select>
          </div>

          <input type="text" placeholder="Leurre utilisé..." value={lure} onChange={(e) => setLure(e.target.value)} className="w-full p-3 bg-white border border-stone-200 rounded-xl text-sm outline-none focus:border-amber-400"/>

          <button type="submit" className="w-full bg-stone-800 text-white py-4 rounded-2xl font-black shadow-lg active:scale-95 transition-transform">
            {initialData ? 'Mettre à jour' : 'Valider la prise'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CatchDialog;