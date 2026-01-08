// components/CatchDialog.tsx - Version 10.1.0 (V8.1 Snapshot Integrity)
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    X, Ruler, Sparkles, Edit2, Image as ImageIcon, Loader2, 
    Cloud, CloudOff, Check, Wand2, CheckCircle2, AlertCircle, Camera, UploadCloud 
} from 'lucide-react';
import { 
    SpeciesType, Zone, Technique, Catch, RefLureType, 
    RefColor, RefSize, RefWeight, FullEnvironmentalSnapshot, Location,
    SCHEMA_VERSION // MICHAEL : Import de la constante de version
} from '../types';
import { getFunctions, httpsCallable } from 'firebase/functions'; 
import { getApp } from 'firebase/app';
import { functions, storage } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { fetchHistoricalWeatherContext } from '../lib/universal-weather-service';
import ExifReader from 'exifreader';

interface CatchDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => void;
    initialData?: Catch | null;
    availableZones: Zone[];
    locationId: string;
    locations: Location[];
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
    userId: string; 
    isActuallyNight?: boolean;
}

const SPECIES_CONFIG: Record<string, { max: number }> = {
    'Perche': { max: 60 }, 'Chevesne': { max: 70 }, 'Sandre': { max: 100 },
    'Brochet': { max: 130 }, 'Silure': { max: 250 }, 'Aspe': { max: 100 },
    'Black-Bass': { max: 65 }, 'Truite': { max: 80 }
};

const compressImageForAI = (file: File): Promise<{ blob: Blob, base64: string }> => {
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
                const base64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
                canvas.toBlob((blob) => {
                    if (blob) resolve({ blob, base64 });
                    else reject(new Error("Erreur Blob"));
                }, 'image/jpeg', 0.85);
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
};

