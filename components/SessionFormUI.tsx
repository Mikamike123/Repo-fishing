// components/SessionFormUI.tsx - Version 4.9.0 (FR Localization & Focus UI)
import React, { useState } from 'react';
import { 
    Save, Loader2, Fish, AlertOctagon, X, Copy, 
    Cloud, Sun, CloudSun, CloudRain, Wind, ZapOff
} from 'lucide-react';
import { 
    Session, Zone, Setup, Technique, Catch, Miss, Lure, 
    RefLureType, RefColor, RefSize, RefWeight, FullEnvironmentalSnapshot, Location 
} from '../types';
import CatchDialog from './CatchDialog';
import MissDialog from './MissDialog';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import { CATCH_DELETION_MESSAGES, MISS_DELETION_MESSAGES } from '../constants/deletionMessages';

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
    userId: string;
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
    displayDateFR: string; // Michael : Reçu du form parent pour l'affichage localisé
    isCatchModalOpen: boolean; setIsCatchModalOpen: (v: boolean) => void;
    isMissModalOpen: boolean; setIsMissModalOpen: (v: boolean) => void;
    editingCatch: Catch | null; setEditingCatch: (v: Catch | null) => void;
    editingMiss: Miss | null; setEditingMiss: (v: Miss | null) => void;
    handleDeleteCatch: (id: string) => void;
    handleDeleteMiss: (id: string) => void;
    handleSaveCatch: (data: any) => void;
    handleSaveMiss: (data: any) => void;
    handleSubmit: (e: React.FormEvent) => void;
    onCancel?: () => void;
    isActuallyNight?: boolean;
}

