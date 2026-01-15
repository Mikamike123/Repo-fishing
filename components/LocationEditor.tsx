// components/LocationEditor.tsx - Version 1.1.0 (Restoration Edition)
import React, { useState, useMemo } from 'react';
import { ArrowLeft, Map as MapIcon, Settings, Anchor, Activity, Info, Save, Edit2, Trash2, Plus, Check, Fish, MapPin } from 'lucide-react';
import { Location, Spot, MorphologyID, DepthCategoryID, BassinType, SpeciesType, SCHEMA_VERSION } from '../types';
import LocationPicker from './LocationPicker';

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

interface LocationEditorProps {
    location: Location;
    spots: Spot[];
    isActuallyNight?: boolean;
    userProfile: any;
    onBack: () => void;
    onEditLocation: (id: string, label: string, data: any) => void;
    onAddSpot: (label: string, locId: string) => void;
    onDeleteSpot: (id: string, label: string) => void;
    onEditSpot: (id: string, label: string) => void;
    setNotification: (msg: string | null) => void;
    setError: (msg: string | null) => void;
}

const LocationEditor: React.FC<LocationEditorProps> = (props) => {
    const [activeTab, setActiveTab] = useState<'bio' | 'spots' | 'species'>('bio');
    const [showPicker, setShowPicker] = useState(false);
    const [spotInput, setSpotInput] = useState("");
    const [editingSpotId, setEditingSpotId] = useState<string | null>(null);
    const [bioForm, setBioForm] = useState<any>({
        typeId: props.location.morphology?.typeId || 'Z_RIVER',
        depthId: props.location.morphology?.depthId || 'Z_3_15',
        bassin: props.location.morphology?.bassin || 'URBAIN',
        meanDepth: props.location.morphology?.meanDepth || 3.0,
        surfaceArea: props.location.morphology?.surfaceArea || 50000,
        shapeFactor: props.location.morphology?.shapeFactor || 1.0,
        speciesIds: props.location.speciesIds || []
    });

    const depthLimits = useMemo(() => {
        switch (bioForm.depthId) {
            case 'Z_LESS_3': return { min: 0.5, max: 3 };
            case 'Z_3_15': return { min: 3, max: 15 };
            case 'Z_MORE_15': return { min: 15, max: 20 };
            default: return { min: 0.5, max: 20 };
        }
    }, [bioForm.depthId]);

    const handleSave = () => {
        if (props.spots.length === 0) return props.setError("Ajoute au moins un Spot !");
        if (bioForm.speciesIds.length === 0) return props.setError("Sélectionne au moins une espèce !");

        const data = {
            coordinates: props.location.coordinates,
            lastSnapshot: null,
            morphology: bioForm,
            speciesIds: bioForm.speciesIds,
            schemaVersion: SCHEMA_VERSION
        };

        localStorage.removeItem(`oracle_cache_v8_${props.location.id}`);
        props.onEditLocation(props.location.id, props.location.label, data);
        props.setNotification("Configuration sauvegardée. Calcul en cours... 🌊");
        setTimeout(() => { props.setNotification(null); props.onBack(); }, 1000);
    };

    const textTitle = props.isActuallyNight ? "text-stone-100" : "text-stone-800";
    const textMuted = props.isActuallyNight ? "text-stone-500" : "text-stone-400";
    const cardClass = props.isActuallyNight ? "bg-[#1c1917] border-stone-800" : "bg-white border-stone-100 shadow-sm";
    const inputBg = props.isActuallyNight ? "bg-stone-900 border-stone-800 text-stone-200" : "bg-stone-50 border-stone-200 text-stone-800";

    return (
        <div className="animate-in slide-in-from-right duration-300">
            {showPicker && <LocationPicker key={`edit-${props.location.id}`} initialLat={props.location.coordinates?.lat} initialLng={props.location.coordinates?.lng} defaultCenter={props.userProfile?.homeAnchor} onValidate={c => { props.onEditLocation(props.location.id, props.location.label, { coordinates: c, lastSnapshot: null }); setShowPicker(false); }} onCancel={() => setShowPicker(false)} />}

            <div className="flex items-center gap-3 mb-4">
                <button onClick={props.onBack} className={`p-2 rounded-full ${props.isActuallyNight ? 'bg-stone-800 text-stone-400' : 'bg-white text-stone-400'}`}><ArrowLeft size={20}/></button>
                <div className="flex-1 min-w-0">
                    <h2 className={`text-xl font-black uppercase truncate tracking-tighter ${textTitle}`}>{props.location.label}</h2>
                    <p className="text-[10px] font-bold opacity-50">{props.location.coordinates ? `${props.location.coordinates.lat.toFixed(3)}, ${props.location.coordinates.lng.toFixed(3)}` : 'Pas de GPS'}</p>
                </div>
                <button onClick={() => setShowPicker(true)} className={`p-2 rounded-xl border ${props.isActuallyNight ? 'border-stone-800 text-stone-500' : 'border-stone-100 text-stone-400'}`}><MapIcon size={20}/></button>
            </div>

            <div className={`flex p-1 rounded-xl mb-6 shadow-inner ${props.isActuallyNight ? 'bg-stone-900' : 'bg-stone-100'}`}>
                {[ {id:'bio', i:Settings, l:'Profil'}, {id:'spots', i:Anchor, l:'Spots'}, {id:'species', i:Activity, l:'Bio'} ].map(t => (
                    <button key={t.id} onClick={() => setActiveTab(t.id as any)} className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${activeTab === t.id ? (props.isActuallyNight ? 'bg-stone-800 text-emerald-400' : 'bg-white text-emerald-600 shadow-sm') : 'text-stone-500'}`}><t.i size={14}/> {t.l}</button>
                ))}
            </div>

            {activeTab === 'bio' && (
                <div className="space-y-4 animate-in zoom-in-95 duration-200">
                    <div className={`${cardClass} rounded-[2.5rem] p-6 border relative overflow-hidden`}>
                        <h3 className={`font-bold flex items-center gap-2 mb-6 ${textTitle}`}><MapIcon size={18} className="text-emerald-500"/> Calibration Morphologique</h3>
                        <div className="space-y-4">
                            <div><label className="text-[10px] font-bold uppercase opacity-50 mb-1 block">Milieu</label>
                            <select value={bioForm.typeId} onChange={e => setBioForm({...bioForm, typeId: e.target.value})} className={`w-full text-sm font-bold rounded-xl px-3 py-3 outline-none ${inputBg}`}>{MORPHOLOGY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-[10px] font-bold uppercase opacity-50 mb-1 block">Profondeur</label>
                                <select value={bioForm.depthId} onChange={e => setBioForm({...bioForm, depthId: e.target.value})} className={`w-full text-sm font-bold rounded-xl px-3 py-3 outline-none ${inputBg}`}>{DEPTH_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
                                <div><label className="text-[10px] font-bold uppercase opacity-50 mb-1 block">Bassin</label>
                                <select value={bioForm.bassin} onChange={e => setBioForm({...bioForm, bassin: e.target.value})} className={`w-full text-sm font-bold rounded-xl px-3 py-3 outline-none ${inputBg}`}>{BASSIN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
                            </div>
                            <div className={`p-4 rounded-2xl border space-y-4 ${props.isActuallyNight ? 'bg-stone-900/40 border-stone-800' : 'bg-stone-50/80 border-stone-100'}`}>
                                <div className="flex items-center gap-2 text-stone-500 text-[10px] font-bold uppercase"><Info size={14}/> Paramètres Physiques</div>
                                
                                <div><label className={`text-[9px] font-bold uppercase ml-1 ${textMuted}`}>Prof. Moyenne ({bioForm.meanDepth}m)</label>
                                <input type="range" min={depthLimits.min} max={depthLimits.max} step="0.5" value={bioForm.meanDepth} onChange={e => setBioForm({...bioForm, meanDepth: parseFloat(e.target.value)})} className="w-full h-2 rounded-lg accent-emerald-500 cursor-pointer" /></div>

                                {/* Michael : Restauration des paramètres spécifiques aux milieux fermés (Lacs/Étangs) */}
                                {bioForm.typeId !== 'Z_RIVER' && bioForm.typeId !== 'Z_MED' && (
                                    <div className="space-y-4 pt-4 border-t border-stone-800/50 mt-4 animate-in fade-in slide-in-from-top-2">
                                        <div>
                                            <label className={`text-[9px] font-bold uppercase ml-1 block mb-1 ${textMuted}`}>Surface (Hectares)</label>
                                            <div className="flex items-center gap-2">
                                                <input type="number" value={bioForm.surfaceArea / 10000} onChange={(e) => setBioForm({...bioForm, surfaceArea: Math.round(parseFloat(e.target.value) * 10000)})} className={`w-full text-sm font-bold rounded-lg px-3 py-2 outline-none ${inputBg}`} />
                                                <span className={`text-xs font-bold ${textMuted}`}>ha</span>
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex justify-between items-center mb-1">
                                                <label className={`text-[9px] font-bold uppercase ml-1 ${textMuted}`}>Facteur de forme (Vent)</label>
                                                <span className={`text-[10px] font-black px-2 rounded ${props.isActuallyNight ? 'bg-blue-950/40 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>{bioForm.shapeFactor.toFixed(1)}</span>
                                            </div>
                                            <div className={`flex justify-center py-6 rounded-xl mb-2 border transition-colors ${props.isActuallyNight ? 'bg-stone-900/60 border-stone-800' : 'bg-white/50 border-stone-100'}`}>
                                                <div 
                                                    className="bg-blue-400/80 border-4 border-blue-200 shadow-lg transition-all duration-300 rounded-full" 
                                                    style={{ 
                                                        width: '50px', 
                                                        height: '50px', 
                                                        transform: `scale(${bioForm.shapeFactor}, ${1 / bioForm.shapeFactor})` 
                                                    }} 
                                                />
                                            </div>
                                            <input type="range" min="1.0" max="2.0" step="0.1" value={bioForm.shapeFactor} onChange={(e) => setBioForm({...bioForm, shapeFactor: parseFloat(e.target.value)})} className={`w-full h-2 rounded-lg appearance-none cursor-pointer transition-all ${props.isActuallyNight ? 'bg-stone-800 accent-blue-400' : 'bg-stone-200 accent-blue-500'}`} />
                                            <div className={`flex justify-between mt-1 text-[8px] font-bold uppercase ${textMuted}`}><span>Rond (Abrité)</span><span>Allongé (Vagues)</span></div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <button onClick={handleSave} className="w-full font-bold py-4 rounded-2xl bg-stone-800 text-white shadow-lg flex items-center justify-center gap-2 transition-all oracle-btn-press"><Save size={20}/> Sauvegarder</button>
                </div>
            )}

            {activeTab === 'spots' && (
                <div className="space-y-4 animate-in zoom-in-95 duration-200">
                    <div className={`${cardClass} rounded-[2.5rem] p-5 border`}>
                        <form onSubmit={(e: React.FormEvent) => { e.preventDefault(); if(editingSpotId) props.onEditSpot(editingSpotId, spotInput); else props.onAddSpot(spotInput, props.location.id); setSpotInput(""); setEditingSpotId(null); }} className="flex gap-2 mb-4">
                            <input type="text" value={spotInput} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSpotInput(e.target.value)} placeholder="Nom du spot..." className={`flex-1 px-4 py-3 rounded-xl text-sm font-bold outline-none ${inputBg}`} />
                            <button type="submit" disabled={!spotInput.trim()} className="p-3 bg-stone-800 text-white rounded-xl shadow-lg transition-all oracle-btn-press">{editingSpotId ? <Check size={18}/> : <Plus size={18}/>}</button>
                        </form>
                        <div className="space-y-2">
                            {props.spots.length === 0 && (
                                <div className="text-center py-8 text-stone-500 text-xs italic opacity-60">Aucun spot défini pour ce secteur.</div>
                            )}
                            {props.spots.map((s: Spot) => (
                                <div key={s.id} className={`flex justify-between items-center p-3 rounded-xl border ${props.isActuallyNight ? 'bg-stone-900 border-stone-800' : 'bg-stone-50 border-stone-100'}`}>
                                    <span className={`text-sm font-bold ${props.isActuallyNight ? 'text-stone-300' : 'text-stone-700'}`}>{s.label}</span>
                                    <div className="flex gap-1">
                                        <button onClick={() => { setEditingSpotId(s.id); setSpotInput(s.label); }} className="p-2 text-stone-500 transition-all oracle-btn-press"><Edit2 size={14}/></button>
                                        <button onClick={() => props.onDeleteSpot(s.id, s.label)} className="p-2 text-stone-500 transition-all oracle-btn-press"><Trash2 size={14}/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <button onClick={handleSave} className="w-full font-bold py-4 rounded-2xl bg-stone-800 text-white shadow-lg flex items-center justify-center gap-2 transition-all oracle-btn-press"><Save size={20}/> Valider les spots</button>
                </div>
            )}

            {activeTab === 'species' && (
                <div className="space-y-4 animate-in zoom-in-95 duration-200">
                    <div className={`${cardClass} rounded-[2.5rem] p-6 border`}>
                        <h3 className={`font-bold flex items-center gap-2 mb-2 ${textTitle}`}><Fish size={18} className="text-blue-500"/> Bioscores</h3>
                        <div className="grid grid-cols-2 gap-3 mt-4">
                            {TARGET_SPECIES.map((s: {id: SpeciesType, label: string}) => {
                                const active = bioForm.speciesIds.includes(s.id);
                                return <button key={s.id} onClick={() => setBioForm({...bioForm, speciesIds: active ? bioForm.speciesIds.filter((id: string) => id !== s.id) : [...bioForm.speciesIds, s.id]})} className={`p-3 rounded-xl border text-sm font-bold flex items-center justify-between transition-all oracle-btn-press ${active ? (props.isActuallyNight ? 'bg-blue-950/40 border-blue-800 text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-700') : (props.isActuallyNight ? 'bg-stone-900 border-stone-800 text-stone-500' : 'bg-stone-50 border-stone-100 text-stone-400')}`}>{s.label} {active && <Check size={16}/>}</button>
                            })}
                        </div>
                    </div>
                    <button onClick={handleSave} className="w-full font-bold py-4 rounded-2xl bg-stone-800 text-white shadow-lg flex items-center justify-center gap-2 transition-all oracle-btn-press"><Save size={20}/> Enregistrer</button>
                </div>
            )}
        </div>
    );
};

export default LocationEditor;