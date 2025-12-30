import React, { useState, useMemo, useEffect } from 'react';
import { 
    MapPin, Star, Trash2, Plus, AlertCircle, ArrowLeft, 
    Info, Map as MapIcon, Edit2, X, Check, ChevronRight, 
    Anchor, Lock, ChevronUp, ChevronDown, 
    Settings, Fish, Save, Maximize, Waves, Droplets
} from 'lucide-react';
import { Location, Spot, MorphologyID, DepthCategoryID, BassinType, SpeciesType } from '../types';
import LocationPicker from './LocationPicker'; 

// --- CONSTANTES DE CONFIGURATION (BIO) ---
const MORPHOLOGY_OPTIONS: { value: MorphologyID; label: string }[] = [
    { value: 'Z_RIVER', label: 'Grand Fleuve / Rivière' },
    { value: 'Z_POND', label: 'Étang / Lac' },
    { value: 'Z_MED', label: 'Canal / Petit cours d\'eau' },
    { value: 'Z_DEEP', label: 'Grand Lac (Profond)' }
];

const DEPTH_OPTIONS: { value: DepthCategoryID; label: string }[] = [
    { value: 'Z_LESS_3', label: 'Faible (< 3m)' },
    { value: 'Z_3_15', label: 'Moyenne (3 - 15m)' },
    { value: 'Z_MORE_15', label: 'Profonde (> 15m)' }
];

const BASSIN_OPTIONS: { value: BassinType; label: string }[] = [
    { value: 'URBAIN', label: 'Zone Urbaine / Portuaire' },
    { value: 'AGRICOLE', label: 'Zone Agricole / Champs' },
    { value: 'PRAIRIE', label: 'Zone Prairie / Pâturage' },
    { value: 'FORESTIER', label: 'Zone Sauvage / Forêt' }
];

const TARGET_SPECIES: { id: SpeciesType; label: string }[] = [
    { id: 'Brochet', label: 'Brochet' },
    { id: 'Sandre', label: 'Sandre' },
    { id: 'Perche', label: 'Perche' },
    { id: 'Black-Bass', label: 'Black-Bass' }
];

interface LocationsManagerProps {
    locations: Location[];
    spots: Spot[];
    onAddLocation: (label: string, coordinates?: { lat: number; lng: number }) => void;
    onEditLocation: (id: string, label: string, extraData?: any) => void;
    onDeleteLocation: (id: string) => void;
    onToggleFavorite: (location: Location) => void;
    onMoveLocation: (id: string, direction: 'up' | 'down') => void;
    onAddSpot: (label: string, locationId: string) => void;
    onDeleteSpot: (id: string) => void;
    onEditSpot: (id: string, label: string) => void;
    onBack: () => void;
}

const GOLDEN_SECTOR_ID = import.meta.env.VITE_GOLDEN_SECTOR_ID; 

