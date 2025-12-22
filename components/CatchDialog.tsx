import React, { useState, useEffect, useRef } from 'react';
import { 
    X, Ruler, Sparkles, Edit2, Image as ImageIcon, Loader2, 
    CloudCheck, CloudOff, Wand2, CheckCircle2, AlertCircle 
} from 'lucide-react';
import { 
    SpeciesType, Zone, Technique, Catch, RefLureType, 
    RefColor, RefSize, RefWeight, FullEnvironmentalSnapshot 
} from '../types';
import { getHistoricalSnapshot } from '../lib/environmental-service';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';
import ExifReader from 'exifreader';

interface CatchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  initialData?: Catch | null;
  availableZones: Zone[];
  availableTechniques: Technique[];
  sessionStartTime: string;
  sessionEndTime: string;
  sessionDate: string;
  lureTypes: RefLureType[];
  colors: RefColor[];
  sizes: RefSize[];
  weights: RefWeight[];
  lastCatchDefaults?: Catch | null;
  userPseudo?: string;
}

const SPECIES_CONFIG: Record<string, { max: number }> = {
  'Perche': { max: 60 }, 'Chevesne': { max: 70 }, 'Sandre': { max: 100 },
  'Brochet': { max: 130 }, 'Silure': { max: 250 }, 'Aspe': { max: 100 },
  'Black-Bass': { max: 65 }, 'Truite': { max: 80 }
};

/**
 * HELPER : Compression d'image côté client
 */
const compressImageForAI = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1200; 
                let width = img.width;
                let height = img.height;
                if (width > MAX_WIDTH) {
                    height = (MAX_WIDTH / width) * height;
                    width = MAX_WIDTH;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                resolve(dataUrl.split(',')[1]);
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
};

