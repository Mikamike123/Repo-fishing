import React, { useState, useEffect, useMemo } from 'react';
import { 
    Save, Loader2, Fish, AlertOctagon, X, Copy, 
    Cloud, Sun, CloudSun, CloudRain, Wind, Thermometer, Droplets
} from 'lucide-react';
import { 
    Session, Zone, Setup, Technique, Catch, Miss, Lure, 
    RefLureType, RefColor, RefSize, RefWeight, FullEnvironmentalSnapshot, Location 
} from '../types';
import { doc, getDoc } from 'firebase/firestore';
// MODIFICATION ICI : Import de getApp pour la région
import { getFunctions, httpsCallable } from 'firebase/functions'; 
import { getApp } from 'firebase/app';
import { db } from '../lib/firebase';

import CatchDialog from './CatchDialog';
import MissDialog from './MissDialog';

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
    initialDiscovery?: { date: string, startTime: string, endTime: string, initialCatch: Catch } | null;
    zones: Zone[]; // Spots
    setups: Setup[];
    techniques: Technique[];
    lures: Lure[];
    lureTypes: RefLureType[];
    colors: RefColor[];
    sizes: RefSize[];
    weights: RefWeight[];
    lastCatchDefaults?: Catch | null;
    
    // NOUVEAUX CHAMPS LOCATION
    locations: Location[];
    defaultLocationId: string;
}

