// App.tsx - Version 4.8.23 (Coach Persistence Logic & Multi-Prop Fix)
import React, { useState, useEffect, useMemo } from 'react'; 
import { Home, PlusCircle, ScrollText, Fish, Bot, User, Menu, X, ChevronRight, MapPin, Anchor, ShieldAlert, LogOut, PartyPopper, Sparkles, WifiOff, Moon, Sun } from 'lucide-react';
import { 
    onSnapshot, query, orderBy, 
    QuerySnapshot, DocumentData, 
    addDoc, deleteDoc, doc, Timestamp, updateDoc, collection, getDoc 
} from 'firebase/firestore'; 
import { onAuthStateChanged, signInWithPopup, signOut, User as FirebaseUser } from 'firebase/auth';

import SessionForm from './components/SessionForm';
import Dashboard from './components/Dashboard';
import HistoryView from './components/HistoryView';
import ArsenalView from './components/ArsenalView';
import CoachView from './components/CoachView'; 
import ProfileView from './components/ProfileView';
import MagicScanButton from './components/MagicScanButton';
import LocationsManager from './components/LocationsManager'; 

// Michael : OracleDataPoint est désormais importé depuis types.ts pour la cohérence globale
import { Session, UserProfile, Catch, WeatherSnapshot, Location, OracleDataPoint } from './types'; 
// Michael : Import de clearChatHistory pour le reset intelligent
import { db, sessionsCollection, auth, googleProvider, clearChatHistory } from './lib/firebase'; 
import { getUserProfile, createUserProfile } from './lib/user-service';
import { useArsenal } from './lib/useArsenal'; 

// Michael : Import de la fonction avec cache (getOrFetchOracleData) et du ménage
import { getOrFetchOracleData, cleanupOracleCache } from './lib/oracle-service'; 

type View = 'dashboard' | 'session' | 'history' | 'arsenal' | 'coach' | 'profile' | 'locations';
type ThemeMode = 'light' | 'night' | 'auto'; // Michael : Pour le moteur Night Ops

