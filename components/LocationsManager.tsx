// components/LocationsManager.tsx - Version 10.0.0 (Full Night Ops Territory Management)
import React, { useState, useMemo, useEffect } from 'react';
import { 
    MapPin, Star, Trash2, Plus, AlertCircle, ArrowLeft, 
    Info, Map as MapIcon, Edit2, X, Check, ChevronRight, 
    Anchor, Settings, Fish, Save, Activity, ChevronUp, ChevronDown
} from 'lucide-react';
import { Location, Spot, MorphologyID, DepthCategoryID, BassinType, SpeciesType } from '../types';
import LocationPicker from './LocationPicker'; 
import { getRandomDeletionMessage, LOCATION_DELETION_MESSAGES } from '../constants/deletionMessages';
import DeleteConfirmDialog from './DeleteConfirmDialog'; 

// --- CONFIGURATION CONSTANTES ---
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
    userId: string;
    onAddLocation: (label: string, coordinates?: { lat: number; lng: number }) => void;
    onEditLocation: (id: string, label: string, extraData?: any) => void;
    onDeleteLocation: (id: string) => void;
    onToggleFavorite: (location: Location) => void;
    onMoveLocation: (id: string, direction: 'up' | 'down') => void;
    onAddSpot: (label: string, locationId: string) => void;
    onDeleteSpot: (id: string) => void;
    onEditSpot: (id: string, label: string) => void;
    onBack: () => void;
    initialOpenLocationId?: string | null;
    isActuallyNight?: boolean; // Michael : Pilier V8.0 raccordé [cite: 469]
}