const CatchDialog: React.FC<CatchDialogProps> = ({ 
    isOpen, onClose, onSave, initialData, availableZones, locationId, locations, availableTechniques, 
    sessionStartTime, sessionEndTime, sessionDate, lureTypes, colors, sizes, weights,
    lastCatchDefaults, userPseudo = "Michael", userId,
    isActuallyNight 
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

    const [isLoadingEnv, setIsLoadingEnv] = useState(false);
    const [envSnapshot, setEnvSnapshot] = useState<FullEnvironmentalSnapshot | null>(null);
    const [envStatus, setEnvStatus] = useState<'idle' | 'found' | 'not-found' | 'simulated'>('idle');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [aiFeedback, setAiFeedback] = useState<{ message: string; confidence: number } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [error, setError] = useState<string | null>(null);

    const filteredSpots = useMemo(() => {
        return availableZones.filter(z => z.locationId === locationId);
    }, [availableZones, locationId]);

    useEffect(() => {
        if (isOpen) {
            setError(null);
            setAiFeedback(null);
            const data = initialData as any;

            if (data) {
                setSpecies((data.species as SpeciesType) || 'Sandre');
                setSize(data.size);
                setLureName(data.lureName || ''); 
                setSelectedTechId(data.techniqueId || '');
                setSelectedZoneId(data.spotId || (filteredSpots[0]?.id || ''));
                setSelectedLureTypeId(data.lureTypeId || '');
                setSelectedColorId(data.lureColorId || '');
                setSelectedSizeId(data.lureSizeId || '');
                setSelectedWeightId(data.lureWeightId || '');
                
                const photo = data.photoUrls && data.photoUrls.length > 0 ? data.photoUrls[0] : '';
                setPhotoLink1(photo);
                setPreviewUrl(photo || null);
                
                setEnvSnapshot(data.envSnapshot || null);
                setEnvStatus(data.envSnapshot ? 'found' : 'idle');
                
                if (data.timestamp) {
                    const dateObj = data.timestamp instanceof Date ? data.timestamp : new Date(data.timestamp.seconds * 1000);
                    setTime(dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
                }
            } else {
                setTime(sessionStartTime);
                setSpecies('Sandre'); 
                setSize(45); 
                setPhotoLink1('');
                setPreviewUrl(null); 
                setEnvSnapshot(null); 
                setEnvStatus('idle');
                
                if (lastCatchDefaults) {
                    setSelectedTechId(lastCatchDefaults.techniqueId || '');
                    setSelectedZoneId(lastCatchDefaults.spotId || (filteredSpots[0]?.id || '')); 
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
                    if (filteredSpots.length > 0) setSelectedZoneId(filteredSpots[0].id);
                    if (availableTechniques.length > 0) setSelectedTechId(availableTechniques[0].id);
                }
            }
        }
    }, [isOpen, initialData, lastCatchDefaults, sessionStartTime, filteredSpots, availableTechniques]);

    useEffect(() => {
        if (!isOpen || !time || !locationId) return;

        const fetchEnv = async () => {
            setIsLoadingEnv(true);
            try {
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
                                        flowRaw: 0, 
                                        waterTemp: cloudData.waterTemp ?? null, 
                                        turbidityIdx: Math.min(1, (cloudData.turbidityNTU || 5) / 50) 
                                    },
                                scores: cloudData.scores ?? { sandre: 0, brochet: 0, perche: 0, blackbass: 0 },
                                metadata: { 
                                    sourceLogId: 'universel_simulated', 
                                    calculationDate: new Date().toISOString(),
                                    calculationMode: 'ZERO_HYDRO', // Michael : Marqué comme simulation physique
                                    schemaVersion: SCHEMA_VERSION // [FIX] Big Bang Compatibility
                                }
                            });
                            setEnvStatus('simulated');
                        }
                    }
                }
                
            } catch (e) {
                console.error("Erreur Env Catch Michael :", e);
                setEnvStatus('not-found');
            } finally {
                setIsLoadingEnv(false);
            }
        };

        const debounce = setTimeout(fetchEnv, 800);
        return () => clearTimeout(debounce);
    }, [time, sessionDate, locationId, isOpen, locations]);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsAnalyzing(true); setIsUploading(true); setError(null); setAiFeedback(null);
        setPreviewUrl(URL.createObjectURL(file));
        try {
            const tags = await ExifReader.load(file);
            if (tags['DateTimeOriginal']) {
                const exifDate = tags['DateTimeOriginal'].description;
                const timePart = exifDate.split(' ')[1];
                if (timePart) { const [h, m] = timePart.split(':'); setTime(`${h}:${m}`); }
            }
            const { blob, base64 } = await compressImageForAI(file);
            
            const analyzePromise = httpsCallable(functions, 'analyzeCatchImage')({ 
                image: base64, userPseudo,
                referentials: {
                    lureTypes: lureTypes.map(l => ({ id: l.id, label: l.label })),
                    colors: colors.map(c => ({ id: c.id, label: c.label }))
                }
            });
            
            const fileName = `catch_${Date.now()}_${file.name.replace(/\s/g, '_')}`;
            const storageRef = ref(storage, `catches/${userId}/${fileName}`);
            const uploadPromise = uploadBytes(storageRef, blob);
            
            const [aiResult, uploadResult] = await Promise.all([analyzePromise, uploadPromise]);
            const { data }: any = aiResult;
            
            if (data.species) setSpecies(data.species as SpeciesType);
            if (data.size) setSize(data.size);
            if (data.lureTypeId) setSelectedLureTypeId(data.lureTypeId);
            if (data.lureColorId) setSelectedColorId(data.lureColorId);
            
            setAiFeedback({ message: data.enthusiastic_message, confidence: data.confidence_score });
            const downloadUrl = await getDownloadURL(uploadResult.ref);
            setPhotoLink1(downloadUrl);
            
        } catch (err: any) {
            console.error("Erreur Vision Michael:", err);
            setError("Analyse ou upload impossible.");
        } finally { setIsAnalyzing(false); setIsUploading(false); }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (time < sessionStartTime || time > sessionEndTime) {
            setError(`L'heure doit être comprise entre ${sessionStartTime} et ${sessionEndTime}.`);
            return;
        }
        const zoneObj = filteredSpots.find(z => z.id === selectedZoneId);
        const techObj = availableTechniques.find(t => t.id === selectedTechId);
        const photos = [photoLink1.trim()].filter(url => url.length > 0);
        
        onSave({ 
            species, size, lureName: lureName.trim(),
            lureTypeId: selectedLureTypeId, lureColorId: selectedColorId,
            lureSizeId: selectedSizeId, lureWeightId: selectedWeightId,
            time, technique: techObj?.label || 'Inconnue', techniqueId: selectedTechId,
            spotName: zoneObj?.label || 'Inconnue', spotId: selectedZoneId,
            photoUrls: photos, envSnapshot
        });
        onClose();
    };

    const inputBg = isActuallyNight ? 'bg-stone-800 border-stone-700 text-stone-100' : 'bg-white border-stone-200 text-stone-700';
    const textTitle = isActuallyNight ? 'text-stone-100' : 'text-stone-800';
    const textMuted = isActuallyNight ? 'text-stone-500' : 'text-stone-400';
    const cardInner = isActuallyNight ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-100';

    const SelectField = ({ label, value, onChange, options, placeholder }: any) => (
        <div className="space-y-1">
            <label className={`text-[10px] font-black uppercase ml-1 ${textMuted}`}>{label}</label>
            <select 
                value={value} 
                onChange={(e) => onChange(e.target.value)} 
                className={`w-full p-2.5 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-amber-500/20 transition-all border ${inputBg}`}
            >
                <option value="">{placeholder}</option>
                {options.map((o: any) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
        </div>
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 sm:items-center p-4">
            <div className={`w-full max-w-lg rounded-3xl shadow-2xl p-6 space-y-4 border max-h-[90vh] overflow-y-auto custom-scrollbar transition-colors duration-500 ${
                isActuallyNight ? 'bg-[#1c1917] border-stone-800' : 'bg-[#FAF9F6] border-white/50'
            }`}>
                
                <div className={`flex justify-between items-center border-b pb-4 ${isActuallyNight ? 'border-stone-800' : 'border-stone-100'}`}>
                    <h3 className={`font-bold text-lg flex items-center gap-2 ${textTitle}`}>
                        {initialData ? <><Edit2 className="text-amber-500" size={20}/> Modifier la Prise</> : <><Sparkles className="text-amber-500" size={20}/> Nouvelle Prise</>}
                    </h3>
                    <div className="flex items-center gap-3">
                         {isLoadingEnv ? <Loader2 className="animate-spin text-amber-500" size={16}/> : 
                          envStatus !== 'idle' ? (
                            <div className="flex items-center gap-1">
                                <Cloud className={envStatus === 'simulated' ? "text-blue-500" : "text-emerald-500"} size={16}/>
                                <Check className={envStatus === 'simulated' ? "text-blue-500" : "text-emerald-500"} size={12}/>
                            </div>
                          ) : <CloudOff className="text-stone-600" size={16}/>}
                         <button type="button" onClick={onClose} className={`p-2 rounded-full transition-colors ${isActuallyNight ? 'bg-stone-800 text-stone-400 hover:text-stone-200' : 'text-stone-400 hover:bg-stone-100'}`}><X size={20}/></button>
                    </div>
                </div>

                <div className="relative group">
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} />
                    <div 
                        onClick={() => !isAnalyzing && !isUploading && fileInputRef.current?.click()}
                        className={`relative w-full aspect-video rounded-3xl border-2 border-dashed flex flex-col items-center justify-center overflow-hidden cursor-pointer transition-all
                            ${previewUrl 
                                ? 'border-transparent bg-stone-900 shadow-inner' 
                                : (isActuallyNight 
                                    ? 'border-stone-800 bg-stone-900/50 hover:border-amber-900/50 hover:bg-amber-950/10' 
                                    : 'border-stone-200 bg-white hover:border-amber-400 hover:bg-amber-50/30'
                                  )}`}
                    >
                        {previewUrl ? (
                            <>
                                <img src={previewUrl} alt="Prise" className="w-full h-full object-contain" />
                                {(isAnalyzing || isUploading) && (
                                    <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm flex flex-col items-center justify-center text-white p-4">
                                        <Loader2 className="animate-spin mb-2" size={32} />
                                        <p className="text-xs font-black uppercase tracking-widest text-center">
                                            {isUploading ? "Upload Photo..." : "Oracle Vision..."}
                                        </p>
                                    </div>
                                )}
                                <div className={`absolute bottom-3 right-3 p-2 rounded-full shadow-lg ${isActuallyNight ? 'bg-stone-800/90 text-stone-300' : 'bg-white/90 text-stone-600'}`}><Camera size={18} /></div>
                            </>
                        ) : (
                            <div className="text-center p-6">
                                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner ${isActuallyNight ? 'bg-amber-950/40 text-amber-500' : 'bg-amber-100 text-amber-600'}`}><UploadCloud size={32} /></div>
                                <p className={`font-bold ${isActuallyNight ? 'text-stone-300' : 'text-stone-800'}`}>Ajouter une Photo</p>
                                <p className={`${textMuted} text-[10px] font-medium uppercase mt-1 tracking-wider`}>Analyse & Stockage IA</p>
                            </div>
                        )}
                    </div>
                </div>

                {aiFeedback && (
                    <div className={`border p-4 rounded-2xl flex items-start gap-3 animate-in zoom-in-95 duration-300 ${
                        isActuallyNight ? 'bg-emerald-950/20 border-emerald-900/40' : 'bg-emerald-50 border-emerald-100'
                    }`}>
                        <CheckCircle2 className="text-emerald-500 shrink-0 mt-0.5" size={18} />
                        <div>
                            <p className={`text-xs font-bold leading-tight ${isActuallyNight ? 'text-emerald-400' : 'text-emerald-800'}`}>{aiFeedback.message}</p>
                            <p className={`text-[9px] font-black uppercase tracking-widest mt-1 ${isActuallyNight ? 'text-emerald-600/80' : 'text-emerald-600'}`}>Confiance : {Math.round(aiFeedback.confidence * 100)}%</p>
                        </div>
                    </div>
                )}

                {error && <div className="bg-rose-950/20 text-rose-500 p-3 rounded-xl text-xs font-bold flex items-center gap-2 border border-rose-900/30">{error}</div>}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className={`text-[10px] font-black uppercase ml-1 ${textMuted}`}>Espèce</label>
                            <select value={species} onChange={(e) => setSpecies(e.target.value as SpeciesType)} className={`w-full p-3 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-amber-500/20 transition-all border ${inputBg}`}>
                                {Object.keys(SPECIES_CONFIG).map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className={`text-[10px] font-black uppercase ml-1 ${textMuted}`}>Heure</label>
                            <input type="time" value={time} onChange={(e) => { setTime(e.target.value); setError(null); }} className={`w-full p-3 border rounded-xl text-sm font-bold text-center outline-none focus:ring-2 focus:ring-amber-500/20 transition-all ${inputBg}`}/>
                        </div>
                    </div>
                    
                    <div className="space-y-1">
                        <label className={`text-[10px] font-black uppercase ml-1 ${textMuted}`}>Technique</label>
                        <select value={selectedTechId} onChange={(e) => setSelectedTechId(e.target.value)} className={`w-full p-3 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-amber-500/20 transition-all border ${inputBg}`}>
                           {availableTechniques.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                        </select>
                    </div>

                    <div className={`p-3 rounded-2xl border grid grid-cols-2 gap-3 transition-colors ${isActuallyNight ? 'bg-stone-900/40 border-stone-800' : 'bg-stone-100/50 border-stone-100'}`}>
                        <SelectField label="Type de Leurre" value={selectedLureTypeId} onChange={setSelectedLureTypeId} options={lureTypes} placeholder="Type..." />
                        <SelectField label="Couleur" value={selectedColorId} onChange={setSelectedColorId} options={colors} placeholder="Couleur..." />
                        <SelectField label="Taille" value={selectedSizeId} onChange={setSelectedSizeId} options={sizes} placeholder="Taille..." />
                        <SelectField label="Poids" value={selectedWeightId} onChange={setSelectedWeightId} options={weights} placeholder="Poids..." />
                    </div>

                    <div className={`p-4 rounded-2xl border space-y-3 shadow-sm transition-colors ${cardInner}`}>
                        <div className="flex justify-between items-center">
                            <label className={`text-[10px] font-black uppercase flex items-center gap-2 ${textMuted}`}><Ruler size={14}/> Taille Prise</label>
                            <span className={`text-xl font-black ${isActuallyNight ? 'text-stone-100' : 'text-stone-800'}`}>{size} <span className="text-xs text-stone-400">cm</span></span>
                        </div>
                        <input type="range" min="10" max={SPECIES_CONFIG[species]?.max || 100} value={size} onChange={(e) => setSize(Number(e.target.value))} className={`w-full h-2 rounded-lg appearance-none cursor-pointer accent-amber-500 ${isActuallyNight ? 'bg-stone-800' : 'bg-stone-100'}`} />
                    </div>

                    <div className="space-y-1">
                        <label className={`text-[10px] font-black uppercase ml-1 ${textMuted}`}>Spot Précis du secteur</label>
                        <select value={selectedZoneId} onChange={(e) => setSelectedZoneId(e.target.value)} className={`w-full p-3 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-amber-500/20 transition-all border ${inputBg}`} disabled={filteredSpots.length === 0}>
                            {filteredSpots.map(z => <option key={z.id} value={z.id}>{z.label}</option>)}
                            {filteredSpots.length === 0 && <option value="">Aucun spot ici</option>}
                        </select>
                    </div>

                    <input 
                        type="text" 
                        placeholder="Modèle précis du leurre..." 
                        value={lureName} 
                        onChange={(e) => setLureName(e.target.value)} 
                        className={`w-full p-3 rounded-xl text-sm outline-none transition-all border ${isActuallyNight ? 'bg-stone-800 border-stone-700 text-stone-100 focus:border-amber-500/50' : 'bg-white border-stone-200 focus:border-amber-400'}`}
                    />
                    
                    <button type="submit" disabled={isLoadingEnv || isAnalyzing || isUploading} className={`w-full py-4 rounded-2xl font-black shadow-lg active:scale-95 transition-all ${
                        isActuallyNight 
                            ? 'bg-stone-100 text-[#1c1917] hover:bg-white disabled:bg-stone-800 disabled:text-stone-600' 
                            : 'bg-stone-800 text-white hover:bg-stone-950 disabled:bg-stone-300'
                    }`}>
                        {isLoadingEnv || isAnalyzing || isUploading ? <Loader2 className="animate-spin mx-auto" /> : initialData ? 'Mettre à jour' : 'Valider la prise'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default CatchDialog;