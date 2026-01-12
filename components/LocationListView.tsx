// components/LocationListView.tsx - Version 1.0.1
import React, { useState, useMemo } from 'react';
import { MapPin, Star, Plus, ArrowLeft, Anchor, Map as MapIcon, Edit2, Trash2, ChevronRight, ChevronUp, ChevronDown, X, Check } from 'lucide-react';
import { Location, UserProfile } from '../types';
import LocationPicker from './LocationPicker';

interface LocationListViewProps {
    locations: Location[];
    spots: any[];
    userProfile: UserProfile | null;
    isActuallyNight?: boolean;
    onBack: () => void;
    onAddLocation: (label: string, coords?: any) => void;
    onEditLocation: (id: string, label: string, data?: any) => void;
    onToggleFavorite: (loc: Location) => void;
    onMoveLocation: (id: string, dir: 'up' | 'down') => void;
    onUpdateUserAnchor: (coords: any) => void;
    onSelectLocation: (loc: Location) => void;
    onRequestDeleteLocation: (id: string, label: string) => void;
    setError: (msg: string | null) => void;
    setNotification: (msg: string | null) => void;
}

const LocationListView: React.FC<LocationListViewProps> = (props) => {
    const [isCreating, setIsCreating] = useState(false);
    const [newLocLabel, setNewLocLabel] = useState("");
    const [newLocCoords, setNewLocCoords] = useState<any>(null);
    const [showPicker, setShowPicker] = useState(false);
    const [pickerMode, setPickerMode] = useState<'create' | 'anchor'>('create');
    const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
    const [tempLabel, setTempLabel] = useState("");

    const sortedLocations = useMemo(() => [...props.locations].sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999)), [props.locations]);

    const handleMapValidation = (coords: any) => {
        if (pickerMode === 'create') {
            setNewLocCoords(coords);
            setIsCreating(true);
        } else {
            props.onUpdateUserAnchor(coords);
            props.setNotification("Ancre plantée ! Seb est paré pour Marseille. ⚓");
            setTimeout(() => props.setNotification(null), 3000);
        }
        setShowPicker(false);
    };

    const textTitle = props.isActuallyNight ? "text-stone-100" : "text-stone-800";
    const inputBg = props.isActuallyNight ? "bg-stone-900 border-stone-800 text-stone-200" : "bg-stone-50 border-stone-200 text-stone-800";

    return (
        <div className="animate-in fade-in duration-300">
            {showPicker && (
                <LocationPicker 
                    key={`picker-${pickerMode}`}
                    initialLat={pickerMode === 'anchor' ? props.userProfile?.homeAnchor?.lat : newLocCoords?.lat} 
                    initialLng={pickerMode === 'anchor' ? props.userProfile?.homeAnchor?.lng : newLocCoords?.lng} 
                    defaultCenter={props.userProfile?.homeAnchor}
                    onValidate={handleMapValidation} 
                    onCancel={() => setShowPicker(false)} 
                />
            )}

            <div className="flex items-center gap-3 mb-8">
                <button onClick={props.onBack} className={`p-2 rounded-full shadow-sm transition-all oracle-btn-press ${props.isActuallyNight ? 'bg-stone-800 text-stone-400' : 'bg-white text-stone-400 hover:text-stone-800'}`}><ArrowLeft size={20} /></button>
                <div className="flex-1">
                    <h2 className={`text-2xl font-black uppercase flex items-center gap-2 tracking-tighter italic ${textTitle}`}><MapPin className="text-emerald-500" /> Mes Secteurs</h2>
                    <p className={`text-xs font-medium opacity-60 ${textTitle}`}>Gère ton territoire de pêche.</p>
                </div>
                <button onClick={() => { setPickerMode('anchor'); setShowPicker(true); }} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all oracle-btn-press shadow-sm border ${props.isActuallyNight ? 'bg-stone-900 border-stone-800 text-stone-400' : 'bg-white border-stone-200 text-stone-500'}`}>
                    <Anchor size={14} className="text-blue-500" /> {props.userProfile?.homeAnchor ? "Ancrage OK" : "Ancrage"}
                </button>
            </div>

            {!isCreating ? (
                <button onClick={() => { setPickerMode('create'); setShowPicker(true); }} className={`w-full mb-8 p-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg transition-all oracle-btn-press ${props.isActuallyNight ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-stone-800 hover:bg-stone-900 text-white'}`}>
                    <Plus size={20} /> Nouveau secteur
                </button>
            ) : (
                <div className={`mb-8 p-4 rounded-2xl shadow-lg animate-in slide-in-from-top-4 border ${props.isActuallyNight ? 'bg-[#1c1917] border-stone-800' : 'bg-white border-stone-200'}`}>
                    <div className="flex justify-between items-center mb-4"><span className="text-xs font-black uppercase text-stone-500">Nouveau Secteur</span><button onClick={() => setIsCreating(false)} className="text-stone-500"><X size={16}/></button></div>
                    <div className="flex gap-2">
                         <div className={`aspect-square w-[58px] rounded-2xl flex items-center justify-center border ${props.isActuallyNight ? 'bg-emerald-950/20 border-emerald-800 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-600'}`}><MapIcon size={24} /></div>
                         <input type="text" value={newLocLabel} onChange={(e) => setNewLocLabel(e.target.value)} placeholder="Nom du secteur..." autoFocus className={`flex-1 px-4 rounded-2xl font-bold outline-none ${inputBg}`} />
                         <button onClick={() => { props.onAddLocation(newLocLabel, newLocCoords); setIsCreating(false); setNewLocLabel(""); }} disabled={!newLocLabel.trim()} className="aspect-square w-[58px] rounded-2xl flex items-center justify-center shadow-lg bg-emerald-500 text-white disabled:bg-stone-800 transition-all oracle-btn-press"><Check size={24} /></button>
                    </div>
                </div>
            )}

            <div className="space-y-3">
                {sortedLocations.map((loc, index) => (
                    <div key={loc.id} onClick={() => editingLabelId !== loc.id && props.onSelectLocation(loc)} className={`group p-4 rounded-2xl border shadow-sm flex items-center justify-between transition-all cursor-pointer oracle-card-press ${editingLabelId === loc.id ? (props.isActuallyNight ? 'bg-amber-950/10 border-amber-500/50' : 'bg-amber-50 border-amber-200 ring-2 ring-amber-100') : (props.isActuallyNight ? 'bg-[#1c1917] border-stone-800' : 'bg-white border-stone-100')}`}>
                        <div className="flex items-center gap-4 flex-1 overflow-hidden">
                            <div className={`w-14 h-14 rounded-xl overflow-hidden shrink-0 border ${props.isActuallyNight ? 'bg-stone-900 border-stone-800' : 'bg-stone-200 border-stone-200'}`}>
                                {loc.coordinates ? <img src={`https://maps.googleapis.com/maps/api/staticmap?center=${loc.coordinates.lat},${loc.coordinates.lng}&zoom=12&size=100x100&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`} className="w-full h-full object-cover" alt="Mini" /> : <MapIcon className="text-stone-600 m-auto mt-3" size={24} />}
                            </div>
                            <div className="flex-1 min-w-0">
                                {editingLabelId === loc.id ? (
                                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                        <input type="text" value={tempLabel} onChange={e => setTempLabel(e.target.value)} className={`w-full rounded px-2 py-1 font-bold text-sm outline-none ${props.isActuallyNight ? 'bg-stone-900 text-stone-100 border border-stone-700' : 'bg-white text-stone-800 border border-amber-300'}`} autoFocus />
                                        <button onClick={() => { props.onEditLocation(loc.id, tempLabel); setEditingLabelId(null); }} className="p-1 bg-amber-500 text-white rounded"><Check size={14}/></button>
                                    </div>
                                ) : (
                                    <div className={`font-black text-sm flex items-center gap-2 tracking-tighter leading-tight transition-colors ${textTitle}`}>
                                        <span className="break-words">{loc.label}</span>
                                        <button onClick={e => { e.stopPropagation(); props.onToggleFavorite(loc); }} className={loc.isFavorite ? 'text-amber-500' : 'text-stone-700'}><Star size={14} fill={loc.isFavorite ? "currentColor" : "none"} /></button>
                                    </div>
                                )}
                                <div className="text-[10px] font-bold mt-1 opacity-60 flex gap-2">
                                    <span className={textTitle}>{props.spots.filter(s => s.locationId === loc.id).length} Spots</span>
                                    {(!loc.speciesIds || loc.speciesIds.length === 0) && <span className="text-rose-500 italic">Config Bio !</span>}
                                </div>
                            </div>
                        </div>
                        <div className={`flex items-center gap-1 pl-2 border-l ml-2 ${props.isActuallyNight ? 'border-stone-800' : 'border-stone-100'}`}>
                            <div className="flex flex-col gap-1 mr-1">
                                {index > 0 && <button onClick={e => { e.stopPropagation(); props.onMoveLocation(loc.id, 'up'); }} className="p-1 text-stone-600"><ChevronUp size={12} /></button>}
                                {index < sortedLocations.length - 1 && <button onClick={e => { e.stopPropagation(); props.onMoveLocation(loc.id, 'down'); }} className="p-1 text-stone-600"><ChevronDown size={12} /></button>}
                            </div>
                            <button onClick={e => { e.stopPropagation(); setEditingLabelId(loc.id); setTempLabel(loc.label); }} className="p-2 text-stone-600 hover:text-amber-500"><Edit2 size={16} /></button>
                            <button onClick={e => { e.stopPropagation(); props.onRequestDeleteLocation(loc.id, loc.label); }} className="p-2 text-stone-600 hover:text-rose-500"><Trash2 size={16} /></button>
                            {editingLabelId !== loc.id && <ChevronRight className="text-stone-700" size={20} />}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default LocationListView;