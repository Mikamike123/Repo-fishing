import React, { useState, useEffect } from 'react';
import { Save, Calendar, Clock, MapPin, Anchor, Plus, X, Loader2, Fish, AlertOctagon } from 'lucide-react';
import { Session, Zone, Setup, Technique, Catch, Miss, Lure, WeatherSnapshot, HydroSnapshot } from '../types';
import { getRealtimeEnvironmentalConditions, getRealtimeWaterTemp } from '../lib/environmental-service';
import CatchDialog from './CatchDialog';
import MissDialog from './MissDialog';

interface SessionFormProps {
    onAddSession: (session: Session) => void;
    onUpdateSession: (id: string, data: Partial<Session>) => void;
    initialData?: Session | null;
    zones: Zone[];
    setups: Setup[];
    techniques: Technique[];
    lures: Lure[]; 
}

const SessionForm: React.FC<SessionFormProps> = ({ onAddSession, onUpdateSession, initialData, zones, setups, techniques }) => {
    const [date, setDate] = useState(initialData?.date || new Date().toISOString().split('T')[0]);
    const [startTime, setStartTime] = useState(initialData?.startTime || "08:00");
    const [endTime, setEndTime] = useState(initialData?.endTime || "11:00");
    const [feeling, setFeeling] = useState(initialData?.feelingScore || 5);
    const [selectedZoneId, setSelectedZoneId] = useState(initialData?.zoneId || '');
    const [selectedSetupId, setSelectedSetupId] = useState(initialData?.setupId || '');
    const [catches, setCatches] = useState<Catch[]>(initialData?.catches || []);
    const [misses, setMisses] = useState<Miss[]>(initialData?.misses || []);

    const [isCatchModalOpen, setIsCatchModalOpen] = useState(false);
    const [isMissModalOpen, setIsMissModalOpen] = useState(false);
    
    // ÉTATS POUR L'ÉDITION D'UNE PRISE/RATÉ
    const [editingCatch, setEditingCatch] = useState<Catch | null>(null);
    const [editingMiss, setEditingMiss] = useState<Miss | null>(null);

    const [isLoadingEnv, setIsLoadingEnv] = useState(!initialData);
    const [envData, setEnvData] = useState<{w: WeatherSnapshot | null, h: HydroSnapshot | null, t: number | null}>({
        w: initialData?.weather || null, h: initialData?.hydro || null, t: initialData?.waterTemp || null
    });

    useEffect(() => {
        if (initialData) return;
        const loadEnv = async () => {
            const [env, temp] = await Promise.all([getRealtimeEnvironmentalConditions(), getRealtimeWaterTemp(null)]);
            setEnvData({ w: env.weather, h: env.hydro, t: temp?.temperature || null });
            setIsLoadingEnv(false);
        };
        loadEnv();
    }, [initialData]);

    useEffect(() => {
        if (zones.length > 0 && !selectedZoneId) setSelectedZoneId(zones[0].id);
        if (setups.length > 0 && !selectedSetupId) setSelectedSetupId(setups[0].id);
    }, [zones, setups, selectedZoneId]);

    const combineDateAndTime = (timeStr: string) => {
        if (!timeStr) return new Date();
        const [hours, minutes] = timeStr.split(':').map(Number);
        const sessionDate = new Date(date);
        sessionDate.setHours(hours, minutes, 0, 0);
        return sessionDate;
    };

    // GESTION SAUVEGARDE PRISE (CRÉATION OU MODIF)
    const handleSaveCatch = (c: any) => {
        const timestamp = combineDateAndTime(c.time);
        
        if (editingCatch) {
            // Modification
            setCatches(prev => prev.map(item => item.id === editingCatch.id ? { ...item, ...c, timestamp } : item));
            setEditingCatch(null);
        } else {
            // Création
            setCatches(prev => [...prev, { ...c, id: crypto.randomUUID(), timestamp }]);
        }
        setIsCatchModalOpen(false);
    };

    // GESTION SAUVEGARDE RATÉ (CRÉATION OU MODIF)
    const handleSaveMiss = (m: any) => {
        const timestamp = combineDateAndTime(m.time);

        if (editingMiss) {
            // Modification
            setMisses(prev => prev.map(item => item.id === editingMiss.id ? { ...item, ...m, timestamp } : item));
            setEditingMiss(null);
        } else {
            // Création
            setMisses(prev => [...prev, { ...m, id: crypto.randomUUID(), timestamp }]);
        }
        setIsMissModalOpen(false);
    };

    // OUVERTURE MODALES EN MODE ÉDITION
    const openEditCatch = (c: Catch) => {
        setEditingCatch(c);
        setIsCatchModalOpen(true);
    };

    const openEditMiss = (m: Miss) => {
        setEditingMiss(m);
        setIsMissModalOpen(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const zoneObj = zones.find(z => z.id === selectedZoneId);
        const setupObj = setups.find(s => s.id === selectedSetupId);

        const payload = {
            date, startTime, endTime, feelingScore: feeling,
            zoneId: selectedZoneId, zoneName: zoneObj?.label || 'Inconnue',
            setupId: selectedSetupId, setupName: setupObj?.label || 'Inconnu',
            catches, misses, weather: envData.w, hydro: envData.h, waterTemp: envData.t,
            catchCount: catches.length, userId: 'user_1',
            techniquesUsed: Array.from(new Set(catches.map(c => c.technique)))
        };

        if (initialData?.id) {
            onUpdateSession(initialData.id, payload);
        } else {
            onAddSession({ id: crypto.randomUUID(), ...payload } as Session);
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto p-4 space-y-6">
            <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-lg p-8 space-y-8 border border-stone-100">
                <h2 className="text-xl font-bold text-stone-800">{initialData ? 'Modifier Session' : 'Nouvelle Session'}</h2>
                
                {/* ... Inputs Date/Heure ... */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-14 bg-stone-50 border border-stone-200 rounded-xl px-4 font-bold text-stone-700" />
                    <div className="flex gap-2">
                        <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="flex-1 h-14 bg-stone-50 border border-stone-200 rounded-xl text-center font-bold text-stone-700" />
                        <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="flex-1 h-14 bg-stone-50 border border-stone-200 rounded-xl text-center font-bold text-stone-700" />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <select value={selectedZoneId} onChange={(e) => setSelectedZoneId(e.target.value)} className="p-4 bg-stone-50 border border-stone-200 rounded-xl font-bold text-stone-700">
                        <option value="">Sélectionner Zone...</option>
                        {zones.map(z => <option key={z.id} value={z.id}>{z.label}</option>)}
                    </select>
                    <select value={selectedSetupId} onChange={(e) => setSelectedSetupId(e.target.value)} className="p-4 bg-stone-50 border border-stone-200 rounded-xl font-bold text-stone-700">
                        <option value="">Sélectionner Setup...</option>
                        {setups.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <button type="button" onClick={() => { setEditingCatch(null); setIsCatchModalOpen(true); }} className="py-4 bg-amber-500 text-white rounded-2xl font-black shadow-lg shadow-amber-500/20 active:scale-95 transition-transform hover:bg-amber-600">+ Prise</button>
                    <button type="button" onClick={() => { setEditingMiss(null); setIsMissModalOpen(true); }} className="py-4 bg-stone-100 text-stone-600 rounded-2xl font-bold border border-stone-200 active:scale-95 transition-transform hover:bg-stone-200">+ Raté</button>
                </div>

                {/* --- VIVIER INTERACTIF --- */}
                <div className="flex gap-3 overflow-x-auto py-4 min-h-[110px] scrollbar-thin scrollbar-thumb-stone-200">
                    {catches.map((c) => (
                        <div 
                            key={c.id} 
                            onClick={() => openEditCatch(c)} // CLIC POUR ÉDITER
                            className="relative shrink-0 w-24 h-24 bg-white border border-amber-100 rounded-2xl p-2 flex flex-col items-center justify-center text-center shadow-sm group cursor-pointer hover:border-amber-400 transition-colors"
                        >
                            <button 
                                type="button" 
                                onClick={(e) => { e.stopPropagation(); setCatches(catches.filter(i => i.id !== c.id)); }} 
                                className="absolute top-1 right-1 p-1 text-stone-300 hover:text-red-500 transition-colors z-10"
                            >
                                <X size={12}/>
                            </button>
                            <Fish size={16} className="text-amber-500 mb-1"/>
                            <span className="text-[10px] font-black text-stone-700 leading-tight truncate w-full">{c.species}</span>
                            <span className="text-[10px] text-stone-400">{c.size}cm</span>
                            <span className="text-[9px] text-stone-300 mt-1 font-mono">
                                {c.timestamp instanceof Date ? c.timestamp.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--:--'}
                            </span>
                        </div>
                    ))}

                    {misses.map((m) => (
                        <div 
                            key={m.id} 
                            onClick={() => openEditMiss(m)} // CLIC POUR ÉDITER
                            className="relative shrink-0 w-24 h-24 bg-stone-50 border border-dashed border-stone-300 rounded-2xl p-2 flex flex-col items-center justify-center text-center group cursor-pointer hover:border-rose-400 transition-colors"
                        >
                            <button 
                                type="button" 
                                onClick={(e) => { e.stopPropagation(); setMisses(misses.filter(i => i.id !== m.id)); }} 
                                className="absolute top-1 right-1 p-1 text-stone-300 hover:text-red-500 transition-colors z-10"
                            >
                                <X size={12}/>
                            </button>
                            <AlertOctagon size={16} className="text-rose-400 mb-1"/>
                            <span className="text-[10px] font-black text-stone-600 leading-tight truncate w-full">{m.type}</span>
                            <span className="text-[9px] text-stone-400 mt-1 font-mono">
                                {m.timestamp instanceof Date ? m.timestamp.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--:--'}
                            </span>
                        </div>
                    ))}
                    
                    {catches.length === 0 && misses.length === 0 && (
                        <div className="w-full flex items-center justify-center text-xs text-stone-400 italic border-2 border-dashed border-stone-100 rounded-2xl bg-stone-50/50">
                            Le vivier est vide.
                        </div>
                    )}
                </div>

                <button 
                    type="submit" 
                    disabled={isLoadingEnv}
                    className="w-full bg-stone-800 text-white py-5 rounded-2xl font-black shadow-xl flex items-center justify-center gap-3 disabled:bg-stone-200 disabled:text-stone-400 transition-all hover:bg-stone-900 active:scale-[0.99]"
                >
                    {isLoadingEnv ? <><Loader2 className="animate-spin" size={20} /> Chargement Météo...</> : <><Save size={20} /> {initialData ? 'Enregistrer les modifications' : 'Terminer la Session'}</>}
                </button>
            </form>

            <CatchDialog 
                isOpen={isCatchModalOpen} 
                onClose={() => { setIsCatchModalOpen(false); setEditingCatch(null); }} 
                onSave={handleSaveCatch} 
                initialData={editingCatch} // Passer la donnée à éditer
                availableZones={zones} 
                availableTechniques={techniques} 
                sessionStartTime={startTime} 
                sessionEndTime={endTime} 
            />
            
            <MissDialog 
                isOpen={isMissModalOpen} 
                onClose={() => { setIsMissModalOpen(false); setEditingMiss(null); }} 
                onSave={handleSaveMiss} 
                initialData={editingMiss} // Passer la donnée à éditer
                availableZones={zones} 
                sessionStartTime={startTime} 
                sessionEndTime={endTime} 
            />
        </div>
    );
};

export default SessionForm;