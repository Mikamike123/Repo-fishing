// components/SessionFormUI.tsx
import React, { useState } from 'react';
import { 
    Save, Loader2, Fish, AlertOctagon, X, Copy, 
    Cloud, Sun, CloudSun, CloudRain, Wind
} from 'lucide-react';
import { 
    Session, Zone, Setup, Technique, Catch, Miss, Lure, 
    RefLureType, RefColor, RefSize, RefWeight, FullEnvironmentalSnapshot, Location 
} from '../types';
import CatchDialog from './CatchDialog';
import MissDialog from './MissDialog';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import { CATCH_DELETION_MESSAGES, MISS_DELETION_MESSAGES } from '../constants/deletionMessages';
import { WEATHER_METADATA, HYDRO_METADATA } from '../constants/indicators';

const getWindDir = (deg?: number) => {
    if (deg === undefined) return '';
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
    return directions[Math.round(deg / 45) % 8];
};

const getWeatherIcon = (clouds: number) => {
    if (clouds < 20) return <Sun size={14} className="text-amber-500" />;
    if (clouds < 60) return <CloudSun size={14} className="text-stone-400" />;
    if (clouds < 90) return <Cloud size={14} className="text-stone-500" />;
    return <CloudRain size={14} className="text-stone-600" />;
};

interface SessionFormUIProps {
    initialData?: Session | null;
    zones: Zone[];
    setups: Setup[];
    techniques: Technique[];
    lureTypes: RefLureType[];
    colors: RefColor[];
    sizes: RefSize[];
    weights: RefWeight[];
    lastCatchDefaults?: Catch | null;
    locations: Location[];
    
    date: string; setDate: (v: string) => void;
    startTime: string; setStartTime: (v: string) => void;
    endTime: string; setEndTime: (v: string) => void;
    locationId: string; setLocationId: (v: string) => void;
    filteredSpots: Zone[];
    spotId: string; setSpotId: (v: string) => void;
    setupId: string; setSetupId: (v: string) => void;
    feelingScore: number; setFeelingScore: (v: number) => void;
    notes: string; setNotes: (v: string) => void;
    catches: Catch[]; misses: Miss[];
    envSnapshot: FullEnvironmentalSnapshot | null;
    isLoadingEnv: boolean;
    envStatus: 'idle' | 'found' | 'not-found' | 'simulated';
    isCatchModalOpen: boolean; setIsCatchModalOpen: (v: boolean) => void;
    isMissModalOpen: boolean; setIsMissModalOpen: (v: boolean) => void;
    editingCatch: Catch | null; setEditingCatch: (v: Catch | null) => void;
    editingMiss: Miss | null; setEditingMiss: (v: Miss | null) => void;
    handleDeleteCatch: (id: string) => void;
    handleDeleteMiss: (id: string) => void;
    handleSaveCatch: (data: any) => void;
    handleSaveMiss: (data: any) => void;
    handleSubmit: (e: React.FormEvent) => void;
}

