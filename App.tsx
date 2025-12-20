import React, { useState, useEffect } from 'react'; 
import { Home, PlusCircle, ScrollText, Settings, Fish, Bot, User, Menu, X, ChevronRight, Users } from 'lucide-react';

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

import { Session, AppData, Spot, Setup, Technique, RefLureType, RefColor, RefSize, RefWeight, UserProfile } from './types';
import { db, sessionsCollection, clearChatHistory } from './lib/firebase'; 
import { getUserProfile, createUserProfile } from './lib/user-service';

type View = 'dashboard' | 'session' | 'history' | 'arsenal' | 'coach' | 'profile';

const App: React.FC = () => {
    // --- GESTION USER ID (Dynamique pour le test) ---
    // Par défaut 'user_1', on peut switcher vers 'user_2'
    const [currentUserId, setCurrentUserId] = useState("user_1"); 

    const [currentView, setCurrentView] = useState<View>('dashboard'); 
    const [sessions, setSessions] = useState<Session[]>([]); 
    const [isLoading, setIsLoading] = useState(true); 
    const [editingSession, setEditingSession] = useState<Session | null>(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [isProfileLoading, setIsProfileLoading] = useState(true);
    const [tempPseudo, setTempPseudo] = useState("");

    const [arsenalData, setArsenalData] = useState<AppData>({
        spots: [], setups: [], techniques: [], lures: [], 
        lureTypes: [], colors: [], sizes: [], weights: []
    });
    const [isArsenalLoading, setIsArsenalLoading] = useState(true);

    // --- RECHARGER LE PROFIL AU SWITCH USER ---
    useEffect(() => {
        setIsProfileLoading(true);
        setUserProfile(null); 
        
        const loadProfile = async () => {
            const profile = await getUserProfile(currentUserId);
            setUserProfile(profile);
            setIsProfileLoading(false);
        };
        loadProfile();
    }, [currentUserId]); 

    // --- CHARGEMENT DES SESSIONS (GLOBAL - SOCIAL) ---
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
                    spotId: data.spotId || '', spotName: data.spotName || 'Spot Inconnu',
                    setupId: data.setupId || '', setupName: data.setupName || 'Setup Inconnu',
                    techniquesUsed: data.techniquesUsed || [], 
                    catches: (data.catches || []).map((c: any) => ({...c, userId: c.userId || data.userId})),
                    misses: (data.misses || []).map((m: any) => ({...m, userId: m.userId || data.userId})),
                    weather: data.weather || null, waterTemp: data.waterTemp || null, hydro: data.hydro || null,
                    bioScore: data.bioScore || null,
                    startTime: data.startTime || '08:00', endTime: data.endTime || '11:00', durationMinutes: data.durationMinutes || 0,
                    catchCount: data.catchCount || 0, notes: data.notes || '', feelingScore: data.feelingScore || 5,
                    
                    userId: data.userId || 'inconnu',
                    userPseudo: data.userPseudo || 'Inconnu',
                    userAvatar: data.userAvatar || null,
                    
                    active: true
                } as Session;
            });
            setSessions(fetchedSessions);
            setIsLoading(false); 
        });

        return () => unsubscribeSessions();
    }, []);

    // ARSENAL GLOBAL
    useEffect(() => {
        const getQuery = (colName: string) => query(collection(db, colName), orderBy('label'));
        const unsubSpots = onSnapshot(getQuery('zones'), (snap) => setArsenalData(prev => ({ ...prev, spots: snap.docs.map(d => ({ id: d.id, ...d.data() } as Spot)) })));
        const unsubSetups = onSnapshot(getQuery('setups'), (snap) => setArsenalData(prev => ({ ...prev, setups: snap.docs.map(d => ({ id: d.id, ...d.data() } as Setup)) })));
        const unsubTechs = onSnapshot(getQuery('techniques'), (snap) => setArsenalData(prev => ({ ...prev, techniques: snap.docs.map(d => ({ id: d.id, ...d.data() } as Technique)) })));
        const unsubLureTypes = onSnapshot(getQuery('ref_lure_types'), (snap) => setArsenalData(prev => ({ ...prev, lureTypes: snap.docs.map(d => ({ id: d.id, ...d.data() } as RefLureType)) })));
        const unsubColors = onSnapshot(getQuery('ref_colors'), (snap) => setArsenalData(prev => ({ ...prev, colors: snap.docs.map(d => ({ id: d.id, ...d.data() } as RefColor)) })));
        const unsubSizes = onSnapshot(getQuery('ref_sizes'), (snap) => setArsenalData(prev => ({ ...prev, sizes: snap.docs.map(d => ({ id: d.id, ...d.data() } as RefSize)) })));
        const unsubWeights = onSnapshot(getQuery('ref_weights'), (snap) => setArsenalData(prev => ({ ...prev, weights: snap.docs.map(d => ({ id: d.id, ...d.data() } as RefWeight)) })));
        setIsArsenalLoading(false);
        return () => { unsubSpots(); unsubSetups(); unsubTechs(); unsubLureTypes(); unsubColors(); unsubSizes(); unsubWeights(); };
    }, []);

    const handleAddItem = async (col: string, label: string) => {
        if (!label.trim()) return;
        try { await addDoc(collection(db, col), { label: label.trim(), userId: currentUserId, active: true, createdAt: Timestamp.now() }); } catch (e) { console.error(e); }
    };
    const handleDeleteItem = async (col: string, id: string) => { try { await deleteDoc(doc(db, col, id)); } catch (e) { console.error(e); } };
    const handleEditItem = async (col: string, id: string, label: string) => { try { await updateDoc(doc(db, col, id), { label, updatedAt: Timestamp.now() }); } catch (e) { console.error(e); } };

    const handleAddSession = async (newSession: Session) => { 
        try {
            const { id, date, ...dataToSave } = newSession; 
            const finalDate = date ? new Date(date) : new Date();
            const catchesWithUser = (dataToSave.catches || []).map(c => ({...c, userId: currentUserId}));
            const missesWithUser = (dataToSave.misses || []).map(m => ({...m, userId: currentUserId}));

            await addDoc(collection(db, 'sessions'), { 
                date: Timestamp.fromDate(finalDate), 
                ...dataToSave, catches: catchesWithUser, misses: missesWithUser, 
                userId: currentUserId, 
                userPseudo: userProfile?.pseudo || 'Inconnu', 
                userAvatar: userProfile?.avatarBase64 || null, 
                createdAt: Timestamp.now() 
            });
            setCurrentView('dashboard'); 
        } catch (error) { console.error(error); }
    };

    const handleUpdateSession = async (id: string, updatedData: Partial<Session>) => {
        const originalSession = sessions.find(s => s.id === id);
        if (originalSession && originalSession.userId !== currentUserId) return;

        try {
            const { date, ...data } = updatedData;
            const updatePayload: any = { ...data };
            if (date) updatePayload.date = Timestamp.fromDate(new Date(date as string));
            if (updatePayload.catches) updatePayload.catches = updatePayload.catches.map((c: any) => ({...c, userId: c.userId || currentUserId}));
            if (updatePayload.misses) updatePayload.misses = updatePayload.misses.map((m: any) => ({...m, userId: m.userId || currentUserId}));
            await updateDoc(doc(db, 'sessions', id), updatePayload);
            setEditingSession(null);
            setCurrentView('history');
        } catch (error) { console.error(error); }
    };

    const handleDeleteSession = async (id: string) => { 
        const sessionToDelete = sessions.find(s => s.id === id);
        if (sessionToDelete && sessionToDelete.userId !== currentUserId) return;
        try { await deleteDoc(doc(sessionsCollection, id)); } catch (error) { console.error(error); }
    };

    const handleEditRequest = (session: Session) => {
        if (session.userId !== currentUserId) return;
        setEditingSession(session);
        setCurrentView('session');
    };

    const handleCreateProfile = async (e: React.FormEvent) => {
        e.preventDefault(); if (!tempPseudo.trim()) return;
        const newProfile = await createUserProfile(currentUserId, tempPseudo); setUserProfile(newProfile);
    };

    const navigateFromMenu = (view: View) => { setEditingSession(null); setCurrentView(view); setIsMenuOpen(false); };

    // --- BOUTON DE DEBUG POUR SWITCHER USER ---
    const toggleUser = () => {
        const nextUser = currentUserId === 'user_1' ? 'user_2' : 'user_1';
        setCurrentUserId(nextUser);
    };

    if (isProfileLoading || isLoading) return <div className="flex h-screen items-center justify-center bg-[#FDFBF7]"><div className="animate-spin text-amber-500 font-bold">Chargement ({currentUserId})...</div></div>;

    if (!userProfile) {
        return (
            <div className="flex h-screen flex-col items-center justify-center bg-[#FDFBF7] p-6 text-center animate-in fade-in duration-500">
                <div className="bg-white p-8 rounded-[2rem] shadow-2xl border border-stone-100 max-w-sm w-full">
                    <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner"><User size={40} className="text-amber-600" /></div>
                    <h1 className="text-2xl font-black text-stone-800 mb-2">Bienvenue !</h1>
                    <p className="text-stone-500 mb-8 text-sm font-medium">Création du profil pour l'ID : <span className="font-mono text-xs bg-stone-100 px-2 py-1 rounded">{currentUserId}</span></p>
                    <form onSubmit={handleCreateProfile} className="space-y-4">
                        <input type="text" placeholder="Choisir un Pseudo..." value={tempPseudo} onChange={(e) => setTempPseudo(e.target.value)} className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl font-black text-center text-stone-800 outline-none focus:ring-2 focus:ring-amber-400 placeholder:text-stone-300" autoFocus />
                        <button type="submit" disabled={!tempPseudo.trim()} className="w-full py-4 bg-stone-800 text-white rounded-2xl font-black shadow-lg hover:bg-stone-900 disabled:opacity-50 transition-all active:scale-95">Créer Profil</button>
                    </form>
                    {currentUserId !== 'user_1' && (
                        <button onClick={toggleUser} className="mt-4 text-xs text-stone-400 underline">Retourner sur user_1</button>
                    )}
                </div>
            </div>
        );
    }

    const renderContent = () => { 
        switch (currentView) {
            case 'dashboard': return (
                <Dashboard 
                    sessions={sessions} onDeleteSession={handleDeleteSession} onEditSession={handleEditRequest} 
                    userName={userProfile.pseudo} currentUserId={currentUserId} 
                />
            ); 
            case 'session': return (
                <SessionForm 
                    onAddSession={handleAddSession} onUpdateSession={handleUpdateSession} initialData={editingSession}
                    zones={arsenalData.spots} setups={arsenalData.setups} techniques={arsenalData.techniques} lures={arsenalData.lures}
                    lureTypes={arsenalData.lureTypes} colors={arsenalData.colors} sizes={arsenalData.sizes} weights={arsenalData.weights}                
                />  
            );
            case 'history': return (
                <HistoryView sessions={sessions} onDeleteSession={handleDeleteSession} onEditSession={handleEditRequest} currentUserId={currentUserId} />
            );
            case 'arsenal': return (
                <ArsenalView 
                    spots={arsenalData.spots} onAddSpot={(l) => handleAddItem('zones', l)} onDeleteSpot={(id) => handleDeleteItem('zones', id)} onEditSpot={(id, l) => handleEditItem('zones', id, l)}
                    setups={arsenalData.setups} onAddSetup={(l) => handleAddItem('setups', l)} onDeleteSetup={(id) => handleDeleteItem('setups', id)} onEditSetup={(id, l) => handleEditItem('setups', id, l)}
                    techniques={arsenalData.techniques} onAddTechnique={(l) => handleAddItem('techniques', l)} onDeleteTechnique={(id) => handleDeleteItem('techniques', id)} onEditTechnique={(id, l) => handleEditItem('techniques', id, l)}
                    lureTypes={arsenalData.lureTypes} onAddLureType={(l) => handleAddItem('ref_lure_types', l)} onDeleteLureType={(id) => handleDeleteItem('ref_lure_types', id)} onEditLureType={(id, l) => handleEditItem('ref_lure_types', id, l)}
                    colors={arsenalData.colors} onAddColor={(l) => handleAddItem('ref_colors', l)} onDeleteColor={(id) => handleDeleteItem('ref_colors', id)} onEditColor={(id, l) => handleEditItem('ref_colors', id, l)}
                    sizes={arsenalData.sizes} onAddSize={(l) => handleAddItem('ref_sizes', l)} onDeleteSize={(id) => handleDeleteItem('ref_sizes', id)} onEditSize={(id, l) => handleEditItem('ref_sizes', id, l)}
                    weights={arsenalData.weights} onAddWeight={(l) => handleAddItem('ref_weights', l)} onDeleteWeight={(id) => handleDeleteItem('ref_weights', id)} onEditWeight={(id, l) => handleEditItem('ref_weights', id, l)}
                    
                    // --- CORRECTION : AJOUT DE LA PROP MANQUANTE ---
                    currentUserId={currentUserId} 
                />
            );
            case 'coach': return <CoachView />;
            case 'profile': return <ProfileView userProfile={userProfile} sessions={sessions} onUpdateProfile={setUserProfile} />;
            default: return <Dashboard sessions={sessions} onDeleteSession={handleDeleteSession} onEditSession={handleEditRequest} userName={userProfile.pseudo} currentUserId={currentUserId} />; 
        }
    };

    return ( 
        <div className="min-h-screen bg-[#FAF9F6] pb-24 text-stone-600">
            {/* BOUTON DEBUG SWITCH USER */}
            <button 
                onClick={toggleUser}
                className="fixed bottom-24 right-4 z-50 bg-stone-800 text-white p-3 rounded-full shadow-2xl border-2 border-white flex items-center gap-2 hover:scale-110 transition-transform"
                title={`Switch User (Actuel: ${userProfile.pseudo})`}
            >
                <Users size={20} />
                <span className="text-xs font-bold hidden sm:inline">Switch {currentUserId === 'user_1' ? 'User 2' : 'User 1'}</span>
            </button>

            <header className="sticky top-0 z-30 border-b border-stone-100 bg-white/80 p-4 backdrop-blur-md"> 
                <div className="mx-auto flex max-w-5xl items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setIsMenuOpen(true)} className="p-2 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-xl transition-colors"><Menu size={24} strokeWidth={2.5} /></button>
                        <div className="flex items-center gap-3">
                            <div className="rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 p-2 text-white shadow-lg"><Fish size={20} /></div>
                            <div>
                                <h1 className="text-lg font-bold text-stone-800">Fishing Oracle</h1>
                                <span className="text-[10px] font-bold text-amber-600 tracking-widest">V3.3 • {userProfile.pseudo.toUpperCase()}</span>
                            </div>
                        </div> 
                    </div>
                </div>
            </header>
            
            {isMenuOpen && (
                <>
                    <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm z-50 animate-in fade-in duration-300" onClick={() => setIsMenuOpen(false)} />
                    <aside className="fixed top-0 left-0 h-full w-3/4 max-w-xs bg-white z-[60] shadow-2xl p-6 animate-in slide-in-from-left duration-300 flex flex-col">
                        <div className="flex justify-between items-center mb-8"><span className="text-xs font-bold text-stone-400 uppercase tracking-widest">Menu</span><button onClick={() => setIsMenuOpen(false)} className="p-2 text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded-full"><X size={20} /></button></div>
                        <div className="flex items-center gap-4 mb-8 bg-stone-50 p-4 rounded-2xl border border-stone-100">
                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center border-2 border-amber-100 text-amber-500 shadow-sm">
                                {userProfile.avatarBase64 ? <img src={userProfile.avatarBase64} alt="Avatar" className="w-full h-full rounded-full object-cover"/> : <User size={24} />}
                            </div>
                            <div><div className="font-black text-stone-800 text-lg leading-none">{userProfile.pseudo}</div><div className="text-xs text-stone-400 font-medium mt-1">Niveau 3 • Soldat</div></div>
                        </div>
                        <nav className="space-y-2 flex-1">
                            <button onClick={() => navigateFromMenu('profile')} className="w-full flex items-center justify-between p-4 rounded-2xl text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition-all group font-bold"><span className="flex items-center gap-3"><User size={20} className="group-hover:text-amber-500 transition-colors"/> Mon Profil</span><ChevronRight size={16} className="text-stone-300 group-hover:text-stone-500" /></button>
                        </nav>
                        <div className="mt-auto pt-6 border-t border-stone-100 text-center"><p className="text-[10px] text-stone-300">Fishing Oracle v3.3<br/>Dev Mode</p></div>
                    </aside>
                </>
            )}

            <main className="mx-auto max-w-xl p-4 lg:max-w-5xl">{renderContent()}</main>
            
            <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-stone-200 bg-white pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)]"> 
                <div className="mx-auto flex max-w-lg items-center justify-around py-3">
                    <button onClick={() => { setEditingSession(null); setCurrentView('dashboard'); }} className={`flex flex-col items-center gap-1 transition-colors ${currentView === 'dashboard' ? 'text-amber-600' : 'text-stone-400'}`}><Home size={24} /><span className="text-[10px] font-bold uppercase tracking-tighter">Oracle</span></button>
                    <button onClick={() => setCurrentView('history')} className={`flex flex-col items-center gap-1 transition-colors ${currentView === 'history' ? 'text-amber-600' : 'text-stone-400'}`}><ScrollText size={24} /><span className="text-[10px] font-bold uppercase tracking-tighter">Journal</span></button>
                    <div className="relative -top-6"><button onClick={() => { setEditingSession(null); setCurrentView('session'); }} className="rounded-full border-4 border-[#FAF9F6] bg-stone-800 p-4 text-white shadow-2xl active:scale-95 transition-transform"><PlusCircle size={32} /></button></div>
                    <button onClick={() => setCurrentView('coach')} className={`flex flex-col items-center gap-1 transition-colors ${currentView === 'coach' ? 'text-emerald-600' : 'text-stone-400'}`}><Bot size={24} /><span className="text-[10px] font-bold uppercase tracking-tighter">Coach</span></button>
                    <button onClick={() => setCurrentView('arsenal')} className={`flex flex-col items-center gap-1 transition-colors ${currentView === 'arsenal' ? 'text-amber-600' : 'text-stone-400'}`}><Settings size={24} /><span className="text-[10px] font-bold uppercase tracking-tighter">Arsenal</span></button>
                </div>
            </nav>
        </div>
    );
}; 

export default App;