const CatchDialog: React.FC<CatchDialogProps> = ({ 
  isOpen, onClose, onSave, initialData, availableZones, availableTechniques, 
  sessionStartTime, sessionEndTime, sessionDate, lureTypes, colors, sizes, weights,
  lastCatchDefaults, userPseudo = "Michael"
}) => {
  const [species, setSpecies] = useState<SpeciesType>('Sandre');
  const [size, setSize] = useState<number>(45);
  const [selectedTechId, setSelectedTechId] = useState('');
  const [selectedZoneId, setSelectedZoneId] = useState('');
  const [lureName, setLureName] = useState('');
  const [time, setTime] = useState(sessionStartTime);
  
  const [selectedLureTypeId, setSelectedLureTypeId] = useState('');
  const [selectedColorId, setSelectedColorId] = useState('');
  const [selectedSizeId, setSelectedSizeId] = useState('');
  const [selectedWeightId, setSelectedWeightId] = useState('');

  const [photoLink1, setPhotoLink1] = useState('');
  const [photoLink2, setPhotoLink2] = useState('');

  const [isLoadingEnv, setIsLoadingEnv] = useState(false);
  const [envSnapshot, setEnvSnapshot] = useState<FullEnvironmentalSnapshot | null>(null);
  // CORRECTION TYPE ICI
  const [envStatus, setEnvStatus] = useState<'idle' | 'found' | 'not-found'>('idle');

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<{ message: string; confidence: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setAiFeedback(null);
      if (initialData) {
        setSpecies(initialData.species);
        setSize(initialData.size);
        setLureName(initialData.lureName || ''); 
        if (availableTechniques.length) setSelectedTechId(initialData.techniqueId || '');
        if (availableZones.length) setSelectedZoneId(initialData.spotId || availableZones[0].id);
        setSelectedLureTypeId(initialData.lureTypeId || '');
        setSelectedColorId(initialData.lureColorId || '');
        setSelectedSizeId(initialData.lureSizeId || '');
        setSelectedWeightId(initialData.lureWeightId || '');
        setPhotoLink1(initialData.photoUrls?.[0] || '');
        setPhotoLink2(initialData.photoUrls?.[1] || '');
        setEnvSnapshot(initialData.envSnapshot || null);
        setEnvStatus(initialData.envSnapshot ? 'found' : 'idle');

        if (initialData.timestamp) {
            const dateObj = initialData.timestamp instanceof Date ? initialData.timestamp : new Date((initialData.timestamp as any).seconds * 1000);
            setTime(dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
        }
      } else {
        setTime(sessionStartTime);
        setSpecies('Sandre'); 
        setSize(45);
        setPhotoLink1('');
        setPhotoLink2('');
        setEnvSnapshot(null);
        setEnvStatus('idle');

        if (lastCatchDefaults) {
            setSelectedTechId(lastCatchDefaults.techniqueId);
            setSelectedZoneId(lastCatchDefaults.spotId); 
            setSelectedLureTypeId(lastCatchDefaults.lureTypeId || '');
            setSelectedColorId(lastCatchDefaults.lureColorId || '');
            setSelectedSizeId(lastCatchDefaults.lureSizeId || '');
            setSelectedWeightId(lastCatchDefaults.lureWeightId || '');
            setLureName(lastCatchDefaults.lureName || '');
        } else {
            setLureName('');
            setSelectedLureTypeId('');
            setSelectedColorId('');
            setSelectedSizeId('');
            setSelectedWeightId('');
            if (availableZones.length > 0) setSelectedZoneId(availableZones[0].id);
            if (availableTechniques.length > 0) setSelectedTechId(availableTechniques[0].id);
        }
      }
    }
  }, [isOpen, initialData, lastCatchDefaults, sessionStartTime, availableZones, availableTechniques]);

  useEffect(() => {
    if (!isOpen) return;
    const fetchEnv = async () => {
      setIsLoadingEnv(true);
      const snapshot = await getHistoricalSnapshot(sessionDate, time);
      if (snapshot) {
        setEnvSnapshot(snapshot);
        setEnvStatus('found');
      } else {
        setEnvStatus('not-found');
      }
      setIsLoadingEnv(false);
    };
    const debounce = setTimeout(fetchEnv, 600);
    return () => clearTimeout(debounce);
  }, [time, sessionDate, isOpen]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    setError(null);
    setAiFeedback(null);

    try {
      const tags = await ExifReader.load(file);
      if (tags['DateTimeOriginal']) {
        const exifDate = tags['DateTimeOriginal'].description;
        const timePart = exifDate.split(' ')[1];
        if (timePart) {
            const [h, m] = timePart.split(':');
            setTime(`${h}:${m}`);
        }
      }

      const compressedBase64 = await compressImageForAI(file);

      const analyzeCatch = httpsCallable(functions, 'analyzeCatchImage');
      const result: any = await analyzeCatch({ 
          image: compressedBase64,
          userPseudo,
          referentials: {
              lureTypes: lureTypes.map(l => ({ id: l.id, label: l.label })),
              colors: colors.map(c => ({ id: c.id, label: c.label }))
          }
      });

      const { data } = result;
      if (data.species) setSpecies(data.species as SpeciesType);
      if (data.size) setSize(data.size);
      if (data.lureTypeId) setSelectedLureTypeId(data.lureTypeId);
      if (data.lureColorId) setSelectedColorId(data.lureColorId);
      
      setAiFeedback({
          message: data.enthusiastic_message,
          confidence: data.confidence_score
      });

    } catch (err: any) {
      console.error("Erreur Vision Oracle:", err);
      setError("Analyse impossible. Vérifie ta connexion.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (time < sessionStartTime || time > sessionEndTime) {
      setError(`L'heure doit être comprise entre ${sessionStartTime} et ${sessionEndTime}.`);
      return;
    }
    const zoneObj = availableZones.find(z => z.id === selectedZoneId);
    const techObj = availableTechniques.find(t => t.id === selectedTechId);
    const photos = [photoLink1.trim(), photoLink2.trim()].filter(url => url.length > 0);

    onSave({ 
      species, size, 
      lureName: lureName.trim(),
      lureTypeId: selectedLureTypeId,
      lureColorId: selectedColorId,
      lureSizeId: selectedSizeId,
      lureWeightId: selectedWeightId,
      time,
      technique: techObj?.label || 'Inconnue', techniqueId: selectedTechId,
      spotName: zoneObj?.label || 'Inconnue', spotId: selectedZoneId,
      photoUrls: photos,
      envSnapshot
    });
    onClose();
  };

  const SelectField = ({ label, value, onChange, options, placeholder }: any) => (
    <div className="space-y-1">
        <label className="text-[10px] font-black uppercase text-stone-400 ml-1">{label}</label>
        <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full p-2.5 bg-white border border-stone-200 rounded-xl text-xs font-medium text-stone-700 outline-none focus:ring-2 focus:ring-amber-200">
           <option value="">{placeholder}</option>
           {options.map((o: any) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-200 sm:items-center p-4">
      <div className="w-full max-w-lg bg-[#FAF9F6] rounded-3xl shadow-2xl p-6 space-y-4 border border-white/50 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b border-stone-100 pb-4">
          <h3 className="font-bold text-lg flex items-center gap-2 text-stone-800">
            {initialData ? <><Edit2 className="text-amber-500" size={20}/> Modifier la Prise</> : <><Sparkles className="text-amber-500" size={20}/> Nouvelle Prise</>}
          </h3>
          <div className="flex items-center gap-3">
             {isLoadingEnv ? <Loader2 className="animate-spin text-amber-500" size={16}/> : 
              envStatus === 'found' ? <CloudCheck className="text-emerald-500" size={16}/> : <CloudOff className="text-stone-300" size={16}/>}
             <button onClick={onClose} className="p-2 text-stone-400 hover:bg-stone-100 rounded-full"><X size={20}/></button>
          </div>
        </div>

        {!initialData && (
            <div className="relative group">
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} />
                <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isAnalyzing}
                    className="w-full py-4 px-6 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white font-black text-sm flex items-center justify-center gap-3 shadow-lg shadow-orange-200 hover:shadow-orange-300 active:scale-95 transition-all disabled:opacity-50"
                >
                    {isAnalyzing ? <><Loader2 className="animate-spin" size={20} /> Analyse Oracle en cours...</> : <><Wand2 size={20} /> Scan Oracle Vision (One-Click)</>}
                </button>
            </div>
        )}

        {aiFeedback && (
            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-start gap-3 animate-in zoom-in-95 duration-300">
                <CheckCircle2 className="text-emerald-500 shrink-0 mt-0.5" size={18} />
                <div>
                    <p className="text-emerald-800 text-xs font-bold leading-tight">{aiFeedback.message}</p>
                    <p className="text-[9px] text-emerald-600 font-black uppercase tracking-widest mt-1">Indice de confiance : {Math.round(aiFeedback.confidence * 100)}%</p>
                </div>
            </div>
        )}

        {error && <div className="bg-rose-50 text-rose-600 p-3 rounded-xl text-xs font-bold flex items-center gap-2 border border-rose-100"><AlertCircle size={16}/> {error}</div>}

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

          <div className="bg-stone-100/50 p-3 rounded-2xl border border-stone-100 grid grid-cols-2 gap-3">
              <SelectField label="Type de Leurre" value={selectedLureTypeId} onChange={setSelectedLureTypeId} options={lureTypes} placeholder="Type..." />
              <SelectField label="Couleur" value={selectedColorId} onChange={setSelectedColorId} options={colors} placeholder="Couleur..." />
              <SelectField label="Taille" value={selectedSizeId} onChange={setSelectedSizeId} options={sizes} placeholder="Taille..." />
              <SelectField label="Poids" value={selectedWeightId} onChange={setSelectedWeightId} options={weights} placeholder="Poids..." />
          </div>

          <div className="bg-white p-4 rounded-2xl border border-stone-100 space-y-3 shadow-sm">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-black uppercase text-stone-400 flex items-center gap-2"><Ruler size={14}/> Taille Prise</label>
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

          <input type="text" placeholder="Commentaire (Modèle précis, etc.)" value={lureName} onChange={(e) => setLureName(e.target.value)} className="w-full p-3 bg-white border border-stone-200 rounded-xl text-sm outline-none focus:border-amber-400"/>

          <div className="bg-blue-50/50 p-3 rounded-2xl border border-blue-100 space-y-2">
             <label className="text-[10px] font-black uppercase text-blue-400 flex items-center gap-1">
                <ImageIcon size={12} /> Liens Google Photos
             </label>
             <input type="url" placeholder="Lien partage n°1" value={photoLink1} onChange={(e) => setPhotoLink1(e.target.value)} className="w-full p-2 bg-white border border-blue-100 rounded-xl text-xs text-blue-800 outline-none focus:ring-2 focus:ring-blue-200"/>
             <input type="url" placeholder="Lien partage n°2" value={photoLink2} onChange={(e) => setPhotoLink2(e.target.value)} className="w-full p-2 bg-white border border-blue-100 rounded-xl text-xs text-blue-800 outline-none focus:ring-2 focus:ring-blue-200"/>
          </div>

          <button type="submit" disabled={isLoadingEnv || isAnalyzing} className="w-full bg-stone-800 text-white py-4 rounded-2xl font-black shadow-lg active:scale-95 transition-transform disabled:bg-stone-300">
            {isLoadingEnv || isAnalyzing ? <Loader2 className="animate-spin mx-auto" /> : initialData ? 'Mettre à jour' : 'Valider la prise'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CatchDialog;