const SessionFormUI: React.FC<SessionFormUIProps> = (props) => {
    const {
        initialData, setups, techniques, lureTypes, colors, sizes, weights, lastCatchDefaults, locations,
        date, setDate, startTime, setStartTime, endTime, setEndTime,
        locationId, setLocationId, filteredSpots, spotId, setSpotId, setupId, setSetupId,
        feelingScore, setFeelingScore, notes, setNotes, catches, misses, envSnapshot,
        isLoadingEnv, envStatus, displayDateFR, isCatchModalOpen, setIsCatchModalOpen, isMissModalOpen, setIsMissModalOpen,
        editingCatch, setEditingCatch, editingMiss, setEditingMiss,
        handleDeleteCatch, handleDeleteMiss, handleSaveCatch, handleSaveMiss, handleSubmit, zones, userId, onCancel,
        isActuallyNight
    } = props;

    const [isCapotExpress, setIsCapotExpress] = useState(false);

    const handleFormSubmit = (e: React.FormEvent) => {
        if (window.navigator && window.navigator.vibrate) {
            window.navigator.vibrate(25);
        }
        handleSubmit(e);
    };

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

    const inputBg = isActuallyNight ? 'bg-stone-800 border-stone-700 text-stone-100' : 'bg-stone-50 border-transparent text-stone-700';

    return (
        <div className={`rounded-3xl p-6 shadow-2xl pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500 transition-colors duration-500 ${
            isActuallyNight ? 'bg-[#1c1917] shadow-black/40 border border-stone-800' : 'bg-white'
        }`}>
            {/* HEADER */}
            <div className="flex justify-between items-center mb-6">
                <h2 className={`text-2xl font-black flex items-center gap-2 uppercase tracking-tighter italic ${isActuallyNight ? 'text-stone-100' : 'text-stone-800'}`}>
                    {initialData ? <><AlertOctagon className="text-amber-500" /> Modifie ta Session</> : <><Fish className="text-emerald-500" /> Nouvelle Session</>}
                </h2>
                <button type="button" onClick={() => onCancel ? onCancel() : window.location.reload()} className={`p-2.5 rounded-full transition-colors ${isActuallyNight ? 'bg-stone-800 text-stone-400' : 'bg-stone-100 text-stone-500'}`}>
                    <X size={22} strokeWidth={2.5} />
                </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
                {/* DATE / HEURE - LOCALISATION FR */}
                <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-4">
                        <label className="text-[9px] font-bold text-stone-400 uppercase tracking-widest mb-1 block">
                            Date {displayDateFR && <span className="text-amber-500/80">({displayDateFR})</span>}
                        </label>
                        <input 
                            type="date" 
                            required 
                            value={date} 
                            onChange={e => setDate(e.target.value)} 
                            className={`w-full p-3 rounded-xl font-bold text-xs outline-none border transition-all ${inputBg}`} 
                        />
                    </div>
                    <div className="col-span-4">
                        <label className="text-[9px] font-bold text-stone-400 uppercase tracking-widest mb-1 block">Début (24h)</label>
                        <input 
                            type="time" 
                            required 
                            step="60"
                            value={startTime} 
                            onChange={e => setStartTime(e.target.value)} 
                            className={`w-full p-3 rounded-xl font-bold text-xs outline-none border transition-all ${inputBg}`} 
                        />
                    </div>
                    <div className="col-span-4">
                        <label className="text-[9px] font-bold text-stone-400 uppercase tracking-widest mb-1 block">Fin (24h)</label>
                        <input 
                            type="time" 
                            required 
                            step="60"
                            value={endTime} 
                            onChange={e => setEndTime(e.target.value)} 
                            className={`w-full p-3 rounded-xl font-bold text-xs outline-none border transition-all ${inputBg}`} 
                        />
                    </div>
                </div>

                {/* SECTEUR / SPOT */}
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="text-[9px] font-bold text-stone-400 uppercase tracking-widest mb-1 block">Secteur</label>
                        <select required value={locationId} onChange={e => setLocationId(e.target.value)} className={`w-full p-3 rounded-xl font-bold text-sm outline-none border transition-all ${inputBg}`}>
                            {locations.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-[9px] font-bold text-stone-400 uppercase tracking-widest mb-1 block">Spot</label>
                        <select required value={spotId} onChange={e => setSpotId(e.target.value)} className={`w-full p-3 rounded-xl font-bold text-sm outline-none border transition-all ${inputBg}`} disabled={filteredSpots.length === 0}>
                            {filteredSpots.map(z => <option key={z.id} value={z.id}>{z.label}</option>)}
                        </select>
                    </div>
                </div>

                {/* COMBO */}
                <div className="grid grid-cols-1 gap-2">
                    <label className="text-[9px] font-bold text-stone-400 uppercase tracking-widest mb-1 block">Combo utilisé</label>
                    <select required value={setupId} onChange={e => setSetupId(e.target.value)} className={`w-full p-3 rounded-xl font-bold text-sm outline-none border transition-all ${inputBg}`}>
                        {setups.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                </div>

                {/* TOGGLE CAPOT SLIM */}
                <div className={`flex items-center justify-between px-3 py-2 rounded-2xl border transition-colors ${
                    isActuallyNight ? 'bg-stone-800 border-stone-700' : 'bg-stone-50 border-stone-100'
                }`}>
                    <div className="flex items-center gap-2">
                        <ZapOff size={14} className={isCapotExpress ? 'text-amber-500' : 'text-stone-500'} />
                        <span className="text-[10px] font-black text-stone-500 uppercase tracking-widest">Session sans touche ?</span>
                    </div>
                    <button 
                        type="button"
                        onClick={() => setIsCapotExpress(!isCapotExpress)}
                        className={`w-10 h-5 rounded-full relative transition-colors ${isCapotExpress ? 'bg-amber-500' : (isActuallyNight ? 'bg-stone-700' : 'bg-stone-300')}`}
                    >
                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isCapotExpress ? 'left-6' : 'left-1'}`} />
                    </button>
                </div>

                {/* ACTIONS PRISE / RATÉ */}
                {!isCapotExpress && (
                    <div className="space-y-4 pt-1 animate-in fade-in duration-300">
                        <div className="flex gap-3">
                            <button type="button" onClick={() => setIsMissModalOpen(true)} className={`flex-1 py-3.5 rounded-2xl text-[11px] font-black border shadow-sm active:scale-95 transition-all flex justify-center items-center gap-2 ${
                                isActuallyNight ? 'bg-rose-950/30 text-rose-400 border-rose-900/50' : 'bg-rose-50 text-rose-600 border-rose-100'
                            }`}>
                                <AlertOctagon size={16}/> RATÉ
                            </button>
                            <button type="button" onClick={() => setIsCatchModalOpen(true)} className={`flex-1 py-3.5 rounded-2xl text-[11px] font-black border shadow-sm active:scale-95 transition-all flex justify-center items-center gap-2 ${
                                isActuallyNight ? 'bg-emerald-950/30 text-emerald-400 border-emerald-900/50' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                            }`}>
                                <Fish size={16}/> PRISE
                            </button>
                        </div>

                        <div className="space-y-2">
                            {catches.map(c => (
                                <div key={c.id} className={`flex items-center justify-between p-3 border rounded-xl ${isActuallyNight ? 'bg-emerald-900/10 border-emerald-900/30' : 'bg-emerald-50/50 border-emerald-100'}`}>
                                    <span className={`font-bold text-sm flex items-center gap-2 truncate ${isActuallyNight ? 'text-stone-200' : 'text-stone-800'}`}>
                                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                        {c.species} {c.size}cm
                                    </span>
                                    <div className="flex gap-1 shrink-0">
                                        <button type="button" onClick={() => { setEditingCatch(c); setIsCatchModalOpen(true); }} className={`p-2 rounded-full shadow-sm border transition-colors ${isActuallyNight ? 'bg-stone-800 border-stone-700 text-stone-400' : 'bg-white border-stone-100 text-stone-400'}`}><Copy size={12}/></button>
                                        <button type="button" onClick={() => triggerDelete(c.id, 'catch')} className={`p-2 rounded-full shadow-sm border transition-colors ${isActuallyNight ? 'bg-stone-800 border-stone-700 text-rose-500' : 'bg-white border-stone-100 text-rose-400'}`}><X size={12}/></button>
                                    </div>
                                </div>
                            ))}
                            {misses.map(m => (
                                <div key={m.id} className={`flex items-center justify-between p-3 border rounded-xl ${isActuallyNight ? 'bg-rose-900/10 border-rose-900/30' : 'bg-rose-50/50 border-rose-100'}`}>
                                    <span className={`font-bold text-sm flex items-center gap-2 truncate ${isActuallyNight ? 'text-stone-200' : 'text-stone-800'}`}>
                                        <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                                        {m.type}
                                    </span>
                                    <div className="flex gap-1 shrink-0">
                                        <button type="button" onClick={() => { setEditingMiss(m); setIsMissModalOpen(true); }} className={`p-2 rounded-full shadow-sm border transition-colors ${isActuallyNight ? 'bg-stone-800 border-stone-700 text-stone-400' : 'bg-white border-stone-100 text-stone-400'}`}><Copy size={12}/></button>
                                        <button type="button" onClick={() => triggerDelete(m.id, 'miss')} className={`p-2 rounded-full shadow-sm border transition-colors ${isActuallyNight ? 'bg-stone-800 border-stone-700 text-rose-500' : 'bg-white border-stone-100 text-rose-400'}`}><X size={12}/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* RESSENTI */}
                <div className="pt-2">
                      <label className="text-[9px] font-bold text-stone-400 uppercase mb-2 flex justify-between tracking-widest">
                        <span>Ton ressenti global</span>
                        <span className="text-amber-500 text-base font-black">{feelingScore}/10</span>
                      </label>
                      <input type="range" min="1" max="10" value={feelingScore} onChange={e => setFeelingScore(parseInt(e.target.value))} className={`w-full h-2 rounded-lg appearance-none cursor-pointer accent-amber-500 ${isActuallyNight ? 'bg-stone-800' : 'bg-stone-200/50'}`}/>
                </div>

                {/* OBSERVATIONS */}
                <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Tes observations rapides..." className={`w-full p-4 rounded-2xl text-sm outline-none resize-none border transition-all italic ${inputBg}`} />

                {/* VALIDATION HAPTIQUE */}
                <button type="submit" disabled={isLoadingEnv} className={`w-full py-5 rounded-2xl font-black shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 text-lg uppercase tracking-tighter ${
                    isActuallyNight ? 'bg-stone-100 text-[#1c1917] hover:bg-white' : 'bg-stone-800 text-white hover:bg-stone-950'
                }`}>
                    {isLoadingEnv ? <Loader2 className="animate-spin" size={24} /> : <><Save size={24} /> {initialData ? 'Enregistre tes modifs' : 'Clôture ta session'}</>}
                </button>
            </form>

            <CatchDialog 
                isOpen={isCatchModalOpen} onClose={() => { setIsCatchModalOpen(false); setEditingCatch(null); }} 
                onSave={handleSaveCatch} initialData={editingCatch} availableZones={zones} locationId={locationId} locations={locations}   
                availableTechniques={techniques} sessionStartTime={startTime} sessionEndTime={endTime} sessionDate={date} 
                lureTypes={lureTypes} colors={colors} sizes={sizes} weights={weights} lastCatchDefaults={lastCatchDefaults} userId={userId}
                isActuallyNight={isActuallyNight}
            />
            
            <button
                type="button"
                className="hidden" 
            />

            <MissDialog 
                isOpen={isMissModalOpen} onClose={() => { setIsMissModalOpen(false); setEditingMiss(null); }} 
                onSave={handleSaveMiss} initialData={editingMiss} availableZones={zones} locationId={locationId} locations={locations}   
                sessionStartTime={startTime} sessionEndTime={endTime} sessionDate={date} lureTypes={lureTypes} colors={colors} sizes={sizes} weights={weights}
                isActuallyNight={isActuallyNight}
            />

            <DeleteConfirmDialog
                isOpen={pendingDelete.type !== null} onClose={() => setPendingDelete({ id: '', type: null })} onConfirm={confirmDeletion}
                title={pendingDelete.type === 'catch' ? "Supprimer cette prise ?" : "Supprimer ce raté ?"}
                customMessages={pendingDelete.type === 'catch' ? CATCH_DELETION_MESSAGES : MISS_DELETION_MESSAGES}
                isActuallyNight={isActuallyNight}
            />
        </div>
    );
};

export default SessionFormUI;