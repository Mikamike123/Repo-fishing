// hooks/useAppEngine.ts - Version 12.0.0 (Stateless Notification Hub)
import { useState, useEffect, useMemo } from 'react';
import { 
    onSnapshot, query, orderBy, 
    addDoc, deleteDoc, doc, Timestamp, updateDoc, collection, getDoc, arrayUnion 
} from 'firebase/firestore'; 
import { onAuthStateChanged, signInWithPopup, signOut, User as FirebaseUser } from 'firebase/auth';
import { db, sessionsCollection, auth, googleProvider, clearChatHistory } from '../lib/firebase'; 
import { getUserProfile, createUserProfile } from '../lib/user-service'; 
import { useArsenal } from '../lib/useArsenal'; 
import { getOrFetchOracleData, cleanupOracleCache } from '../lib/oracle-service'; 
import { Session, UserProfile, WeatherSnapshot, OracleDataPoint } from '../types';

export const useAppEngine = () => {
    const [user, setUser] = useState<FirebaseUser | null>(null);
    const [isWhitelisted, setIsWhitelisted] = useState<boolean | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [themeMode, setThemeMode] = useState<'light' | 'night' | 'auto'>('auto'); 
    const [isActuallyNight, setIsActuallyNight] = useState(false);
    
    const [lastSyncTimestamp, setLastSyncTimestamp] = useState<number>(0);
    const [lastCoachLocationId, setLastCoachLocationId] = useState<string>("");
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    const [currentView, setCurrentView] = useState<any>('dashboard'); 
    const [sessions, setSessions] = useState<Session[]>([]); 
    
    const [activeDashboardTab, setActiveDashboardTab] = useState<'live' | 'tactics' | 'experience'>('live');
    
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

    const [usersRegistry, setUsersRegistry] = useState<Record<string, UserProfile>>({});
    const [lastSavedSessionId, setLastSavedSessionId] = useState<string | null>(null);

    const currentUserId = user?.uid || "guest"; 

    const triggerHaptic = (pattern = [30, 50, 30]) => {
        if (window.navigator && window.navigator.vibrate) window.navigator.vibrate(pattern);
    };

    // --- LOGIQUE DE NOTIFICATION STATELESS (Pastille avec chiffre) ---
    const unreadFeedCount = useMemo(() => {
        if (!sessions.length || currentUserId === "guest") return 0;
        
        // Michael : On ne regarde que les 20 sessions les plus récentes pour ne pas noyer un nouvel utilisateur
        const recentSessions = sessions.slice(0, 20);
        
        return recentSessions.filter(s => {
            const isRead = s.readBy?.includes(currentUserId);
            const isHidden = s.hiddenBy?.includes(currentUserId);
            return !isRead && !isHidden;
        }).length;
    }, [sessions, currentUserId]);

    const handleMarkSessionAsRead = async (sessionId: string) => {
        if (currentUserId === "guest") return;
        try {
            const sessionRef = doc(db, 'sessions', sessionId);
            await updateDoc(sessionRef, {
                readBy: arrayUnion(currentUserId)
            });
        } catch (e) { console.error("Erreur lecture session Firestore:", e); }
    };

    const handleHideSessionFromFeed = async (sessionId: string) => {
        if (currentUserId === "guest") return;
        try {
            triggerHaptic([40]);
            const sessionRef = doc(db, 'sessions', sessionId);
            await updateDoc(sessionRef, {
                hiddenBy: arrayUnion(currentUserId)
            });
        } catch (e) { console.error("Erreur purge session Firestore:", e); }
    };

    // --- LOGIQUE DU REGISTRE ---
    useEffect(() => {
        if (!sessions.length) return;
        const fetchMissingProfiles = async () => {
            const uniqueUserIds = Array.from(new Set(sessions.map(s => s.userId)));
            const missingIds = uniqueUserIds.filter(id => 
                id !== currentUserId && id !== "guest" && !usersRegistry[id]
            );
            if (missingIds.length === 0) return;
            const fetchedEntries: Record<string, UserProfile> = {};
            let hasUpdates = false;
            for (const id of missingIds) {
                try {
                    const profile = await getUserProfile(id);
                    if (profile) { fetchedEntries[id] = profile; hasUpdates = true; }
                } catch (e) { console.error(`Erreur registre ID ${id}:`, e); }
            }
            if (hasUpdates) { setUsersRegistry(prev => ({ ...prev, ...fetchedEntries })); }
        };
        fetchMissingProfiles();
    }, [sessions, currentUserId, usersRegistry]);

    // --- GESTION THEME & RESEAU ---
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

    // --- AUTH & WHITELIST ---
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
                    } else { setIsWhitelisted(false); }
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

    useEffect(() => {
        if (activeLocation?.lastSnapshot) {
            setDisplayedWeather(activeLocation.lastSnapshot.weather);
            const snapDate = new Date(activeLocation.lastSnapshot.metadata.calculationDate).getTime();
            setLastSyncTimestamp(snapDate);
        }
    }, [activeLocationId, activeLocation?.lastSnapshot]);

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
            const hasExistingData = oraclePoints.length > 0 || activeLocation.lastSnapshot;
            if (!hasExistingData) { setIsOracleLoading(true); setIsWeatherLoading(true); }
            try {
                const { points, snapshot } = await getOrFetchOracleData(
                    activeLocation.coordinates.lat, activeLocation.coordinates.lng, 
                    activeLocation.id, activeLocation.morphology
                );
                setOraclePoints(points);
                if (snapshot) {
                    setDisplayedWeather(snapshot.weather);
                    const snapDate = new Date(snapshot.metadata.calculationDate).getTime();
                    setLastSyncTimestamp(snapDate);
                    if (Date.now() - snapDate < 60000 && activeLocation.id) {
                         await updateDoc(doc(db, 'locations', activeLocation.id), {
                            lastSnapshot: snapshot,
                            lastCalculatedTemp: snapshot.hydro.waterTemp,
                            lastSyncDate: snapshot.metadata.calculationDate
                        });
                    }
                }
            } catch (err) { console.error("🔥 Sync Error:", err); }
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

    // --- PROFILE SYNC ---
    useEffect(() => {
        if (!user || !isWhitelisted) return;
        setIsProfileLoading(true);
        setFirestoreError(null); 
        const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as UserProfile;
                setUserProfile({ ...data, id: docSnap.id }); 
                if ((data as any).themePreference) setThemeMode((data as any).themePreference);
                setFirestoreError(null); 
            } else { setFirestoreError("DOC_NOT_FOUND"); }
            setIsProfileLoading(false);
        }, (err) => {
            setFirestoreError(err.message); setIsProfileLoading(false);
        });
        return () => unsubscribe();
    }, [user, isWhitelisted]);

    useEffect(() => {
        if (firestoreError === "DOC_NOT_FOUND") { setCurrentView('profile'); }
    }, [firestoreError]);

    const handleCreateProfile = async (pseudo: string) => {
        if (!user) return;
        try {
            triggerHaptic([50, 50, 50]);
            await createUserProfile(user.uid, pseudo);
            setCurrentView('dashboard');
        } catch (e) { console.error("Erreur création profil Michael :", e); }
    };

    // --- SESSIONS SNAPSHOT ---
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
        let savedId = session.id;
        if (session.id) {
            const { date, id, ...data } = session;
            await updateDoc(doc(db, 'sessions', id), { ...data, date: Timestamp.fromDate(new Date(date as string)) });
            setEditingSession(null); 
        } else {
            const { id, date, ...dataToSave } = session;
            const docRef = await addDoc(collection(db, 'sessions'), { 
                ...dataToSave, 
                date: Timestamp.fromDate(new Date(date as string)), 
                userId: currentUserId, 
                userPseudo: userProfile?.pseudo || 'Michael', 
                createdAt: Timestamp.now(), 
                active: true,
                readBy: [currentUserId], // Michael : L'auteur a déjà lu sa session
                hiddenBy: []
            });
            savedId = docRef.id;
            setMagicDraft(null); 
        }
        setLastSavedSessionId(savedId || null);
        setCurrentView('history');
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
        usersRegistry, lastSavedSessionId, setLastSavedSessionId,
        unreadFeedCount, // Michael : Nouveau compteur dynamique stateless
        hasNewMenuContent: false, 
        handleLogin: () => signInWithPopup(auth, googleProvider),
        handleLogout: () => { signOut(auth); setCurrentView('dashboard'); setIsMenuOpen(false); },
        handleSaveSession, handleEditRequest: (s: Session) => { setEditingSession(s); setCurrentView('session'); },
        handleDeleteSession: async (id: string) => { await deleteDoc(doc(db, 'sessions', id)); },
        handleMagicDiscovery: (d: any) => { triggerHaptic([50, 20, 50]); setMagicDraft(d); setCurrentView('session'); },
        handleAddItem, handleDeleteItem, handleEditItem, handleMoveItem, handleToggleLocationFavorite,
        targetLocationId, setTargetLocationId, lastCatchDefaults, currentLiveSnapshot, handleConsumeLevelUp, 
        navigateFromMenu, handleResetCollection,
        handleMarkSessionAsRead, handleHideSessionFromFeed
    };
};