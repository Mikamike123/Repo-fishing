import React, { useState, useEffect } from 'react';
import { 
    Save, Loader2, Fish, AlertOctagon, X, Copy, 
    // Icons pour les widgets météo
    Cloud, Sun, CloudSun, CloudRain, Wind, Thermometer, Droplets
} from 'lucide-react';
import { Session, Zone, Setup, Technique, Catch, Miss, Lure, RefLureType, RefColor, RefSize, RefWeight } from '../types';
import { collection, query, orderBy, limit, getDocs, where, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

import CatchDialog from './CatchDialog';
import MissDialog from './MissDialog';

// --- HELPERS VISUELS (Identiques à SessionCard) ---
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

interface SessionFormProps {
    onAddSession: (session: Session) => void;
    onUpdateSession: (id: string, data: Partial<Session>) => void;
    initialData?: Session | null;
    zones: Zone[];
    setups: Setup[];
    techniques: Technique[];
    lures: Lure[];
    lureTypes: RefLureType[];
    colors: RefColor[];
    sizes: RefSize[];
    weights: RefWeight[];
    lastCatchDefaults?: Catch | null;
}

const SessionForm: React.FC<SessionFormProps> = ({ 
    onAddSession, onUpdateSession, initialData, zones, setups, techniques,
    lureTypes, colors, sizes, weights, lastCatchDefaults
}) => {
    const safeData = initialData as any;

    const [date, setDate] = useState(safeData?.date || new Date().toISOString().split('T')[0]);
    const [startTime, setStartTime] = useState(safeData?.startTime || "08:00");
    const [endTime, setEndTime] = useState(safeData?.endTime || "11:00");
    const [spotId, setSpotId] = useState(safeData?.spotId || (zones[0]?.id || ''));

    // États de données (Stockés mais plus affichés en inputs bruts)
    const [weatherCondition, setWeatherCondition] = useState<any>(safeData?.weatherCondition || 'Eclaircies');
    const [airTemp, setAirTemp] = useState(safeData?.airTemp?.toString() || null);
    const [windSpeed, setWindSpeed] = useState(safeData?.windSpeed?.toString() || null);
    const [windDirection, setWindDirection] = useState(safeData?.windDirection || 0);
    const [pressure, setPressure] = useState(safeData?.pressure?.toString() || null);
    const [cloudCover, setCloudCover] = useState(safeData?.cloudCover || 0); 
    const [waterFlow, setWaterFlow] = useState(safeData?.waterFlow?.toString() || null);
    const [waterTemp, setWaterTemp] = useState(safeData?.waterTemp?.toString() || null);
    const [waterLevel, setWaterLevel] = useState(safeData?.waterLevel?.toString() || null);

    const [feelingScore, setFeelingScore] = useState(safeData?.feelingScore || 5);
    const [comment, setComment] = useState(safeData?.comment || '');

    const [catches, setCatches] = useState<Catch[]>(safeData?.catches || []);
    const [misses, setMisses] = useState<Miss[]>(safeData?.misses || []);

    const [isLoadingEnv, setIsLoadingEnv] = useState(false);
    const [envStatus, setEnvStatus] = useState<'idle' | 'found' | 'not-found'>('idle');
    
    const [isCatchModalOpen, setIsCatchModalOpen] = useState(false);
    const [isMissModalOpen, setIsMissModalOpen] = useState(false);
    
    const [editingCatch, setEditingCatch] = useState<Catch | null>(null);
    const [editingMiss, setEditingMiss] = useState<Miss | null>(null);

    // --- AUTO-FETCH INTELLIGENT (Sur changement Date ou Heure) ---
    useEffect(() => {
        // Si on est en mode édition avec des données déjà présentes, on ne réécrase pas automatiquement
        if (initialData && envStatus === 'idle') return;

        const fetchEnv = async () => {
            setIsLoadingEnv(true);
            setEnvStatus('idle');

            try {
                // 1. Reconstitution du Timestamp cible (Date + Heure Début)
                const targetDate = new Date(`${date}T${startTime}:00`);
                const targetTimestamp = Timestamp.fromDate(targetDate);

                // 2. Requête : Trouver le log le plus proche DANS LE PASSÉ par rapport à ce timestamp
                // "Quel temps faisait-il à ce moment là ?"
                const q = query(
                    collection(db, 'environmental_logs'),
                    where('timestamp', '<=', targetTimestamp),
                    orderBy('timestamp', 'desc'),
                    limit(1)
                );

                const snapshot = await getDocs(q);

                if (!snapshot.empty) {
                    const docData = snapshot.docs[0].data() as any;
                    
                    // MAPPING
                    if (docData.weather) {
                        if (docData.weather.temp !== undefined) setAirTemp(docData.weather.temp);
                        if (docData.weather.windSpeed !== undefined) setWindSpeed(docData.weather.windSpeed);
                        if (docData.weather.windDirection !== undefined) setWindDirection(docData.weather.windDirection);
                        if (docData.weather.pressure !== undefined) setPressure(docData.weather.pressure);
                        if (docData.weather.cloudCover !== undefined) setCloudCover(docData.weather.cloudCover);
                    }

                    if (docData.hydro) {
                        // Division par 1000 pour m3/s
                        if (docData.hydro.flow !== undefined) setWaterFlow((docData.hydro.flow / 1000).toFixed(0));
                        if (docData.hydro.level !== undefined) setWaterLevel(docData.hydro.level);
                        
                        if (docData.hydro.waterTemp !== undefined) {
                            setWaterTemp(docData.hydro.waterTemp);
                        } else if (docData.weather?.waterTemp !== undefined) {
                            setWaterTemp(docData.weather.waterTemp);
                        }
                    }
                    setEnvStatus('found');
                } else {
                    setEnvStatus('not-found');
                    // On ne reset pas forcément à zéro pour laisser une saisie manuelle si besoin, 
                    // mais ici on a décidé de cacher les inputs, donc ça restera vide.
                }
            } catch (error) {
                console.error("Erreur fetch env:", error);
            } finally {
                setIsLoadingEnv(false);
            }
        };

        const timeoutId = setTimeout(fetchEnv, 800); // Debounce de 800ms pour éviter de spammer pendant la saisie de l'heure
        return () => clearTimeout(timeoutId);

    }, [date, startTime]); // Se déclenche quand la date ou l'heure de début change

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        const sessionData: any = {
            date,
            startTime,
            endTime,
            spotId,
            weatherCondition,
            airTemp: airTemp ? Number(airTemp) : null,
            windSpeed: windSpeed ? Number(windSpeed) : null,
            windDirection,
            pressure: pressure ? Number(pressure) : null,
            cloudCover: cloudCover || 0,
            waterFlow: waterFlow ? Number(waterFlow) : null,
            waterTemp: waterTemp ? Number(waterTemp) : null,
            waterLevel: waterLevel ? Number(waterLevel) : null,
            feelingScore,
            comment,
            catches,
            misses
        };

        if (initialData) {
            onUpdateSession(initialData.id, sessionData);
        } else {
            onAddSession(sessionData);
        }
    };

    // --- HANDLERS (Inchangés) ---
    const handleSaveCatch = (catchData: any) => {
        if (editingCatch) {
            setCatches(prev => prev.map(c => c.id === editingCatch.id ? { ...catchData, id: c.id } : c));
        } else {
            setCatches(prev => [...prev, { ...catchData, id: Date.now().toString() }]);
        }
        setIsCatchModalOpen(false);
        setEditingCatch(null);
    };

    const handleDeleteCatch = (id: string) => {
        if (confirm("Supprimer ?")) setCatches(prev => prev.filter(c => c.id !== id));
    };

    const handleSaveMiss = (missData: any) => {
        if (editingMiss) {
            setMisses(prev => prev.map(m => m.id === editingMiss.id ? { ...missData, id: m.id } : m));
        } else {
            setMisses(prev => [...prev, { ...missData, id: Date.now().toString() }]);
        }
        setIsMissModalOpen(false);
        setEditingMiss(null);
    };

    const handleDeleteMiss = (id: string) => {
        if (confirm("Supprimer ?")) setMisses(prev => prev.filter(m => m.id !== id));
    };

    return (
        <div className="bg-white rounded-3xl p-6 shadow-xl pb-24">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-stone-800 flex items-center gap-2">
                    {initialData ? <><AlertOctagon className="text-amber-500" /> Éditer</> : <><Fish className="text-emerald-500" /> Nouvelle Session</>}
                </h2>
                {initialData && (
                    <button onClick={() => onUpdateSession(initialData.id, {})} className="p-2 bg-stone-100 rounded-full hover:bg-stone-200">
                        <X size={20} />
                    </button>
                )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* 1. INFO DE BASE */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1 block">Date</label>
                        <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full p-4 bg-stone-50 rounded-2xl font-bold text-stone-700 outline-none focus:ring-2 focus:ring-emerald-100 transition-all" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1 block">Début</label>
                        <input type="time" required value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full p-4 bg-stone-50 rounded-2xl font-bold text-stone-700 outline-none focus:ring-2 focus:ring-emerald-100 transition-all" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1 block">Fin</label>
                        <input type="time" required value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full p-4 bg-stone-50 rounded-2xl font-bold text-stone-700 outline-none focus:ring-2 focus:ring-emerald-100 transition-all" />
                    </div>
                </div>

                <div>
                    <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1 block">Spot</label>
                    <select required value={spotId} onChange={e => setSpotId(e.target.value)} className="w-full p-4 bg-stone-50 rounded-2xl font-bold text-stone-700 outline-none focus:ring-2 focus:ring-emerald-100 transition-all">
                        {zones.map(z => <option key={z.id} value={z.id}>{z.label} ({z.type})</option>)}
                    </select>
                </div>

                {/* 2. WIDGETS ENVIRONNEMENT (Style SessionCard) */}
                <div className="space-y-2">
                    <div className="flex justify-between items-end px-1">
                        <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                            Conditions (Auto)
                        </label>
                        {/* Indicateur de statut discret */}
                        {isLoadingEnv ? (
                             <span className="text-[9px] text-amber-500 font-bold flex items-center gap-1"><Loader2 size={10} className="animate-spin"/> Recherche...</span>
                        ) : envStatus === 'found' ? (
                             <span className="text-[9px] text-emerald-500 font-bold">Données synchronisées</span>
                        ) : (
                             <span className="text-[9px] text-stone-300 italic">Aucune donnée trouvée</span>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-2">
                        {/* Widget Météo */}
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50 text-blue-900 border border-blue-100 shrink-0 min-w-[80px] justify-center">
                            {airTemp !== null ? getWeatherIcon(cloudCover) : <Cloud size={16} className="text-blue-300"/>}
                            <span className="text-sm font-bold">{airTemp !== null ? `${Math.round(Number(airTemp))}°C` : '--'}</span>
                        </div>

                        {/* Widget Vent */}
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-stone-100 text-stone-600 border border-stone-200 shrink-0 min-w-[100px] justify-center">
                            <Wind size={16} className="text-stone-400" />
                            <span className="text-sm font-bold">
                                {windSpeed !== null ? `${Math.round(Number(windSpeed))} ${getWindDir(windDirection)}` : '--'}
                            </span>
                        </div>

                        {/* Widget Eau */}
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-50 text-orange-700 border border-orange-100 shrink-0 min-w-[80px] justify-center">
                            <Thermometer size={16} className="text-orange-500" />
                            <span className="text-sm font-bold">{waterTemp !== null ? `${Number(waterTemp).toFixed(1)}°C` : '--'}</span>
                        </div>

                        {/* Widget Débit */}
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-cyan-50 text-cyan-700 border border-cyan-100 shrink-0 min-w-[80px] justify-center">
                            <Droplets size={16} className="text-cyan-500" />
                            <span className="text-sm font-bold">{waterFlow !== null ? `${Number(waterFlow).toFixed(0)}` : '--'}</span>
                        </div>
                    </div>
                </div>

                {/* 3. LISTES (Boutons Restaurés & Améliorés) */}
                <div className="space-y-4 pt-2">
                    <div className="flex gap-3">
                        <button 
                            type="button" 
                            onClick={() => setIsMissModalOpen(true)} 
                            className="flex-1 py-3 bg-rose-50 text-rose-600 rounded-full text-xs font-black border border-rose-100 shadow-sm active:scale-95 transition-all flex justify-center items-center gap-2 hover:bg-rose-100"
                        >
                            <AlertOctagon size={16}/> AJOUTER RATÉ
                        </button>
                        <button 
                            type="button" 
                            onClick={() => setIsCatchModalOpen(true)} 
                            className="flex-1 py-3 bg-emerald-50 text-emerald-600 rounded-full text-xs font-black border border-emerald-100 shadow-sm active:scale-95 transition-all flex justify-center items-center gap-2 hover:bg-emerald-100"
                        >
                            <Fish size={16}/> AJOUTER PRISE
                        </button>
                    </div>

                    {catches.length === 0 && misses.length === 0 && (
                        <div className="p-6 border-2 border-dashed border-stone-100 rounded-2xl text-center">
                            <p className="text-stone-400 text-xs italic">Aucune prise pour le moment.</p>
                        </div>
                    )}
                    
                    <div className="space-y-2">
                        {catches.map(c => (
                            <div key={c.id} className="flex items-center justify-between p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                                <span className="font-bold text-stone-800 text-sm flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                    {c.species} {c.size}cm
                                </span>
                                <div className="flex gap-1">
                                    <button type="button" onClick={() => { setEditingCatch(c); setIsCatchModalOpen(true); }} className="p-2 bg-white rounded-full text-stone-400 shadow-sm border border-stone-100 hover:text-emerald-600"><Copy size={12}/></button>
                                    <button type="button" onClick={() => handleDeleteCatch(c.id)} className="p-2 bg-white rounded-full text-rose-400 shadow-sm border border-stone-100 hover:text-rose-600"><X size={12}/></button>
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
                                    <button type="button" onClick={() => handleDeleteMiss(m.id)} className="p-2 bg-white rounded-full text-rose-400 shadow-sm border border-stone-100 hover:text-rose-600"><X size={12}/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 4. FEELING */}
                <div className="pt-2">
                     <label className="text-[10px] font-bold text-stone-400 uppercase mb-3 flex justify-between">
                        <span>Ressenti Global</span>
                        <span className="text-amber-500 text-lg font-black">{feelingScore}/10</span>
                     </label>
                     <input type="range" min="1" max="10" value={feelingScore} onChange={e => setFeelingScore(parseInt(e.target.value))} className="w-full h-2 bg-stone-100 rounded-lg appearance-none cursor-pointer accent-amber-500"/>
                     <div className="flex justify-between text-[8px] font-bold text-stone-300 uppercase mt-2 px-1">
                        <span>Horrible</span>
                        <span>Moyen</span>
                        <span>Légendaire</span>
                    </div>
                </div>

                <textarea rows={3} value={comment} onChange={e => setComment(e.target.value)} placeholder="Notes sur la session..." className="w-full p-4 bg-stone-50 rounded-2xl text-sm outline-none resize-none focus:ring-2 focus:ring-stone-200 transition-all" />

                <button type="submit" disabled={isLoadingEnv} className="w-full py-4 bg-stone-800 text-white rounded-2xl font-black shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2">
                    {isLoadingEnv ? <Loader2 className="animate-spin" size={20} /> : <><Save size={20} /> {initialData ? 'Modifier' : 'Terminer'}</>}
                </button>
            </form>

            <CatchDialog 
                isOpen={isCatchModalOpen} 
                onClose={() => { setIsCatchModalOpen(false); setEditingCatch(null); }} 
                onSave={handleSaveCatch} 
                initialData={editingCatch}
                availableZones={zones} 
                availableTechniques={techniques} 
                sessionStartTime={startTime} 
                sessionEndTime={endTime} 
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
                sessionStartTime={startTime} 
                sessionEndTime={endTime} 
                lureTypes={lureTypes}
                colors={colors}
                sizes={sizes}
                weights={weights}
            />
        </div>
    );
};

export default SessionForm;