const SessionForm: React.FC<SessionFormProps> = ({ 
    onAddSession, onUpdateSession, initialData, initialDiscovery, zones, setups, techniques,
    lureTypes, colors, sizes, weights, lastCatchDefaults,
    locations, defaultLocationId
}) => {
    // 1. États de base (Priorité : Édition > Discovery > Défaut)
    const [date, setDate] = useState(initialData?.date || initialDiscovery?.date || new Date().toISOString().split('T')[0]);
    const [startTime, setStartTime] = useState(initialData?.startTime || initialDiscovery?.startTime || "08:00");
    const [endTime, setEndTime] = useState(initialData?.endTime || initialDiscovery?.endTime || "11:00");
    
    // --- GESTION LOCATION & SPOT ---
    // Initialisation Location : Édition > Props (Dashboard) > Premier dispo
    const [locationId, setLocationId] = useState<string>(
        initialData?.locationId || defaultLocationId || (locations[0]?.id || '')
    );

    // Filtrage des spots selon la location sélectionnée
    const filteredSpots = useMemo(() => {
        if (!locationId) return [];
        return zones.filter(z => z.locationId === locationId);
    }, [zones, locationId]);

    // Initialisation Spot : Doit appartenir à la location, sinon premier de la liste filtrée
    const [spotId, setSpotId] = useState<string>(() => {
        if (initialData?.spotId) return initialData.spotId;
        // Si on change de location, on prend le premier spot dispo
        return filteredSpots.length > 0 ? filteredSpots[0].id : '';
    });

    // Effet de bord : Quand on change de location, on reset le spot
    useEffect(() => {
        // On ne reset PAS si c'est l'initialisation (évite d'écraser initialData au montage)
        // Mais ici on veut juste s'assurer que si l'user change manuellement, le spot suit.
        // Une astuce simple : vérifier si le spotId actuel est valide pour la nouvelle location
        const isValid = zones.find(z => z.id === spotId && z.locationId === locationId);
        if (!isValid) {
             setSpotId(filteredSpots.length > 0 ? filteredSpots[0].id : '');
        }
    }, [locationId, filteredSpots, zones]); // spotId retiré des dépendances pour éviter boucle

    const [setupId, setSetupId] = useState(initialData?.setupId || (setups[0]?.id || ''));

    const [envSnapshot, setEnvSnapshot] = useState<FullEnvironmentalSnapshot | null>(initialData?.envSnapshot || null);
    const [feelingScore, setFeelingScore] = useState(initialData?.feelingScore || 5);
    const [notes, setNotes] = useState(initialData?.notes || ''); 

    // Initialisation des prises avec celle du Discovery si présente
    const [catches, setCatches] = useState<Catch[]>(
        initialData?.catches || (initialDiscovery?.initialCatch ? [initialDiscovery.initialCatch] : [])
    );
    const [misses, setMisses] = useState<Miss[]>(initialData?.misses || []);

    const [isLoadingEnv, setIsLoadingEnv] = useState(false);
    // AJOUT: statut 'simulated' pour les archives hors Nanterre
    const [envStatus, setEnvStatus] = useState<'idle' | 'found' | 'not-found' | 'simulated'>('idle');
    const [isCatchModalOpen, setIsCatchModalOpen] = useState(false);
    const [isMissModalOpen, setIsMissModalOpen] = useState(false);
    const [editingCatch, setEditingCatch] = useState<Catch | null>(null);
    const [editingMiss, setEditingMiss] = useState<Miss | null>(null);

    // Effet pour synchroniser si initialDiscovery change (quand on clique sur le bouton Magic)
    useEffect(() => {
        if (initialDiscovery && !initialData) {
            setDate(initialDiscovery.date);
            setStartTime(initialDiscovery.startTime);
            setEndTime(initialDiscovery.endTime);
            if (initialDiscovery.initialCatch) {
                setCatches([initialDiscovery.initialCatch]);
            }
        }
    }, [initialDiscovery, initialData]);

    // --- LOGIQUE D'ACQUISITION ENVIRONNEMENTALE (Mise à jour) ---
    useEffect(() => {
        // Si on édite une session qui a déjà ses données et qu'on n'a rien touché, on ne recharge pas
        if (initialData && envStatus === 'idle' && initialData.envSnapshot && 
            date === initialData.date && startTime === initialData.startTime && locationId === initialData.locationId) {
            setEnvStatus('found');
            return;
        }

        const fetchEnv = async () => {
            setIsLoadingEnv(true);
            setEnvStatus('idle');
            setEnvSnapshot(null); // Reset pour éviter confusion

            try {
                const hourStr = startTime.split(':')[0];
                const hourInt = parseInt(hourStr);
                
                // ID CONSTANTE POUR NANTERRE
                const NANTERRE_SECTOR_ID = "WYAjhoUeeikT3mS0hjip";
                const isNanterre = locationId === NANTERRE_SECTOR_ID;

                // CAS A : NANTERRE (Golden Data - Firestore Direct)
                if (isNanterre) {
                    const docId = `${date}_${hourStr}00`;
                    const docRef = doc(db, 'environmental_logs', docId);
                    const snap = await getDoc(docRef);

                    if (snap.exists()) {
                        const d = snap.data() as any;
                        const newSnapshot: FullEnvironmentalSnapshot = {
                            weather: {
                                temperature: d.weather?.temp || 0,
                                pressure: d.weather?.pressure || 0,
                                windSpeed: d.weather?.windSpeed || 0,
                                windDirection: d.weather?.windDir || 0, 
                                precip: d.weather?.precip || 0,
                                clouds: d.weather?.cloudCover || 0, 
                                conditionCode: d.weather?.condition_code || 0
                            },
                            hydro: {
                                flowRaw: d.hydro?.flow || 0,
                                flowLagged: d.computed?.flow_lagged || 0,
                                level: d.hydro?.level || 0,
                                waterTemp: d.hydro?.waterTemp || null,
                                turbidityIdx: d.computed?.turbidity_idx || 0
                            },
                            scores: {
                                sandre: d.computed?.score_sandre || 0,
                                brochet: d.computed?.score_brochet || 0,
                                perche: d.computed?.score_perche || 0
                            },
                            metadata: {
                                sourceLogId: snap.id,
                                calculationDate: d.updatedAt || d.timestamp
                            }
                        };
                        setEnvSnapshot(newSnapshot);
                        setEnvStatus('found');
                    } else {
                        setEnvStatus('not-found');
                    }
                }
                // CAS B : AUTRES SECTEURS (Cloud Function - Historical Context)
                else {
                    const currentLocation = locations.find(l => l.id === locationId);
                    
                    // DEBUG: Vérification des coordonnées
                    console.log("Tentative récupération historique pour:", currentLocation?.label);
                    
                    if (!currentLocation?.coordinates) {
                        console.warn("⚠️ Pas de coordonnées GPS trouvées pour ce secteur:", currentLocation);
                        setEnvStatus('not-found');
                        return;
                    }

                    // CORRECTION: Spécifier la région europe-west1
                    const functions = getFunctions(getApp(), 'europe-west1');
                    const getHistoricalContext = httpsCallable(functions, 'getHistoricalContext');
                    
                    console.log("Appel Cloud Function avec:", {
                        date, hour: hourInt, lat: currentLocation.coordinates.lat, lon: currentLocation.coordinates.lng
                    });

                    const result = await getHistoricalContext({
                        date: date,
                        hour: hourInt,
                        lat: currentLocation.coordinates.lat,
                        lon: currentLocation.coordinates.lng // Attention: 'lng' en front -> 'lon' en back
                    });

                    const data = result.data as FullEnvironmentalSnapshot | null;
                    console.log("Réponse Cloud Function:", data);

                    if (data) {
                        setEnvSnapshot(data);
                        setEnvStatus('simulated'); // Statut distinct pour indiquer que c'est une simulation
                    } else {
                        setEnvStatus('not-found');
                    }
                }

            } catch (error) {
                console.error("Erreur récupération environnement:", error);
                setEnvStatus('not-found');
            } finally {
                setIsLoadingEnv(false);
            }
        };

        const timeoutId = setTimeout(fetchEnv, 800);
        return () => clearTimeout(timeoutId);
    }, [date, startTime, locationId, locations, initialData]); // Ajout de locationId

    const handleDeleteCatch = (id: string) => {
        if (window.confirm("Supprimer cette prise ?")) {
            setCatches(prev => prev.filter(c => c.id !== id));
        }
    };

    const handleDeleteMiss = (id: string) => {
        if (window.confirm("Supprimer ce raté ?")) {
            setMisses(prev => prev.filter(m => m.id !== id));
        }
    };

    const handleSaveCatch = (catchData: any) => {
        if (editingCatch) {
            setCatches(prev => prev.map(c => c.id === editingCatch.id ? { ...catchData, id: c.id } : c));
        } else {
            setCatches(prev => [...prev, { ...catchData, id: Date.now().toString() }]);
        }
        setIsCatchModalOpen(false);
        setEditingCatch(null);
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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const zone = zones.find(z => z.id === spotId);
        const setup = setups.find(s => s.id === setupId);
        const location = locations.find(l => l.id === locationId); // Récupération Location

        const sessionData: any = {
            date, startTime, endTime, 
            
            // SAUVEGARDE LOCATION
            locationId,
            locationName: location?.label || 'Secteur Inconnu',

            spotId,
            spotName: zone?.label || 'Inconnu', 
            
            setupId,
            setupName: setup?.label || 'Inconnu', 
            feelingScore,
            notes, catches, misses, envSnapshot,
            catchCount: catches.length
        };
        if (initialData) {
            onUpdateSession(initialData.id, sessionData);
        } else {
            onAddSession(sessionData as Session);
        }
    };

    return (
        <div className="bg-white rounded-3xl p-6 shadow-xl pb-24">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-stone-800 flex items-center gap-2">
                    {initialData ? <><AlertOctagon className="text-amber-500" /> Éditer Session</> : <><Fish className="text-emerald-500" /> Nouvelle Session</>}
                </h2>
                {initialData && (
                    <button type="button" onClick={() => onUpdateSession(initialData.id, {})} className="p-2 bg-stone-100 rounded-full hover:bg-stone-200">
                        <X size={20} />
                    </button>
                )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                {/* LIGNE 1 : DATE + HEURES (Compactée) */}
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

                {/* LIGNE 2 : SECTEUR + SPOT (Sélecteur Location ajouté) */}
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="text-[9px] font-bold text-stone-400 uppercase tracking-widest mb-1 block">Secteur</label>
                        <select required value={locationId} onChange={e => setLocationId(e.target.value)} className="w-full p-3 bg-stone-50 rounded-xl font-bold text-stone-700 text-sm outline-none focus:ring-2 focus:ring-emerald-100 transition-all">
                            {locations.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                            {locations.length === 0 && <option value="">Aucun secteur</option>}
                        </select>
                    </div>
                    <div>
                        <label className="text-[9px] font-bold text-stone-400 uppercase tracking-widest mb-1 block">Spot</label>
                        <select required value={spotId} onChange={e => setSpotId(e.target.value)} className="w-full p-3 bg-stone-50 rounded-xl font-bold text-stone-700 text-sm outline-none focus:ring-2 focus:ring-emerald-100 transition-all" disabled={filteredSpots.length === 0}>
                            {filteredSpots.map(z => <option key={z.id} value={z.id}>{z.label}</option>)}
                            {filteredSpots.length === 0 && <option value="">Aucun spot ici</option>}
                        </select>
                    </div>
                </div>

                {/* LIGNE 3 : SETUP (Full width pour laisser de la place au texte long) */}
                <div>
                    <label className="text-[9px] font-bold text-stone-400 uppercase tracking-widest mb-1 block">Setup Principal</label>
                    <select required value={setupId} onChange={e => setSetupId(e.target.value)} className="w-full p-3 bg-stone-50 rounded-xl font-bold text-stone-700 text-sm outline-none focus:ring-2 focus:ring-emerald-100 transition-all">
                        {setups.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                </div>

                {/* OBSERVATOIRE (Compacté) */}
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
                            <span className="text-[9px] text-blue-500 font-bold uppercase">Simulé (Hors Nanterre)</span>
                        ) : (
                             <span className="text-[9px] text-stone-300 italic">Non disponible</span>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1">
                        {/* WIDGETS COMPACTS */}
                        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-blue-50 text-blue-900 border border-blue-100 shrink-0 min-w-[70px] justify-center">
                            {envSnapshot ? getWeatherIcon(envSnapshot.weather.clouds) : <Cloud size={14} className="text-blue-300"/>}
                            <span className="text-xs font-bold">{envSnapshot ? `${Math.round(envSnapshot.weather.temperature)}°` : '--'}</span>
                        </div>

                        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-stone-100 text-stone-600 border border-stone-200 shrink-0 min-w-[80px] justify-center">
                            <Wind size={14} className="text-stone-400" />
                            <span className="text-xs font-bold">
                                {envSnapshot ? `${Math.round(envSnapshot.weather.windSpeed)} ${getWindDir(envSnapshot.weather.windDirection)}` : '--'}
                            </span>
                        </div>

                        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-orange-50 text-orange-700 border border-orange-100 shrink-0 min-w-[70px] justify-center">
                            <Thermometer size={14} className="text-orange-500" />
                            <span className="text-xs font-bold">{envSnapshot?.hydro.waterTemp ? `${envSnapshot.hydro.waterTemp.toFixed(1)}°` : '--'}</span>
                        </div>

                        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-cyan-50 text-cyan-700 border border-cyan-100 shrink-0 min-w-[70px] justify-center">
                            <Droplets size={14} className="text-cyan-500" />
                            <span className="text-xs font-bold">
                                {envSnapshot?.hydro.flowRaw ? Math.round(envSnapshot.hydro.flowRaw) : '--'}
                            </span>
                        </div>
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
                sessionStartTime={startTime} 
                sessionEndTime={endTime} 
                sessionDate={date}
                lureTypes={lureTypes}
                colors={colors}
                sizes={sizes}
                weights={weights}
            />
        </div>
    );
};

export default SessionForm;