import React, { useState, useEffect } from 'react';
import { X, AlertOctagon, MapPin, Clock, AlertTriangle, Edit2 } from 'lucide-react';
import { Miss, Zone } from '../types';

interface MissDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  initialData?: Miss | null; // Ajout pour l'édition
  availableZones: Zone[];
  sessionStartTime: string;
  sessionEndTime: string;
}

const MissDialog: React.FC<MissDialogProps> = ({ 
  isOpen, onClose, onSave, initialData, availableZones, sessionStartTime, sessionEndTime 
}) => {
  const [type, setType] = useState<Miss['type']>('Décroché');
  const [time, setTime] = useState(sessionStartTime);
  const [location, setLocation] = useState('');
  const [selectedZoneId, setSelectedZoneId] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (initialData) {
        // --- MODE ÉDITION ---
        setType(initialData.type);
        setLocation(initialData.location || '');
        
        const zone = availableZones.find(z => z.id === initialData.zoneId || z.label === initialData.zone);
        if (zone) setSelectedZoneId(zone.id);

        if (initialData.timestamp) {
            const dateObj = initialData.timestamp instanceof Date 
                ? initialData.timestamp 
                : new Date((initialData.timestamp as any).seconds * 1000);
            setTime(dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
        }
      } else {
        // --- MODE CRÉATION ---
        setTime(sessionStartTime);
        setType('Décroché');
        setLocation('');
        if (availableZones.length > 0) setSelectedZoneId(availableZones[0].id);
      }
    }
  }, [isOpen, initialData, sessionStartTime, availableZones]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (time < sessionStartTime || time > sessionEndTime) {
      setError(`L'heure doit être comprise entre ${sessionStartTime} et ${sessionEndTime}.`);
      return;
    }

    const zoneObj = availableZones.find(z => z.id === selectedZoneId);
    
    onSave({ 
      type, time, location, 
      zone: zoneObj?.label || 'Inconnue', zoneId: selectedZoneId 
    });
    
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-200 sm:items-center p-4">
      <div className="w-full max-w-lg bg-[#FAF9F6] rounded-3xl shadow-2xl p-6 space-y-5 border border-white/50">
        <div className="flex justify-between items-center border-b border-stone-100 pb-4">
          <h3 className="font-bold text-lg text-rose-600 flex items-center gap-2">
            {initialData ? <><Edit2 size={20}/> Modifier le Raté</> : <><AlertOctagon size={20}/> Signaler un Raté</>}
          </h3>
          <button onClick={onClose} className="p-2 text-stone-400 hover:bg-stone-100 rounded-full"><X size={20}/></button>
        </div>

        {error && <div className="bg-rose-50 text-rose-600 p-3 rounded-xl text-xs font-bold flex items-center gap-2 border border-rose-100">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-stone-400 ml-1">Type d'échec</label>
              <select value={type} onChange={(e) => setType(e.target.value as any)} className="w-full p-3 bg-white border border-stone-200 rounded-xl text-sm font-bold text-stone-700 outline-none focus:ring-2 focus:ring-rose-200">
                <option value="Décroché">Décroché</option>
                <option value="Casse">Casse</option>
                <option value="Coupe">Coupe</option>
                <option value="Touche Ratée">Touche Ratée</option>
                <option value="Suivi">Suivi</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-stone-400 ml-1">Heure</label>
              <input type="time" value={time} onChange={(e) => { setTime(e.target.value); setError(null); }} className="w-full p-3 bg-white border rounded-xl text-sm font-bold text-center outline-none focus:ring-2 focus:ring-rose-200"/>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-stone-400 ml-1">Zone / Spot</label>
            <select value={selectedZoneId} onChange={(e) => setSelectedZoneId(e.target.value)} className="w-full p-3 bg-white border border-stone-200 rounded-xl text-sm font-medium text-stone-700 outline-none focus:ring-2 focus:ring-rose-200">
              {availableZones.map(z => <option key={z.id} value={z.id}>{z.label}</option>)}
            </select>
          </div>

          <input type="text" placeholder="Détail précis..." value={location} onChange={(e) => setLocation(e.target.value)} className="w-full p-3 bg-white border border-stone-200 rounded-xl text-sm outline-none focus:border-rose-300"/>

          <button type="submit" className="w-full bg-stone-800 text-white py-4 rounded-2xl font-black shadow-lg active:scale-95 transition-transform">
            {initialData ? 'Mettre à jour' : 'Enregistrer le Raté'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default MissDialog;