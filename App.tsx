// App.tsx
import React, { useState, useEffect, useMemo } from 'react'; 
import { Home, PlusCircle, ScrollText, Settings, Fish, Bot, User, Menu, X, ChevronRight, Users, MapPin } from 'lucide-react';
import { 
  onSnapshot, query, orderBy, 
  QuerySnapshot, DocumentData, 
  addDoc, deleteDoc, doc, Timestamp, updateDoc, collection 
} from 'firebase/firestore'; 

import SessionForm from './components/SessionForm';
import Dashboard from './components/Dashboard';
import HistoryView from './components/HistoryView';
import ArsenalView from './components/ArsenalView';
import CoachView from './components/CoachView'; 
import ProfileView from './components/ProfileView';
import MagicScanButton from './components/MagicScanButton';
import LocationsManager from './components/LocationsManager'; 

import { Session, UserProfile, Catch, WeatherSnapshot, Location } from './types'; 
import { db, sessionsCollection } from './lib/firebase'; 
import { getUserProfile, createUserProfile } from './lib/user-service';
import { useArsenal } from './lib/useArsenal'; 
import { fetchOracleChartData, OracleDataPoint } from './lib/oracle-service'; 
import { fetchUniversalWeather } from './lib/universal-weather-service'; 

type View = 'dashboard' | 'session' | 'history' | 'arsenal' | 'coach' | 'profile' | 'locations';