const LocationsManager: React.FC<LocationsManagerProps> = ({ 
    locations, spots, userId,
    onAddLocation, onEditLocation, onDeleteLocation, onToggleFavorite, onMoveLocation,
    onAddSpot, onDeleteSpot, onEditSpot,
    onBack, initialOpenLocationId,
    isActuallyNight 
}) => {
    // --- STATE NAVIGATION & DATA ---
    const [selectedLocation, setSelectedLocation] = useState<Location | null>(null); 
    const [activeTab, setActiveTab] = useState<'bio' | 'spots' | 'species'>('bio');
    const [error, setError] = useState<string | null>(null);
    const [notification, setNotification] = useState<string | null>(null);

    // --- STATE SUPPRESSION (STANDARDISÉ) ---
    const [deleteConfirm, setDeleteConfirm] = useState<{
        type: 'location' | 'spot';
        id: string;
        label: string;
    } | null>(null);

    // --- STATE ÉDITION BIO ---
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

    // --- STATE CRÉATION ---
    const [isCreating, setIsCreating] = useState(false);
    const [creationStep, setCreationStep] = useState<'map' | 'form'>('map');
    const [newLocLabel, setNewLocLabel] = useState("");
    const [newLocCoords, setNewLocCoords] = useState<{lat: number, lng: number} | null>(null);

    // --- STATE SPOTS ---
    const [spotInput, setSpotInput] = useState("");
    const [editingSpotId, setEditingSpotId] = useState<string | null>(null);

    // --- STATE MAP & EDIT LABEL ---
    const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
    const [tempLabel, setTempLabel] = useState("");
    const [showPicker, setShowPicker] = useState(false);
    const [pickerMode, setPickerMode] = useState<'create' | 'edit'>('create');

    // --- EFFETS ---

    useEffect(() => {
        if (initialOpenLocationId && locations.length > 0) {
            const target = locations.find(l => l.id === initialOpenLocationId);
            if (target) {
                handleSelectLocation(target);
            }
        }
    }, [initialOpenLocationId, locations]);

    useEffect(() => {
        if (selectedLocation) {
            const morph = selectedLocation.morphology;
            setBioForm({
                typeId: morph?.typeId || 'Z_RIVER',
                depthId: (morph?.depthId as DepthCategoryID) || 'Z_3_15',
                bassin: morph?.bassin || 'URBAIN',
                meanDepth: morph?.meanDepth || 3.0,
                surfaceArea: morph?.surfaceArea || 50000,
                shapeFactor: morph?.shapeFactor || 1.0,
                speciesIds: selectedLocation.speciesIds || []
            });
        }
    }, [selectedLocation]);

    // --- HELPERS ---

    const getSafeCoords = (loc: Location | null) => {
        if (!loc) return null;
        if (loc.coordinates?.lat !== undefined) {
            return { lat: Number(loc.coordinates.lat), lng: Number(loc.coordinates.lng) };
        }
        return null;
    };

    const getStaticMapUrl = (lat: number, lng: number, zoom = 13, size = "600x300") => {
        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        if (!apiKey) return "";
        return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${size}&scale=2&maptype=roadmap&markers=color:0xef4444%7C${lat},${lng}&key=${apiKey}`;
    };

    const sortedLocations = useMemo(() => {
        return [...locations].sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999));
    }, [locations]);

    // --- LOGIQUE MÉTIER ---

    const handleSelectLocation = (loc: Location) => {
        setSelectedLocation(loc);
        setActiveTab('bio'); 
        setError(null);
    };

    const handleToggleFavorite = (loc: Location) => {
        const favoritesCount = locations.filter(l => l.isFavorite).length;
        if (!loc.isFavorite && favoritesCount >= 3) {
            setError("Limite de 3 favoris atteinte. Retirez-en un pour ajouter celui-ci.");
            setTimeout(() => setError(null), 4000);
            return;
        }
        onToggleFavorite(loc);
    };

    // --- WORKFLOW CRÉATION (MAP FIRST) ---

    const startCreation = () => {
        setIsCreating(true);
        setCreationStep('map'); 
        setNewLocLabel("");
        setNewLocCoords(null);
    };

    const handleMapValidation = (coords: {lat: number, lng: number}) => {
        if (pickerMode === 'create') {
            setNewLocCoords(coords);
            setCreationStep('form'); 
            setShowPicker(false);
        } else {
            if (selectedLocation) {
                onEditLocation(selectedLocation.id, selectedLocation.label, { coordinates: coords });
                setSelectedLocation(prev => prev ? {...prev, coordinates: coords} : null);
            }
            setShowPicker(false);
        }
    };

    const finalizeCreation = () => {
        if (!newLocLabel.trim() || !newLocCoords) return;
        onAddLocation(newLocLabel, newLocCoords);
        setIsCreating(false);
    };

    // --- LOGIQUE ÉDITION BIO / ESPÈCES ---

    const toggleSpecies = (speciesId: string) => {
        setBioForm(prev => {
            const exists = prev.speciesIds.includes(speciesId);
            return { 
                ...prev, 
                speciesIds: exists ? prev.speciesIds.filter(id => id !== speciesId) : [...prev.speciesIds, speciesId] 
            };
        });
    };

    const handleSaveConfig = () => {
        if (!selectedLocation) return;
        
        const currentSpots = spots.filter(s => s.locationId === selectedLocation.id);
        if (currentSpots.length === 0) {
            setError("Configuration incomplète : Vous devez définir au moins un Spot dans l'onglet 'Spots' avant de sauvegarder.");
            return;
        }

        if (bioForm.speciesIds.length === 0) {
            setError("Impossible d'enregistrer : Sélectionnez au moins une espèce pour le calcul des Bioscores.");
            return;
        }

        const extraData = {
            coordinates: getSafeCoords(selectedLocation),
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
        
        setNotification("Sauvegarde effectuée. Retour à la liste...");
        setError(null);
        
        setTimeout(() => {
            setNotification(null);
            setSelectedLocation(null);
        }, 800);
    };

    const handleAddSpotSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!spotInput.trim() || !selectedLocation) return;
        if (editingSpotId) { 
            onEditSpot(editingSpotId, spotInput); 
            setEditingSpotId(null); 
        } else { 
            onAddSpot(spotInput, selectedLocation.id); 
        }
        setSpotInput("");
    };

    const requestDelete = (type: 'location' | 'spot', id: string, label: string) => {
        setDeleteConfirm({ type, id, label });
    };

    const confirmDelete = () => {
        if (!deleteConfirm) return;

        if (deleteConfirm.type === 'location') {
            onDeleteLocation(deleteConfirm.id);
            if (selectedLocation && selectedLocation.id === deleteConfirm.id) {
                setSelectedLocation(null);
            }
        } else {
            onDeleteSpot(deleteConfirm.id);
        }
        setDeleteConfirm(null);
    };

    // --- RENDERERS ---

    // Michael : Styles Adaptatifs Soft Night Ops (#1c1917) 
    const cardClass = isActuallyNight 
        ? "bg-[#1c1917] border-stone-800 shadow-none" 
        : "bg-white border-stone-100 shadow-sm";
    
    const textTitle = isActuallyNight ? "text-stone-100" : "text-stone-800";
    const textMuted = isActuallyNight ? "text-stone-500" : "text-stone-400";
    const inputBg = isActuallyNight ? "bg-stone-900 border-stone-800 text-stone-200" : "bg-stone-50 border-stone-200 text-stone-800";
    const navBg = isActuallyNight ? "bg-stone-900 border-stone-800" : "bg-stone-100";

    if (selectedLocation) {
        const coords = getSafeCoords(selectedLocation);

        return (
            <div className="pb-24 animate-in slide-in-from-right duration-300 px-4 pt-4 max-w-2xl mx-auto relative">
                {showPicker && (
                    <LocationPicker 
                        initialLat={coords?.lat} 
                        initialLng={coords?.lng} 
                        onValidate={handleMapValidation} 
                        onCancel={() => setShowPicker(false)} 
                    />
                )}

                <DeleteConfirmDialog 
                    isOpen={!!deleteConfirm}
                    onClose={() => setDeleteConfirm(null)}
                    onConfirm={confirmDelete}
                    title={deleteConfirm?.type === 'location' ? `Supprimer "${deleteConfirm?.label}" ?` : `Supprimer le spot ?`}
                    customMessages={LOCATION_DELETION_MESSAGES} 
                    isActuallyNight={isActuallyNight}
                />

                {/* HEADER FIXE */}
                <div className="flex items-center gap-3 mb-4">
                    <button onClick={() => { setSelectedLocation(null); setEditingSpotId(null); setSpotInput(""); }} className={`p-2 rounded-full shadow-sm transition-colors ${isActuallyNight ? 'bg-stone-800 text-stone-400' : 'bg-white text-stone-400 hover:text-stone-800'}`}><ArrowLeft size={20} /></button>
                    <div className="flex-1 min-w-0">
                        <h2 className={`text-xl font-black uppercase truncate tracking-tighter ${textTitle}`}>{selectedLocation.label}</h2>
                        <div className="flex items-center gap-2 text-xs font-medium">
                            <span className={isActuallyNight ? 'text-stone-600' : 'text-stone-500'}>{coords ? `${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)}` : 'Pas de GPS'}</span>
                            <span className="text-stone-300">•</span>
                            <span className={selectedLocation.isFavorite ? 'text-amber-500 font-bold' : (isActuallyNight ? 'text-stone-600' : 'text-stone-500')}>{selectedLocation.isFavorite ? 'Favori' : 'Standard'}</span>
                        </div>
                    </div>
                    <button onClick={() => { setPickerMode('edit'); setShowPicker(true); }} className={`p-2 rounded-xl transition-colors ${isActuallyNight ? 'bg-stone-800 text-stone-500 hover:text-emerald-500' : 'bg-stone-100 text-stone-500 hover:bg-emerald-50 hover:text-emerald-600'}`}>
                        <MapIcon size={20} />
                    </button>
                </div>

                {notification && <div className="mb-4 bg-emerald-900/20 text-emerald-500 border border-emerald-900/30 px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2 animate-pulse"><Check size={16}/> {notification}</div>}
                {error && <div className="mb-4 bg-rose-950/20 text-rose-500 border border-rose-900/30 px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2"><AlertCircle size={16}/> {error}</div>}

                {/* CARTE FIXE */}
                {coords ? (
                    <div className={`mb-6 rounded-2xl overflow-hidden shadow-lg border-2 relative h-32 group transition-colors ${isActuallyNight ? 'border-stone-800' : 'border-white'}`}>
                        <img src={getStaticMapUrl(coords.lat, coords.lng)} alt="Carte" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
                        <div className="absolute bottom-3 left-3 text-white font-bold text-sm flex items-center gap-1"><MapPin size={14}/> {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}</div>
                    </div>
                ) : (
                        <div className={`mb-6 h-24 rounded-2xl flex items-center justify-center border border-dashed text-xs px-4 transition-colors ${isActuallyNight ? 'bg-stone-900/40 border-stone-800 text-stone-600' : 'bg-stone-100 border-stone-300 text-stone-400'}`}>
                        GPS manquant. Utilisez l'icône carte en haut pour définir.
                        </div>
                )}

                {/* NAVIGATION ONGLETS */}
                <div className={`flex p-1 rounded-xl mb-6 shadow-inner transition-colors ${navBg}`}>
                    <button onClick={() => setActiveTab('bio')} className={`flex-1 py-2 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-1 sm:gap-2 transition-all ${activeTab === 'bio' ? (isActuallyNight ? 'bg-stone-800 text-emerald-400 shadow-sm' : 'bg-white text-emerald-600 shadow-sm') : 'text-stone-500'}`}>
                        <Settings size={14} /> Profil & Bio
                    </button>
                    <button onClick={() => setActiveTab('spots')} className={`flex-1 py-2 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-1 sm:gap-2 transition-all ${activeTab === 'spots' ? (isActuallyNight ? 'bg-stone-800 text-stone-100 shadow-sm' : 'bg-white text-stone-800 shadow-sm') : 'text-stone-500'}`}>
                        <Anchor size={14} /> Spots
                    </button>
                    <button onClick={() => setActiveTab('species')} className={`flex-1 py-2 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-1 sm:gap-2 transition-all ${activeTab === 'species' ? (isActuallyNight ? 'bg-stone-800 text-blue-400 shadow-sm' : 'bg-white text-blue-600 shadow-sm') : 'text-stone-500'}`}>
                        <Activity size={14} /> Bioscores
                    </button>
                </div>

                {/* CONTENU ONGLET 1: PROFIL & BIO */}
                {activeTab === 'bio' && (
                    <div className="animate-in fade-in zoom-in-95 duration-200 space-y-4">
                         <div className={`${cardClass} rounded-[2.5rem] p-6 border relative overflow-hidden transition-colors duration-500`}>
                            <div className={`absolute top-0 right-0 p-4 opacity-10 pointer-events-none ${isActuallyNight ? 'text-stone-700' : 'text-stone-200'}`}>
                                <Settings size={100} />
                            </div>
                            
                            <h3 className={`font-bold flex items-center gap-2 mb-6 relative z-10 ${textTitle}`}><MapIcon size={18} className="text-emerald-500"/> Calibration Morphologique</h3>
                            
                            <div className="space-y-5 relative z-10">
                                {/* Type de Milieu */}
                                <div>
                                    <label className={`text-[10px] font-bold uppercase ml-1 block mb-1 ${textMuted}`}>Type de milieu</label>
                                    <select value={bioForm.typeId} onChange={(e) => setBioForm({...bioForm, typeId: e.target.value as MorphologyID})} className={`w-full text-sm font-bold rounded-xl px-3 py-3 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all ${inputBg}`}>
                                        {MORPHOLOGY_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                    </select>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={`text-[10px] font-bold uppercase ml-1 block mb-1 ${textMuted}`}>Profondeur</label>
                                        <select value={bioForm.depthId} onChange={(e) => setBioForm({...bioForm, depthId: e.target.value as DepthCategoryID})} className={`w-full text-sm font-bold rounded-xl px-3 py-3 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all ${inputBg}`}>
                                            {DEPTH_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={`text-[10px] font-bold uppercase ml-1 block mb-1 ${textMuted}`}>Bassin Versant</label>
                                        <select value={bioForm.bassin} onChange={(e) => setBioForm({...bioForm, bassin: e.target.value as BassinType})} className={`w-full text-sm font-bold rounded-xl px-3 py-3 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all ${inputBg}`}>
                                            {BASSIN_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                        </select>
                                    </div>
                                </div>

                                {/* Paramètres Avancés */}
                                <div className={`p-4 rounded-2xl border space-y-4 transition-colors ${isActuallyNight ? 'bg-stone-900/40 border-stone-800' : 'bg-stone-50/80 border-stone-100'}`}>
                                    <div className="flex items-center gap-2 text-stone-500 mb-2">
                                        <Info size={14}/> <span className="text-[10px] font-bold uppercase tracking-wider">Paramètres Déterministes</span>
                                    </div>
                                    
                                    <div>
                                        <label className={`text-[9px] font-bold uppercase ml-1 ${textMuted}`}>Profondeur Moyenne (m)</label>
                                        <div className="flex items-center gap-3">
                                            <input type="range" min="0.5" max="20" step="0.5" value={bioForm.meanDepth} onChange={(e) => setBioForm({...bioForm, meanDepth: parseFloat(e.target.value)})} className={`flex-1 h-2 rounded-lg appearance-none cursor-pointer transition-all ${isActuallyNight ? 'bg-stone-800 accent-stone-200' : 'bg-stone-200 accent-stone-800'}`} />
                                            <span className={`w-12 text-right font-black px-2 py-1 rounded border text-xs transition-colors ${isActuallyNight ? 'bg-stone-900 border-stone-700 text-stone-200' : 'bg-white border-stone-200 text-stone-800'}`}>{bioForm.meanDepth}m</span>
                                        </div>
                                    </div>

                                    {bioForm.typeId !== 'Z_RIVER' && bioForm.typeId !== 'Z_MED' && (
                                        <div className={`space-y-4 pt-4 border-t ${isActuallyNight ? 'border-stone-800' : 'border-stone-200/50'}`}>
                                            <div>
                                                <label className={`text-[9px] font-bold uppercase ml-1 ${textMuted}`}>Surface (Hectares)</label>
                                                <div className="flex items-center gap-2">
                                                    <input 
                                                        type="number" 
                                                        value={bioForm.surfaceArea / 10000} 
                                                        onChange={(e) => setBioForm({...bioForm, surfaceArea: Math.round(parseFloat(e.target.value) * 10000)})} 
                                                        className={`w-full text-sm font-bold rounded-lg px-3 py-2 transition-all ${inputBg}`} 
                                                    />
                                                    <span className={`text-xs font-bold ${textMuted}`}>ha</span>
                                                </div>
                                            </div>
                                            
                                            <div>
                                                <div className="flex justify-between items-center mb-1">
                                                    <label className={`text-[9px] font-bold uppercase ml-1 ${textMuted}`}>Facteur de forme (Vent)</label>
                                                    <span className={`text-[10px] font-black px-2 rounded ${isActuallyNight ? 'bg-blue-950/40 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>{bioForm.shapeFactor.toFixed(1)}</span>
                                                </div>
                                                
                                                <div className={`flex justify-center py-6 rounded-xl mb-2 border transition-colors ${isActuallyNight ? 'bg-stone-900/60 border-stone-800' : 'bg-white/50 border-stone-100'}`}>
                                                    <div 
                                                        className="bg-blue-400/80 border-4 border-blue-200 shadow-lg transition-all duration-300 rounded-full"
                                                        style={{
                                                            width: '60px',
                                                            height: '60px',
                                                            transform: `scale(${bioForm.shapeFactor}, ${1 / bioForm.shapeFactor})` 
                                                        }}
                                                    />
                                                </div>

                                                <input 
                                                    type="range" 
                                                    min="1.0" 
                                                    max="2.0" 
                                                    step="0.1" 
                                                    value={bioForm.shapeFactor} 
                                                    onChange={(e) => setBioForm({...bioForm, shapeFactor: parseFloat(e.target.value)})} 
                                                    className={`w-full h-4 rounded-lg appearance-none cursor-pointer transition-all ${isActuallyNight ? 'bg-stone-800 accent-blue-400' : 'bg-stone-200 accent-blue-500'}`} 
                                                />
                                                <div className={`flex justify-between mt-1 text-[8px] font-bold uppercase ${textMuted}`}>
                                                    <span>Rond (Abrité)</span>
                                                    <span>Allongé (Vagues)</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <button onClick={handleSaveConfig} className={`w-full font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all ${isActuallyNight ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-stone-800 hover:bg-stone-900 text-white'}`}>
                            <Save size={20} /> Enregistrer la configuration
                        </button>
                    </div>
                )}

                {/* CONTENU ONGLET 2: SPOTS */}
                {activeTab === 'spots' && (
                    <div className="animate-in fade-in zoom-in-95 duration-200 space-y-6">
                        <div className={`${cardClass} rounded-[2.5rem] p-5 border transition-colors duration-500`}>
                            <form onSubmit={handleAddSpotSubmit} className="flex gap-2 mb-4">
                                <input type="text" value={spotInput} onChange={(e) => setSpotInput(e.target.value)} placeholder={editingSpotId ? "Renommer le spot..." : "Ajouter un spot..."} className={`flex-1 px-4 py-3 rounded-xl text-sm font-bold outline-none transition-all ${inputBg} focus:ring-2 focus:ring-amber-500/20`} />
                                <button type="submit" disabled={!spotInput.trim()} className={`p-3 rounded-xl shadow-lg active:scale-95 transition-all ${isActuallyNight ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-stone-800 hover:bg-stone-900 text-white'}`}>{editingSpotId ? <Check size={18} /> : <Plus size={18} />}</button>
                            </form>
                            <div className="space-y-2">
                                {spots.filter(s => s.locationId === selectedLocation.id).length === 0 && (
                                    <div className="text-center py-8 text-stone-500 text-xs italic opacity-60">Aucun spot défini pour ce secteur.</div>
                                )}
                                {spots.filter(s => s.locationId === selectedLocation.id).map(spot => (
                                    <div key={spot.id} className={`flex justify-between items-center p-3 rounded-xl border transition-all group ${isActuallyNight ? 'bg-stone-900 border-stone-800 hover:border-amber-500/50' : 'bg-stone-50 border-stone-100 hover:border-amber-200'}`}>
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full border flex items-center justify-center font-bold text-xs transition-colors ${isActuallyNight ? 'bg-stone-800 border-stone-700 text-stone-500' : 'bg-white border-stone-200 text-stone-400'}`}>{spot.label.charAt(0)}</div>
                                            <span className={`text-sm font-bold transition-colors ${isActuallyNight ? 'text-stone-300' : 'text-stone-700'}`}>{spot.label}</span>
                                        </div>
                                        <div className="flex gap-1">
                                            <button onClick={() => { setEditingSpotId(spot.id); setSpotInput(spot.label); }} className="p-2 text-stone-500 hover:text-amber-500 rounded-lg transition-all"><Edit2 size={14} /></button>
                                            <button onClick={() => requestDelete('spot', spot.id, spot.label)} className="p-2 text-stone-500 hover:text-rose-500 rounded-lg transition-all"><Trash2 size={14} /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <button onClick={handleSaveConfig} className={`w-full font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all ${isActuallyNight ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-stone-800 hover:bg-stone-900 text-white'}`}>
                            <Save size={20} /> Enregistrer les modifications
                        </button>
                    </div>
                )}

                {/* CONTENU ONGLET 3: BIOSCORES */}
                {activeTab === 'species' && (
                    <div className="animate-in fade-in zoom-in-95 duration-200 space-y-6">
                        <div className={`${cardClass} rounded-[2.5rem] p-6 border relative overflow-hidden transition-colors duration-500`}>
                             <div className={`absolute top-0 right-0 p-4 opacity-10 pointer-events-none ${isActuallyNight ? 'text-stone-700' : 'text-stone-200'}`}>
                                <Fish size={100} />
                            </div>

                            <h3 className={`font-bold flex items-center gap-2 mb-2 relative z-10 ${textTitle}`}><Activity size={18} className="text-blue-500"/> Bioscores Attendus</h3>
                            <p className={`text-xs mb-6 relative z-10 opacity-70 ${textTitle}`}>Sélectionne les espèces pour lesquelles tu souhaites voir le bioscore s'afficher.</p>
                            
                            <div className="grid grid-cols-2 gap-3 relative z-10">
                                {TARGET_SPECIES.map(species => {
                                    const isSelected = bioForm.speciesIds.includes(species.id);
                                    return ( 
                                        <button key={species.id} onClick={() => toggleSpecies(species.id)} className={`p-3 rounded-xl border text-sm font-bold flex items-center justify-between transition-all active:scale-95 ${isSelected ? (isActuallyNight ? 'bg-blue-950/40 border-blue-800 text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm') : (isActuallyNight ? 'bg-stone-900 border-stone-800 text-stone-500 hover:bg-stone-800' : 'bg-stone-50 border-stone-100 text-stone-400 hover:bg-stone-100')}`}>
                                            {species.label} 
                                            {isSelected && <Check size={16} className="text-blue-500"/>}
                                        </button> 
                                    );
                                })}
                            </div>

                            {bioForm.speciesIds.length === 0 && (
                                <div className="mt-4 p-3 bg-rose-950/20 border border-rose-900/30 rounded-xl flex items-center gap-2 text-rose-500 text-xs font-bold animate-pulse">
                                    <AlertCircle size={16}/> Sélectionner au moins une espèce.
                                </div>
                            )}
                        </div>

                        <button onClick={handleSaveConfig} className={`w-full font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all ${bioForm.speciesIds.length > 0 ? (isActuallyNight ? 'bg-emerald-600 text-white' : 'bg-stone-800 text-white') : 'bg-stone-300 text-stone-500 cursor-not-allowed'}`} disabled={bioForm.speciesIds.length === 0}>
                            <Save size={20} /> Enregistrer la configuration
                        </button>
                    </div>
                )}
            </div>
        );
    }

    // VUE PRINCIPALE : LISTE & CRÉATION
    return (
        <div className="pb-24 animate-in fade-in duration-300 px-4 pt-4 max-w-2xl mx-auto relative">
            {showPicker && (
                <LocationPicker 
                    initialLat={newLocCoords?.lat} 
                    initialLng={newLocCoords?.lng} 
                    onValidate={handleMapValidation} 
                    onCancel={() => { setShowPicker(false); if(isCreating && creationStep === 'map') setIsCreating(false); }} 
                />
            )}

            <DeleteConfirmDialog 
                isOpen={!!deleteConfirm}
                onClose={() => setDeleteConfirm(null)}
                onConfirm={confirmDelete}
                title={deleteConfirm?.type === 'location' ? `Supprimer "${deleteConfirm?.label}" ?` : `Supprimer le spot ?`}
                customMessages={LOCATION_DELETION_MESSAGES} 
                isActuallyNight={isActuallyNight}
            />

            {/* HEADER LISTE */}
            <div className="flex items-center gap-3 mb-8">
                <button onClick={onBack} className={`p-2 rounded-full shadow-sm transition-colors ${isActuallyNight ? 'bg-stone-800 text-stone-400' : 'bg-white text-stone-400 hover:text-stone-800'}`}><ArrowLeft size={20} /></button>
                <div>
                    <h2 className={`text-2xl font-black uppercase flex items-center gap-2 tracking-tighter italic ${textTitle}`}><MapPin className="text-emerald-500" /> Mes Secteurs</h2>
                    <p className={`text-xs font-medium opacity-60 ${textTitle}`}>Gérez votre territoire de pêche.</p>
                </div>
            </div>

            {error && <div className="mb-6 bg-rose-950/20 border border-rose-900/30 text-rose-500 px-4 py-3 rounded-xl flex items-center gap-3"><AlertCircle size={20} /> <span className="text-xs font-bold">{error}</span></div>}

            {/* JAUGE FAVORIS */}
            <div className={`mb-8 p-4 rounded-2xl border flex items-center justify-between transition-colors duration-500 ${locations.filter(l => l.isFavorite).length >= 3 ? (isActuallyNight ? 'bg-amber-950/20 border-amber-900/40' : 'bg-amber-50 border-amber-200') : (isActuallyNight ? 'bg-stone-900/40 border-stone-800' : 'bg-white border-stone-100')}`}>
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full transition-colors ${locations.filter(l => l.isFavorite).length >= 3 ? (isActuallyNight ? 'bg-amber-900/40 text-amber-500' : 'bg-amber-100 text-amber-600') : 'bg-stone-100 text-stone-400'}`}>
                        <Star size={20} fill={locations.filter(l => l.isFavorite).length >= 3 ? "currentColor" : "none"} />
                    </div>
                    <div>
                        <div className={`font-black text-sm uppercase tracking-wide transition-colors ${textTitle}`}>Favoris Actifs</div>
                        <div className="text-[10px] text-stone-500 font-bold">Priorité Météo Dashboard</div>
                    </div>
                </div>
                <div className="text-right">
                    <span className={`text-2xl font-black transition-colors ${locations.filter(l => l.isFavorite).length >= 3 ? 'text-amber-500' : textTitle}`}>{locations.filter(l => l.isFavorite).length}</span>
                    <span className="text-sm font-bold text-stone-300">/3</span>
                </div>
            </div>

            {/* ZONE CRÉATION (MAP FIRST) */}
            {!isCreating ? (
                <button onClick={() => { setPickerMode('create'); startCreation(); setShowPicker(true); }} className={`w-full mb-8 p-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all ${isActuallyNight ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-stone-800 hover:bg-stone-900 text-white'}`}>
                    <Plus size={20} /> Créer un nouveau secteur
                </button>
            ) : (
                <div className={`mb-8 p-4 rounded-2xl shadow-lg animate-in slide-in-from-top-4 border transition-colors ${isActuallyNight ? 'bg-[#1c1917] border-stone-800' : 'bg-white border-stone-200'}`}>
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-xs font-black uppercase text-stone-500">Nouveau Secteur</span>
                        <button onClick={() => setIsCreating(false)} className="text-stone-500 hover:text-stone-300"><X size={16}/></button>
                    </div>
                    
                    <div className="flex gap-2">
                         <div className={`aspect-square w-[58px] rounded-2xl flex items-center justify-center border cursor-default relative transition-colors ${isActuallyNight ? 'bg-emerald-950/20 border-emerald-800 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-600'}`}>
                             <MapIcon size={24} />
                             <div className="absolute top-2 right-2 w-2 h-2 bg-emerald-500 rounded-full border border-white"></div>
                         </div>
                         <input type="text" value={newLocLabel} onChange={(e) => setNewLocLabel(e.target.value)} placeholder="Nom du secteur..." autoFocus className={`flex-1 px-4 rounded-2xl font-bold outline-none transition-all focus:ring-2 focus:ring-emerald-500/20 ${inputBg}`} />
                         <button onClick={finalizeCreation} disabled={!newLocLabel.trim()} className="aspect-square w-[58px] rounded-2xl flex items-center justify-center shadow-lg bg-emerald-500 text-white disabled:bg-stone-800 disabled:text-stone-600 transition-all">
                             <Check size={24} />
                         </button>
                    </div>
                    <div className="mt-2 text-[10px] text-emerald-600 font-medium text-center">
                        Coordonnées validées : {newLocCoords?.lat.toFixed(4)}, {newLocCoords?.lng.toFixed(4)}
                    </div>
                </div>
            )}

            {/* LISTE DES SECTEURS */}
            <div className="space-y-3">
                {sortedLocations.length === 0 && <div className="text-center text-stone-500 py-10 italic opacity-60">Aucun secteur. Commencez par en créer un !</div>}
                
                {sortedLocations.map((loc, index) => {
                    const listSafeCoords = getSafeCoords(loc);
                    const isEditingLabel = editingLabelId === loc.id;

                    return (
                        <div key={loc.id} onClick={() => !isEditingLabel && handleSelectLocation(loc)} className={`group p-4 rounded-2xl border shadow-sm flex items-center justify-between transition-all cursor-pointer ${isEditingLabel ? (isActuallyNight ? 'bg-amber-950/10 border-amber-500/50' : 'bg-amber-50 border-amber-200 ring-2 ring-amber-100') : (isActuallyNight ? 'bg-[#1c1917] border-stone-800 hover:border-stone-700' : 'bg-white border-stone-100 hover:bg-stone-50')}`}>
                            <div className="flex items-center gap-4 flex-1 overflow-hidden">
                                <div className={`w-16 h-16 rounded-xl overflow-hidden shrink-0 border relative transition-colors ${isActuallyNight ? 'bg-stone-900 border-stone-800' : 'bg-stone-200 border-stone-200'}`}>
                                    {listSafeCoords ? (
                                        <img src={getStaticMapUrl(listSafeCoords.lat, listSafeCoords.lng, 12, "100x100")} className="w-full h-full object-cover" alt="Mini" />
                                    ) : (
                                        <MapIcon className="text-stone-600 m-auto mt-4" size={24} />
                                    )}
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    {isEditingLabel ? (
                                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                            <input type="text" value={tempLabel} onChange={(e) => setTempLabel(e.target.value)} className={`w-full rounded px-2 py-1 font-bold text-sm outline-none ${isActuallyNight ? 'bg-stone-900 text-stone-100 border border-stone-700' : 'bg-white text-stone-800 border border-amber-300'}`} autoFocus />
                                            <button onClick={(e) => { e.stopPropagation(); onEditLocation(loc.id, tempLabel); setEditingLabelId(null); }} className="p-1 bg-amber-500 text-white rounded"><Check size={14}/></button>
                                        </div>
                                    ) : (
                                        <div className={`font-bold text-lg flex items-center gap-2 transition-colors ${textTitle}`}>
                                            <span className="truncate">{loc.label}</span>
                                            <button onClick={(e) => { e.stopPropagation(); handleToggleFavorite(loc); }} className={`${loc.isFavorite ? 'text-amber-500' : 'text-stone-700 hover:text-stone-500'}`}>
                                                <Star size={16} fill={loc.isFavorite ? "currentColor" : "none"} />
                                            </button>
                                        </div>
                                    )}
                                    <div className="text-xs font-medium mt-1 flex items-center gap-2 transition-colors opacity-70">
                                        <span className={textTitle}>{spots.filter(s => s.locationId === loc.id).length} Spots</span>
                                        {(!loc.speciesIds || loc.speciesIds.length === 0) && <span className="text-rose-500 flex items-center gap-1"><AlertCircle size={10}/> Config Bio manquante</span>}
                                    </div>
                                </div>
                            </div>
                            
                            <div className={`flex items-center gap-1 pl-2 border-l ml-2 transition-colors ${isActuallyNight ? 'border-stone-800' : 'border-stone-100'}`}>
                                <div className="flex flex-col gap-1 mr-1">
                                    {index > 0 && <button onClick={(e) => { e.stopPropagation(); onMoveLocation(loc.id, 'up'); }} className="p-1 hover:bg-stone-800 rounded text-stone-600 transition-colors"><ChevronUp size={12} /></button>}
                                    {index < sortedLocations.length - 1 && <button onClick={(e) => { e.stopPropagation(); onMoveLocation(loc.id, 'down'); }} className="p-1 hover:bg-stone-800 rounded text-stone-600 transition-colors"><ChevronDown size={12} /></button>}
                                </div>
                                <button onClick={(e) => { e.stopPropagation(); setEditingLabelId(loc.id); setTempLabel(loc.label); }} className="p-2 text-stone-600 hover:text-amber-500 transition-colors"><Edit2 size={16} /></button>
                                <button onClick={(e) => { e.stopPropagation(); requestDelete('location', loc.id, loc.label); }} className="p-2 text-stone-600 hover:text-rose-500 transition-colors"><Trash2 size={16} /></button>
                                {!isEditingLabel && <ChevronRight className="text-stone-700" size={20} />}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default LocationsManager;