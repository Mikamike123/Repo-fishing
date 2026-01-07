// hooks/useAppEngine.ts - Version 5.4.0 (Onboarding Support)
import { useState, useEffect, useMemo } from 'react';
import { 
    onSnapshot, query, orderBy, 
    addDoc, deleteDoc, doc, Timestamp, updateDoc, collection, getDoc 
} from 'firebase/firestore'; 
import { onAuthStateChanged, signInWithPopup, signOut, User as FirebaseUser } from 'firebase/auth';
import { db, sessionsCollection, auth, googleProvider, clearChatHistory } from '../lib/firebase'; 
import { getUserProfile, createUserProfile } from '../lib/user-service'; // Michael : Assure-toi que createUserProfile est bien exporté
import { useArsenal } from '../lib/useArsenal'; 
import { getOrFetchOracleData, cleanupOracleCache } from '../lib/oracle-service'; 
import { Session, UserProfile, WeatherSnapshot, OracleDataPoint } from '../types';

export const useAppEngine = () => {
    const [user, setUser] = useState<FirebaseUser | null>(null);
    const [isWhitelisted, setIsWhitelisted] = useState<boolean | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [themeMode, setThemeMode] = useState<'light' | 'night' | 'auto'>('auto'); 
    const [isActuallyNight, setIsActuallyNight] = useState(false);
    const [lastSyncTimestamp, setLastSyncTimestamp] = useState<number>(Date.now());
    const [lastCoachLocationId, setLastCoachLocationId] = useState<string>("");
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    const [currentView, setCurrentView] = useState<any>('dashboard'); 
    const [sessions, setSessions] = useState<Session[]>([]); 
    const [activeDashboardTab, setActiveDashboardTab] = useState<'live' | 'tactics' | 'activity' | 'experience'>('live');
    const [isLoading, setIsLoading] = useState(true); 
    const [editingSession, setEditingSession] = useState<Session | null>(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [magicDraft, setMagicDraft] = useState<any>(null);
    const [targetLocationId, setTargetLocationId] = useState<string | null>(null);

    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [isProfileLoading, setIsProfileLoading] = useState(true);
    const [firestoreError, setFirestoreError] = useState<string | null>(null); 
    const [activeLocationId, setActiveLocationId] = useState<string>("");
    const [oraclePoints, setOraclePoints] = useState<OracleDataPoint[]>([]);
    const [isOracleLoading, setIsOracleLoading] = useState(false);
    const [displayedWeather, setDisplayedWeather] = useState<WeatherSnapshot | null>(null);
    const [isWeatherLoading, setIsWeatherLoading] = useState(false);

    const currentUserId = user?.uid || "guest"; 

    const triggerHaptic = (pattern = [30, 50, 30]) => {
        if (window.navigator && window.navigator.vibrate) window.navigator.vibrate(pattern);
    };

    useEffect(() => {
        const checkTheme = () => {
            if (themeMode === 'auto') {
                const hour = new Date().getHours();
                setIsActuallyNight(hour >= 19 || hour <= 7);
            } else { setIsActuallyNight(themeMode === 'night'); }
        };
        checkTheme();
        const interval = setInterval(checkTheme, 60000);
        return () => clearInterval(interval);
    }, [themeMode]);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            setAuthLoading(true);
            if (firebaseUser?.email) {
                const normalizedEmail = firebaseUser.email.toLowerCase().trim();
                try {
                    const whitelistDoc = await getDoc(doc(db, 'authorized_users', normalizedEmail));
                    if (whitelistDoc.exists()) { 
                        setUser(firebaseUser); 
                        setIsWhitelisted(true); 
                    } else { 
                        setIsWhitelisted(false); 
                    }
                } catch (error) {
                    console.error("🔥 Erreur Whitelist:", error);
                    setIsWhitelisted(false);
                }
            } else { 
                setUser(null); 
                setIsWhitelisted(null); 
            }
            setAuthLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const { arsenalData, handleAddItem, handleDeleteItem, handleEditItem, handleMoveItem, handleToggleLocationFavorite } = useArsenal(currentUserId);

    const handleResetCollection = async (collectionName: string, defaultItems: any[], currentItems: any[]) => {
        try {
            const deletePromises = currentItems.map(item => deleteDoc(doc(db, collectionName, item.id)));
            await Promise.all(deletePromises);
            for (const item of defaultItems) {
                await addDoc(collection(db, collectionName), {
                    label: item.label, displayOrder: item.displayOrder || 0,
                    userId: currentUserId, active: true, createdAt: Timestamp.now()
                });
            }
        } catch (e) { console.error(`Erreur Reset Michael :`, e); }
    };

    const mySessions = useMemo(() => sessions.filter(s => s.userId === currentUserId), [sessions, currentUserId]);
    const lastCatchDefaults = useMemo(() => (mySessions[0]?.catches?.length ? mySessions[0].catches[mySessions[0].catches.length - 1] : null), [mySessions]);

    const defaultLocationId = useMemo(() => {
        const fav = arsenalData.locations.find(l => l.isFavorite);
        return fav ? fav.id : (arsenalData.locations[0]?.id || "");
    }, [arsenalData.locations]);

    useEffect(() => {
        if (!activeLocationId && defaultLocationId) setActiveLocationId(defaultLocationId);
    }, [defaultLocationId, activeLocationId]);

    const activeLocation = useMemo(() => arsenalData.locations.find(l => l.id === activeLocationId), [arsenalData.locations, activeLocationId]);

    const liveOraclePoint = useMemo(() => {
        if (!oraclePoints.length) return null;
        const nowTs = Date.now();
        return oraclePoints.reduce((prev, curr) => Math.abs(curr.timestamp - nowTs) < Math.abs(prev.timestamp - nowTs) ? curr : prev);
    }, [oraclePoints]);

    const currentLiveSnapshot = useMemo(() => {
        if (!activeLocation || !liveOraclePoint || !displayedWeather) return null;
        return {
            locationName: activeLocation.label, userName: userProfile?.pseudo || "Pêcheur",
            coordinates: activeLocation.coordinates, 
            env: {
                hydro: { 
                    waterTemp: liveOraclePoint.waterTemp, turbidityNTU: liveOraclePoint.turbidityNTU,
                    dissolvedOxygen: liveOraclePoint.dissolvedOxygen, waveHeight: liveOraclePoint.waveHeight,
                    flowRaw: liveOraclePoint.flowRaw, level: 0, flowLagged: 0, turbidityIdx: 0
                },
                weather: displayedWeather 
            },
            scores: {
                sandre: liveOraclePoint.sandre, brochet: liveOraclePoint.brochet, perche: liveOraclePoint.perche, blackbass: liveOraclePoint.blackbass
            }
        };
    }, [activeLocation, liveOraclePoint, displayedWeather, userProfile]);

    useEffect(() => {
        const syncEnvironment = async () => {
            if (!activeLocation?.coordinates) return;
            setIsOracleLoading(true); setIsWeatherLoading(true);
            try {
                const points = await getOrFetchOracleData(activeLocation.coordinates.lat, activeLocation.coordinates.lng, activeLocation.id, activeLocation.morphology);
                setOraclePoints(points);
                setLastSyncTimestamp(Date.now()); 
                if (points.length > 0) {
                    const nowTs = Date.now();
                    const livePoint = points.reduce((prev, curr) => Math.abs(curr.timestamp - nowTs) < Math.abs(prev.timestamp - nowTs) ? curr : prev);
                    setDisplayedWeather({
                        temperature: livePoint.airTemp, pressure: livePoint.pressure, clouds: livePoint.clouds,
                        windSpeed: livePoint.windSpeed, windDirection: livePoint.windDirection, precip: livePoint.precip, conditionCode: livePoint.conditionCode
                    } as WeatherSnapshot);
                }
            } catch (err) { console.error("Sync Error:", err); } 
            finally { setIsOracleLoading(false); setIsWeatherLoading(false); }
        };
        syncEnvironment();
        const interval = setInterval(syncEnvironment, 30 * 60 * 1000);
        return () => clearInterval(interval);
    }, [activeLocationId, activeLocation]);

    useEffect(() => {
        if (activeLocationId && lastCoachLocationId && activeLocationId !== lastCoachLocationId) {
            clearChatHistory(currentUserId);
            setLastCoachLocationId(activeLocationId);
        } else if (activeLocationId && !lastCoachLocationId) {
            setLastCoachLocationId(activeLocationId);
        }
    }, [activeLocationId, lastCoachLocationId, currentUserId]);

    useEffect(() => {
        if (!user || !isWhitelisted) return;
        setIsProfileLoading(true);
        setFirestoreError(null); 
        
        const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as UserProfile;
                setUserProfile({ ...data, id: docSnap.id }); 
                if ((data as any).themePreference) setThemeMode((data as any).themePreference);
                setFirestoreError(null); // Michael : On nettoie l'erreur si le doc apparaît
            } else {
                setFirestoreError("DOC_NOT_FOUND");
            }
            setIsProfileLoading(false);
        }, (err) => {
            setFirestoreError(err.message); 
            setIsProfileLoading(false);
        });
        return () => unsubscribe();
    }, [user, isWhitelisted]);

    useEffect(() => {
        if (firestoreError === "DOC_NOT_FOUND") {
            setCurrentView('profile');
        }
    }, [firestoreError]);

    // Michael : Nouveau handler pour créer le profil depuis l'UI Onboarding
    const handleCreateProfile = async (pseudo: string) => {
        if (!user) return;
        try {
            triggerHaptic([50, 50, 50]);
            await createUserProfile(user.uid, pseudo);
            // Le onSnapshot s'occupera de mettre à jour userProfile automatiquement
            setCurrentView('dashboard');
        } catch (e) {
            console.error("Erreur création profil Michael :", e);
        }
    };

    useEffect(() => {
        if (!user || !isWhitelisted) return;
        const q = query(sessionsCollection, orderBy('date', 'desc')); 
        const unsubscribeSessions = onSnapshot(q, (snapshot) => {
            const fetched = snapshot.docs.map(doc => {
                const data = doc.data();
                let dateString = data.date instanceof Timestamp ? data.date.toDate().toISOString().split('T')[0] : data.date;
                return { id: doc.id, ...data, date: dateString } as Session;
            });
            setSessions(fetched); setIsLoading(false);
        }, (err) => console.error("🔥 Erreur Sessions:", err.message));
        return () => unsubscribeSessions();
    }, [user, isWhitelisted]);

    const handleSaveSession = async (session: Session) => {
        triggerHaptic();
        if (session.id) {
            const { date, id, ...data } = session;
            await updateDoc(doc(db, 'sessions', id), { ...data, date: Timestamp.fromDate(new Date(date as string)) });
            setEditingSession(null); setCurrentView('history');
        } else {
            const { id, date, ...dataToSave } = session;
            await addDoc(collection(db, 'sessions'), { ...dataToSave, date: Timestamp.fromDate(new Date(date as string)), userId: currentUserId, userPseudo: userProfile?.pseudo || 'Inconnu', userAvatar: userProfile?.avatarBase64 || null, createdAt: Timestamp.now(), active: true });
            setMagicDraft(null); setCurrentView('dashboard');
        }
    };

    const handleConsumeLevelUp = async (goToExperience: boolean) => {
        if (!userProfile) return;
        try {
            await updateDoc(doc(db, 'users', currentUserId), { pendingLevelUp: false });
            if (goToExperience) { setActiveDashboardTab('experience'); setCurrentView('dashboard'); }
        } catch (e) { console.error("Error level notification :", e); }
    };

    const navigateFromMenu = (view: any) => { 
        triggerHaptic([10]);
        setEditingSession(null); setMagicDraft(null); setCurrentView(view); setIsMenuOpen(false); 
    };

    return {
        user, authLoading, isActuallyNight, themeMode, lastSyncTimestamp, currentUserId,
        currentView, setCurrentView, sessions, activeDashboardTab, setActiveDashboardTab,
        editingSession, setEditingSession, isMenuOpen, setIsMenuOpen, magicDraft, setMagicDraft,
        userProfile, setUserProfile, activeLocationId, setActiveLocationId, oraclePoints,
        isOracleLoading: isOracleLoading || isWeatherLoading, activeLocation, arsenalData, displayedWeather,
        isOnline, triggerHaptic, isWhitelisted, firestoreError, handleCreateProfile,
        handleLogin: () => signInWithPopup(auth, googleProvider),
        handleLogout: () => { signOut(auth); setCurrentView('dashboard'); setIsMenuOpen(false); },
        handleSaveSession, handleEditRequest: (s: Session) => { setEditingSession(s); setCurrentView('session'); },
        handleDeleteSession: async (id: string) => { await deleteDoc(doc(db, 'sessions', id)); },
        handleMagicDiscovery: (d: any) => { triggerHaptic([50, 20, 50]); setMagicDraft(d); setCurrentView('session'); },
        handleAddItem, handleDeleteItem, handleEditItem, handleMoveItem, handleToggleLocationFavorite,
        targetLocationId, setTargetLocationId, lastCatchDefaults, currentLiveSnapshot, handleConsumeLevelUp, navigateFromMenu, handleResetCollection
    };
};