const LocationsManager: React.FC<LocationsManagerProps> = ({ 
    locations, spots,
    onAddLocation, onEditLocation, onDeleteLocation, onToggleFavorite, onMoveLocation,
    onAddSpot, onDeleteSpot, onEditSpot,
    onBack
}) => {
    const [selectedLocation, setSelectedLocation] = useState<Location | null>(null); 
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'spots' | 'bio'>('spots');

    const [bioForm, setBioForm] = useState<{
        typeId: MorphologyID;
        depthId: DepthCategoryID;
        bassin: BassinType;
        meanDepth: number; 
        surfaceArea: number;
        shapeFactor: number;
        speciesIds: string[];
    }>({
        typeId: 'Z_RIVER',
        depthId: 'Z_3_15', 
        bassin: 'URBAIN',
        meanDepth: 5.0,
        surfaceArea: 100000,
        shapeFactor: 1.2,
        speciesIds: []
    });

    const [labelInput, setLabelInput] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showMap, setShowMap] = useState(false);
    const [tempCoords, setTempCoords] = useState<{lat: number, lng: number} | undefined>(undefined);
    const [spotInput, setSpotInput] = useState("");
    const [editingSpotId, setEditingSpotId] = useState<string | null>(null);

    const getSafeCoords = (loc: Location | null) => {
        if (!loc) return null;
        const data = loc as any;
        if (data.coordinates?.coordinates?.lat !== undefined) {
            return { lat: Number(data.coordinates.coordinates.lat), lng: Number(data.coordinates.coordinates.lng) };
        }
        if (loc.coordinates?.lat !== undefined) {
            return { lat: Number(loc.coordinates.lat), lng: Number(loc.coordinates.lng) };
        }
        return null;
    };

    useEffect(() => {
        if (selectedLocation) {
            const morph = selectedLocation.morphology;
            const currentBassin = morph?.bassin as any;
            const safeBassin: BassinType = currentBassin === 'NATUREL' ? 'FORESTIER' : (currentBassin || 'URBAIN');

            setBioForm({
                typeId: morph?.typeId || 'Z_RIVER',
                depthId: (morph?.depthId as DepthCategoryID) || 'Z_3_15',
                bassin: safeBassin,
                meanDepth: morph?.meanDepth || 5.0,
                surfaceArea: morph?.surfaceArea || 100000,
                shapeFactor: morph?.shapeFactor || 1.2,
                speciesIds: selectedLocation.speciesIds || []
            });
            const safeCoords = getSafeCoords(selectedLocation);
            if (safeCoords) setTempCoords(safeCoords);
            setActiveTab('spots'); 
        }
    }, [selectedLocation]);

    const favoritesCount = locations.filter(l => l.isFavorite).length;
    const isLimitReached = favoritesCount >= 3;

    const sortedLocations = useMemo(() => {
        return [...locations].sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999));
    }, [locations]);

    const getStaticMapUrl = (lat: number, lng: number, zoom = 13, size = "600x300") => {
        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        if (!apiKey) return "";
        return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${size}&scale=2&maptype=roadmap&markers=color:0xef4444%7C${lat},${lng}&key=${apiKey}`;
    };

    const handleSubmitLocation = (e: React.FormEvent) => {
        e.preventDefault();
        if (!labelInput.trim()) return;
        if (editingId) {
            const payload: any = {};
            if (tempCoords) payload.coordinates = { lat: tempCoords.lat, lng: tempCoords.lng };
            onEditLocation(editingId, labelInput, payload);
            setEditingId(null);
        } else {
            onAddLocation(labelInput, tempCoords);
        }
        setLabelInput("");
        setTempCoords(undefined);
    };

    const handleStartEditLocation = (e: React.MouseEvent, location: Location) => {
        e.stopPropagation(); 
        setEditingId(location.id);
        setLabelInput(location.label);
        const safe = getSafeCoords(location);
        setTempCoords(safe || undefined);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSaveBio = () => {
        if (!selectedLocation) return;
        const extraData = {
            morphology: {
                typeId: bioForm.typeId,
                depthId: bioForm.depthId, 
                bassin: bioForm.bassin,
                meanDepth: Number(bioForm.meanDepth),
                surfaceArea: Number(bioForm.surfaceArea),
                shapeFactor: Number(bioForm.shapeFactor)
            },
            speciesIds: bioForm.speciesIds
        };
        onEditLocation(selectedLocation.id, selectedLocation.label, extraData);
        setSelectedLocation((prev: Location | null) => prev ? { ...prev, ...extraData } : null);
    };

    const toggleSpecies = (speciesId: string) => {
        setBioForm(prev => {
            const exists = prev.speciesIds.includes(speciesId);
            return { ...prev, speciesIds: exists ? prev.speciesIds.filter(id => id !== speciesId) : [...prev.speciesIds, speciesId] };
        });
    };

    const handleAddSpotSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!spotInput.trim() || !selectedLocation) return;
        if (editingSpotId) { onEditSpot(editingSpotId, spotInput); setEditingSpotId(null); }
        else { onAddSpot(spotInput, selectedLocation.id); }
        setSpotInput("");
    };

    const currentSafeCoords = getSafeCoords(selectedLocation);
    const isRiver = bioForm.typeId === 'Z_RIVER';

    if (selectedLocation) {
        return (
            <div className="pb-24 animate-in slide-in-from-right duration-300 px-4 pt-4 max-w-2xl mx-auto">
                <div className="flex items-center gap-3 mb-4">
                    <button onClick={() => { setSelectedLocation(null); setEditingSpotId(null); setSpotInput(""); }} className="p-2 bg-white rounded-full shadow-sm text-stone-400 hover:text-stone-800 transition-colors"><ArrowLeft size={20} /></button>
                    <div className="flex-1">
                        <h2 className="text-xl font-black text-stone-800 tracking-tighter uppercase truncate">{selectedLocation.label}</h2>
                        <div className="flex items-center gap-2 text-xs text-stone-500 font-medium"><span>{spots.filter(s => s.locationId === selectedLocation.id).length} Spots</span><span>•</span><span>{selectedLocation.isFavorite ? 'Favori' : 'Standard'}</span></div>
                    </div>
                </div>

                <div className="flex p-1 bg-stone-100 rounded-xl mb-6">
                    <button onClick={() => setActiveTab('spots')} className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'spots' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-400'}`}><Anchor size={16} /> Spots</button>
                    <button onClick={() => setActiveTab('bio')} className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'bio' ? 'bg-white text-emerald-600 shadow-sm' : 'text-stone-400'}`}><Settings size={16} /> Profil & Bio</button>
                </div>

                {activeTab === 'spots' && (
                    <div className="animate-in fade-in zoom-in-95 duration-200">
                        {currentSafeCoords ? (
                            <div className="mb-6 rounded-2xl overflow-hidden shadow-lg border-2 border-white relative h-32">
                                <img src={getStaticMapUrl(currentSafeCoords.lat, currentSafeCoords.lng)} alt="Carte" className="w-full h-full object-cover" />
                                <div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded text-[10px] font-mono text-stone-600">{currentSafeCoords.lat.toFixed(4)}, {currentSafeCoords.lng.toFixed(4)}</div>
                            </div>
                        ) : <div className="mb-6 h-24 bg-stone-100 rounded-2xl flex items-center justify-center border border-dashed border-stone-300 text-stone-400 text-xs text-center px-4">Gérez le GPS via l'icône Map du secteur.</div>}

                        <div className="bg-white rounded-[2rem] p-5 border border-stone-100 shadow-sm">
                            <form onSubmit={handleAddSpotSubmit} className="flex gap-2 mb-4">
                                <input type="text" value={spotInput} onChange={(e) => setSpotInput(e.target.value)} placeholder={editingSpotId ? "Renommer..." : "Nouveau spot..."} className="flex-1 bg-stone-50 px-4 py-3 rounded-xl text-sm font-bold border border-stone-200 focus:ring-2 focus:ring-amber-200 outline-none transition-all" />
                                <button type="submit" disabled={!spotInput.trim()} className="bg-stone-800 text-white p-3 rounded-xl">{editingSpotId ? <Check size={18} /> : <Plus size={18} />}</button>
                            </form>
                            <div className="space-y-2">
                                {spots.filter(s => s.locationId === selectedLocation.id).map(spot => (
                                    <div key={spot.id} className="flex justify-between items-center p-3 rounded-xl bg-stone-50 border border-stone-100 group hover:border-amber-200 transition-colors">
                                        <span className="text-sm font-bold text-stone-700">{spot.label}</span>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => { setEditingSpotId(spot.id); setSpotInput(spot.label); }} className="p-1.5 text-stone-400 hover:text-amber-600"><Edit2 size={14} /></button>
                                            <button onClick={() => onDeleteSpot(spot.id)} className="p-1.5 text-stone-400 hover:text-rose-600"><Trash2 size={14} /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'bio' && (
                    <div className="animate-in fade-in zoom-in-95 duration-200 space-y-6">
                        <div className="bg-white rounded-[2rem] p-6 border border-stone-100 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-stone-800 flex items-center gap-2"><MapIcon size={18} className="text-emerald-500"/> Morphologie</h3>
                                <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter flex items-center gap-1.5 ${isRiver ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                                    {isRiver ? <><Waves size={12}/> Eau Vive</> : <><Droplets size={12}/> Eau Close</>}
                                </div>
                            </div>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-bold text-stone-400 uppercase ml-1">Type de milieu</label>
                                    <select value={bioForm.typeId} onChange={(e) => setBioForm({...bioForm, typeId: e.target.value as MorphologyID})} className="w-full mt-1 bg-stone-50 border border-stone-200 text-stone-800 text-sm font-bold rounded-xl px-3 py-3">{MORPHOLOGY_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-stone-400 uppercase ml-1">Catégorie Profondeur</label>
                                        <select value={bioForm.depthId} onChange={(e) => setBioForm({...bioForm, depthId: e.target.value as DepthCategoryID})} className="w-full mt-1 bg-stone-50 border border-stone-200 text-stone-800 text-sm font-bold rounded-xl px-3 py-3">{DEPTH_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select>
                                    </div>
                                    
                                    <div>
                                        <label className="text-[10px] font-bold text-stone-400 uppercase ml-1">Bassin Versant</label>
                                        <select value={bioForm.bassin} onChange={(e) => setBioForm({...bioForm, bassin: e.target.value as BassinType})} className="w-full mt-1 bg-stone-50 border border-stone-200 text-stone-800 text-sm font-bold rounded-xl px-3 py-3">{BASSIN_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select>
                                    </div>
                                </div>

                                <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100 space-y-4">
                                    <div className="flex items-center gap-2 text-stone-500 mb-2"><Info size={14}/> <span className="text-[10px] font-bold uppercase tracking-wider">Paramètres Déterministes Oracle</span></div>
                                    
                                    <div>
                                        <label className="text-[9px] font-bold text-stone-400 uppercase ml-1">Profondeur Moyenne (mètres)</label>
                                        <input type="number" step="0.1" value={bioForm.meanDepth} onChange={(e) => setBioForm({...bioForm, meanDepth: parseFloat(e.target.value)})} className="w-full mt-1 bg-white border border-stone-200 text-stone-800 text-xs font-bold rounded-lg px-3 py-2" placeholder="Ex: 4.5" />
                                        <p className="text-[9px] text-stone-400 mt-1 italic">Crucial pour l'inertie thermique (Air2Water) et l'oxygène.</p>
                                    </div>

                                    {!isRiver && (
                                        <div className="space-y-6">
                                            <div>
                                                <label className="text-[9px] font-bold text-stone-400 uppercase ml-1">Surface du secteur (ha)</label>
                                                <div className="flex items-center gap-3">
                                                    <input 
                                                        type="number" 
                                                        step="0.1" 
                                                        value={bioForm.surfaceArea / 10000} 
                                                        onChange={(e) => setBioForm({...bioForm, surfaceArea: Math.round(parseFloat(e.target.value) * 10000)})} 
                                                        className="w-full mt-1 bg-white border border-stone-200 text-stone-800 text-sm font-black rounded-lg px-3 py-2 shadow-inner" 
                                                    />
                                                    <div className="shrink-0 bg-stone-100 px-3 py-2 rounded-lg border border-stone-200 text-[10px] font-mono text-stone-500">
                                                        {bioForm.surfaceArea.toLocaleString()} m²
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="pt-2 border-t border-stone-200/50">
                                                <div className="flex justify-between items-center mb-4">
                                                    <label className="text-[9px] font-bold text-stone-400 uppercase ml-1">Facteur de forme (Exposition Vent)</label>
                                                    <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">{bioForm.shapeFactor.toFixed(1)}</span>
                                                </div>
                                                <div className="flex items-center gap-6 px-2">
                                                    {/* Visualiseur de forme agrandi et bleu */}
                                                    <div className="relative w-20 h-20 flex items-center justify-center shrink-0 bg-white rounded-xl shadow-inner border border-stone-100 overflow-hidden">
                                                        <div 
                                                            className="bg-blue-500/20 border-2 border-blue-500 transition-all duration-300"
                                                            style={{
                                                                width: `${30 + (bioForm.shapeFactor - 1) * 30}px`,
                                                                height: `${30 - (bioForm.shapeFactor - 1) * 10}px`,
                                                                borderRadius: `${(2 - bioForm.shapeFactor) * 50}%`
                                                            }}
                                                        />
                                                    </div>
                                                    <div className="flex-1">
                                                        <input 
                                                            type="range" 
                                                            min="1.0" 
                                                            max="2.0" 
                                                            step="0.1" 
                                                            value={bioForm.shapeFactor} 
                                                            onChange={(e) => setBioForm({...bioForm, shapeFactor: parseFloat(e.target.value)})} 
                                                            className="w-full h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-blue-500" 
                                                        />
                                                        <div className="flex justify-between mt-2">
                                                            <span className="text-[8px] font-bold text-stone-400 uppercase">Concentré (1.0)</span>
                                                            <span className="text-[8px] font-bold text-stone-400 uppercase">Étiré (2.0)</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <p className="text-[9px] text-stone-400 mt-4 italic leading-tight">Définit le "Fetch" effectif. Un plan d'eau étiré génère plus de vagues par vent de travers.</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-[2rem] p-6 border border-stone-100 shadow-sm">
                            <h3 className="font-bold text-stone-800 flex items-center gap-2 mb-4"><Fish size={18} className="text-blue-500"/> Espèces Présentes</h3>
                            <div className="grid grid-cols-2 gap-3">
                                {TARGET_SPECIES.map(species => {
                                    const isSelected = bioForm.speciesIds.includes(species.id);
                                    return ( <button key={species.id} onClick={() => toggleSpecies(species.id)} className={`p-3 rounded-xl border text-sm font-bold flex items-center justify-between transition-all ${isSelected ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-stone-50 border-stone-100 text-stone-400'}`}>{species.label} {isSelected && <Check size={16} />}</button> );
                                })}
                            </div>
                        </div>

                        <button onClick={handleSaveBio} className="w-full bg-stone-800 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform"><Save size={20} /> Enregistrer la configuration</button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="pb-24 animate-in fade-in duration-300 px-4 pt-4 max-w-2xl mx-auto">
            {showMap && <LocationPicker initialLat={tempCoords?.lat} initialLng={tempCoords?.lng} onValidate={(coords) => { setTempCoords(coords); setShowMap(false); }} onCancel={() => setShowMap(false)} />}
            <div className="flex items-center gap-3 mb-8">
                <button onClick={onBack} className="p-2 bg-white rounded-full shadow-sm text-stone-400 hover:text-stone-800 transition-colors"><ArrowLeft size={20} /></button>
                <div><h2 className="text-2xl font-black text-stone-800 tracking-tighter uppercase flex items-center gap-2"><MapPin className="text-emerald-500" /> Mes Secteurs</h2><p className="text-xs text-stone-500 font-medium">Gérez vos zones de pêche.</p></div>
            </div>

            {error && <div className="mb-6 bg-rose-50 border border-rose-100 text-rose-700 px-4 py-3 rounded-xl flex items-center gap-3"><AlertCircle size={20} /> <span className="text-xs font-bold">{error}</span></div>}

            <div className={`mb-8 p-4 rounded-2xl border flex items-center justify-between ${isLimitReached ? 'bg-amber-50 border-amber-200' : 'bg-white border-stone-100'}`}>
                <div className="flex items-center gap-3"><div className={`p-2 rounded-full ${isLimitReached ? 'bg-amber-100 text-amber-600' : 'bg-stone-100 text-stone-400'}`}><Star size={20} fill={isLimitReached ? "currentColor" : "none"} /></div><div><div className="font-black text-stone-800 text-sm uppercase tracking-wide">Favoris Actifs</div><div className="text-[10px] text-stone-400 font-bold">Priorité sur l'Oracle</div></div></div>
                <div className="text-right"><span className={`text-2xl font-black ${isLimitReached ? 'text-amber-600' : 'text-stone-800'}`}>{favoritesCount}</span><span className="text-sm font-bold text-stone-300">/3</span></div>
            </div>

            <form onSubmit={handleSubmitLocation} className="mb-8 relative flex gap-2 items-stretch">
                <div className="relative flex-1"><input type="text" value={labelInput} onChange={(e) => setLabelInput(e.target.value)} placeholder={editingId ? "Modifier..." : "Nouveau secteur..."} className={`w-full pl-5 pr-4 py-4 bg-white border rounded-2xl font-bold text-stone-800 outline-none focus:ring-2 focus:ring-emerald-400 shadow-sm transition-colors ${editingId ? 'border-amber-300 bg-amber-50/30' : 'border-stone-200'}`} /></div>
                <button type="button" onClick={() => setShowMap(true)} className={`aspect-square w-[58px] rounded-2xl flex items-center justify-center border transition-all ${tempCoords ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white border-stone-200 text-stone-400'}`}><MapIcon size={24} /> {tempCoords && <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white"></span>}</button>
                <button type="submit" disabled={!labelInput.trim()} className={`aspect-square w-[58px] rounded-2xl flex items-center justify-center shadow-lg text-white ${editingId ? 'bg-amber-500' : 'bg-stone-800'}`}>{editingId ? <Check size={24} /> : <Plus size={24} />}</button>
            </form>

            <div className="space-y-3">
                {sortedLocations.map((loc, index) => {
                    const listSafeCoords = getSafeCoords(loc);
                    return (
                        <div key={loc.id} onClick={() => setSelectedLocation(loc)} className={`group p-4 rounded-2xl border shadow-sm flex items-center justify-between transition-all cursor-pointer hover:bg-stone-50 ${editingId === loc.id ? 'bg-amber-50 border-amber-200' : 'bg-white border-stone-100'}`}>
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 rounded-xl overflow-hidden bg-stone-200 shrink-0 border border-stone-200 relative">{listSafeCoords ? <img src={getStaticMapUrl(listSafeCoords.lat, listSafeCoords.lng, 12, "100x100")} className="w-full h-full object-cover" alt="Mini" /> : <MapIcon className="text-stone-300 m-auto mt-4" size={24} />}</div>
                                <div><div className="font-bold text-stone-700 text-lg flex items-center gap-2">{loc.label} <button onClick={(e) => { e.stopPropagation(); onToggleFavorite(loc); }} className={`${loc.isFavorite ? 'text-amber-500' : 'text-stone-200 hover:text-stone-400'}`}><Star size={16} fill={loc.isFavorite ? "currentColor" : "none"} /></button></div><div className="text-xs text-stone-400 font-medium mt-1"><span>{spots.filter(s => s.locationId === loc.id).length} Spots</span></div></div>
                            </div>
                            <div className="flex items-center gap-2"><div className="flex flex-col mr-2">{index > 0 && <button onClick={(e) => { e.stopPropagation(); onMoveLocation(loc.id, 'up'); }} className="p-1 hover:bg-stone-200 rounded text-stone-400"><ChevronUp size={12} /></button>}{index < sortedLocations.length - 1 && <button onClick={(e) => { e.stopPropagation(); onMoveLocation(loc.id, 'down'); }} className="p-1 hover:bg-stone-200 rounded text-stone-400"><ChevronDown size={12} /></button>}</div>
                            <button onClick={(e) => handleStartEditLocation(e, loc)} className="p-2 text-stone-300 hover:text-amber-600 transition-colors"><Edit2 size={18} /></button>
                            <button onClick={(e) => { e.stopPropagation(); loc.id !== GOLDEN_SECTOR_ID && onDeleteLocation(loc.id); }} className={`p-2 transition-colors ${loc.id === GOLDEN_SECTOR_ID ? 'text-stone-200 cursor-not-allowed' : 'text-stone-300 hover:text-rose-500'}`} disabled={loc.id === GOLDEN_SECTOR_ID}>{loc.id === GOLDEN_SECTOR_ID ? <Lock size={18} /> : <Trash2 size={18} />}</button>
                            <ChevronRight className="text-stone-300 ml-2" size={20} /></div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default LocationsManager;