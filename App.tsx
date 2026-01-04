// App.tsx - Version 4.8.6 (Scaling Mobile & Branding Fix)
import React, { useState, useEffect, useMemo } from 'react'; 
import { Home, PlusCircle, ScrollText, Fish, Bot, User, Menu, X, ChevronRight, MapPin, Anchor, ShieldAlert, LogOut, PartyPopper, Sparkles, WifiOff } from 'lucide-react';
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
import { db, sessionsCollection, auth, googleProvider } from './lib/firebase'; 
import { getUserProfile, createUserProfile } from './lib/user-service';
import { useArsenal } from './lib/useArsenal'; 

// Michael : Import de la fonction avec cache (getOrFetchOracleData) et du ménage
import { getOrFetchOracleData, cleanupOracleCache } from './lib/oracle-service'; 

type View = 'dashboard' | 'session' | 'history' | 'arsenal' | 'coach' | 'profile' | 'locations';

const App: React.FC = () => {
    // --- GESTION AUTHENTIFICATION & WHITELIST ---
    const [user, setUser] = useState<FirebaseUser | null>(null);
    const [isWhitelisted, setIsWhitelisted] = useState<boolean | null>(null);
    const [authLoading, setAuthLoading] = useState(true);

    // Michael : L'ID utilisateur devient dynamique basé sur la session
    const currentUserId = user?.uid || "guest"; 

    // --- ÉTATS D'ORIGINE V4.6 ---
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

    // Michael : État pour la résilience Offline (v4.8.4)
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    // --- LOGIQUE DE SURVEILLANCE RÉSEAU (v4.8.4) ---
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

    // --- LOGIQUE DE SURVEILLANCE AUTH ---
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
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (e) {
            console.error("Erreur d'authentification Michael :", e);
        }
    };

    const handleLogout = () => {
        signOut(auth);
        setCurrentView('dashboard');
        setIsMenuOpen(false);
    };

    // --- HOOK ARSENAL ---
    const { 
        arsenalData, 
        handleAddItem, 
        handleDeleteItem, 
        handleEditItem, 
        handleMoveItem, 
        handleToggleLocationFavorite 
    } = useArsenal(currentUserId);

    // --- LOGIQUE RESET D'ORIGINE ---
    const handleResetCollection = async (collectionName: string, defaultItems: any[], currentItems: any[]) => {
        try {
            const deletePromises = currentItems.map(item => 
                deleteDoc(doc(db, collectionName, item.id))
            );
            await Promise.all(deletePromises);
            for (const item of defaultItems) {
                await addDoc(collection(db, collectionName), {
                    label: item.label,
                    displayOrder: item.displayOrder || 0,
                    userId: currentUserId,
                    active: true,
                    createdAt: Timestamp.now()
                });
            }
        } catch (e) {
            console.error(`Erreur Reset sur ${collectionName}:`, e);
        }
    };

    // --- CALCULS SESSIONS & LAST CATCH (ORIGINE) ---
    const mySessions = useMemo(() => sessions.filter(s => s.userId === currentUserId), [sessions, currentUserId]);
    const lastSession = mySessions.length > 0 ? mySessions[0] : null;
    const lastCatchDefaults = useMemo(() => {
        return lastSession && lastSession.catches && lastSession.catches.length > 0 
            ? lastSession.catches[lastSession.catches.length - 1] : null;
    }, [lastSession]);

    // --- CALCUL DU SECTEUR PAR DÉFAUT ---
    const defaultLocationId = useMemo(() => {
        if (!arsenalData.locations || arsenalData.locations.length === 0) return "";
        const fav = arsenalData.locations.find(l => l.isFavorite);
        if (fav) return fav.id;
        return arsenalData.locations[0].id;
    }, [arsenalData.locations]);

    useEffect(() => { 
        if (!activeLocationId && defaultLocationId) {
            setActiveLocationId(defaultLocationId);
         }
        if (activeLocationId && arsenalData.locations.length > 0) {
           const currentLoc = arsenalData.locations.find(l => l.id === activeLocationId);
           const isFav = currentLoc?.isFavorite;
           if (!currentLoc || !isFav) {
                setActiveLocationId(defaultLocationId);
           }
        }
    }, [defaultLocationId, activeLocationId, arsenalData.locations]);

    const activeLocation = useMemo(() => {
        return arsenalData.locations.find(l => l.id === activeLocationId);
    }, [arsenalData.locations, activeLocationId]);

    // --- SYNC ENVIRONNEMENT (UNIFIÉ & CACHÉ - v4.8.3) ---
    useEffect(() => {
        const syncEnvironment = async () => {
            if (!activeLocation?.coordinates) return;
            
            setIsOracleLoading(true);
            setIsWeatherLoading(true);
            
            try {
                // 1. Récupération des données via le Cache Tactique (30 min)
                const points = await getOrFetchOracleData(
                    activeLocation.coordinates.lat, 
                    activeLocation.coordinates.lng, 
                    activeLocation.id,
                    activeLocation.morphology
                );
                setOraclePoints(points);

                // 2. Mapping automatique du Live directement depuis les points Oracle
                if (points.length > 0) {
                    const nowTs = Date.now();
                    const livePoint = points.reduce((prev, curr) => 
                        Math.abs(curr.timestamp - nowTs) < Math.abs(prev.timestamp - nowTs) ? curr : prev
                    );

                    // Michael : On alimente displayedWeather avec les données brutes portées par l'Oracle
                    setDisplayedWeather({
                        temperature: livePoint.airTemp,
                        pressure: livePoint.pressure,
                        clouds: livePoint.clouds,
                        windSpeed: livePoint.windSpeed,
                        windDirection: livePoint.windDirection,
                        precip: livePoint.precip,
                        conditionCode: livePoint.conditionCode
                    } as WeatherSnapshot);
                }
            } catch (err) { 
                console.error("Sync Error Unified Michael :", err); 
            } finally { 
                setIsOracleLoading(false); 
                setIsWeatherLoading(false); 
            }
        };

        syncEnvironment();
        
        const interval = setInterval(syncEnvironment, 30 * 60 * 1000);
        return () => clearInterval(interval);
    }, [activeLocationId, activeLocation]);

    // --- PRE-FETCHING DES FAVORIS & MÉNAGE CACHE (v4.8.3) ---
    useEffect(() => {
        const prefetchFavorites = async () => {
            if (cleanupOracleCache) cleanupOracleCache();

            const favs = arsenalData.locations.filter(l => l.active && l.isFavorite);
            console.log(`⚡ Pre-fetching de ${favs.length} secteurs favoris...`);
            
            favs.forEach(loc => {
                if (loc.coordinates && loc.id !== activeLocationId) {
                    getOrFetchOracleData(loc.coordinates.lat, loc.coordinates.lng, loc.id, loc.morphology);
                }
            });
        };
        
        if (arsenalData.locations.length > 0) prefetchFavorites();
    }, [arsenalData.locations]);

    const liveOraclePoint = useMemo(() => {
        if (!oraclePoints.length) return null;
        const nowTs = Date.now();
        return oraclePoints.reduce((prev, curr) => Math.abs(curr.timestamp - nowTs) < Math.abs(prev.timestamp - nowTs) ? curr : prev);
    }, [oraclePoints]);

    // --- SNAPSHOT LIVE ---
    const currentLiveSnapshot = useMemo(() => {
        if (!activeLocation || !liveOraclePoint || !displayedWeather) return null;

        return {
            locationName: activeLocation.label,
            userName: userProfile?.pseudo || "Pêcheur",
            env: {
                hydro: { 
                    waterTemp: liveOraclePoint.waterTemp,
                    turbidityNTU: liveOraclePoint.turbidityNTU,
                    dissolvedOxygen: liveOraclePoint.dissolvedOxygen,
                    waveHeight: liveOraclePoint.waveHeight,
                    flowRaw: liveOraclePoint.flowRaw, 
                    level: 0, 
                    flowLagged: 0,
                    turbidityIdx: 0
                },
                weather: displayedWeather 
            },
            scores: {
                sandre: liveOraclePoint.sandre,
                brochet: liveOraclePoint.brochet,
                perche: liveOraclePoint.perche,
                blackbass: liveOraclePoint.blackbass
            }
        };
    }, [activeLocation, liveOraclePoint, displayedWeather, userProfile]);

    // --- USER PROFILE (ÉCOUTE TEMPS RÉEL) ---
    useEffect(() => {
        if (!user) return;
        setIsProfileLoading(true);
        const unsubscribe = onSnapshot(doc(db, 'users', currentUserId), (docSnap) => {
            if (docSnap.exists()) {
                setUserProfile({ ...docSnap.data(), id: docSnap.id } as UserProfile); 
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
                    id: doc.id, 
                    date: dateString, 
                    startTime: data.startTime || '08:00',
                    endTime: data.endTime || '11:00',
                    durationMinutes: data.durationMinutes || 0,
                    locationId: data.locationId || '',
                    locationName: data.locationName || 'Secteur Inconnu',
                    spotId: data.spotId || '', 
                    spotName: data.spotName || 'Spot Inconnu',
                    setupId: data.setupId || '', 
                    setupName: data.setupName || 'Setup Inconnu',
                    feelingScore: data.feelingScore || 5,
                    catchCount: data.catchCount || 0,
                    notes: data.notes || '',
                    techniquesUsed: data.techniquesUsed || [], 
                    envSnapshot: data.envSnapshot || null,
                    catches: (data.catches || []).map((c: any) => ({...c, userId: c.userId || data.userId})),
                    misses: (data.misses || []).map((m: any) => ({...m, userId: m.userId || data.userId})),
                    userId: data.userId || 'inconnu',
                    userPseudo: data.userPseudo || 'Inconnu',
                    userAvatar: data.userAvatar || null,
                    active: true,
                    displayOrder: data.displayOrder || 0
                } as Session;
            });
            setSessions(fetchedSessions);
            setIsLoading(false); 
        });
        return () => unsubscribeSessions();
    }, [user]); 

    // --- HANDLERS D'ORIGINE ---
    const handleSaveSession = async (session: Session) => {
        if (session.id) {
            const { date, ...data } = session;
            const updatePayload: any = { ...data };
            if (date) updatePayload.date = Timestamp.fromDate(new Date(date as string));
            await updateDoc(doc(db, 'sessions', session.id), updatePayload);
            setEditingSession(null);
            setCurrentView('history'); 
        } else {
            const { id, date, ...dataToSave } = session; 
            const finalDate = date ? new Date(date) : new Date();
            const cleanData = JSON.parse(JSON.stringify(dataToSave, (key, value) => value === undefined ? null : value));
            await addDoc(collection(db, 'sessions'), { 
                ...cleanData,
                date: Timestamp.fromDate(finalDate), 
                userId: currentUserId, 
                userPseudo: userProfile?.pseudo || 'Inconnu', 
                userAvatar: userProfile?.avatarBase64 || null, 
                createdAt: Timestamp.now(),
                active: true 
            });
            setMagicDraft(null); 
            setCurrentView('dashboard'); 
        }
    };

    const handleDeleteSession = async (id: string) => {
        try { await deleteDoc(doc(db, 'sessions', id)); } 
        catch (error) { console.error("Erreur suppression session:", error); }
    };

    const handleEditRequest = (session: Session) => {
        if (session.userId !== currentUserId) return;
        setEditingSession(session);
        setMagicDraft(null); 
        setCurrentView('session');
    };

    const handleMagicDiscovery = (draft: any) => {
        setMagicDraft(draft);
        setEditingSession(null);
        setCurrentView('session');
    };

    const handleCreateProfile = async (e: React.FormEvent) => {
        e.preventDefault(); if (!tempPseudo.trim()) return;
        const newProfile = await createUserProfile(currentUserId, tempPseudo); setUserProfile(newProfile);
    };

    const navigateFromMenu = (view: View) => { 
        setEditingSession(null); 
        setMagicDraft(null); 
        setCurrentView(view); 
        setIsMenuOpen(false); 
    };

    const handleOpenLocation = () => {
        if (activeLocationId) setTargetLocationId(activeLocationId);
        setCurrentView('locations');
    };

    // --- GESTION NOTIFICATION LEVEL UP ---
    const handleConsumeLevelUp = async (goToExperience: boolean) => {
        if (!userProfile) return;
        try {
            await updateDoc(doc(db, 'users', currentUserId), { pendingLevelUp: false });
            if (goToExperience) {
                setActiveDashboardTab('experience'); 
                setCurrentView('dashboard');
            }
        } catch (e) { console.error("Error resetting level notification:", e); }
    };

    const renderContent = () => { 
        switch (currentView) {
            case 'locations':
                return <LocationsManager userId={currentUserId} initialOpenLocationId={targetLocationId} locations={arsenalData.locations} spots={arsenalData.spots} onAddLocation={(l: string, coords: any) => handleAddItem('locations', l, coords ? { coordinates: coords } : undefined)} onEditLocation={(id, l, extra) => handleEditItem('locations', id, l, extra)} onDeleteLocation={(id: string) => handleDeleteItem('locations', id)} onToggleFavorite={handleToggleLocationFavorite} onMoveLocation={(id: string, dir: 'up' | 'down') => handleMoveItem('locations', id, dir)} onAddSpot={(l: string, locId: string) => handleAddItem('zones', l, { locationId: locId })} onDeleteSpot={(id: string) => handleDeleteItem('zones', id)} onEditSpot={(id: string, l: string) => handleEditItem('zones', id, l)} onBack={() => { setTargetLocationId(null); setCurrentView('dashboard'); }} />;
            case 'dashboard': 
                return <Dashboard 
                    userProfile={userProfile} 
                    activeTab={activeDashboardTab} 
                    onTabChange={setActiveDashboardTab} 
                    userName={userProfile?.pseudo || 'Pêcheur'} 
                    currentUserId={currentUserId} 
                    sessions={sessions} 
                    oracleData={oraclePoints} 
                    isOracleLoading={isOracleLoading || isWeatherLoading} 
                    activeLocationLabel={activeLocation?.label || "Sélectionner un secteur"} 
                    activeLocationId={activeLocationId} 
                    availableLocations={arsenalData.locations.filter(l => l.active && l.isFavorite)} 
                    onLocationClick={handleOpenLocation} 
                    onLocationSelect={setActiveLocationId} 
                    setActiveLocationId={setActiveLocationId} 
                    onEditSession={(s) => { setEditingSession(s); setCurrentView('session'); }} 
                    onDeleteSession={handleDeleteSession} 
                    onMagicDiscovery={handleMagicDiscovery} 
                    lureTypes={arsenalData.lureTypes} 
                    colors={arsenalData.colors} 
                    locations={arsenalData.locations} 
                    arsenalData={arsenalData}
                    displayedWeather={displayedWeather} 
                />;
            case 'history':
                return <HistoryView sessions={sessions} onDeleteSession={handleDeleteSession} onEditSession={handleEditRequest} currentUserId={currentUserId} />;
            case 'arsenal':
                return <ArsenalView currentUserId={currentUserId} setups={arsenalData.setups} onAddSetup={(l: string) => handleAddItem('setups', l)} onDeleteSetup={(id: string) => handleDeleteItem('setups', id)} onEditSetup={(id: string, l: string) => handleEditItem('setups', id, l)} onMoveSetup={(id: string, dir: 'up' | 'down') => handleMoveItem('setups', id, dir)} techniques={arsenalData.techniques} onAddTechnique={(l: string) => handleAddItem('techniques', l)} onDeleteTechnique={(id: string) => handleDeleteItem('techniques', id)} onEditTechnique={(id: string, l: string) => handleEditItem('techniques', id, l)} onMoveTechnique={(id: string, dir: 'up' | 'down') => handleMoveItem('techniques', id, dir)} lureTypes={arsenalData.lureTypes} onAddLureType={(l: string) => handleAddItem('ref_lure_types', l)} onDeleteLureType={(id: string) => handleDeleteItem('ref_lure_types', id)} onEditLureType={(id: string, l: string) => handleEditItem('ref_lure_types', id, l)} onMoveLureType={(id: string, dir: 'up' | 'down') => handleMoveItem('ref_lure_types', id, dir)} colors={arsenalData.colors} onAddColor={(l: string) => handleAddItem('ref_colors', l)} onDeleteColor={(id: string) => handleDeleteItem('ref_colors', id)} onEditColor={(id: string, l: string) => handleEditItem('ref_colors', id, l)} onMoveColor={(id: string, dir: 'up' | 'down') => handleMoveItem('ref_colors', id, dir)} sizes={arsenalData.sizes} onAddSize={(l: string) => handleAddItem('ref_sizes', l)} onDeleteSize={(id: string) => handleDeleteItem('ref_sizes', id)} onEditSize={(id: string, l: string) => handleEditItem('ref_sizes', id, l)} onMoveSize={(id: string, dir: 'up' | 'down') => handleMoveItem('ref_sizes', id, dir)} weights={arsenalData.weights} onAddWeight={(l: string) => handleAddItem('ref_weights', l)} onDeleteWeight={(id: string) => handleDeleteItem('ref_weights', id)} onEditWeight={(id: string, l: string) => handleEditItem('ref_weights', id, l)} onMoveWeight={(id: string, dir: 'up' | 'down') => handleMoveItem('ref_weights', id, dir)} onResetTechniques={(defaults) => handleResetCollection('techniques', defaults, arsenalData.techniques)} onResetLureTypes={(defaults) => handleResetCollection('ref_lure_types', defaults, arsenalData.lureTypes)} onResetColors={(defaults) => handleResetCollection('ref_colors', defaults, arsenalData.colors)} onResetSizes={(defaults) => handleResetCollection('ref_sizes', defaults, arsenalData.sizes)} onResetWeights={(defaults) => handleResetCollection('ref_weights', defaults, arsenalData.weights)} onResetSetups={(defaults) => handleResetCollection('setups', defaults, arsenalData.setups)} />;
            case 'coach': 
                return <CoachView sessions={sessions} arsenalData={arsenalData} liveSnapshot={currentLiveSnapshot} currentUserId={currentUserId} userPseudo={userProfile?.pseudo || 'Pêcheur'} />;
            case 'profile':
                return <ProfileView userProfile={userProfile!} sessions={sessions} arsenalData={arsenalData} onUpdateProfile={setUserProfile} onLogout={handleLogout} />;
            case 'session':
                return <SessionForm onAddSession={handleSaveSession} onUpdateSession={(id, data) => handleSaveSession({ ...data, id } as Session)} initialData={editingSession} initialDiscovery={magicDraft} zones={arsenalData.spots} setups={arsenalData.setups} techniques={arsenalData.techniques} lures={arsenalData.lures} lureTypes={arsenalData.lureTypes} colors={arsenalData.colors} sizes={arsenalData.sizes} weights={arsenalData.weights} locations={arsenalData.locations} defaultLocationId={activeLocationId} lastCatchDefaults={lastCatchDefaults} currentUserId={currentUserId} />;
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
                    <p className="text-stone-400 mb-10 text-base font-medium leading-relaxed">Le carnet stratégique des soldats du quai. Accès restreint.</p>
                    <button onClick={handleLogin} className="w-full py-5 bg-stone-800 hover:bg-stone-900 text-white rounded-2xl font-black shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3 text-lg"><User size={24} /> Connexion Google</button>
                    <p className="mt-8 text-[11px] text-stone-300 uppercase font-black tracking-widest">Version Elite 4.8.5</p>
                </div>
            </div>
        );
    }

    if (isWhitelisted === false) {
        return (
            <div className="flex h-screen flex-col items-center justify-center bg-red-50 p-6 text-center">
                <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-red-100 max-sm w-full animate-in fade-in">
                    <ShieldAlert size={60} className="text-red-500 mx-auto mb-6" />
                    <h2 className="text-2xl font-black text-stone-800 mb-4 uppercase">Accès Refusé</h2>
                    <p className="text-stone-500 mb-8 text-sm leading-relaxed">L'email <span className="font-bold text-stone-800">{user.email}</span> n'est pas autorisé.<br/>Contacte l'administrateur.</p>
                    <button onClick={handleLogout} className="w-full py-4 bg-stone-100 text-stone-600 rounded-2xl font-bold hover:bg-stone-200 transition-colors">Quitter</button>
                </div>
            </div>
        );
    }

    if (!userProfile) {
        return (
            <div className="flex h-screen flex-col items-center justify-center bg-[#FDFBF7] p-6 text-center animate-in fade-in duration-500">
                <div className="bg-white p-8 rounded-[2rem] shadow-2xl border border-stone-100 max-w-sm w-full">
                    <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner"><User size={40} className="text-amber-600" /></div>
                    <h1 className="text-2xl font-black text-stone-800 mb-2 tracking-tighter uppercase">Profil Oracle</h1>
                    <p className="text-stone-500 mb-8 text-sm font-medium">Initialisation pour l'ID : <span className="font-mono text-xs bg-stone-100 px-2 py-1 rounded">{currentUserId}</span></p>
                    <form onSubmit={handleCreateProfile} className="space-y-4">
                        <input type="text" placeholder="Pseudo..." value={tempPseudo} onChange={(e) => setTempPseudo(e.target.value)} className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl font-black text-center outline-none focus:ring-2 focus:ring-amber-400 text-lg" autoFocus />
                        <button type="submit" disabled={!tempPseudo.trim()} className="w-full py-4 bg-stone-800 text-white rounded-2xl font-black shadow-lg text-lg">Lancer l'Oracle</button>
                    </form>
                </div>
            </div>
        );
    }

    return ( 
        <div className="min-h-screen bg-[#FAF9F6] pb-32 text-stone-600 relative">
            {userProfile.pendingLevelUp && (
                <LevelUpModal 
                    level={userProfile.levelReached || 1} 
                    onClose={() => handleConsumeLevelUp(false)} 
                    onConfirm={() => handleConsumeLevelUp(true)}
                />
            )}

            {/* HEADER : Mise à jour Safe Area Top (iPhone Notch) & Scaling */}
            <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-lg border-b border-stone-200 px-5 pt-[env(safe-area-inset-top,16px)] pb-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                    <button onClick={() => setIsMenuOpen(true)} className="p-2.5 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-xl transition-colors">
                        <Menu size={32} strokeWidth={2.5} />
                    </button>
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center overflow-hidden p-1 border border-stone-100 shadow-sm">
                        <img src="/logo192.png" alt="Logo" className="w-full h-full object-contain" />
                    </div>
                    <span className="font-black text-2xl tracking-tighter text-stone-800 uppercase italic">Oracle<span className="text-amber-500"> Fish</span></span>
                    
                    {!isOnline && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-600 rounded-full border border-amber-100 animate-pulse">
                            <WifiOff size={16} strokeWidth={3} />
                            <span className="text-[12px] font-black uppercase tracking-widest">Offline</span>
                        </div>
                    )}
                </div>
                <button onClick={() => setCurrentView('profile')} className="w-12 h-12 rounded-full bg-stone-100 overflow-hidden border-2 border-stone-200 shadow-sm active:scale-90 transition-transform">
                    {userProfile?.avatarBase64 ? <img src={userProfile.avatarBase64} alt="Profile" className="w-full h-full object-cover" /> : <User size={28} className="text-stone-400 m-auto mt-2" />}
                </button>
            </header>

            {isMenuOpen && (
                <>
                    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 animate-in fade-in" onClick={() => setIsMenuOpen(false)} />
                    <aside className="fixed top-0 left-0 h-full w-4/5 max-w-xs bg-white z-[60] shadow-2xl p-8 animate-in slide-in-from-left flex flex-col pt-[env(safe-area-inset-top,24px)]">
                        <div className="flex justify-between items-center mb-10"><span className="text-xs font-black text-stone-400 uppercase tracking-widest">Menu Principal</span><button onClick={() => setIsMenuOpen(false)} className="p-3 text-stone-400 hover:bg-stone-50 rounded-full"><X size={28} /></button></div>
                        <div className="flex items-center gap-4 mb-10 bg-stone-50 p-5 rounded-3xl border border-stone-100">
                            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center border-2 border-amber-100 text-amber-500 overflow-hidden shadow-inner">
                                {userProfile?.avatarBase64 ? <img src={userProfile.avatarBase64} alt="Avatar" className="w-full h-full object-cover"/> : <User size={32} />}
                            </div>
                            <div><div className="font-black text-stone-800 text-xl leading-none">{userProfile?.pseudo}</div><div className="text-xs text-stone-400 font-bold mt-1.5 uppercase tracking-wide">Soldat du Quai</div></div>
                        </div>
                        <nav className="space-y-3 flex-1">
                            <button onClick={() => { setCurrentView('arsenal'); setIsMenuOpen(false); }} className="w-full flex items-center justify-between p-5 rounded-2xl text-stone-600 hover:bg-amber-50 hover:text-amber-800 transition-all font-black text-xl group">
                                <span className="flex items-center gap-4"><Anchor size={28} className="text-stone-400 group-hover:text-amber-500 transition-colors"/> Mon Arsenal</span><ChevronRight size={24} />
                            </button>
                            <button onClick={() => navigateFromMenu('profile')} className="w-full flex items-center justify-between p-5 rounded-2xl text-stone-600 hover:bg-amber-50 hover:text-amber-800 transition-all font-black text-xl group">
                                <span className="flex items-center gap-4"><User size={28} className="text-stone-400 group-hover:text-amber-500 transition-colors"/> Mon Profil</span><ChevronRight size={24} />
                            </button>
                        </nav>
                        <button onClick={handleLogout} className="mt-auto flex items-center gap-4 p-5 text-stone-400 hover:text-red-500 transition-colors font-black text-xl border-t border-stone-100 pb-[env(safe-area-inset-bottom,20px)]">
                            <LogOut size={28} /> Déconnexion
                        </button>
                    </aside>
                </>
            )}

            <main className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-500">
                {renderContent()}
            </main>

            {/* BOTTOM NAV : Mise à jour Safe Area Bottom & Scaling */}
            <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-stone-200 bg-white/95 backdrop-blur-md pb-[env(safe-area-inset-bottom,12px)] shadow-[0_-8px_30px_rgb(0,0,0,0.04)]"> 
                <div className="mx-auto flex max-w-lg items-center justify-around py-4">
                    <button onClick={() => { setTargetLocationId(null); setCurrentView('dashboard'); }} className={`flex flex-col items-center gap-1.5 transition-all active:scale-90 ${currentView === 'dashboard' ? 'text-amber-600' : 'text-stone-500 font-black'}`}><Home size={32} /><span className="text-[12px] font-black uppercase tracking-tighter">Live</span></button>
                    <button onClick={() => { setEditingSession(null); setMagicDraft(null); setCurrentView('history'); }} className={`flex flex-col items-center gap-1.5 transition-all active:scale-90 ${currentView === 'history' ? 'text-amber-600' : 'text-stone-500 font-black'}`}><ScrollText size={32} /><span className="text-[12px] font-black uppercase tracking-tighter">Journal</span></button>
                    
                    <div className="relative -top-7 flex items-center justify-center gap-3">
                        <button onClick={() => { setEditingSession(null); setMagicDraft(null); setCurrentView('session'); }} 
                                className="rounded-full border-4 border-[#FAF9F6] bg-stone-800 p-5 text-white shadow-2xl active:scale-90 transition-all transform hover:rotate-6">
                            <PlusCircle size={40} />
                        </button>
                        <MagicScanButton 
                            userPseudo={userProfile?.pseudo || "Michael"}
                            lureTypes={arsenalData.lureTypes}
                            colors={arsenalData.colors}
                            onDiscoveryComplete={handleMagicDiscovery}
                            userId={currentUserId}
                        />
                    </div>
                    
                    <button onClick={() => { setEditingSession(null); setMagicDraft(null); setCurrentView('coach'); }} className={`flex flex-col items-center gap-1.5 transition-all active:scale-90 ${currentView === 'coach' ? 'text-emerald-600' : 'text-stone-500 font-black'}`}><Bot size={32} /><span className="text-[12px] font-black uppercase tracking-tighter">Coach</span></button>
                    <button onClick={() => { setEditingSession(null); setMagicDraft(null); setCurrentView('locations'); }} className={`flex flex-col items-center gap-1.5 transition-all active:scale-90 ${currentView === 'locations' ? 'text-indigo-600' : 'text-stone-500 font-black'}`}><MapPin size={32} /><span className="text-[12px] font-black uppercase tracking-tighter">Secteurs</span></button>
                </div>
            </nav>
        </div>
    );
}; 

