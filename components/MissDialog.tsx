// components/MissDialog.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { X, AlertOctagon, Edit2, Loader2, Cloud, CloudOff, Check } from 'lucide-react';
import { 
    Miss, Zone, RefLureType, RefColor, RefSize, RefWeight, 
    FullEnvironmentalSnapshot, Location 
} from '../types';
import { doc, getDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions'; 
import { getApp } from 'firebase/app';
import { db } from '../lib/firebase';
import { fetchHistoricalWeatherContext } from '../lib/universal-weather-service';

interface MissDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  initialData?: Miss | null;
  availableZones: Zone[];
  locationId: string;   // REQUIS pour le filtrage par secteur
  locations: Location[]; // REQUIS pour la simulation Gold Standard
  sessionStartTime: string;
  sessionEndTime: string;
  sessionDate: string;
  lureTypes: RefLureType[];
  colors: RefColor[];
  sizes: RefSize[];
  weights: RefWeight[];
}

const MissDialog: React.FC<MissDialogProps> = ({ 
  isOpen, onClose, onSave, initialData, availableZones, locationId, locations,
  sessionStartTime, sessionEndTime, sessionDate, lureTypes, colors, sizes, weights 
}) => {
  const [type, setType] = useState<Miss['type']>('Décroché');
  const [time, setTime] = useState(sessionStartTime);
  const [location, setLocation] = useState('');
  const [selectedZoneId, setSelectedZoneId] = useState('');
  const [selectedLureTypeId, setSelectedLureTypeId] = useState('');
  const [selectedColorId, setSelectedColorId] = useState('');
  const [selectedSizeId, setSelectedSizeId] = useState('');
  const [selectedWeightId, setSelectedWeightId] = useState('');

  const [isLoadingEnv, setIsLoadingEnv] = useState(false);
  const [envSnapshot, setEnvSnapshot] = useState<FullEnvironmentalSnapshot | null>(null);
  const [envStatus, setEnvStatus] = useState<'idle' | 'found' | 'not-found' | 'simulated'>('idle');

  const [error, setError] = useState<string | null>(null);

  // --- 1. FILTRAGE DES SPOTS PAR SECTEUR ---
  const filteredSpots = useMemo(() => {
    return availableZones.filter(z => z.locationId === locationId);
  }, [availableZones, locationId]);

  // --- 2. INITIALISATION DES DONNÉES ---
  useEffect(() => {
    if (isOpen) {
      setError(null);
      const data = initialData as any; 

      if (data) {
        setType(data.type);
        setLocation(data.location || '');
        setSelectedZoneId(data.spotId || (filteredSpots[0]?.id || ''));
        setSelectedLureTypeId(data.lureTypeId || '');
        setSelectedColorId(data.lureColorId || '');
        setSelectedSizeId(data.lureSizeId || '');
        setSelectedWeightId(data.lureWeightId || '');
        setEnvSnapshot(data.envSnapshot || null);
        setEnvStatus(data.envSnapshot ? 'found' : 'idle');

        if (data.timestamp) {
            const dateObj = data.timestamp instanceof Date ? data.timestamp : new Date(data.timestamp.seconds * 1000);
            setTime(dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
        }
      } else {
        setTime(sessionStartTime);
        setType('Décroché');
        setLocation('');
        setSelectedLureTypeId('');
        setSelectedColorId('');
        setSelectedSizeId('');
        setSelectedWeightId('');
        setEnvSnapshot(null);
        setEnvStatus('idle');
        if (filteredSpots.length > 0) setSelectedZoneId(filteredSpots[0].id);
      }
    }
  }, [isOpen, initialData, sessionStartTime, filteredSpots]);

  // --- 3. ACQUISITION ENVIRONNEMENTALE (MODÈLE UNIFIÉ) ---
  useEffect(() => {
    if (!isOpen || !time || !locationId) return;

    const fetchEnv = async () => {
      setIsLoadingEnv(true);
      const GOLDEN_SECTOR_ID = import.meta.env.VITE_GOLDEN_SECTOR_ID;
      
      try {
        if (locationId === GOLDEN_SECTOR_ID) {
          const hourStr = time.split(':')[0];
          const docId = `${sessionDate}_${hourStr}00`;
          const snap = await getDoc(doc(db, 'environmental_logs', docId));

          if (snap.exists()) {
            const d = snap.data() as any;
            setEnvSnapshot({
              weather: {
                temperature: d.weather?.temp || 0,
                pressure: d.weather?.pressure || 0,
                windSpeed: d.weather?.windSpeed || 0,
                windDirection: d.weather?.windDir || 0,
                precip: d.weather?.precip || 0,
                clouds: d.weather?.cloudCover || 0,
                conditionCode: d.weather?.condition_code || 0
              },
              hydro: {
                flowRaw: d.hydro?.flow || 0,
                flowLagged: d.computed?.flow_lagged || 0,
                level: d.hydro?.level || 0,
                waterTemp: d.hydro?.waterTemp ?? null,
                turbidityIdx: d.computed?.turbidity_idx || 0
              },
              scores: {
                sandre: d.computed?.score_sandre || 0,
                brochet: d.computed?.score_brochet || 0,
                perche: d.computed?.score_perche || 0,
                blackbass: d.computed?.score_blackbass || 0
              },
              metadata: { sourceLogId: snap.id, calculationDate: d.updatedAt || d.timestamp }
            });
            setEnvStatus('found');
          } else {
            setEnvStatus('not-found');
          }
        } else {
          const currentLocation = locations.find(l => l.id === locationId);
          if (currentLocation?.coordinates) {
            const weatherContext = await fetchHistoricalWeatherContext(
                currentLocation.coordinates.lat, 
                currentLocation.coordinates.lng, 
                sessionDate
            );

            if (weatherContext) {
                const functionsInstance = getFunctions(getApp(), 'europe-west1');
                const getHistoricalContext = httpsCallable(functionsInstance, 'getHistoricalContext');
                const result = await getHistoricalContext({
                    weather: weatherContext.snapshot,
                    weatherHistory: weatherContext.history,
                    location: currentLocation,
                    dateStr: sessionDate
                });

                const cloudData = result.data as any;
                if (cloudData) {
                    setEnvSnapshot({
                        weather: { ...weatherContext.snapshot },
                        hydro: { 
                                flowRaw: 0, flowLagged: 0, level: 0, 
                                waterTemp: cloudData.waterTemp ?? null, 
                                turbidityIdx: Math.min(1, (cloudData.turbidityNTU || 5) / 50) 
                              },
                        scores: cloudData.scores ?? { sandre: 0, brochet: 0, perche: 0, blackbass: 0 },
                        metadata: { sourceLogId: 'gold_standard_simulated', calculationDate: new Date().toISOString() }
                    });
                    setEnvStatus('simulated');
                }
            }
          }
        }
      } catch (e) {
        console.error("Erreur récupération environnement (Miss) Michael :", e);
        setEnvStatus('not-found');
      } finally {
        setIsLoadingEnv(false);
      }
    };

    const debounce = setTimeout(fetchEnv, 800);
    return () => clearTimeout(debounce);
  }, [time, sessionDate, locationId, isOpen, locations]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (time < sessionStartTime || time > sessionEndTime) {
      setError(`L'heure doit être comprise entre ${sessionStartTime} et ${sessionEndTime}.`);
      return;
    }

    const zoneObj = filteredSpots.find(z => z.id === selectedZoneId);
    
    onSave({ 
      type, time, location, 
      spotName: zoneObj?.label || 'Inconnue', spotId: selectedZoneId,
      lureTypeId: selectedLureTypeId,
      lureColorId: selectedColorId,
      lureSizeId: selectedSizeId,
      lureWeightId: selectedWeightId,
      envSnapshot 
    });
    onClose();
  };

  const SelectField = ({ label, value, onChange, options, placeholder }: any) => (
    <div className="space-y-1">
       <label className="text-[10px] font-black uppercase text-stone-400 ml-1">{label}</label>
       <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full p-2.5 bg-white border border-stone-200 rounded-xl text-xs font-medium text-stone-700 outline-none focus:ring-2 focus:ring-rose-200">
          <option value="">{placeholder}</option>
          {options.map((o: any) => <option key={o.id} value={o.id}>{o.label}</option>)}
       </select>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-200 sm:items-center p-4">
      <div className="w-full max-w-lg bg-[#FAF9F6] rounded-3xl shadow-2xl p-6 space-y-5 border border-white/50 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b border-stone-100 pb-4">
          <h3 className="font-bold text-lg text-rose-600 flex items-center gap-2">
            {initialData ? <><Edit2 size={20}/> Modifier le Raté</> : <><AlertOctagon size={20}/> Signaler un Raté</>}
          </h3>
          <div className="flex items-center gap-3">
             {isLoadingEnv ? <Loader2 className="animate-spin text-rose-500" size={16}/> : 
              envStatus !== 'idle' ? (
                <div className="flex items-center gap-1">
                    <Cloud className={envStatus === 'simulated' ? "text-blue-500" : "text-emerald-500"} size={16}/>
                    <Check className={envStatus === 'simulated' ? "text-blue-500" : "text-emerald-500"} size={12}/>
                </div>
              ) : <CloudOff className="text-stone-300" size={16}/>}
             <button onClick={onClose} className="p-2 text-stone-400 hover:bg-stone-100 rounded-full"><X size={20}/></button>
          </div>
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
            <label className="text-[10px] font-black uppercase text-stone-400 ml-1">Zone / Spot du secteur</label>
            <select value={selectedZoneId} onChange={(e) => setSelectedZoneId(e.target.value)} className="w-full p-3 bg-white border border-stone-200 rounded-xl text-sm font-medium text-stone-700 outline-none focus:ring-2 focus:ring-rose-200" disabled={filteredSpots.length === 0}>
              {filteredSpots.map(z => <option key={z.id} value={z.id}>{z.label}</option>)}
              {filteredSpots.length === 0 && <option value="">Aucun spot pour ce secteur</option>}
            </select>
          </div>

          <div className="bg-stone-100/50 p-3 rounded-2xl border border-stone-100 grid grid-cols-2 gap-3">
              <SelectField label="Type de Leurre" value={selectedLureTypeId} onChange={setSelectedLureTypeId} options={lureTypes} placeholder="Type..." />
              <SelectField label="Couleur" value={selectedColorId} onChange={setSelectedColorId} options={colors} placeholder="Couleur..." />
              <SelectField label="Taille" value={selectedSizeId} onChange={setSelectedSizeId} options={sizes} placeholder="Taille..." />
              <SelectField label="Poids" value={selectedWeightId} onChange={setSelectedWeightId} options={weights} placeholder="Poids..." />
          </div>

          <input type="text" placeholder="Commentaire / Détail..." value={location} onChange={(e) => setLocation(e.target.value)} className="w-full p-3 bg-white border border-stone-200 rounded-xl text-sm outline-none focus:border-rose-300"/>

          <button type="submit" disabled={isLoadingEnv} className="w-full bg-stone-800 text-white py-4 rounded-2xl font-black shadow-lg active:scale-95 transition-transform">
            {isLoadingEnv ? <Loader2 className="animate-spin mx-auto" /> : initialData ? 'Mettre à jour' : 'Enregistrer le Raté'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default MissDialog;