const App: React.FC = () => {
    // --- GESTION AUTHENTIFICATION & WHITELIST ---
    const [user, setUser] = useState<FirebaseUser | null>(null);
    const [isWhitelisted, setIsWhitelisted] = useState<boolean | null>(null);
    const [authLoading, setAuthLoading] = useState(true);

    // Michael : L'ID utilisateur devient dynamique basé sur la session
    const currentUserId = user?.uid || "guest"; 

    // --- ÉTATS SYSTÈME & THEME (Michael : Engine Night Ops) ---
    const [themeMode, setThemeMode] = useState<ThemeMode>('auto'); 
    const [isActuallyNight, setIsActuallyNight] = useState(false);
    const [lastSyncTimestamp, setLastSyncTimestamp] = useState<number>(Date.now());

    // Michael : Suivi du secteur pour le Coach (Reset intelligent)
    const [lastCoachLocationId, setLastCoachLocationId] = useState<string>("");

    // Michael : Feedback haptique pattern marqué
    const triggerHaptic = (pattern = [30, 50, 30]) => {
        if (window.navigator && window.navigator.vibrate) {
            window.navigator.vibrate(pattern);
        }
    };

    // Michael : Logique Night Ops Soft (Bascule auto 19h-7h)
    useEffect(() => {
        const checkTheme = () => {
            if (themeMode === 'auto') {
                const hour = new Date().getHours();
                setIsActuallyNight(hour >= 19 || hour <= 7);
            } else {
                setIsActuallyNight(themeMode === 'night');
            }
        };
        checkTheme();
        const interval = setInterval(checkTheme, 60000);
        return () => clearInterval(interval);
    }, [themeMode]);

    // --- ÉTATS NAVIGATION & DONNÉES ---
    const [currentView, setCurrentView] = useState<View>('dashboard'); 
    const [sessions, setSessions] = useState<Session[]>([]); 
    const [activeDashboardTab, setActiveDashboardTab] = useState<'live' | 'tactics' | 'activity' | 'experience'>('live');
    const [isLoading, setIsLoading] = useState(true); 
    const [editingSession, setEditingSession] = useState<Session | null>(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [magicDraft, setMagicDraft] = useState<any>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [isProfileLoading, setIsProfileLoading] = useState(true);
    const [tempPseudo, setTempPseudo] = useState("");
    const [activeLocationId, setActiveLocationId] = useState<string>("");
    const [oraclePoints, setOraclePoints] = useState<OracleDataPoint[]>([]);
    const [isOracleLoading, setIsOracleLoading] = useState(false);
    const [displayedWeather, setDisplayedWeather] = useState<WeatherSnapshot | null>(null);
    const [isWeatherLoading, setIsWeatherLoading] = useState(false);
    const [targetLocationId, setTargetLocationId] = useState<string | null>(null);
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    // --- LOGIQUE RÉSEAU & AUTH ---
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
            if (firebaseUser && firebaseUser.email) {
                const whitelistDoc = await getDoc(doc(db, 'authorized_users', firebaseUser.email));
                if (whitelistDoc.exists()) {
                    setUser(firebaseUser);
                    setIsWhitelisted(true);
                } else {
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

    const handleLogin = async () => {
        try { await signInWithPopup(auth, googleProvider); } 
        catch (e) { console.error("Erreur Michael Auth :", e); }
    };

    const handleLogout = () => {
        signOut(auth);
        setCurrentView('dashboard');
        setIsMenuOpen(false);
    };

    // --- ARSENAL ---
    const { 
        arsenalData, handleAddItem, handleDeleteItem, handleEditItem, handleMoveItem, handleToggleLocationFavorite 
    } = useArsenal(currentUserId);

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

    // --- CALCULS SESSIONS & LAST CATCH ---
    const mySessions = useMemo(() => sessions.filter(s => s.userId === currentUserId), [sessions, currentUserId]);
    const lastSession = mySessions.length > 0 ? mySessions[0] : null;
    const lastCatchDefaults = useMemo(() => {
        return lastSession && lastSession.catches && lastSession.catches.length > 0 
            ? lastSession.catches[lastSession.catches.length - 1] : null;
    }, [lastSession]);

    const defaultLocationId = useMemo(() => {
        if (!arsenalData.locations || arsenalData.locations.length === 0) return "";
        const fav = arsenalData.locations.find(l => l.isFavorite);
        return fav ? fav.id : arsenalData.locations[0].id;
    }, [arsenalData.locations]);

    useEffect(() => { 
        if (!activeLocationId && defaultLocationId) setActiveLocationId(defaultLocationId);
        if (activeLocationId && arsenalData.locations.length > 0) {
           const currentLoc = arsenalData.locations.find(l => l.id === activeLocationId);
           if (!currentLoc || !currentLoc.isFavorite) setActiveLocationId(defaultLocationId);
        }
    }, [defaultLocationId, activeLocationId, arsenalData.locations]);

    const activeLocation = useMemo(() => arsenalData.locations.find(l => l.id === activeLocationId), [arsenalData.locations, activeLocationId]);

    // --- SYNC ORACLE ---
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
                        windSpeed: livePoint.windSpeed, windDirection: livePoint.windDirection, precip: livePoint.precip,
                        conditionCode: livePoint.conditionCode
                    } as WeatherSnapshot);
                }
            } catch (err) { console.error("Sync Error Unified Michael :", err); } 
            finally { setIsOracleLoading(false); setIsWeatherLoading(false); }
        };
        syncEnvironment();
        const interval = setInterval(syncEnvironment, 30 * 60 * 1000);
        return () => clearInterval(interval);
    }, [activeLocationId, activeLocation]);

    // Michael : Reset du chat uniquement si le secteur change sur le Live
    useEffect(() => {
        if (activeLocationId && lastCoachLocationId && activeLocationId !== lastCoachLocationId) {
            clearChatHistory(currentUserId);
            setLastCoachLocationId(activeLocationId);
        } else if (activeLocationId && !lastCoachLocationId) {
            setLastCoachLocationId(activeLocationId);
        }
    }, [activeLocationId, lastCoachLocationId, currentUserId]);

    // --- USER PROFILE & THEME SYNC ---
    useEffect(() => {
        if (!user) return;
        setIsProfileLoading(true);
        const unsubscribe = onSnapshot(doc(db, 'users', currentUserId), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as UserProfile;
                setUserProfile({ ...data, id: docSnap.id }); 
                if ((data as any).themePreference) setThemeMode((data as any).themePreference);
            }
            setIsProfileLoading(false);
        });
        return () => unsubscribe();
    }, [currentUserId, user]); 

    // --- SESSIONS ---
    useEffect(() => {
        if (!user) return;
        const q = query(sessionsCollection, orderBy('date', 'desc')); 
        const unsubscribeSessions = onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
            const fetchedSessions: Session[] = snapshot.docs.map(doc => {
                const data = doc.data();
                let dateString = '';
                if (data.date instanceof Timestamp) dateString = data.date.toDate().toISOString().split('T')[0];
                else if (typeof data.date === 'string') dateString = data.date;
                return {
                    id: doc.id, date: dateString, startTime: data.startTime || '08:00', endTime: data.endTime || '11:00',
                    durationMinutes: data.durationMinutes || 0, locationId: data.locationId || '', locationName: data.locationName || 'Secteur Inconnu',
                    spotId: data.spotId || '', spotName: data.spotName || 'Spot Inconnu', setupId: data.setupId || '', setupName: data.setupName || 'Setup Inconnu',
                    feelingScore: data.feelingScore || 5, catchCount: data.catchCount || 0, notes: data.notes || '', techniquesUsed: data.techniquesUsed || [], 
                    envSnapshot: data.envSnapshot || null,
                    catches: (data.catches || []).map((c: any) => ({...c, userId: c.userId || data.userId})),
                    misses: (data.misses || []).map((m: any) => ({...m, userId: m.userId || data.userId})),
                    userId: data.userId || 'inconnu', userPseudo: data.userPseudo || 'Inconnu', userAvatar: data.userAvatar || null,
                    active: true, displayOrder: data.displayOrder || 0
                } as Session;
            });
            setSessions(fetchedSessions); setIsLoading(false); 
        });
        return () => unsubscribeSessions();
    }, [user]); 

    // --- HANDLERS ---
    const handleSaveSession = async (session: Session) => {
        triggerHaptic(); 
        if (session.id) {
            const { date, ...data } = session;
            const updatePayload: any = { ...data };
            if (date) updatePayload.date = Timestamp.fromDate(new Date(date as string));
            await updateDoc(doc(db, 'sessions', session.id), updatePayload);
            setEditingSession(null); setCurrentView('history'); 
        } else {
            const { id, date, ...dataToSave } = session; 
            const finalDate = date ? new Date(date) : new Date();
            const cleanData = JSON.parse(JSON.stringify(dataToSave, (key, value) => value === undefined ? null : value));
            await addDoc(collection(db, 'sessions'), { 
                ...cleanData, date: Timestamp.fromDate(finalDate), userId: currentUserId, 
                userPseudo: userProfile?.pseudo || 'Inconnu', userAvatar: userProfile?.avatarBase64 || null, 
                createdAt: Timestamp.now(), active: true 
            });
            setMagicDraft(null); setCurrentView('dashboard'); 
        }
    };

    const handleDeleteSession = async (id: string) => {
        try { await deleteDoc(doc(db, 'sessions', id)); } 
        catch (error) { console.error("Erreur suppression Michael :", error); }
    };

    const handleEditRequest = (session: Session) => {
        if (session.userId !== currentUserId) return;
        setEditingSession(session); setMagicDraft(null); setCurrentView('session');
    };

    const handleMagicDiscovery = (draft: any) => {
        triggerHaptic([50, 20, 50]); 
        setMagicDraft(draft); setEditingSession(null); setCurrentView('session');
    };

    const handleCreateProfile = async (e: React.FormEvent) => {
        e.preventDefault(); if (!tempPseudo.trim()) return;
        const newProfile = await createUserProfile(currentUserId, tempPseudo); setUserProfile(newProfile);
    };

    const navigateFromMenu = (view: View) => { 
        triggerHaptic([10]);
        setEditingSession(null); setMagicDraft(null); setCurrentView(view); setIsMenuOpen(false); 
    };

    const handleConsumeLevelUp = async (goToExperience: boolean) => {
        if (!userProfile) return;
        try {
            await updateDoc(doc(db, 'users', currentUserId), { pendingLevelUp: false });
            if (goToExperience) { setActiveDashboardTab('experience'); setCurrentView('dashboard'); }
        } catch (e) { console.error("Error level notification :", e); }
    };

    const liveOraclePoint = useMemo(() => {
        if (!oraclePoints.length) return null;
        const nowTs = Date.now();
        return oraclePoints.reduce((prev, curr) => Math.abs(curr.timestamp - nowTs) < Math.abs(prev.timestamp - nowTs) ? curr : prev);
    }, [oraclePoints]);

    const currentLiveSnapshot = useMemo(() => {
        if (!activeLocation || !liveOraclePoint || !displayedWeather) return null;
        return {
            locationName: activeLocation.label, userName: userProfile?.pseudo || "Pêcheur",
            coordinates: activeLocation.coordinates, // Michael : Transmission des coordonnées pour l'IA
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

    const renderContent = () => { 
        switch (currentView) {
            case 'locations':
                return <LocationsManager 
                        userId={currentUserId} 
                        initialOpenLocationId={targetLocationId} 
                        locations={arsenalData.locations} 
                        spots={arsenalData.spots} 
                        onAddLocation={(label: string, coords: any) => handleAddItem('locations', label, coords ? { coordinates: coords } : undefined)} 
                        onEditLocation={(id: string, label: string, extra?: any) => handleEditItem('locations', id, label, extra)} 
                        onDeleteLocation={(id: string) => handleDeleteItem('locations', id)} 
                        onToggleFavorite={handleToggleLocationFavorite} 
                        onMoveLocation={(id: string, dir: 'up' | 'down') => handleMoveItem('locations', id, dir)} 
                        onAddSpot={(label: string, locId: string) => handleAddItem('zones', label, { locationId: locId })} 
                        onDeleteSpot={(id: string) => handleDeleteItem('zones', id)} 
                        onEditSpot={(id: string, label: string) => handleEditItem('zones', id, label)} 
                        onBack={() => { setTargetLocationId(null); setCurrentView('dashboard'); }} 
                    />;

                case 'dashboard': 
                return <Dashboard 
                    userProfile={userProfile} activeTab={activeDashboardTab} onTabChange={setActiveDashboardTab} userName={userProfile?.pseudo || 'Pêcheur'} 
                    currentUserId={currentUserId} sessions={sessions} oracleData={oraclePoints} isOracleLoading={isOracleLoading || isWeatherLoading} 
                    activeLocationLabel={activeLocation?.label || "Sélectionner un secteur"} activeLocationId={activeLocationId} availableLocations={arsenalData.locations.filter(l => l.active && l.isFavorite)} 
                    onLocationClick={() => { if (activeLocationId) setTargetLocationId(activeLocationId); setCurrentView('locations'); }} 
                    onLocationSelect={setActiveLocationId} setActiveLocationId={setActiveLocationId} onEditSession={(s) => { setEditingSession(s); setCurrentView('session'); }} 
                    onDeleteSession={handleDeleteSession} onMagicDiscovery={handleMagicDiscovery} lureTypes={arsenalData.lureTypes} colors={arsenalData.colors} locations={arsenalData.locations} arsenalData={arsenalData} displayedWeather={displayedWeather} 
                    lastSyncTimestamp={lastSyncTimestamp} isActuallyNight={isActuallyNight}
                />;
            case 'history': return <HistoryView sessions={sessions} onDeleteSession={handleDeleteSession} onEditSession={handleEditRequest} currentUserId={currentUserId} isActuallyNight={isActuallyNight} />;
            case 'arsenal': return <ArsenalView currentUserId={currentUserId} setups={arsenalData.setups} onAddSetup={(l: string) => handleAddItem('setups', l)} onDeleteSetup={(id: string) => handleDeleteItem('setups', id)} onEditSetup={(id: string, l: string) => handleEditItem('setups', id, l)} onMoveSetup={(id: string, dir: 'up' | 'down') => handleMoveItem('setups', id, dir)} techniques={arsenalData.techniques} onAddTechnique={(l: string) => handleAddItem('techniques', l)} onDeleteTechnique={(id: string) => handleDeleteItem('techniques', id)} onEditTechnique={(id: string, l: string) => handleEditItem('techniques', id, l)} onMoveTechnique={(id: string, dir: 'up' | 'down') => handleMoveItem('techniques', id, dir)} lureTypes={arsenalData.lureTypes} onAddLureType={(l: string) => handleAddItem('ref_lure_types', l)} onDeleteLureType={(id: string) => handleDeleteItem('ref_lure_types', id)} onEditLureType={(id: string, label: string) => handleEditItem('ref_lure_types', id, label)} onMoveLureType={(id: string, dir: 'up' | 'down') => handleMoveItem('ref_lure_types', id, dir)} colors={arsenalData.colors} onAddColor={(l: string) => handleAddItem('ref_colors', l)} onDeleteColor={(id: string) => handleDeleteItem('ref_colors', id)} onEditColor={(id: string, l: string) => handleEditItem('ref_colors', id, l)} onMoveColor={(id: string, dir: 'up' | 'down') => handleMoveItem('ref_colors', id, dir)} sizes={arsenalData.sizes} onAddSize={(l: string) => handleAddItem('ref_sizes', l)} onDeleteSize={(id: string) => handleDeleteItem('ref_sizes', id)} onEditSize={(id: string, l: string) => handleEditItem('ref_sizes', id, l)} onMoveSize={(id: string, dir: 'up' | 'down') => handleMoveItem('ref_sizes', id, dir)} weights={arsenalData.weights} onAddWeight={(l: string) => handleAddItem('ref_weights', l)} onDeleteWeight={(id: string) => handleDeleteItem('ref_weights', id)} onEditWeight={(id: string, l: string) => handleEditItem('ref_weights', id, l)} onMoveWeight={(id: string, dir: 'up' | 'down') => handleMoveItem('ref_weights', id, dir)} onResetTechniques={(defaults) => handleResetCollection('techniques', defaults, arsenalData.techniques)} onResetLureTypes={(defaults) => handleResetCollection('ref_lure_types', defaults, arsenalData.lureTypes)} onResetColors={(defaults) => handleResetCollection('ref_colors', defaults, arsenalData.colors)} onResetSizes={(defaults) => handleResetCollection('ref_sizes', defaults, arsenalData.sizes)} onResetWeights={(defaults) => handleResetCollection('ref_weights', defaults, arsenalData.weights)} onResetSetups={(defaults) => handleResetCollection('setups', defaults, arsenalData.setups)} />;
            case 'coach': return <CoachView sessions={sessions} arsenalData={arsenalData} liveSnapshot={currentLiveSnapshot} currentUserId={currentUserId} userPseudo={userProfile?.pseudo || 'Pêcheur'} isActuallyNight={isActuallyNight} />;
            case 'profile': return <ProfileView userProfile={userProfile!} sessions={sessions} arsenalData={arsenalData} onUpdateProfile={setUserProfile} onLogout={handleLogout} themeMode={themeMode} isActuallyNight={isActuallyNight} />;
            case 'session': return <SessionForm onAddSession={handleSaveSession} onUpdateSession={(id, data) => handleSaveSession({ ...data, id } as Session)} onCancel={() => setCurrentView('dashboard')} initialData={editingSession} initialDiscovery={magicDraft} zones={arsenalData.spots} setups={arsenalData.setups} techniques={arsenalData.techniques} lures={arsenalData.lures} lureTypes={arsenalData.lureTypes} colors={arsenalData.colors} sizes={arsenalData.sizes} weights={arsenalData.weights} locations={arsenalData.locations} defaultLocationId={activeLocationId} lastCatchDefaults={lastCatchDefaults} currentUserId={currentUserId} isActuallyNight={isActuallyNight} />;
            default: return null;
        }
    };

    if (authLoading) return <div className="flex h-screen items-center justify-center bg-[#FDFBF7]"><div className="animate-spin text-amber-500 font-bold uppercase tracking-widest text-lg">Oracle Loading...</div></div>;

    if (!user) {
        return (
            <div className="flex h-screen flex-col items-center justify-center bg-[#FDFBF7] p-6 text-center animate-in fade-in duration-500">
                <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-stone-100 max-w-sm w-full">
                    <div className="w-24 h-24 bg-stone-800 rounded-3xl flex items-center justify-center mx-auto mb-8 rotate-3 shadow-xl overflow-hidden p-4">
                        <img src="/logo192.png" alt="Oracle Fish" className="w-full h-full object-contain" />
                    </div>
                    <h1 className="text-3xl font-black text-stone-800 mb-2 tracking-tighter uppercase italic">Oracle<span className="text-amber-500"> Fish</span></h1>
                    <button onClick={handleLogin} className="w-full py-5 bg-stone-800 hover:bg-stone-900 text-white rounded-2xl font-black shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3 text-lg"><User size={24} /> Connexion Google</button>
                    <p className="mt-8 text-[11px] text-stone-300 uppercase font-black tracking-widest">Version Elite 4.8.23</p>
                </div>
            </div>
        );
    }

    return ( 
        <div className={`min-h-screen transition-colors duration-700 ${isActuallyNight ? 'bg-[#1c1917] text-stone-300' : 'bg-[#FAF9F6] text-stone-600'} pb-32 relative`}>
            {userProfile?.pendingLevelUp && (
                <LevelUpModal level={userProfile.levelReached || 1} onClose={() => handleConsumeLevelUp(false)} onConfirm={() => handleConsumeLevelUp(true)} />
            )}

            {/* HEADER : w-10 h-10 et pt-safe-area pour Pixel 9 (V4.8.23) */}
            <header className={`sticky top-0 z-30 ${isActuallyNight ? 'bg-[#292524]/90 border-stone-800' : 'bg-white/90 border-stone-200'} backdrop-blur-lg border-b px-5 pt-[calc(env(safe-area-inset-top)+14px)] pb-5 flex items-center justify-between shadow-sm transition-all duration-500`}>
                <div className="flex items-center gap-3">
                    <button onClick={() => { triggerHaptic([10]); setIsMenuOpen(true); }} className={`p-2 transition-colors ${isActuallyNight ? 'text-stone-400 hover:text-amber-400' : 'text-stone-500 hover:text-stone-800'}`}>
                        <Menu size={28} strokeWidth={2.5} />
                    </button>
                    <div className="w-10 h-10 flex items-center justify-center overflow-hidden">
                        <img src="/logo192.png" alt="Logo" className="w-full h-full object-contain rounded-xl shadow-sm" />
                    </div>
                    <span className={`font-black text-xl tracking-tighter uppercase italic ${isActuallyNight ? 'text-stone-100' : 'text-stone-800'}`}>
                        Oracle<span className="text-amber-500"> Fish</span>
                    </span>
                    {!isOnline && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-600 rounded-full border border-amber-100 animate-pulse">
                            <WifiOff size={16} strokeWidth={3} /><span className="text-[12px] font-black uppercase tracking-widest">Offline</span>
                        </div>
                    )}
                </div>
                
                <button onClick={() => navigateFromMenu('profile')} className={`w-10 h-10 rounded-full overflow-hidden border-2 transition-all active:scale-90 ${isActuallyNight ? 'border-stone-700' : 'border-stone-200 shadow-sm'}`}>
                    {userProfile?.avatarBase64 ? <img src={userProfile.avatarBase64} alt="Profile" className="w-full h-full object-cover" /> : <User size={24} className="text-stone-400 m-auto mt-1" />}
                </button>
            </header>

            {/* NAVIGATION 6 COLONNES "FLAT" */}
            <nav className={`fixed bottom-0 left-0 right-0 z-40 border-t ${isActuallyNight ? 'bg-[#292524]/95 border-stone-800' : 'bg-white/95 border-stone-200'} backdrop-blur-md pb-[env(safe-area-inset-bottom,12px)] shadow-[0_-8px_30px_rgb(0,0,0,0.04)]`}> 
                <div className="mx-auto grid grid-cols-6 max-w-lg items-center py-4 px-1">
                    <button onClick={() => { triggerHaptic([5]); setCurrentView('dashboard'); }} className={`flex flex-col items-center gap-1.5 transition-all active:scale-90 ${currentView === 'dashboard' ? 'text-amber-600' : 'text-stone-500 font-black'}`}>
                        <Home size={26} /><span className="text-[10px] uppercase tracking-tighter font-black">Live</span>
                    </button>
                    <button onClick={() => { triggerHaptic([5]); setCurrentView('history'); }} className={`flex flex-col items-center gap-1.5 transition-all active:scale-90 ${currentView === 'history' ? 'text-amber-600' : 'text-stone-500 font-black'}`}>
                        <ScrollText size={26} /><span className="text-[10px] uppercase tracking-tighter font-black">Journal</span>
                    </button>
                    <button onClick={() => { triggerHaptic([15]); setCurrentView('session'); }} className={`flex flex-col items-center gap-1.5 transition-all active:scale-90 ${currentView === 'session' ? (isActuallyNight ? 'text-stone-100' : 'text-stone-900') : 'text-stone-500 font-black'}`}>
                        <PlusCircle size={26} strokeWidth={3} /><span className="text-[10px] font-black uppercase tracking-tighter">Session</span>
                    </button>
                    <div className="flex flex-col items-center gap-1.5">
                        <MagicScanButton userPseudo={userProfile?.pseudo || "Michael"} lureTypes={arsenalData.lureTypes} colors={arsenalData.colors} onDiscoveryComplete={handleMagicDiscovery} userId={currentUserId} />
                        <span className="text-[10px] font-black text-amber-600 uppercase tracking-tighter">Wand</span>
                    </div>
                    <button onClick={() => { triggerHaptic([5]); setCurrentView('coach'); }} className={`flex flex-col items-center gap-1.5 transition-all active:scale-90 ${currentView === 'coach' ? 'text-emerald-600' : 'text-stone-500 font-black'}`}>
                        <Bot size={26} /><span className="text-[10px] uppercase tracking-tighter font-black">Coach</span>
                    </button>
                    <button onClick={() => { triggerHaptic([5]); setCurrentView('locations'); }} className={`flex flex-col items-center gap-1.5 transition-all active:scale-90 ${currentView === 'locations' ? 'text-indigo-600' : 'text-stone-500 font-black'}`}>
                        <MapPin size={26} /><span className="text-[10px] uppercase tracking-tighter font-black">Secteurs</span>
                    </button>
                </div>
            </nav>

            <main className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-500">{renderContent()}</main>

            {/* SIDE MENU SOFT NIGHT */}
            {isMenuOpen && (
                <>
                    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 animate-in fade-in" onClick={() => setIsMenuOpen(false)} />
                    <aside className={`fixed top-0 left-0 h-full w-4/5 max-w-xs z-[60] shadow-2xl p-8 animate-in slide-in-from-left flex flex-col pt-[env(safe-area-inset-top,24px)] ${isActuallyNight ? 'bg-[#1c1917] text-stone-200 border-r border-stone-800' : 'bg-white text-stone-600'}`}>
                        <div className="flex justify-between items-center mb-10"><span className="text-xs font-black text-stone-400 uppercase tracking-widest">Menu Principal</span><button onClick={() => setIsMenuOpen(false)} className="p-3 text-stone-400 hover:bg-stone-50 rounded-full transition-colors"><X size={28} /></button></div>
                        <div className={`flex items-center gap-4 mb-10 p-5 rounded-3xl border ${isActuallyNight ? 'bg-[#292524] border-stone-700' : 'bg-stone-50 border-stone-100'}`}>
                            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center border-2 border-amber-100 text-amber-500 overflow-hidden shadow-inner">
                                {userProfile?.avatarBase64 ? <img src={userProfile.avatarBase64} alt="Avatar" className="w-full h-full object-cover"/> : <User size={32} />}
                            </div>
                            <div><div className="font-black text-xl leading-none">{userProfile?.pseudo}</div><div className="text-xs text-stone-400 font-bold mt-1.5 uppercase tracking-wide">Soldat du Quai</div></div>
                        </div>
                        <nav className="space-y-3 flex-1">
                            <button onClick={() => navigateFromMenu('arsenal')} className={`w-full flex items-center justify-between p-5 rounded-2xl transition-all font-black text-xl group ${isActuallyNight ? 'hover:bg-stone-800 text-stone-300' : 'hover:bg-amber-50 text-stone-600'}`}><span className="flex items-center gap-4"><Anchor size={28} className="text-stone-400 group-hover:text-amber-500"/> Mon Arsenal</span><ChevronRight size={24} /></button>
                            <button onClick={() => navigateFromMenu('profile')} className={`w-full flex items-center justify-between p-5 rounded-2xl transition-all font-black text-xl group ${isActuallyNight ? 'hover:bg-stone-800 text-stone-300' : 'hover:bg-amber-50 text-stone-600'}`}><span className="flex items-center gap-4"><User size={28} className="text-stone-400 group-hover:text-amber-500"/> Ton Profil</span><ChevronRight size={24} /></button>
                        </nav>
                        <div className="flex items-center gap-3 p-5 opacity-40 text-[10px] font-black uppercase tracking-widest">
                            {isActuallyNight ? <Moon size={14} /> : <Sun size={14} />} {isActuallyNight ? 'Mode Night Ops' : 'Mode Jour'}
                        </div>
                    </aside>
                </>
            )}
        </div>
    );
}; 

const LevelUpModal: React.FC<{ level: number, onClose: () => void, onConfirm: () => void }> = ({ level, onClose, onConfirm }) => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
        <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-md" onClick={onClose} />
        <div className="relative bg-white rounded-[2.5rem] shadow-2xl border-4 border-amber-400 p-8 max-w-sm w-full text-center overflow-hidden animate-in zoom-in duration-500">
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20"><Sparkles className="absolute top-4 left-4 text-amber-500 animate-bounce" size={24} /></div>
            <div className="relative z-10">
                <div className="w-24 h-24 bg-gradient-to-br from-amber-400 to-orange-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl rotate-6"><PartyPopper size={48} className="text-white" /></div>
                <h2 className="text-3xl font-black text-stone-800 mb-2 uppercase italic tracking-tighter">NIVEAU <span className="text-amber-500">{level}</span> !</h2>
                <div className="space-y-3 mt-8">
                    <button onClick={onConfirm} className="w-full py-5 bg-stone-800 text-white rounded-2xl font-black shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 text-lg">VOIR TON RANG <ChevronRight size={18} /></button>
                    <button onClick={onClose} className="w-full py-3 text-stone-400 font-black text-sm uppercase tracking-widest">Plus tard</button>
                </div>
            </div>
        </div>
    </div>
);

export default App;