const getLevelUpMessage = (level: number) => {
    if (level <= 5) return "Pas mal. Tu as enfin compris de quel côté se tenait la canne.";
    if (level <= 10) return "Attention, les poissons commencent à reconnaître ton ombre à la surface.";
    if (level <= 20) return "Expert Oracle ? L'eau est ton jardin, mais reste vigilant sur la discrétion de tes montages.";
    return "Maître de l'Oracle. Les poissons te saluent... ou ils se moquent, c'est dur à dire.";
};

const LevelUpModal: React.FC<{ level: number, onClose: () => void, onConfirm: () => void }> = ({ level, onClose, onConfirm }) => {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-md" onClick={onClose} />
            <div className="relative bg-white rounded-[2.5rem] shadow-2xl border-4 border-amber-400 p-8 max-w-sm w-full text-center overflow-hidden animate-in zoom-in duration-500">
                <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
                    <Sparkles className="absolute top-4 left-4 text-amber-500 animate-bounce" size={24} />
                    <Sparkles className="absolute top-10 right-10 text-orange-500 animate-pulse" size={20} />
                    <Sparkles className="absolute bottom-10 left-10 text-yellow-500 animate-ping" size={16} />
                </div>
                <div className="relative z-10">
                    <div className="w-24 h-24 bg-gradient-to-br from-amber-400 to-orange-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl rotate-6">
                        <PartyPopper size={48} className="text-white" />
                    </div>
                    <h2 className="text-3xl font-black text-stone-800 mb-2 uppercase italic tracking-tighter">
                        NIVEAU <span className="text-amber-500">{level}</span> !
                    </h2>
                    <p className="text-stone-500 font-medium mb-8 leading-relaxed italic text-base">
                        "{getLevelUpMessage(level)}"
                    </p>
                    <div className="space-y-3">
                        <button 
                            onClick={onConfirm}
                            className="w-full py-5 bg-stone-800 hover:bg-stone-900 text-white rounded-2xl font-black shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 text-lg"
                        >
                            VOIR MON RANG <ChevronRight size={18} />
                        </button>
                        <button 
                            onClick={onClose}
                            className="w-full py-3 text-stone-400 hover:text-stone-600 font-black text-sm uppercase tracking-widest"
                        >
                            Plus tard
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default App;