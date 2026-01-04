// components/SessionForm.tsx - Version 4.8.10 (Form Ergonomics & Capot Express)
import React, { useState, useEffect, useMemo } from 'react';
import { 
    Session, Zone, Setup, Technique, Catch, Miss, Lure, 
    RefLureType, RefColor, RefSize, RefWeight, FullEnvironmentalSnapshot, Location, BioScoreSnapshot 
} from '../types';
import { getFunctions, httpsCallable } from 'firebase/functions'; 
import { getApp } from 'firebase/app';
import { fetchHistoricalWeatherContext } from '../lib/universal-weather-service';

import SessionFormUI from './SessionFormUI';

interface SessionFormProps {
    onAddSession: (session: Session) => void;
    onUpdateSession: (id: string, data: Partial<Session>) => void;
    onCancel?: () => void; // Michael : Ajout de la prop d'annulation
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
    currentUserId: string;
}

const SessionForm: React.FC<SessionFormProps> = (props) => {
    const { initialData, initialDiscovery, zones, setups, locations, defaultLocationId, onUpdateSession, onAddSession, onCancel } = props;

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

    const calculateSessionMidpoint = (dateStr: string, start: string, end: string): string => {
        try {
            const d = new Date(dateStr);
            const [h1, m1] = start.split(':').map(Number);
            const [h2, m2] = end.split(':').map(Number);
            const startMin = h1 * 60 + m1;
            const endMin = h2 * 60 + m2;
            const midMin = Math.round((startMin + endMin) / 2);
            const midH = Math.floor(midMin / 60);
            const midM = midMin % 60;
            d.setHours(midH, midM, 0, 0);
            return d.toISOString();
        } catch (e) {
            return new Date(dateStr).toISOString();
        }
    };

    useEffect(() => {
        if (!locationId || locations.length === 0) return;

        if (initialData && initialData.envSnapshot && 
            date === initialData.date && startTime === initialData.startTime && locationId === initialData.locationId) {
            setEnvSnapshot(initialData.envSnapshot);
            setEnvStatus('found');
            return;
        }

        const fetchEnv = async () => {
            setIsLoadingEnv(true);
            try {
                const currentLocation = locations.find(l => l.id === locationId);
                if (!currentLocation?.coordinates?.lat || !currentLocation?.coordinates?.lng) {
                    setEnvStatus('not-found');
                    return;
                }
                const preciseIsoDate = calculateSessionMidpoint(date, startTime, endTime);
                const weatherContext = await fetchHistoricalWeatherContext(
                    currentLocation.coordinates.lat,
                    currentLocation.coordinates.lng,
                    preciseIsoDate
                );

                if (!weatherContext) {
                    setEnvStatus('not-found');
                    return;
                }

                const functionsInstance = getFunctions(getApp(), 'europe-west1');
                const getHistoricalContext = httpsCallable(functionsInstance, 'getHistoricalContext');
                const result = await getHistoricalContext({
                    weather: weatherContext.snapshot,
                    weatherHistory: weatherContext.history,
                    location: currentLocation,
                    dateStr: preciseIsoDate
                });

                const cloudData = result.data as any;

                if (cloudData) {
                    const newSnapshot: FullEnvironmentalSnapshot = {
                        weather: { ...weatherContext.snapshot },
                        hydro: { ...cloudData.hydro },
                        scores: cloudData.scores,
                        metadata: {
                            ...cloudData.metadata,
                            sourceLogId: cloudData.metadata?.sourceLogId || 'ultreia_live_simulation'
                        }
                    };
                    setEnvSnapshot(newSnapshot);
                    setEnvStatus('simulated');
                } else {
                    setEnvStatus('not-found');
                }
            } catch (error) {
                console.error("Erreur environnement Michael :", error);
                setEnvStatus('not-found');
            } finally {
                setIsLoadingEnv(false);
            }
        };

        const timeoutId = setTimeout(fetchEnv, 800);
        return () => clearTimeout(timeoutId);
    }, [date, startTime, endTime, locationId, locations, initialData]);

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

        let filteredSnapshot = envSnapshot ? JSON.parse(JSON.stringify(envSnapshot)) : null;

        if (filteredSnapshot && speciesIds.length > 0) {
            const cleanedScores: Partial<BioScoreSnapshot> = {};
            const speciesMap: Record<string, keyof BioScoreSnapshot> = {
                'Sandre': 'sandre', 'Brochet': 'brochet', 'Perche': 'perche', 'Black-Bass': 'blackbass'
            };

            speciesIds.forEach(speciesName => {
                const key = speciesMap[speciesName];
                if (key && envSnapshot?.scores[key] !== undefined) {
                    (cleanedScores as any)[key] = envSnapshot.scores[key];
                }
            });
            filteredSnapshot.scores = cleanedScores as BioScoreSnapshot;
        }

        const sessionData: any = {
            date, startTime, endTime, 
            locationId,
            locationName: location?.label || 'Secteur Inconnu',
            speciesIds: speciesIds,
            spotId,
            spotName: zone?.label || 'Inconnu', 
            setupId,
            setupName: setup?.label || 'Inconnu', 
            feelingScore,
            notes, catches, misses, 
            envSnapshot: filteredSnapshot,
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
            onCancel={onCancel} // Michael : Transmission de l'action d'annulation
            userId={props.currentUserId}
        />
    );
};

export default SessionForm;