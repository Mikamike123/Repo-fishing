import React, { useState, useEffect } from 'react';
import { X, AlertOctagon, MapPin, Scale, HelpCircle } from 'lucide-react';
import { Miss, ZoneType } from '../types';

interface MissDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<Miss, 'id' | 'timestamp'>) => void;
  initialZone: ZoneType;
  availableZones: string[];
}

const MissDialog: React.FC<MissDialogProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  initialZone,
  availableZones 
}) => {
  const [type, setType] = useState<Miss['type']>('Décroché');
  const [speciesSupposed, setSpeciesSupposed] = useState<Miss['speciesSupposed']>('Inconnu');
  const [estimation, setEstimation] = useState<Miss['estimation']>('Moyen');
  const [location, setLocation] = useState<string>('');
  const [zone, setZone] = useState<string>(initialZone);

  // Sync state with props when dialog opens or initialZone changes
  useEffect(() => {
      if (isOpen) {
        setZone(initialZone);
      }
    }, [isOpen, initialZone]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ type, speciesSupposed, estimation, location, zone });
    // Reset defaults
    setType('Décroché');
    setSpeciesSupposed('Inconnu');
    setEstimation('Moyen');
    setLocation('');
    onClose();
  };

  const estimations = ['Inconnu', 'Petit', 'Moyen', 'Lourd', 'Monstre'];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-0 sm:p-4 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#FAF9F6] rounded-t-3xl sm:rounded-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] border-t sm:border border-stone-200 overflow-hidden animate-in slide-in-from-bottom duration-300">
        
        {/* Header */}
        <div className="bg-white px-6 py-4 border-b border-stone-100 flex justify-between items-center">
          <div className="flex items-center gap-2 text-red-500">
            <AlertOctagon size={20} />
            <h3 className="font-bold text-lg tracking-tight text-stone-800">Signaler un Raté</h3>
          </div>
          <button onClick={onClose} className="p-2 text-stone-400 hover:bg-stone-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 pb-8 sm:pb-6">
          
          <div className="grid grid-cols-2 gap-4">
            {/* Type Select */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-stone-400">Type d'échec</label>
              <select 
                value={type}
                onChange={(e) => setType(e.target.value as Miss['type'])}
                className="w-full bg-white border border-stone-200 text-stone-700 rounded-xl px-3 py-3 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 font-medium appearance-none transition-all text-sm"
              >
                <option value="Décroché">Décroché</option>
                <option value="Casse">Casse</option>
                <option value="Touche Ratée">Touche Ratée</option>
                <option value="Suivi">Suivi</option>
                <option value="Inconnu">Inconnu</option>
              </select>
            </div>

            {/* Species Supposed Select */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1">
                 Espèce (?)
              </label>
              <select 
                value={speciesSupposed}
                onChange={(e) => setSpeciesSupposed(e.target.value as Miss['speciesSupposed'])}
                className="w-full bg-white border border-stone-200 text-stone-700 rounded-xl px-3 py-3 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 font-medium appearance-none transition-all text-sm"
              >
                <option value="Inconnu">Inconnu</option>
                <option value="Sandre">Sandre</option>
                <option value="Perche">Perche</option>
                <option value="Brochet">Brochet</option>
                <option value="Silure">Silure</option>
              </select>
            </div>
          </div>

          {/* Estimation Slider/Selector */}
          <div className="space-y-3 bg-white p-4 rounded-2xl border border-stone-100 shadow-sm">
             <label className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-2">
              <Scale size={14} /> Estimation Poids
            </label>
            <div className="flex justify-between gap-1 overflow-x-auto pb-1 no-scrollbar">
              {estimations.map((est) => (
                <button
                  key={est}
                  type="button"
                  onClick={() => setEstimation(est as Miss['estimation'])}
                  className={`flex-1 min-w-[60px] py-2 px-1 rounded-lg text-[10px] font-bold transition-all border ${
                    estimation === est 
                      ? 'bg-red-50 border-red-200 text-red-600 shadow-sm' 
                      : 'bg-stone-50 border-stone-100 text-stone-400 hover:bg-stone-100'
                  }`}
                >
                  {est}
                </button>
              ))}
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
                className="w-full bg-white border border-stone-200 text-stone-700 rounded-xl px-3 py-3 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 font-medium appearance-none transition-all text-sm"
              >
                {availableZones.map(z => (
                   <option key={z} value={z}>{z}</option>
                ))}
              </select>
          </div>

          {/* Location Input */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-2">
              <MapPin size={14} /> Localisation (Détail)
            </label>
            <input 
              type="text" 
              placeholder="Ex: Devant la péniche..."
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full bg-white border border-stone-200 text-stone-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all font-medium placeholder-stone-300 text-sm"
            />
          </div>

          {/* Action Button */}
          <button 
            type="submit"
            className="w-full bg-stone-100 hover:bg-red-50 text-stone-600 hover:text-red-600 border border-stone-200 hover:border-red-200 font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all transform active:scale-95"
          >
            <AlertOctagon size={20} strokeWidth={2.5} />
            Enregistrer le Raté
          </button>

        </form>
      </div>
    </div>
  );
};

export default MissDialog;