const App: React.FC = () => {
    // --- GESTION USER ID ---
    const [currentUserId, setCurrentUserId] = useState("user_1"); 

    const [currentView, setCurrentView] = useState<View>('dashboard'); 
    const [sessions, setSessions] = useState<Session[]>([]); 
    const [isLoading, setIsLoading] = useState(true); 
    const [editingSession, setEditingSession] = useState<Session | null>(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    
    // État pour le Manager de lieux
    const [showLocationsManager, setShowLocationsManager] = useState(false);

    // --- NOUVEL ÉTAT : BROUILLON MAGIC SCAN ---
    const [magicDraft, setMagicDraft] = useState<any>(null);

    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [isProfileLoading, setIsProfileLoading] = useState(true);
    const [tempPseudo, setTempPseudo] = useState("");
    
    // --- MICHAEL : ÉTATS LIFTÉS DU DASHBOARD ---
    const [activeLocationId, setActiveLocationId] = useState<string>("");
    const [oraclePoints, setOraclePoints] = useState<OracleDataPoint[]>([]);
    const [isOracleLoading, setIsOracleLoading] = useState(false);
    const [displayedWeather, setDisplayedWeather] = useState<WeatherSnapshot | null>(null);
    const [isWeatherLoading, setIsWeatherLoading] = useState(false);

    // --- UTILISATION DU HOOK ARSENAL ---
    const { 
        arsenalData, 
        handleAddItem, 
        handleDeleteItem, 
        handleEditItem, 
        handleMoveItem, 
        handleToggleLocationFavorite 
    } = useArsenal(currentUserId);

    // --- CALCUL DU SECTEUR PAR DÉFAUT (Logic Universelle) ---
    const defaultLocationId = useMemo(() => {
        if (!arsenalData.locations || arsenalData.locations.length === 0) return "";
        
        // 1. Priorité au favori
        const fav = arsenalData.locations.find(l => l.isFavorite);
        if (fav) return fav.id;

        // 2. Sinon le premier de la liste
        return arsenalData.locations[0].id;
    }, [arsenalData.locations]);

    // Initialisation de la sélection
    useEffect(() => { 
        if (!activeLocationId && defaultLocationId) {
            setActiveLocationId(defaultLocationId);
        }
        // Sécurité : Si la location active a été supprimée, on rebascule sur le défaut
        if (activeLocationId && arsenalData.locations.length > 0) {
            const exists = arsenalData.locations.find(l => l.id === activeLocationId);
            if (!exists) setActiveLocationId(defaultLocationId);
        }
    }, [defaultLocationId, activeLocationId, arsenalData.locations]);

    const activeLocation = useMemo(() => {
        return arsenalData.locations.find(l => l.id === activeLocationId);
    }, [arsenalData.locations, activeLocationId]);

    // --- SYNC ORACLE ---
    useEffect(() => {
        const syncOracle = async () => {
            if (!activeLocation?.coordinates) return;
            setIsOracleLoading(true);
            try {
                const points = await fetchOracleChartData(
                    activeLocation.coordinates.lat, 
                    activeLocation.coordinates.lng, 
                    activeLocation.morphology
                );
                setOraclePoints(points);
            } catch (err) { console.error("Oracle Sync Error:", err); }
            finally { setIsOracleLoading(false); }
        };
        syncOracle();
    }, [activeLocationId, activeLocation]);

    const liveOraclePoint = useMemo(() => {
        if (!oraclePoints.length) return null;
        const nowTs = Date.now();
        return oraclePoints.reduce((prev, curr) => Math.abs(curr.timestamp - nowTs) < Math.abs(prev.timestamp - nowTs) ? curr : prev);
    }, [oraclePoints]);

    // --- SYNC MÉTÉO ---
    useEffect(() => {
        const updateWeather = async () => {
            if (activeLocation?.coordinates) {
                setIsWeatherLoading(true);
                try {
                    const customData = await fetchUniversalWeather(activeLocation.coordinates.lat, activeLocation.coordinates.lng);
                    setDisplayedWeather(customData);
                } catch (e) { console.error("Weather Sync Error", e); }
                finally { setIsWeatherLoading(false); }
            }
        };
        updateWeather();
        const interval = setInterval(updateWeather, 15 * 60 * 1000);
        return () => clearInterval(interval);
    }, [activeLocation]);

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

    // --- USER PROFILE ---
    useEffect(() => {
        setIsProfileLoading(true);
        const loadProfile = async () => {
            const profile = await getUserProfile(currentUserId);
            setUserProfile(profile);
            setIsProfileLoading(false);
        };
        loadProfile();
    }, [currentUserId]); 

    // --- SESSIONS ---
    useEffect(() => {
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
    }, []); 

    const mySessions = sessions.filter(s => s.userId === currentUserId);
    const lastSession = mySessions.length > 0 ? mySessions[0] : null;
    const lastCatchDefaults: Catch | null = lastSession && lastSession.catches && lastSession.catches.length > 0 
        ? lastSession.catches[lastSession.catches.length - 1] 
        : null;

    const sanitizeForFirestore = (obj: any) => {
        return JSON.parse(JSON.stringify(obj, (key, value) => 
             value === undefined ? null : value
        ));
    };

    // --- HANDLERS ---
    const handleAddSession = async (newSession: Session) => { 
        try {
            const { id, date, ...dataToSave } = newSession; 
            const finalDate = date ? new Date(date) : new Date();
            const cleanData = sanitizeForFirestore(dataToSave);
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
        } catch (error) { console.error(error); }
    };

    const handleUpdateSession = async (id: string, updatedData: Partial<Session>) => {
        try {
            const { date, ...data } = updatedData;
            const updatePayload: any = { ...data };
            if (date) updatePayload.date = Timestamp.fromDate(new Date(date as string));
            
            await updateDoc(doc(db, 'sessions', id), updatePayload);
            setEditingSession(null);
            setCurrentView('history');
        } catch (error) { console.error(error); }
    };

    const handleSaveSession = async (session: Session) => {
        if (session.id) {
            await handleUpdateSession(session.id, session);
        } else {
            await handleAddSession(session);
        }
    };

    const handleDeleteSession = async (id: string) => {
        try {
            await deleteDoc(doc(db, 'sessions', id));
        } catch (error) {
            console.error("Erreur suppression session:", error);
        }
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

    const toggleUser = () => {
        const nextUser = currentUserId === 'user_1' ? 'user_2' : 'user_1';
        setCurrentUserId(nextUser);
    };

    const renderContent = () => { 
        if (showLocationsManager) {
            return (
                <LocationsManager 
                    locations={arsenalData.locations}
                    spots={arsenalData.spots}
                    onAddLocation={(l: string, coords: any) => handleAddItem('locations', l, coords ? { coordinates: coords } : undefined)}
                    onEditLocation={(id, l, extra) => handleEditItem('locations', id, l, extra)}
                    onDeleteLocation={(id: string) => handleDeleteItem('locations', id)}
                    onToggleFavorite={handleToggleLocationFavorite}
                    onMoveLocation={(id: string, dir: 'up' | 'down') => handleMoveItem('locations', id, dir)} 
                    
                    onAddSpot={(l: string, locId: string) => handleAddItem('zones', l, { locationId: locId })}
                    onDeleteSpot={(id: string) => handleDeleteItem('zones', id)}
                    onEditSpot={(id: string, l: string) => handleEditItem('zones', id, l)}

                    onBack={() => { setShowLocationsManager(false); }}
                />
            );
        }

        switch (currentView) {
            case 'dashboard': 
                return (
                    <Dashboard 
                        userName={userProfile?.pseudo || 'Pêcheur'}
                        currentUserId={currentUserId}
                        sessions={sessions}
                        
                        // Props Moteur Universel
                        oracleData={oraclePoints} 
                        isOracleLoading={isOracleLoading || isWeatherLoading}
                        
                        // Props de Gestion des Lieux
                        activeLocationLabel={activeLocation?.label || "Sélectionner un secteur"}
                        activeLocationId={activeLocationId}
                        availableLocations={arsenalData.locations}
                        onLocationClick={() => setShowLocationsManager(true)}
                        onLocationSelect={setActiveLocationId} 
                        // [CORRECTION] Ajout de la prop manquante exigée par l'interface DashboardProps
                        setActiveLocationId={setActiveLocationId}
                        
                        // Actions standard
                        onEditSession={(s) => { setEditingSession(s); setCurrentView('session'); }}
                        onDeleteSession={handleDeleteSession}
                        onMagicDiscovery={handleMagicDiscovery}
                        
                        // Props Arsenal
                        lureTypes={arsenalData.lureTypes}
                        colors={arsenalData.colors}
                        locations={arsenalData.locations}
                    />
                );
            case 'history':
                return <HistoryView sessions={sessions} onDeleteSession={handleDeleteSession} onEditSession={handleEditRequest} currentUserId={currentUserId} />;
            case 'arsenal':
                return (
                    <ArsenalView 
                        currentUserId={currentUserId}
                        setups={arsenalData.setups} 
                        onAddSetup={(l: string) => handleAddItem('setups', l)} 
                        onDeleteSetup={(id: string) => handleDeleteItem('setups', id)} 
                        onEditSetup={(id: string, l: string) => handleEditItem('setups', id, l)}
                        onMoveSetup={(id: string, dir: 'up' | 'down') => handleMoveItem('setups', id, dir)} 
                        techniques={arsenalData.techniques} 
                        onAddTechnique={(l: string) => handleAddItem('techniques', l)} 
                        onDeleteTechnique={(id: string) => handleDeleteItem('techniques', id)} 
                        onEditTechnique={(id: string, l: string) => handleEditItem('techniques', id, l)}
                        onMoveTechnique={(id: string, dir: 'up' | 'down') => handleMoveItem('techniques', id, dir)} 
                        lureTypes={arsenalData.lureTypes} 
                        onAddLureType={(l: string) => handleAddItem('ref_lure_types', l)} 
                        onDeleteLureType={(id: string) => handleDeleteItem('ref_lure_types', id)} 
                        onEditLureType={(id: string, l: string) => handleEditItem('ref_lure_types', id, l)}
                        onMoveLureType={(id: string, dir: 'up' | 'down') => handleMoveItem('ref_lure_types', id, dir)} 
                        colors={arsenalData.colors} 
                        onAddColor={(l: string) => handleAddItem('ref_colors', l)} 
                        onDeleteColor={(id: string) => handleDeleteItem('ref_colors', id)} 
                        onEditColor={(id: string, l: string) => handleEditItem('ref_colors', id, l)}
                        onMoveColor={(id: string, dir: 'up' | 'down') => handleMoveItem('ref_colors', id, dir)} 
                        sizes={arsenalData.sizes} 
                        onAddSize={(l: string) => handleAddItem('ref_sizes', l)} 
                        onDeleteSize={(id: string) => handleDeleteItem('ref_sizes', id)} 
                        onEditSize={(id: string, l: string) => handleEditItem('ref_sizes', id, l)}
                        onMoveSize={(id: string, dir: 'up' | 'down') => handleMoveItem('ref_sizes', id, dir)} 
                        weights={arsenalData.weights} 
                        onAddWeight={(l: string) => handleAddItem('ref_weights', l)} 
                        onDeleteWeight={(id: string) => handleDeleteItem('ref_weights', id)} 
                        onEditWeight={(id: string, l: string) => handleEditItem('ref_weights', id, l)}
                        onMoveWeight={(id: string, dir: 'up' | 'down') => handleMoveItem('ref_weights', id, dir)} 
                    />
                );
            case 'coach': 
                return (
                    <CoachView 
                        sessions={sessions} 
                        arsenalData={arsenalData} 
                        liveSnapshot={currentLiveSnapshot} 
                    />
                );
            case 'profile':
                return <ProfileView userProfile={userProfile!} sessions={sessions} onUpdateProfile={setUserProfile} />;
            case 'session':
                return (
                    <SessionForm 
                        onAddSession={handleAddSession}
                        onUpdateSession={(id, data) => handleSaveSession({ ...data, id } as Session)} 
                        initialData={editingSession}
                        initialDiscovery={magicDraft}
                        zones={arsenalData.spots} 
                        setups={arsenalData.setups}
                        techniques={arsenalData.techniques}
                        lures={arsenalData.lures}
                        lureTypes={arsenalData.lureTypes}
                        colors={arsenalData.colors}
                        sizes={arsenalData.sizes}
                        weights={arsenalData.weights}
                        locations={arsenalData.locations} 
                        defaultLocationId={activeLocationId} 
                        lastCatchDefaults={lastCatchDefaults}
                    />
                );
            default:
                return null;
        }
    };

    if (isProfileLoading || isLoading) return <div className="flex h-screen items-center justify-center bg-[#FDFBF7]"><div className="animate-spin text-amber-500 font-bold uppercase tracking-widest">Oracle v4.5 Loading...</div></div>;

    if (!userProfile) {
        return (
            <div className="flex h-screen flex-col items-center justify-center bg-[#FDFBF7] p-6 text-center animate-in fade-in duration-500">
                <div className="bg-white p-8 rounded-[2rem] shadow-2xl border border-stone-100 max-w-sm w-full">
                    <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner"><User size={40} className="text-amber-600" /></div>
                    <h1 className="text-2xl font-black text-stone-800 mb-2 tracking-tighter uppercase">Profil Oracle</h1>
                    <p className="text-stone-500 mb-8 text-sm font-medium">Initialisation pour l'ID : <span className="font-mono text-xs bg-stone-100 px-2 py-1 rounded">{currentUserId}</span></p>
                    <form onSubmit={handleCreateProfile} className="space-y-4">
                        <input type="text" placeholder="Pseudo..." value={tempPseudo} onChange={(e) => setTempPseudo(e.target.value)} className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl font-black text-center outline-none focus:ring-2 focus:ring-amber-400" autoFocus />
                        <button type="submit" disabled={!tempPseudo.trim()} className="w-full py-4 bg-stone-800 text-white rounded-2xl font-black shadow-lg">Lancer l'Oracle</button>
                    </form>
                </div>
            </div>
        );
    }

    return ( 
        <div className="min-h-screen bg-[#FAF9F6] pb-24 text-stone-600">
            {!showLocationsManager && (
                // [RESTAURATION HEADER] Ajout du bouton Menu (Burger)
                <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-stone-200 px-4 py-3 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-2">
                        {/* BOUTON MENU RESTAURÉ */}
                        <button onClick={() => setIsMenuOpen(true)} className="p-2 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-xl transition-colors">
                            <Menu size={24} strokeWidth={2.5} />
                        </button>
                        
                        <div className="w-8 h-8 bg-stone-800 rounded-lg flex items-center justify-center">
                            <Fish className="text-white" size={20} />
                        </div>
                        <span className="font-black text-lg tracking-tighter text-stone-800">SEINE<span className="text-amber-500">ORACLE</span></span>
                    </div>
                    <button onClick={() => setCurrentView('profile')} className="w-8 h-8 rounded-full bg-stone-100 overflow-hidden border border-stone-200">
                        {userProfile?.avatarBase64 ? <img src={userProfile.avatarBase64} alt="Profile" className="w-full h-full object-cover" /> : <User size={20} className="text-stone-400 m-auto mt-1" />}
                    </button>
                </header>
            )}

            {/* [RESTAURATION SIDEBAR] Menu latéral complet */}
            {isMenuOpen && (
                <>
                    <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm z-50 animate-in fade-in" onClick={() => setIsMenuOpen(false)} />
                    <aside className="fixed top-0 left-0 h-full w-3/4 max-w-xs bg-white z-[60] shadow-2xl p-6 animate-in slide-in-from-left flex flex-col">
                        <div className="flex justify-between items-center mb-8"><span className="text-xs font-bold text-stone-400 uppercase tracking-widest">Menu Principal</span><button onClick={() => setIsMenuOpen(false)} className="p-2 text-stone-400 hover:bg-stone-100 rounded-full"><X size={20} /></button></div>
                        <div className="flex items-center gap-4 mb-8 bg-stone-50 p-4 rounded-2xl border border-stone-100">
                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center border-2 border-amber-100 text-amber-500 overflow-hidden shadow-inner">
                                {userProfile?.avatarBase64 ? <img src={userProfile.avatarBase64} alt="Avatar" className="w-full h-full object-cover"/> : <User size={24} />}
                            </div>
                            <div><div className="font-black text-stone-800 text-lg leading-none">{userProfile?.pseudo}</div><div className="text-xs text-stone-400 font-medium mt-1">v4.5 Soldat du Quai</div></div>
                        </div>
                        <nav className="space-y-2 flex-1">
                            {/* Lien Mes Secteurs corrigé pour pointer vers LocationsManager */}
                            <button onClick={() => { setShowLocationsManager(true); setIsMenuOpen(false); }} className="w-full flex items-center justify-between p-4 rounded-2xl text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition-all font-bold">
                                <span className="flex items-center gap-3"><MapPin size={20} className="text-emerald-500"/> Mes Secteurs</span><ChevronRight size={16} />
                            </button>

                            <button onClick={() => navigateFromMenu('profile')} className="w-full flex items-center justify-between p-4 rounded-2xl text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition-all font-bold">
                                <span className="flex items-center gap-3"><User size={20} className="text-amber-500"/> Mon Profil</span><ChevronRight size={16} />
                            </button>
                        </nav>
                        <div className="mt-auto pt-6 border-t border-stone-100 text-center"><p className="text-[10px] text-stone-300 tracking-tighter uppercase font-bold">Seine Oracle v4.5 RAG Ready</p></div>
                    </aside>
                </>
            )}

            <main className="max-w-md mx-auto">
                {renderContent()}
            </main>

            <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-stone-200 bg-white pb-safe shadow-lg"> 
                <div className="mx-auto flex max-w-lg items-center justify-around py-3">
                    <button onClick={() => { setShowLocationsManager(false); setCurrentView('dashboard'); }} className={`flex flex-col items-center gap-1 ${currentView === 'dashboard' && !showLocationsManager ? 'text-amber-600' : 'text-stone-400'}`}><Home size={24} /><span className="text-[10px] font-bold uppercase tracking-tighter">Live</span></button>
                    <button onClick={() => { setEditingSession(null); setMagicDraft(null); setCurrentView('history'); }} className={`flex flex-col items-center gap-1 ${currentView === 'history' ? 'text-amber-600' : 'text-stone-400'}`}><ScrollText size={24} /><span className="text-[10px] font-bold uppercase tracking-tighter">Journal</span></button>
                    
                    <div className="relative -top-6 flex items-center justify-center gap-3">
                        <button onClick={() => { setEditingSession(null); setMagicDraft(null); setCurrentView('session'); }} 
                                className="rounded-full border-4 border-[#FAF9F6] bg-stone-800 p-4 text-white shadow-2xl active:scale-95 transition-all">
                            <PlusCircle size={32} />
                        </button>
                        
                        <MagicScanButton 
                            userPseudo={userProfile?.pseudo || "Michael"}
                            lureTypes={arsenalData.lureTypes}
                            colors={arsenalData.colors}
                            onDiscoveryComplete={handleMagicDiscovery}
                        />
                    </div>

                    <button onClick={() => { setEditingSession(null); setMagicDraft(null); setCurrentView('coach'); }} className={`flex flex-col items-center gap-1 ${currentView === 'coach' ? 'text-emerald-600' : 'text-stone-400'}`}><Bot size={24} /><span className="text-[10px] font-bold uppercase tracking-tighter">Coach</span></button>
                    <button onClick={() => { setEditingSession(null); setMagicDraft(null); setCurrentView('arsenal'); }} className={`flex flex-col items-center gap-1 ${currentView === 'arsenal' ? 'text-amber-600' : 'text-stone-400'}`}><Settings size={24} /><span className="text-[10px] font-bold uppercase tracking-tighter">Arsenal</span></button>
                </div>
            </nav>
        </div>
    );
}; 

export default App;