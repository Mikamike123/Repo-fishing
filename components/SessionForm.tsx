// components/SessionForm.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { 
    Session, Zone, Setup, Technique, Catch, Miss, Lure, 
    RefLureType, RefColor, RefSize, RefWeight, FullEnvironmentalSnapshot, Location, BioScoreSnapshot 
} from '../types';
import { doc, getDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions'; 
import { getApp } from 'firebase/app';
import { db } from '../lib/firebase';
import { fetchHistoricalWeatherContext } from '../lib/universal-weather-service';

import SessionFormUI from './SessionFormUI';

interface SessionFormProps {
    onAddSession: (session: Session) => void;
    onUpdateSession: (id: string, data: Partial<Session>) => void;
    initialData?: Session | null;
    initialDiscovery?: { date: string, startTime: string, endTime: string, initialCatch: Catch } | null;
    zones: Zone[];
    setups: Setup[];
    techniques: Technique[];
    lures: Lure[];
    lureTypes: RefLureType[];
    colors: RefColor[];
    sizes: RefSize[];
    weights: RefWeight[];
    lastCatchDefaults?: Catch | null;
    locations: Location[];
    defaultLocationId: string;
}

const SessionForm: React.FC<SessionFormProps> = (props) => {
    const { initialData, initialDiscovery, zones, setups, locations, defaultLocationId, onUpdateSession, onAddSession } = props;

    const [date, setDate] = useState(initialData?.date || initialDiscovery?.date || new Date().toISOString().split('T')[0]);
    const [startTime, setStartTime] = useState(initialData?.startTime || initialDiscovery?.startTime || "08:00");
    const [endTime, setEndTime] = useState(initialData?.endTime || initialDiscovery?.endTime || "11:00");
    const [locationId, setLocationId] = useState<string>(initialData?.locationId || defaultLocationId || (locations[0]?.id || ''));
    const [setupId, setSetupId] = useState(initialData?.setupId || (setups[0]?.id || ''));
    const [feelingScore, setFeelingScore] = useState(initialData?.feelingScore || 5);
    const [notes, setNotes] = useState(initialData?.notes || ''); 
    const [catches, setCatches] = useState<Catch[]>(initialData?.catches || (initialDiscovery?.initialCatch ? [initialDiscovery.initialCatch] : []));
    const [misses, setMisses] = useState<Miss[]>(initialData?.misses || []);

    const [envSnapshot, setEnvSnapshot] = useState<FullEnvironmentalSnapshot | null>(initialData?.envSnapshot || null);
    const [isLoadingEnv, setIsLoadingEnv] = useState(false);
    const [envStatus, setEnvStatus] = useState<'idle' | 'found' | 'not-found' | 'simulated'>('idle');

    const [isCatchModalOpen, setIsCatchModalOpen] = useState(false);
    const [isMissModalOpen, setIsMissModalOpen] = useState(false);
    const [editingCatch, setEditingCatch] = useState<Catch | null>(null);
    const [editingMiss, setEditingMiss] = useState<Miss | null>(null);

    const filteredSpots = useMemo(() => {
        if (!locationId) return [];
        return zones.filter(z => z.locationId === locationId);
    }, [zones, locationId]);

    const [spotId, setSpotId] = useState<string>(() => {
        if (initialData?.spotId) return initialData.spotId;
        return filteredSpots.length > 0 ? filteredSpots[0].id : '';
    });

    useEffect(() => {
        const isValid = zones.find(z => z.id === spotId && z.locationId === locationId);
        if (!isValid) {
            setSpotId(filteredSpots.length > 0 ? filteredSpots[0].id : '');
        }
    }, [locationId, filteredSpots, zones, spotId]);

    // --- LOGIQUE D'ACQUISITION ENVIRONNEMENTALE ---
    useEffect(() => {
        if (!locationId || locations.length === 0) return;

        if (initialData && envStatus === 'idle' && initialData.envSnapshot && 
            date === initialData.date && startTime === initialData.startTime && locationId === initialData.locationId) {
            setEnvStatus('found');
            return;
        }

        const fetchEnv = async () => {
            setIsLoadingEnv(true);
            setEnvStatus('idle');
            setEnvSnapshot(null);

            try {
                const hourStr = startTime.split(':')[0];
                const NANTERRE_SECTOR_ID = "WYAjhoUeeikT3mS0hjip";
                const isNanterre = locationId === NANTERRE_SECTOR_ID;

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
                                perche: d.computed?.score_perche || 0,
                                blackbass: d.computed?.score_blackbass || 0
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
                } else {
                    const currentLocation = locations.find(l => l.id === locationId);
                    if (!currentLocation?.coordinates?.lat || !currentLocation?.coordinates?.lng) {
                        setEnvStatus('not-found');
                        return;
                    }

                    const weatherContext = await fetchHistoricalWeatherContext(
                        currentLocation.coordinates.lat,
                        currentLocation.coordinates.lng,
                        date
                    );

                    if (!weatherContext) {
                        setEnvStatus('not-found');
                        return;
                    }

                    const functions = getFunctions(getApp(), 'europe-west1');
                    const getHistoricalContext = httpsCallable(functions, 'getHistoricalContext');

                    const result = await getHistoricalContext({
                        weather: weatherContext.snapshot,
                        weatherHistory: weatherContext.history,
                        location: currentLocation,
                        dateStr: date
                    });

                    const cloudData = result.data as any;

                    if (cloudData) {
                        const newSnapshot: FullEnvironmentalSnapshot = {
                            weather: { ...weatherContext.snapshot },
                            hydro: {
                                flowRaw: 0,
                                flowLagged: 0,
                                level: 0,
                                waterTemp: cloudData.waterTemp,
                                turbidityIdx: cloudData.turbidityNTU / 80 
                            },
                            scores: cloudData.scores,
                            metadata: {
                                sourceLogId: 'gold_standard_simulated',
                                calculationDate: new Date().toISOString()
                            }
                        };
                        setEnvSnapshot(newSnapshot);
                        setEnvStatus('simulated');
                    } else {
                        setEnvStatus('not-found');
                    }
                }
            } catch (error) {
                console.error("Erreur environnement :", error);
                setEnvStatus('not-found');
            } finally {
                setIsLoadingEnv(false);
            }
        };

        const timeoutId = setTimeout(fetchEnv, 800);
        return () => clearTimeout(timeoutId);
    }, [date, startTime, locationId, locations, initialData]);

    // --- HANDLERS ---
    const handleDeleteCatch = (id: string) => {
            setCatches(prev => prev.filter(c => c.id !== id));
    };

    const handleDeleteMiss = (id: string) => {
            setMisses(prev => prev.filter(m => m.id !== id));
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
        const location = locations.find(l => l.id === locationId);
        const speciesIds = location?.speciesIds || [];

        // --- FILTRAGE DES BIOSCORES MICHAEL ---
        // On ne garde que les scores correspondant aux espèces du secteur
        let filteredSnapshot = envSnapshot ? { ...envSnapshot } : null;
        
        if (filteredSnapshot && speciesIds.length > 0) {
            const cleanedScores: Partial<BioScoreSnapshot> = {};
            
            speciesIds.forEach(speciesName => {
                // Mapping des noms (Brochet -> brochet, Black-Bass -> blackbass)
                const key = speciesName.toLowerCase().replace('-', '') as keyof BioScoreSnapshot;
                if (envSnapshot?.scores[key] !== undefined) {
                    (cleanedScores as any)[key] = envSnapshot.scores[key];
                }
            });
            
            filteredSnapshot.scores = cleanedScores as BioScoreSnapshot;
        }

        const sessionData: any = {
            date, startTime, endTime, 
            locationId,
            locationName: location?.label || 'Secteur Inconnu',
            speciesIds: speciesIds, // Crucial pour le rendu de SessionCard
            spotId,
            spotName: zone?.label || 'Inconnu', 
            setupId,
            setupName: setup?.label || 'Inconnu', 
            feelingScore,
            notes, catches, misses, 
            envSnapshot: filteredSnapshot, // On enregistre la version filtrée
            catchCount: catches.length
        };

        if (initialData) {
            onUpdateSession(initialData.id, sessionData);
        } else {
            onAddSession(sessionData as Session);
        }
    };

    return (
        <SessionFormUI 
            {...props}
            date={date} setDate={setDate}
            startTime={startTime} setStartTime={setStartTime}
            endTime={endTime} setEndTime={setEndTime}
            locationId={locationId} setLocationId={setLocationId}
            filteredSpots={filteredSpots}
            spotId={spotId} setSpotId={setSpotId}
            setupId={setupId} setSetupId={setSetupId}
            feelingScore={feelingScore} setFeelingScore={setFeelingScore}
            notes={notes} setNotes={setNotes}
            catches={catches} misses={misses}
            envSnapshot={envSnapshot}
            isLoadingEnv={isLoadingEnv}
            envStatus={envStatus}
            isCatchModalOpen={isCatchModalOpen} setIsCatchModalOpen={setIsCatchModalOpen}
            isMissModalOpen={isMissModalOpen} setIsMissModalOpen={setIsMissModalOpen}
            editingCatch={editingCatch} setEditingCatch={setEditingCatch}
            editingMiss={editingMiss} setEditingMiss={setEditingMiss}
            handleDeleteCatch={handleDeleteCatch}
            handleDeleteMiss={handleDeleteMiss}
            handleSaveCatch={handleSaveCatch}
            handleSaveMiss={handleSaveMiss}
            handleSubmit={handleSubmit}
        />
    );
};

export default SessionForm;