import React, { useState, useMemo, useEffect } from 'react';
import { 
    MapPin, Star, Trash2, Plus, AlertCircle, ArrowLeft, 
    Info, Map as MapIcon, Edit2, X, Check, ChevronRight, 
    Anchor, Lock, ChevronUp, ChevronDown, 
    Settings, Fish, Save 
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
    { value: 'NATUREL', label: 'Zone Sauvage / Forêt' }
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
    
    // Actions Secteurs
    onAddLocation: (label: string, coordinates?: { lat: number; lng: number }) => void;
    // La signature permet maintenant de passer n'importe quel objet (coordinates ou morphology)
    onEditLocation: (id: string, label: string, extraData?: any) => void;
    onDeleteLocation: (id: string) => void;
    onToggleFavorite: (location: Location) => void;
    onMoveLocation: (id: string, direction: 'up' | 'down') => void;
    
    // Actions Spots
    onAddSpot: (label: string, locationId: string) => void;
    onDeleteSpot: (id: string) => void;
    onEditSpot: (id: string, label: string) => void;

    onBack: () => void;
}

const PROTECTED_LOCATION_ID = "WYAjhoUeeikT3mS0hjip"; // ID Nanterre - Gold Standard

const LocationsManager: React.FC<LocationsManagerProps> = ({ 
    locations, spots,
    onAddLocation, onEditLocation, onDeleteLocation, onToggleFavorite, onMoveLocation,
    onAddSpot, onDeleteSpot, onEditSpot,
    onBack
}) => {
    // --- ÉTATS GLOBAUX ---
    const [selectedLocation, setSelectedLocation] = useState<Location | null>(null); 
    const [error, setError] = useState<string | null>(null);

    // --- ÉTATS ONGLETS & BIO ---
    const [activeTab, setActiveTab] = useState<'spots' | 'bio'>('spots');
    const [bioForm, setBioForm] = useState<{
        typeId: MorphologyID;
        depthId: DepthCategoryID;
        bassin: BassinType;
        speciesIds: string[];
    }>({
        typeId: 'Z_RIVER',
        depthId: 'Z_3_15',
        bassin: 'URBAIN',
        speciesIds: []
    });

    // --- ÉTATS FORMULAIRE SECTEUR (MASTER) ---
    const [labelInput, setLabelInput] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showMap, setShowMap] = useState(false);
    const [tempCoords, setTempCoords] = useState<{lat: number, lng: number} | undefined>(undefined);

    // --- ÉTATS FORMULAIRE SPOT (DETAIL) ---
    const [spotInput, setSpotInput] = useState("");
    const [editingSpotId, setEditingSpotId] = useState<string | null>(null);

    // --- UTILITAIRE DE RÉPARATION (POUR LIRE LES DONNÉES CORROMPUES) ---
    // Cette fonction détecte si les coordonnées sont imbriquées (bug) ou plates (correct)
    const getSafeCoords = (loc: Location | null) => {
        if (!loc) return null;
        const data = loc as any; // Cast pour vérifier la structure profonde

        // 1. Cas "Buggé" (Double imbrication vue en DB - Port Gennevilliers)
        if (data.coordinates?.coordinates?.lat !== undefined) {
            return {
                lat: Number(data.coordinates.coordinates.lat),
                lng: Number(data.coordinates.coordinates.lng)
            };
        }

        // 2. Cas "Propre" (Standard)
        if (loc.coordinates?.lat !== undefined) {
            return {
                lat: Number(loc.coordinates.lat),
                lng: Number(loc.coordinates.lng)
            };
        }

        return null;
    };

    // --- SYNC DU FORMULAIRE BIO ---
    useEffect(() => {
        if (selectedLocation) {
            setBioForm({
                typeId: selectedLocation.morphology?.typeId || 'Z_RIVER',
                depthId: selectedLocation.morphology?.depthId || 'Z_3_15',
                bassin: selectedLocation.morphology?.bassin || 'URBAIN',
                speciesIds: selectedLocation.speciesIds || []
            });
            
            // Récupération intelligente des coords pour l'édition éventuelle
            const safeCoords = getSafeCoords(selectedLocation);
            if (safeCoords) setTempCoords(safeCoords);
            else setTempCoords(undefined);

            setActiveTab('spots'); 
        }
    }, [selectedLocation]);

    // --- HELPERS ---
    const favoritesCount = locations.filter(l => l.isFavorite).length;
    const isLimitReached = favoritesCount >= 3;

    // TRI DES SECTEURS
    const sortedLocations = useMemo(() => {
        return [...locations].sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999));
    }, [locations]);

    const getStaticMapUrl = (lat: number, lng: number, zoom = 13, size = "600x300") => {
        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        if (!apiKey) return "";
        return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${size}&scale=2&maptype=roadmap&markers=color:0xef4444%7C${lat},${lng}&key=${apiKey}`;
    };

    // --- GESTIONNAIRES SECTEURS (MASTER) ---
    const handleSubmitLocation = (e: React.FormEvent) => {
        e.preventDefault();
        if (!labelInput.trim()) return;
        
        if (editingId) {
            // CORRECTION: On construit explicitement l'objet pour éviter l'ambiguïté
            const payload: any = {};
            if (tempCoords) {
                payload.coordinates = { 
                    lat: tempCoords.lat, 
                    lng: tempCoords.lng 
                };
            }
            
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
        
        // Utilisation de getSafeCoords pour pré-remplir correctement même si buggé
        const safe = getSafeCoords(location);
        setTempCoords(safe || undefined);
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // --- GESTIONNAIRES BIO (DETAIL) ---
    const handleSaveBio = () => {
        if (!selectedLocation) return;
        
        const extraData = {
            morphology: {
                typeId: bioForm.typeId,
                depthId: bioForm.depthId,
                bassin: bioForm.bassin
            },
            speciesIds: bioForm.speciesIds
        };

        // Sauvegarde : On envoie les données Bio en top-level
        // IMPORTANT : Si le parent force un wrapper 'coordinates', cela cassera les données.
        onEditLocation(selectedLocation.id, selectedLocation.label, extraData);

        // Mise à jour optimiste locale
        setSelectedLocation((prev: Location | null) => prev ? { ...prev, ...extraData } : null);
    };

    const toggleSpecies = (speciesId: string) => {
        setBioForm(prev => {
            const exists = prev.speciesIds.includes(speciesId);
            return {
                ...prev,
                speciesIds: exists 
                    ? prev.speciesIds.filter(id => id !== speciesId)
                    : [...prev.speciesIds, speciesId]
            };
        });
    };

    // --- GESTIONNAIRES SPOTS (DETAIL) ---
    const filteredSpots = useMemo(() => {
        if (!selectedLocation) return [];
        return spots.filter(s => s.locationId === selectedLocation.id);
    }, [spots, selectedLocation]);

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

    // Calcul des coordonnées sécurisées pour l'affichage courant
    const currentSafeCoords = getSafeCoords(selectedLocation);

    // --- VUE DÉTAIL (SECTEUR + SES SPOTS) ---
    if (selectedLocation) {
        return (
            <div className="pb-24 animate-in slide-in-from-right duration-300 px-4 pt-4 max-w-2xl mx-auto">
                {/* HEADER AVEC RETOUR */}
                <div className="flex items-center gap-3 mb-4">
                    <button onClick={() => { setSelectedLocation(null); setEditingSpotId(null); setSpotInput(""); }} className="p-2 bg-white rounded-full shadow-sm text-stone-400 hover:text-stone-800 transition-colors">
                        <ArrowLeft size={20} />
                    </button>
                    <div className="flex-1">
                        <h2 className="text-xl font-black text-stone-800 tracking-tighter uppercase truncate">{selectedLocation.label}</h2>
                        <div className="flex items-center gap-2 text-xs text-stone-500 font-medium">
                            <span>{filteredSpots.length} Spots</span>
                            <span>•</span>
                            <span>{selectedLocation.isFavorite ? 'Favori' : 'Standard'}</span>
                        </div>
                    </div>
                </div>

                {/* SEGMENTED CONTROL (ONGLETS) */}
                <div className="flex p-1 bg-stone-100 rounded-xl mb-6">
                    <button 
                        onClick={() => setActiveTab('spots')}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'spots' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
                    >
                        <Anchor size={16} /> Spots
                    </button>
                    <button 
                        onClick={() => setActiveTab('bio')}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'bio' ? 'bg-white text-emerald-600 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
                    >
                        <Settings size={16} /> Profil & Bio
                    </button>
                </div>

                {/* --- CONTENU : ONGLET SPOTS --- */}
                {activeTab === 'spots' && (
                    <div className="animate-in fade-in zoom-in-95 duration-200">
                        {/* CARTE STATIQUE */}
                        {currentSafeCoords ? (
                            <div className="mb-6 rounded-2xl overflow-hidden shadow-lg border-2 border-white relative h-32">
                                <img 
                                    src={getStaticMapUrl(currentSafeCoords.lat, currentSafeCoords.lng)} 
                                    alt="Carte du secteur" 
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded text-[10px] font-mono text-stone-600 shadow-sm">
                                    {currentSafeCoords.lat.toFixed(4)}, {currentSafeCoords.lng.toFixed(4)}
                                </div>
                            </div>
                        ) : (
                            <div className="mb-6 h-24 bg-stone-100 rounded-2xl flex items-center justify-center border border-dashed border-stone-300 text-stone-400 text-xs">
                                Pas de coordonnées GPS définies (ou perdues)
                            </div>
                        )}

                        {/* LISTE DES SPOTS */}
                        <div className="bg-white rounded-[2rem] p-5 border border-stone-100 shadow-sm">
                            <form onSubmit={handleAddSpotSubmit} className="flex gap-2 mb-4">
                                <input 
                                    type="text" 
                                    value={spotInput}
                                    onChange={(e) => setSpotInput(e.target.value)}
                                    placeholder={editingSpotId ? "Renommer..." : "Nouveau spot..."}
                                    className="flex-1 bg-stone-50 px-4 py-3 rounded-xl text-sm font-bold border border-stone-200 focus:ring-2 focus:ring-amber-200 outline-none transition-all"
                                    autoFocus={!!editingSpotId}
                                />
                                <button type="submit" disabled={!spotInput.trim()} className="bg-stone-800 text-white p-3 rounded-xl disabled:opacity-50">
                                    {editingSpotId ? <Check size={18} /> : <Plus size={18} />}
                                </button>
                                {editingSpotId && (
                                    <button type="button" onClick={() => { setEditingSpotId(null); setSpotInput(""); }} className="bg-stone-100 text-stone-400 p-3 rounded-xl">
                                        <X size={18} />
                                    </button>
                                )}
                            </form>

                            <div className="space-y-2">
                                {filteredSpots.map(spot => (
                                    <div key={spot.id} className="flex justify-between items-center p-3 rounded-xl bg-stone-50 border border-stone-100 group hover:border-amber-200 transition-colors">
                                        <span className="text-sm font-bold text-stone-700">{spot.label}</span>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => { setEditingSpotId(spot.id); setSpotInput(spot.label); }} className="p-1.5 text-stone-400 hover:text-amber-600 hover:bg-amber-100 rounded-lg"><Edit2 size={14} /></button>
                                            <button onClick={() => onDeleteSpot(spot.id)} className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-100 rounded-lg"><Trash2 size={14} /></button>
                                        </div>
                                    </div>
                                ))}
                                {filteredSpots.length === 0 && <div className="text-center py-6 text-stone-300 text-xs italic">Aucun spot.</div>}
                            </div>
                        </div>
                    </div>
                )}

                {/* --- CONTENU : ONGLET BIO --- */}
                {activeTab === 'bio' && (
                    <div className="animate-in fade-in zoom-in-95 duration-200 space-y-6">
                        
                        {/* Bloc 1: Environnement */}
                        <div className="bg-white rounded-[2rem] p-6 border border-stone-100 shadow-sm">
                            <h3 className="font-bold text-stone-800 flex items-center gap-2 mb-4">
                                <MapIcon size={18} className="text-emerald-500"/> Morphologie
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-bold text-stone-400 uppercase ml-1">Type de milieu</label>
                                    <select 
                                        value={bioForm.typeId}
                                        onChange={(e) => setBioForm({...bioForm, typeId: e.target.value as MorphologyID})}
                                        className="w-full mt-1 bg-stone-50 border border-stone-200 text-stone-800 text-sm font-bold rounded-xl px-3 py-3 outline-none focus:ring-2 focus:ring-emerald-200"
                                    >
                                        {MORPHOLOGY_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-stone-400 uppercase ml-1">Profondeur Moyenne</label>
                                    <select 
                                        value={bioForm.depthId}
                                        onChange={(e) => setBioForm({...bioForm, depthId: e.target.value as DepthCategoryID})}
                                        className="w-full mt-1 bg-stone-50 border border-stone-200 text-stone-800 text-sm font-bold rounded-xl px-3 py-3 outline-none focus:ring-2 focus:ring-emerald-200"
                                    >
                                        {DEPTH_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-stone-400 uppercase ml-1">Environnement</label>
                                    <select 
                                        value={bioForm.bassin}
                                        onChange={(e) => setBioForm({...bioForm, bassin: e.target.value as BassinType})}
                                        className="w-full mt-1 bg-stone-50 border border-stone-200 text-stone-800 text-sm font-bold rounded-xl px-3 py-3 outline-none focus:ring-2 focus:ring-emerald-200"
                                    >
                                        {BASSIN_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Bloc 2: Espèces Cibles */}
                        <div className="bg-white rounded-[2rem] p-6 border border-stone-100 shadow-sm">
                            <h3 className="font-bold text-stone-800 flex items-center gap-2 mb-4">
                                <Fish size={18} className="text-blue-500"/> Espèces Présentes
                            </h3>
                            <p className="text-xs text-stone-400 mb-4">Cochez les espèces pour activer les calculs de BioScore.</p>
                            
                            <div className="grid grid-cols-2 gap-3">
                                {TARGET_SPECIES.map(species => {
                                    const isSelected = bioForm.speciesIds.includes(species.id);
                                    return (
                                        <button
                                            key={species.id}
                                            onClick={() => toggleSpecies(species.id)}
                                            className={`p-3 rounded-xl border text-sm font-bold flex items-center justify-between transition-all ${
                                                isSelected 
                                                ? 'bg-blue-50 border-blue-200 text-blue-700' 
                                                : 'bg-stone-50 border-stone-100 text-stone-400 hover:border-stone-300'
                                            }`}
                                        >
                                            {species.label}
                                            {isSelected && <Check size={16} className="text-blue-500" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Bouton Sauvegarder */}
                        <button 
                            onClick={handleSaveBio}
                            className="w-full bg-stone-800 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform"
                        >
                            <Save size={20} />
                            Enregistrer la configuration
                        </button>

                    </div>
                )}
            </div>
        );
    }

    // --- VUE LISTE (SECTEURS) ---
    return (
        <div className="pb-24 animate-in fade-in duration-300 px-4 pt-4 max-w-2xl mx-auto">
            
            {showMap && (
                <LocationPicker 
                    initialLat={tempCoords?.lat}
                    initialLng={tempCoords?.lng}
                    onValidate={(coords) => { setTempCoords(coords); setShowMap(false); }}
                    onCancel={() => setShowMap(false)}
                />
            )}

            <div className="flex items-center gap-3 mb-8">
                <button onClick={onBack} className="p-2 bg-white rounded-full shadow-sm text-stone-400 hover:text-stone-800 transition-colors">
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h2 className="text-2xl font-black text-stone-800 tracking-tighter uppercase flex items-center gap-2">
                        <MapPin className="text-emerald-500" /> Mes Secteurs
                    </h2>
                    <p className="text-xs text-stone-500 font-medium">Gérez vos zones de pêche.</p>
                </div>
            </div>

            {error && (
                <div className="mb-6 bg-rose-50 border border-rose-100 text-rose-700 px-4 py-3 rounded-xl flex items-center gap-3 animate-in slide-in-from-top-2">
                    <AlertCircle size={20} className="shrink-0" />
                    <span className="text-xs font-bold">{error}</span>
                </div>
            )}

            {/* JAUGE FAVORIS */}
            <div className={`mb-8 p-4 rounded-2xl border flex items-center justify-between transition-colors ${isLimitReached ? 'bg-amber-50 border-amber-200' : 'bg-white border-stone-100'}`}>
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${isLimitReached ? 'bg-amber-100 text-amber-600' : 'bg-stone-100 text-stone-400'}`}>
                        <Star size={20} fill={isLimitReached ? "currentColor" : "none"} />
                    </div>
                    <div>
                        <div className="font-black text-stone-800 text-sm uppercase tracking-wide">Favoris Actifs</div>
                        <div className="text-[10px] text-stone-400 font-bold">Apparaissent en priorité sur l'Oracle</div>
                    </div>
                </div>
                <div className="text-right">
                    <span className={`text-2xl font-black ${isLimitReached ? 'text-amber-600' : 'text-stone-800'}`}>
                        {favoritesCount}
                    </span>
                    <span className="text-sm font-bold text-stone-300">/3</span>
                </div>
            </div>

            {/* FORMULAIRE SECTEUR */}
            <form onSubmit={handleSubmitLocation} className="mb-8 relative flex gap-2 items-stretch">
                <div className="relative flex-1">
                    <input 
                        type="text" 
                        value={labelInput}
                        onChange={(e) => setLabelInput(e.target.value)}
                        placeholder={editingId ? "Modifier le nom..." : "Nouveau secteur (ex: Seine Paris...)"}
                        className={`w-full pl-5 pr-4 py-4 bg-white border rounded-2xl font-bold text-stone-800 outline-none focus:ring-2 focus:ring-emerald-400 shadow-sm transition-colors ${editingId ? 'border-amber-300 bg-amber-50/30' : 'border-stone-200'}`}
                    />
                </div>
                
                <button
                    type="button"
                    onClick={() => setShowMap(true)}
                    className={`aspect-square w-[58px] rounded-2xl flex items-center justify-center border transition-all relative ${
                        tempCoords ? 'bg-emerald-50 border-emerald-200 text-emerald-600 shadow-sm' : 'bg-white border-stone-200 text-stone-400 hover:border-emerald-300 hover:text-emerald-500'
                    }`}
                >
                    <MapIcon size={24} />
                    {tempCoords && <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white"></span>}
                </button>

                <button type="submit" disabled={!labelInput.trim()} className={`aspect-square w-[58px] rounded-2xl flex items-center justify-center shadow-lg text-white ${editingId ? 'bg-amber-500' : 'bg-stone-800'}`}>
                    {editingId ? <Check size={24} /> : <Plus size={24} />}
                </button>

                {editingId && (
                    <button type="button" onClick={() => { setEditingId(null); setLabelInput(""); setTempCoords(undefined); }} className="aspect-square w-[58px] bg-stone-100 text-stone-400 rounded-2xl flex items-center justify-center">
                        <X size={24} />
                    </button>
                )}
            </form>

            {/* LISTE SECTEURS */}
            <div className="space-y-3">
                {sortedLocations.map((loc, index) => {
                    const isProtected = loc.id === PROTECTED_LOCATION_ID;
                    // Utilisation de la fonction sécurisée pour l'affichage de liste
                    const listSafeCoords = getSafeCoords(loc);

                    return (
                        <div key={loc.id} onClick={() => setSelectedLocation(loc)} className={`group p-4 rounded-2xl border shadow-sm flex items-center justify-between transition-all cursor-pointer hover:bg-stone-50 ${editingId === loc.id ? 'bg-amber-50 border-amber-200' : 'bg-white border-stone-100'}`}>
                            <div className="flex items-center gap-4">
                                {/* MINIATURE CARTE */}
                                <div className="w-16 h-16 rounded-xl overflow-hidden bg-stone-200 shrink-0 border border-stone-200 relative">
                                    {listSafeCoords ? (
                                        <img src={getStaticMapUrl(listSafeCoords.lat, listSafeCoords.lng, 12, "100x100")} className="w-full h-full object-cover" alt="Miniature" />
                                    ) : (
                                        <MapIcon className="text-stone-300 m-auto mt-4" size={24} />
                                    )}
                                </div>

                                <div>
                                    <div className="font-bold text-stone-700 text-lg flex items-center gap-2">
                                        {loc.label}
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); onToggleFavorite(loc); }}
                                            className={`${loc.isFavorite ? 'text-amber-500' : 'text-stone-200 hover:text-stone-400'}`}
                                        >
                                            <Star size={16} fill={loc.isFavorite ? "currentColor" : "none"} />
                                        </button>
                                    </div>
                                    <div className="text-xs text-stone-400 font-medium mt-1 flex flex-col">
                                        <span>{spots.filter(s => s.locationId === loc.id).length} Spots</span>
                                        {listSafeCoords && (
                                            <span className="text-[10px] text-stone-300 mt-0.5 font-mono">
                                                {listSafeCoords.lat.toFixed(4)}, {listSafeCoords.lng.toFixed(4)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {/* BOUTONS DE TRI */}
                                <div className="flex flex-col mr-2" onClick={(e) => e.stopPropagation()}>
                                    {index > 0 && (
                                        <button onClick={() => onMoveLocation(loc.id, 'up')} className="p-1 hover:bg-stone-200 rounded text-stone-400 hover:text-stone-700">
                                            <ChevronUp size={12} strokeWidth={3} />
                                        </button>
                                    )}
                                    {index < sortedLocations.length - 1 && (
                                        <button onClick={() => onMoveLocation(loc.id, 'down')} className="p-1 hover:bg-stone-200 rounded text-stone-400 hover:text-stone-700">
                                            <ChevronDown size={12} strokeWidth={3} />
                                        </button>
                                    )}
                                </div>

                                <div className="h-8 w-px bg-stone-100 mx-1"></div>

                                <button onClick={(e) => handleStartEditLocation(e, loc)} className="p-2 text-stone-300 hover:text-amber-600 hover:bg-amber-100 rounded-xl transition-colors">
                                    <Edit2 size={18} />
                                </button>
                                
                                <button 
                                    onClick={(e) => { e.stopPropagation(); !isProtected && onDeleteLocation(loc.id); }} 
                                    className={`p-2 rounded-xl transition-colors ${isProtected ? 'text-stone-200 cursor-not-allowed' : 'text-stone-300 hover:text-rose-500 hover:bg-rose-50'}`}
                                    title={isProtected ? "Secteur Protégé" : "Supprimer"}
                                    disabled={isProtected}
                                >
                                    {isProtected ? <Lock size={18} /> : <Trash2 size={18} />}
                                </button>
                                
                                <ChevronRight className="text-stone-300 ml-2" size={20} />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default LocationsManager;