const SessionFormUI: React.FC<SessionFormUIProps> = (props) => {
    const {
        initialData, setups, techniques, lureTypes, colors, sizes, weights, lastCatchDefaults, locations,
        date, setDate, startTime, setStartTime, endTime, setEndTime,
        locationId, setLocationId, filteredSpots, spotId, setSpotId, setupId, setSetupId,
        feelingScore, setFeelingScore, notes, setNotes, catches, misses, envSnapshot,
        isLoadingEnv, envStatus, isCatchModalOpen, setIsCatchModalOpen, isMissModalOpen, setIsMissModalOpen,
        editingCatch, setEditingCatch, editingMiss, setEditingMiss,
        handleDeleteCatch, handleDeleteMiss, handleSaveCatch, handleSaveMiss, handleSubmit, zones
    } = props;

    const GOLDEN_SECTOR_ID = import.meta.env.VITE_GOLDEN_SECTOR_ID;
    const isGolden = locationId === GOLDEN_SECTOR_ID;

    const [pendingDelete, setPendingDelete] = useState<{ id: string; type: 'catch' | 'miss' | null }>({
        id: '',
        type: null
    });

    const triggerDelete = (id: string, type: 'catch' | 'miss') => {
        setPendingDelete({ id, type });
    };

    const confirmDeletion = () => {
        if (pendingDelete.type === 'catch') handleDeleteCatch(pendingDelete.id);
        if (pendingDelete.type === 'miss') handleDeleteMiss(pendingDelete.id);
        setPendingDelete({ id: '', type: null });
    };

    // Helper pour extraire les valeurs du snapshot proprement
    const getVal = (meta: any, type: 'weather' | 'hydro') => {
        if (!envSnapshot) return '--';
        const val = (envSnapshot as any)[type]?.[meta.dataKey];
        if (val === undefined || val === null) return '--';
        
        // Formattage spécifique Michael
        if (meta.dataKey === 'windSpeed') return `${Math.round(val)}km/h ${getWindDir(envSnapshot.weather.windDirection)}`;
        if (meta.dataKey === 'flowLagged') return Math.round(val / 1000); 
        if (typeof val === 'number') return val % 1 === 0 ? val : val.toFixed(1);
        return val;
    };

    return (
        <div className="bg-white rounded-3xl p-6 shadow-xl pb-24">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-stone-800 flex items-center gap-2">
                    {initialData ? <><AlertOctagon className="text-amber-500" /> Éditer Session</> : <><Fish className="text-emerald-500" /> Nouvelle Session</>}
                </h2>
                {initialData && (
                    <button type="button" onClick={() => props.handleSubmit({ preventDefault: () => {} } as any)} className="p-2 bg-stone-100 rounded-full hover:bg-stone-200">
                        <X size={20} />
                    </button>
                )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-6">
                        <label className="text-[9px] font-bold text-stone-400 uppercase tracking-widest mb-1 block">Date</label>
                        <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full p-3 bg-stone-50 rounded-xl font-bold text-stone-700 text-sm outline-none focus:ring-2 focus:ring-emerald-100 transition-all" />
                    </div>
                    <div className="col-span-3">
                        <label className="text-[9px] font-bold text-stone-400 uppercase tracking-widest mb-1 block">Début</label>
                        <input type="time" required value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full p-3 bg-stone-50 rounded-xl font-bold text-stone-700 text-sm outline-none focus:ring-2 focus:ring-emerald-100 transition-all" />
                    </div>
                    <div className="col-span-3">
                        <label className="text-[9px] font-bold text-stone-400 uppercase tracking-widest mb-1 block">Fin</label>
                        <input type="time" required value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full p-3 bg-stone-50 rounded-xl font-bold text-stone-700 text-sm outline-none focus:ring-2 focus:ring-emerald-100 transition-all" />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="text-[9px] font-bold text-stone-400 uppercase tracking-widest mb-1 block">Secteur</label>
                        <select required value={locationId} onChange={e => setLocationId(e.target.value)} className="w-full p-3 bg-stone-50 rounded-xl font-bold text-stone-700 text-sm outline-none focus:ring-2 focus:ring-emerald-100 transition-all">
                            {locations.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-[9px] font-bold text-stone-400 uppercase tracking-widest mb-1 block">Spot</label>
                        <select required value={spotId} onChange={e => setSpotId(e.target.value)} className="w-full p-3 bg-stone-50 rounded-xl font-bold text-stone-700 text-sm outline-none focus:ring-2 focus:ring-emerald-100 transition-all" disabled={filteredSpots.length === 0}>
                            {filteredSpots.map(z => <option key={z.id} value={z.id}>{z.label}</option>)}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-2">
                    <label className="text-[9px] font-bold text-stone-400 uppercase tracking-widest mb-1 block">Setup Principal</label>
                    <select required value={setupId} onChange={e => setSetupId(e.target.value)} className="w-full p-3 bg-stone-50 rounded-xl font-bold text-stone-700 text-sm outline-none focus:ring-2 focus:ring-emerald-100 transition-all">
                        {setups.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                </div>

                <div className="space-y-2 pt-2 border-t border-stone-100 mt-2">
                    <div className="flex justify-between items-end px-1">
                        <label className="text-[9px] font-bold text-stone-400 uppercase tracking-widest">
                            {envStatus === 'simulated' ? 'Conditions Reconstituées (Est.)' : 'Conditions (Archives)'}
                        </label>
                        {isLoadingEnv ? (
                             <span className="text-[9px] text-amber-500 font-bold flex items-center gap-1"><Loader2 size={10} className="animate-spin"/> Recherche...</span>
                        ) : envStatus === 'found' ? (
                             <span className="text-[9px] text-emerald-500 font-bold uppercase">Données Synchronisées</span>
                        ) : envStatus === 'simulated' ? (
                            <span className="text-[9px] text-blue-500 font-bold uppercase">Simulé (Universel)</span>
                        ) : (
                             <span className="text-[9px] text-stone-300 italic">Non disponible</span>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1">
                        {/* Boucle Météo Michael */}
                        {Object.entries(WEATHER_METADATA).map(([key, meta]) => {
                            const val = getVal(meta, 'weather');
                            const themes: any = {
                                rose: "bg-rose-50 text-rose-900 border-rose-100",
                                indigo: "bg-indigo-50 text-indigo-900 border-indigo-100",
                                amber: "bg-amber-50 text-amber-900 border-amber-100",
                                blue: "bg-blue-50 text-blue-900 border-blue-100"
                            };
                            return (
                                <div key={key} className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border shrink-0 min-w-[70px] justify-center ${themes[meta.theme] || 'bg-stone-50'}`}>
                                    {key === 'tempAir' && envSnapshot ? getWeatherIcon(envSnapshot.weather.clouds) : <meta.icon size={14} className="opacity-60" />}
                                    <span className="text-xs font-bold">
                                        {val}{val !== '--' ? (key === 'wind' ? '' : meta.unit) : ''}
                                    </span>
                                </div>
                            );
                        })}

                        {/* Boucle Hydro Michael */}
                        {Object.entries(HYDRO_METADATA).map(([key, meta]) => {
                            if ((key === 'flow' || key === 'level') && !isGolden) return null;
                            const val = getVal(meta, 'hydro');
                            const themes: any = {
                                orange: "bg-orange-50 text-orange-700 border-orange-100",
                                emerald: "bg-emerald-50 text-emerald-800 border-emerald-100",
                                purple: "bg-purple-50 text-purple-700 border-purple-100",
                                indigo: "bg-indigo-50 text-indigo-700 border-indigo-100",
                                blue: "bg-blue-50 text-blue-700 border-blue-100",
                                cyan: "bg-cyan-50 text-cyan-700 border-cyan-100"
                            };

                            return (
                                <div key={key} className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border shrink-0 min-w-[70px] justify-center ${themes[meta.theme] || 'bg-stone-50'}`}>
                                    <meta.icon size={14} className="opacity-70" />
                                    <span className="text-xs font-bold">{val}{val !== '--' ? meta.unit : ''}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="space-y-4 pt-2">
                    <div className="flex gap-3">
                        <button type="button" onClick={() => setIsMissModalOpen(true)} className="flex-1 py-3 bg-rose-50 text-rose-600 rounded-full text-xs font-black border border-rose-100 shadow-sm active:scale-95 transition-all flex justify-center items-center gap-2 hover:bg-rose-100">
                            <AlertOctagon size={16}/> AJOUTER RATÉ
                        </button>
                        <button type="button" onClick={() => setIsCatchModalOpen(true)} className="flex-1 py-3 bg-emerald-50 text-emerald-600 rounded-full text-xs font-black border border-emerald-100 shadow-sm active:scale-95 transition-all flex justify-center items-center gap-2 hover:bg-emerald-100">
                            <Fish size={16}/> AJOUTER PRISE
                        </button>
                    </div>

                    <div className="space-y-2">
                        {catches.map(c => (
                            <div key={c.id} className="flex items-center justify-between p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                                <span className="font-bold text-stone-800 text-sm flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                    {c.species} {c.size}cm
                                </span>
                                <div className="flex gap-1">
                                    <button type="button" onClick={() => { setEditingCatch(c); setIsCatchModalOpen(true); }} className="p-2 bg-white rounded-full text-stone-400 shadow-sm border border-stone-100 hover:text-emerald-600"><Copy size={12}/></button>
                                    <button type="button" onClick={() => triggerDelete(c.id, 'catch')} className="p-2 bg-white rounded-full text-rose-400 shadow-sm border border-stone-100 hover:text-rose-600"><X size={12}/></button>
                                </div>
                            </div>
                        ))}
                        {misses.map(m => (
                            <div key={m.id} className="flex items-center justify-between p-3 bg-rose-50/50 border border-rose-100 rounded-xl">
                                <span className="font-bold text-stone-800 text-sm flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                                    {m.type}
                                </span>
                                <div className="flex gap-1">
                                    <button type="button" onClick={() => { setEditingMiss(m); setIsMissModalOpen(true); }} className="p-2 bg-white rounded-full text-stone-400 shadow-sm border border-stone-100 hover:text-rose-600"><Copy size={12}/></button>
                                    <button type="button" onClick={() => triggerDelete(m.id, 'miss')} className="p-2 bg-white rounded-full text-rose-400 shadow-sm border border-stone-100 hover:text-rose-600"><X size={12}/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="pt-2">
                      <label className="text-[9px] font-bold text-stone-400 uppercase mb-2 flex justify-between">
                        <span>Ressenti Global</span>
                        <span className="text-amber-500 text-base font-black">{feelingScore}/10</span>
                      </label>
                      <input type="range" min="1" max="10" value={feelingScore} onChange={e => setFeelingScore(parseInt(e.target.value))} className="w-full h-2 bg-stone-100 rounded-lg appearance-none cursor-pointer accent-amber-500"/>
                </div>

                <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observations rapides..." className="w-full p-3 bg-stone-50 rounded-2xl text-sm outline-none resize-none focus:ring-2 focus:ring-stone-200 transition-all" />

                <button type="submit" disabled={isLoadingEnv} className="w-full py-4 bg-stone-800 text-white rounded-2xl font-black shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2">
                    {isLoadingEnv ? <Loader2 className="animate-spin" size={20} /> : <><Save size={20} /> {initialData ? 'Enregistrer les modifications' : 'Clôturer la session'}</>}
                </button>
            </form>

            <CatchDialog 
                isOpen={isCatchModalOpen} 
                onClose={() => { setIsCatchModalOpen(false); setEditingCatch(null); }} 
                onSave={handleSaveCatch} 
                initialData={editingCatch}
                availableZones={zones} 
                locationId={locationId} 
                locations={locations}   
                availableTechniques={techniques} 
                sessionStartTime={startTime} 
                sessionEndTime={endTime} 
                sessionDate={date} 
                lureTypes={lureTypes}
                colors={colors}
                sizes={sizes}
                weights={weights}
                lastCatchDefaults={lastCatchDefaults}
            />
            
            <MissDialog 
                isOpen={isMissModalOpen} 
                onClose={() => { setIsMissModalOpen(false); setEditingMiss(null); }} 
                onSave={handleSaveMiss} 
                initialData={editingMiss}
                availableZones={zones} 
                locationId={locationId} 
                locations={locations}   
                sessionStartTime={startTime} 
                sessionEndTime={endTime} 
                sessionDate={date}
                lureTypes={lureTypes}
                colors={colors}
                sizes={sizes}
                weights={weights}
            />

            <DeleteConfirmDialog
                isOpen={pendingDelete.type !== null}
                onClose={() => setPendingDelete({ id: '', type: null })}
                onConfirm={confirmDeletion}
                title={pendingDelete.type === 'catch' ? "Supprimer cette prise ?" : "Supprimer ce raté ?"}
                customMessages={pendingDelete.type === 'catch' ? CATCH_DELETION_MESSAGES : MISS_DELETION_MESSAGES}
            />
        </div>
    );
};

export default SessionFormUI;