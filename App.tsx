import React, { useState, useEffect } from 'react'; 
import { Home, PlusCircle, ScrollText, Settings, Fish, Bot } from 'lucide-react'; 

import { 
  onSnapshot, query, orderBy, QuerySnapshot, DocumentData, 
  addDoc, deleteDoc, doc, Timestamp, updateDoc, collection
} from 'firebase/firestore'; 

import SessionForm from './components/SessionForm';
import Dashboard from './components/Dashboard';
import HistoryView from './components/HistoryView';
import ArsenalView from './components/ArsenalView';
import CoachView from './components/CoachView'; 

// Import des nouveaux types V3.1
import { Session, AppData, Spot, Setup, Technique, Lure, RefLureType, RefColor, RefSize, RefWeight } from './types';
import { db, sessionsCollection, clearChatHistory } from './lib/firebase'; 

type View = 'dashboard' | 'session' | 'history' | 'arsenal' | 'coach';

const App: React.FC = () => {
    const [currentView, setCurrentView] = useState<View>('dashboard'); 
    const [sessions, setSessions] = useState<Session[]>([]); 
    const [isLoading, setIsLoading] = useState(true); 
    const [editingSession, setEditingSession] = useState<Session | null>(null);

    // Initialisation complète de l'état Arsenal V3.1
    const [arsenalData, setArsenalData] = useState<AppData>({
        spots: [],
        setups: [],
        techniques: [],
        lures: [], // Legacy, gardé pour compatibilité
        lureTypes: [],
        colors: [],
        sizes: [],
        weights: []
    });
    const [isArsenalLoading, setIsArsenalLoading] = useState(true);

    // Nettoyage chat
    useEffect(() => {
        let timer: NodeJS.Timeout | null = null;
        if (currentView !== 'coach') {
            timer = setTimeout(() => {
                clearChatHistory().catch(err => console.error("Erreur chat:", err));
            }, 500); 
        }
        return () => { if (timer) clearTimeout(timer); };
    }, [currentView]); 

    // Sync Sessions (inchangé, robuste V3)
    useEffect(() => {
        const q = query(sessionsCollection, orderBy('date', 'desc')); 
        const unsubscribe = onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
            const fetchedSessions: Session[] = snapshot.docs.map(doc => {
                const data = doc.data();
                let dateString = '';
                if (data.date instanceof Timestamp) dateString = data.date.toDate().toISOString().split('T')[0];
                else if (typeof data.date === 'string') dateString = data.date;

                return {
                    id: doc.id, 
                    date: dateString, 
                    // Mapping de compatibilité V2->V3.1 (zone -> spot)
                    spotId: data.spotId || data.zoneId || '',
                    spotName: data.spotName || data.zoneName || data.zone || 'Spot Inconnu',
                    setupId: data.setupId || '',
                    setupName: data.setupName || data.setup || 'Setup Inconnu',
                    techniquesUsed: data.techniquesUsed || [], 
                    catches: data.catches || [],
                    misses: data.misses || [],
                    weather: data.weather || null, 
                    waterTemp: data.waterTemp || null,
                    hydro: data.hydro || null,
                    bioScore: data.bioScore || null,
                    startTime: data.startTime || '08:00',
                    endTime: data.endTime || '11:00',
                    durationMinutes: data.durationMinutes || 0,
                    catchCount: data.catchCount || 0,
                    notes: data.notes || '',
                    feelingScore: data.feelingScore || 5,
                    userId: data.userId || 'user_1',
                    active: true
                } as Session;
            });
            setSessions(fetchedSessions);
            setIsLoading(false); 
        }, (error) => {
            console.error("Erreur sessions:", error);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, []); 

    // --- SYNC ARSENAL V3.1 (Toutes les collections) ---
    useEffect(() => {
        // 1. Spots (ex-Zones) - On écoute 'zones' pour l'instant (transition douce)
        const unsubSpots = onSnapshot(query(collection(db, 'zones'), orderBy('label')), (snap) => {
            setArsenalData(prev => ({ ...prev, spots: snap.docs.map(d => ({ id: d.id, ...d.data() } as Spot)) }));
        });
        // 2. Setups
        const unsubSetups = onSnapshot(query(collection(db, 'setups'), orderBy('label')), (snap) => {
            setArsenalData(prev => ({ ...prev, setups: snap.docs.map(d => ({ id: d.id, ...d.data() } as Setup)) }));
        });
        // 3. Techniques
        const unsubTechs = onSnapshot(query(collection(db, 'techniques'), orderBy('label')), (snap) => {
            setArsenalData(prev => ({ ...prev, techniques: snap.docs.map(d => ({ id: d.id, ...d.data() } as Technique)) }));
        });
        
        // --- NOUVELLES COLLECTIONS ---
        const unsubLureTypes = onSnapshot(query(collection(db, 'ref_lure_types'), orderBy('label')), (snap) => {
            setArsenalData(prev => ({ ...prev, lureTypes: snap.docs.map(d => ({ id: d.id, ...d.data() } as RefLureType)) }));
        });
        const unsubColors = onSnapshot(query(collection(db, 'ref_colors'), orderBy('label')), (snap) => {
            setArsenalData(prev => ({ ...prev, colors: snap.docs.map(d => ({ id: d.id, ...d.data() } as RefColor)) }));
        });
        const unsubSizes = onSnapshot(query(collection(db, 'ref_sizes'), orderBy('label')), (snap) => {
            setArsenalData(prev => ({ ...prev, sizes: snap.docs.map(d => ({ id: d.id, ...d.data() } as RefSize)) }));
        });
        const unsubWeights = onSnapshot(query(collection(db, 'ref_weights'), orderBy('label')), (snap) => {
            setArsenalData(prev => ({ ...prev, weights: snap.docs.map(d => ({ id: d.id, ...d.data() } as RefWeight)) }));
        });

        setIsArsenalLoading(false);
        return () => { 
            unsubSpots(); unsubSetups(); unsubTechs(); 
            unsubLureTypes(); unsubColors(); unsubSizes(); unsubWeights(); 
        };
    }, []);

    // Handlers Génériques (Create/Delete/Update)
    const handleAddItem = async (col: string, label: string) => {
        if (!label.trim()) return;
        try { 
            await addDoc(collection(db, col), { label: label.trim(), userId: 'user_1', active: true, createdAt: Timestamp.now() }); 
        } catch (e) { console.error(e); }
    };

    const handleDeleteItem = async (col: string, id: string) => {
        try { await deleteDoc(doc(db, col, id)); } catch (e) { console.error(e); }
    };

    const handleEditItem = async (col: string, id: string, label: string) => {
        try { await updateDoc(doc(db, col, id), { label, updatedAt: Timestamp.now() }); }
        catch (e) { console.error(e); }
    };

    // --- GESTION SESSIONS ---
    const handleAddSession = async (newSession: Session) => { 
        try {
            const { id, date, ...dataToSave } = newSession; 
            const finalDate = date ? new Date(date) : new Date();
            await addDoc(sessionsCollection, { 
                date: Timestamp.fromDate(finalDate), 
                ...dataToSave,
                createdAt: Timestamp.now()
            });
            setCurrentView('dashboard'); 
        } catch (error) { console.error("Erreur sauvegarde session:", error); }
    };

    const handleUpdateSession = async (id: string, updatedData: Partial<Session>) => {
        try {
            const { date, ...data } = updatedData;
            const updatePayload: any = { ...data };
            if (date) {
                updatePayload.date = Timestamp.fromDate(new Date(date as string));
            }
            await updateDoc(doc(db, 'sessions', id), updatePayload);
            setEditingSession(null);
            setCurrentView('history');
        } catch (error) { console.error("Erreur mise à jour session:", error); }
    };

    const handleDeleteSession = async (id: string) => { 
        try { await deleteDoc(doc(sessionsCollection, id)); } 
        catch (error) { console.error("Erreur suppression session:", error); }
    };

    const handleEditRequest = (session: Session) => {
        setEditingSession(session);
        setCurrentView('session');
    };

    const renderContent = () => { 
        if (isLoading || isArsenalLoading) return <div className="p-20 text-center animate-pulse font-bold text-stone-400">Synchronisation Oracle V3.1...</div>;
        
        switch (currentView) {
            case 'dashboard': return <Dashboard sessions={sessions} onDeleteSession={handleDeleteSession} onEditSession={handleEditRequest} />; 
            case 'session': return (
                <SessionForm 
                    onAddSession={handleAddSession} 
                    onUpdateSession={handleUpdateSession}
                    initialData={editingSession}
                    // Mapping vers les nouvelles props (spots au lieu de zones)
                    zones={arsenalData.spots} 
                    setups={arsenalData.setups} 
                    techniques={arsenalData.techniques} 
                    lures={arsenalData.lures}
                    // TODO: Ajouter plus tard les refs aux dialogs de prise
                />
            );
            case 'history': return <HistoryView sessions={sessions} onDeleteSession={handleDeleteSession} onEditSession={handleEditRequest} />; 
            case 'arsenal': return (
                <ArsenalView 
                    // SPOTS
                    spots={arsenalData.spots} 
                    onAddSpot={(l) => handleAddItem('zones', l)} // On garde la collection 'zones' pour l'instant
                    onDeleteSpot={(id) => handleDeleteItem('zones', id)} 
                    onEditSpot={(id, l) => handleEditItem('zones', id, l)}
                    // SETUPS
                    setups={arsenalData.setups} 
                    onAddSetup={(l) => handleAddItem('setups', l)} 
                    onDeleteSetup={(id) => handleDeleteItem('setups', id)} 
                    onEditSetup={(id, l) => handleEditItem('setups', id, l)}
                    // TECHNIQUES
                    techniques={arsenalData.techniques} 
                    onAddTechnique={(l) => handleAddItem('techniques', l)} 
                    onDeleteTechnique={(id) => handleDeleteItem('techniques', id)} 
                    onEditTechnique={(id, l) => handleEditItem('techniques', id, l)}
                    // --- NOUVEAUX ---
                    lureTypes={arsenalData.lureTypes}
                    onAddLureType={(l) => handleAddItem('ref_lure_types', l)}
                    onDeleteLureType={(id) => handleDeleteItem('ref_lure_types', id)}
                    onEditLureType={(id, l) => handleEditItem('ref_lure_types', id, l)}
                    
                    colors={arsenalData.colors}
                    onAddColor={(l) => handleAddItem('ref_colors', l)}
                    onDeleteColor={(id) => handleDeleteItem('ref_colors', id)}
                    onEditColor={(id, l) => handleEditItem('ref_colors', id, l)}
                    
                    sizes={arsenalData.sizes}
                    onAddSize={(l) => handleAddItem('ref_sizes', l)}
                    onDeleteSize={(id) => handleDeleteItem('ref_sizes', id)}
                    onEditSize={(id, l) => handleEditItem('ref_sizes', id, l)}
                    
                    weights={arsenalData.weights}
                    onAddWeight={(l) => handleAddItem('ref_weights', l)}
                    onDeleteWeight={(id) => handleDeleteItem('ref_weights', id)}
                    onEditWeight={(id, l) => handleEditItem('ref_weights', id, l)}
                />
            );
            case 'coach': return <CoachView />;
            default: return <Dashboard sessions={sessions} onDeleteSession={handleDeleteSession} onEditSession={handleEditRequest} />; 
        }
    };

    return ( 
        <div className="min-h-screen bg-[#FAF9F6] pb-24 text-stone-600">
            <header className="sticky top-0 z-30 border-b border-stone-100 bg-white/80 p-4 backdrop-blur-md"> 
                <div className="mx-auto flex max-w-5xl items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 p-2 text-white shadow-lg"><Fish size={20} /></div>
                        <div><h1 className="text-lg font-bold text-stone-800">Fishing Oracle</h1><span className="text-[10px] font-bold text-amber-600 tracking-widest">V3.1 NANTERRE</span></div>
                    </div> 
                </div>
            </header>
            
            <main className="mx-auto max-w-xl p-4 lg:max-w-5xl">{renderContent()}</main>
            
            <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-stone-200 bg-white pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)]"> 
                <div className="mx-auto flex max-w-lg items-center justify-around py-3">
                    <button onClick={() => { setEditingSession(null); setCurrentView('dashboard'); }} className={`flex flex-col items-center gap-1 transition-colors ${currentView === 'dashboard' ? 'text-amber-600' : 'text-stone-400'}`}><Home size={24} /><span className="text-[10px] font-bold uppercase tracking-tighter">Oracle</span></button>
                    <button onClick={() => setCurrentView('history')} className={`flex flex-col items-center gap-1 transition-colors ${currentView === 'history' ? 'text-amber-600' : 'text-stone-400'}`}><ScrollText size={24} /><span className="text-[10px] font-bold uppercase tracking-tighter">Journal</span></button>
                    
                    <div className="relative -top-6">
                        <button onClick={() => { setEditingSession(null); setCurrentView('session'); }} className="rounded-full border-4 border-[#FAF9F6] bg-stone-800 p-4 text-white shadow-2xl active:scale-95 transition-transform">
                            <PlusCircle size={32} />
                        </button>
                    </div>
                    
                    <button onClick={() => setCurrentView('coach')} className={`flex flex-col items-center gap-1 transition-colors ${currentView === 'coach' ? 'text-emerald-600' : 'text-stone-400'}`}><Bot size={24} /><span className="text-[10px] font-bold uppercase tracking-tighter">Coach</span></button>
                    <button onClick={() => setCurrentView('arsenal')} className={`flex flex-col items-center gap-1 transition-colors ${currentView === 'arsenal' ? 'text-amber-600' : 'text-stone-400'}`}><Settings size={24} /><span className="text-[10px] font-bold uppercase tracking-tighter">Arsenal</span></button>
                </div>
            </nav>
        </div>
    );
}; 

export default App;