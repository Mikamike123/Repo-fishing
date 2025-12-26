import React, { useState, useMemo } from 'react';
import { MapPin, Star, Trash2, Plus, AlertCircle, ArrowLeft, Info, Map as MapIcon, Edit2, X, Check, ChevronRight, Anchor, Lock, ChevronUp, ChevronDown } from 'lucide-react';
import { Location, Spot } from '../types';
import LocationPicker from './LocationPicker'; 

interface LocationsManagerProps {
    locations: Location[];
    spots: Spot[];
    
    // Actions Secteurs
    onAddLocation: (label: string, coordinates?: { lat: number; lng: number }) => void;
    onEditLocation: (id: string, label: string, coordinates?: { lat: number; lng: number }) => void;
    onDeleteLocation: (id: string) => void;
    onToggleFavorite: (location: Location) => void;
    onMoveLocation: (id: string, direction: 'up' | 'down') => void; // <--- AJOUT TRI
    
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

    // --- ÉTATS FORMULAIRE SECTEUR ---
    const [labelInput, setLabelInput] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showMap, setShowMap] = useState(false);
    const [tempCoords, setTempCoords] = useState<{lat: number, lng: number} | undefined>(undefined);

    // --- ÉTATS FORMULAIRE SPOT ---
    const [spotInput, setSpotInput] = useState("");
    const [editingSpotId, setEditingSpotId] = useState<string | null>(null);

    // --- HELPERS ---
    const favoritesCount = locations.filter(l => l.isFavorite).length;
    const isLimitReached = favoritesCount >= 3;

    // TRI DES SECTEURS PAR ORDRE D'AFFICHAGE
    const sortedLocations = useMemo(() => {
        return [...locations].sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999));
    }, [locations]);

    const getStaticMapUrl = (lat: number, lng: number, zoom = 13, size = "600x300") => {
        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        if (!apiKey) return "";
        return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${size}&scale=2&maptype=roadmap&markers=color:0xef4444%7C${lat},${lng}&key=${apiKey}`;
    };

    // --- GESTIONNAIRES SECTEURS ---
    const handleSubmitLocation = (e: React.FormEvent) => {
        e.preventDefault();
        if (!labelInput.trim()) return;
        
        if (editingId) {
            onEditLocation(editingId, labelInput, tempCoords);
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
        setTempCoords(location.coordinates);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // --- GESTIONNAIRES SPOTS ---
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

    // --- VUE DÉTAIL (SECTEUR + SES SPOTS) ---
    if (selectedLocation) {
        return (
            <div className="pb-24 animate-in slide-in-from-right duration-300 px-4 pt-4 max-w-2xl mx-auto">
                <div className="flex items-center gap-3 mb-6">
                    <button onClick={() => { setSelectedLocation(null); setEditingSpotId(null); setSpotInput(""); }} className="p-2 bg-white rounded-full shadow-sm text-stone-400 hover:text-stone-800 transition-colors">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h2 className="text-xl font-black text-stone-800 tracking-tighter uppercase">{selectedLocation.label}</h2>
                        <p className="text-xs text-stone-500 font-medium">{filteredSpots.length} Spots référencés</p>
                    </div>
                </div>

                {/* CARTE STATIQUE */}
                {selectedLocation.coordinates ? (
                    <div className="mb-8 rounded-2xl overflow-hidden shadow-lg border-2 border-white relative h-40">
                        <img 
                            src={getStaticMapUrl(selectedLocation.coordinates.lat, selectedLocation.coordinates.lng)} 
                            alt="Carte du secteur" 
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded text-[10px] font-mono text-stone-600 shadow-sm">
                            {selectedLocation.coordinates.lat}, {selectedLocation.coordinates.lng}
                        </div>
                    </div>
                ) : (
                    <div className="mb-8 h-32 bg-stone-100 rounded-2xl flex items-center justify-center border border-dashed border-stone-300 text-stone-400 text-xs">
                        Pas de coordonnées GPS définies
                    </div>
                )}

                {/* LISTE DES SPOTS */}
                <div className="bg-white rounded-[2rem] p-6 border border-stone-100 shadow-sm">
                    <h3 className="font-bold text-stone-800 flex items-center gap-2 mb-4">
                        <Anchor size={18} className="text-amber-500"/> Spots du secteur
                    </h3>

                    <form onSubmit={handleAddSpotSubmit} className="flex gap-2 mb-6">
                        <input 
                            type="text" 
                            value={spotInput}
                            onChange={(e) => setSpotInput(e.target.value)}
                            placeholder={editingSpotId ? "Renommer le spot..." : "Nouveau spot (ex: Sous le pont)..."}
                            className="flex-1 bg-stone-50 px-4 py-3 rounded-xl text-sm font-bold border border-stone-200 focus:ring-2 focus:ring-amber-200 outline-none transition-all"
                            autoFocus={!!editingSpotId}
                        />
                        <button type="submit" disabled={!spotInput.trim()} className="bg-stone-800 text-white p-3 rounded-xl disabled:opacity-50">
                            {editingSpotId ? <Check size={18} /> : <Plus size={18} />}
                        </button>
                        {editingSpotId && (
                            <button type="button" onClick={() => { setEditingSpotId(null); setSpotInput(""); }} className="bg-stone-100 text-stone-400 p-3 rounded-xl hover:text-stone-600">
                                <X size={18} />
                            </button>
                        )}
                    </form>

                    <div className="space-y-2">
                        {filteredSpots.map(spot => (
                            <div key={spot.id} className="flex justify-between items-center p-3 rounded-xl bg-stone-50 border border-stone-100 group hover:border-amber-200 transition-colors">
                                <span className="text-sm font-bold text-stone-700">{spot.label}</span>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => { setEditingSpotId(spot.id); setSpotInput(spot.label); }} className="p-1.5 text-stone-400 hover:text-amber-600 hover:bg-amber-100 rounded-lg">
                                        <Edit2 size={14} />
                                    </button>
                                    <button onClick={() => onDeleteSpot(spot.id)} className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-100 rounded-lg">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {filteredSpots.length === 0 && (
                            <div className="text-center py-6 text-stone-300 text-xs italic">Aucun spot dans ce secteur.</div>
                        )}
                    </div>
                </div>
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

                    return (
                        <div key={loc.id} onClick={() => setSelectedLocation(loc)} className={`group p-4 rounded-2xl border shadow-sm flex items-center justify-between transition-all cursor-pointer hover:bg-stone-50 ${editingId === loc.id ? 'bg-amber-50 border-amber-200' : 'bg-white border-stone-100'}`}>
                            <div className="flex items-center gap-4">
                                {/* MINIATURE CARTE */}
                                <div className="w-16 h-16 rounded-xl overflow-hidden bg-stone-200 shrink-0 border border-stone-200 relative">
                                    {loc.coordinates ? (
                                        <img src={getStaticMapUrl(loc.coordinates.lat, loc.coordinates.lng, 12, "100x100")} className="w-full h-full object-cover" alt="Miniature" />
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
                                    <div className="text-xs text-stone-400 font-medium mt-1">
                                        {spots.filter(s => s.locationId === loc.id).length} Spots
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