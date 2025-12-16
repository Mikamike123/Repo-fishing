import React, { useState, useEffect } from 'react'; 
import { Home, PlusCircle, ScrollText, Settings, Fish, Bot } from 'lucide-react'; 

// Imports Firestore pour le listener et le CRUD
import { 
  onSnapshot, query, orderBy, QuerySnapshot, DocumentData, 
  addDoc, deleteDoc, doc, Timestamp, 
  getDoc, setDoc, updateDoc 
} from 'firebase/firestore'; 

import SessionForm from './components/SessionForm';
import Dashboard from './components/Dashboard';
import HistoryView from './components/HistoryView';
import ArsenalView from './components/ArsenalView';
import CoachView from './components/CoachView'; 
import { Session, ArsenalConfig } from './types'; 
// Import de clearChatHistory pour la réinitialisation UX
import { sessionsCollection, configDocRef, clearChatHistory } from './lib/firebase'; 


type View = 'dashboard' | 'session' | 'history' | 'arsenal' | 'coach';

// Valeurs par défaut initiales pour l'Arsenal
const DEFAULT_ARSENAL: ArsenalConfig = {
    zones: ["Jaune", "Rouge", "Papeteries", "Piles de Pont"],
    setups: ["Combo Hiver (Light)", "Combo Été (Power)", "Combo Test"],
    techniques: ["Linéaire", "Gratte", "Verticale", "Surface", "Drop Shot"],
};

const App: React.FC = () => {
    const [currentView, setCurrentView] = useState<View>('dashboard'); 
    
    // NOUVEAUX ÉTATS pour la persistance Firestore (Sessions)
    const [sessions, setSessions] = useState<Session[]>([]); 
    const [isLoading, setIsLoading] = useState(true); 

    // État pour la configuration de l'Arsenal
    const [arsenalConfig, setArsenalConfig] = useState<ArsenalConfig>(DEFAULT_ARSENAL);
    const [isArsenalLoading, setIsArsenalLoading] = useState(true);

    // --- NETTOYAGE DE L'HISTORIQUE DU COACH À LA SORTIE (UX : Éphémère) ---
    useEffect(() => {
        let timer: NodeJS.Timeout | null = null;

        if (currentView !== 'coach') {
            // Si l'utilisateur quitte la vue 'coach', planifier le nettoyage après un petit délai
            timer = setTimeout(() => {
                clearChatHistory().catch(err => {
                    console.error("Erreur lors de l'effacement de l'historique du chat:", err);
                });
            }, 500); // Délai de 500ms
        }

        // Fonction de nettoyage: annule la suppression si l'utilisateur revient
        return () => {
            if (timer) {
                clearTimeout(timer);
            }
        };
    }, [currentView]); 
    // --- FIN NETTOYAGE ---


    // --- FIREBASE LISTENER (READ SESSIONS) ---
    useEffect(() => {
        const q = query(sessionsCollection, orderBy('date', 'desc')); 

        const unsubscribe = onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
            const fetchedSessions: Session[] = snapshot.docs.map(doc => {
                const data = doc.data();
                
                const dateString = data.date ? data.date.toDate().toISOString().split('T')[0] : '';
                
                return {
                    id: doc.id, 
                    date: dateString, 
                    zone: data.zone,
                    setup: data.setup,
                    // Protection des tableaux (Crucial pour éviter les crashes)
                    techniquesUsed: data.techniquesUsed || [], 
                    catches: data.catches || [],
                    misses: data.misses || [],
                    
                    weather: data.weather, 
                    waterTemp: data.waterTemp,      // Ajout lecture waterTemp
                    cloudCoverage: data.cloudCoverage, // Ajout lecture cloudCoverage
                    hydro: data.hydro,              // Ajout lecture hydro
                    bioScore: data.bioScore,        // Ajout lecture bioScore

                    startTime: data.startTime,      // Ajout lecture horaires
                    endTime: data.endTime,
                    durationMinutes: data.durationMinutes,

                    catchCount: data.catchCount || 0,
                    notes: data.notes || '',
                    feelingScore: data.feelingScore || 5,
                } as Session;
            });

            setSessions(fetchedSessions);
            setIsLoading(false); 
        }, (error) => {
            console.error("Erreur de lecture Firestore:", error);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, []); 

    // --- FIREBASE READ/INITIALIZE ARSENAL (Lecture, Création si non existant) ---
    useEffect(() => {
        const fetchArsenal = async () => {
            try {
                const docSnap = await getDoc(configDocRef);
                
                if (docSnap.exists()) {
                    const data = docSnap.data() as ArsenalConfig;

                    // Fusionner les données lues avec les valeurs par défaut
                    setArsenalConfig({
                        zones: data.zones || DEFAULT_ARSENAL.zones, 
                        setups: data.setups || DEFAULT_ARSENAL.setups,
                        techniques: data.techniques || DEFAULT_ARSENAL.techniques,
                    });
                    
                    console.log("Configuration Arsenal chargée depuis Firestore.");
                } else {
                    // Le document n'existe pas, le créer avec les valeurs par défaut
                    await setDoc(configDocRef, DEFAULT_ARSENAL);
                    setArsenalConfig(DEFAULT_ARSENAL);
                    console.log("Configuration Arsenal créée dans Firestore avec les valeurs par défaut.");
                }
            } catch (error) {
                console.error("Erreur lors du chargement/création de la configuration Arsenal:", error);
                setArsenalConfig(DEFAULT_ARSENAL);
            } finally {
                setIsArsenalLoading(false);
            }
        };
        
        fetchArsenal();
    }, []);
    // --- FIN READ/INITIALIZE ARSENAL ---


    // --- Fonction de mise à jour générique pour Firestore (Arsenal) ---
    const updateArsenal = async (field: keyof ArsenalConfig, newValue: string[]) => {
        // 1. Mise à jour du state local (UI immédiate)
        setArsenalConfig(prev => ({
            ...prev,
            [field]: newValue,
        }));

        // 2. Mise à jour dans Firestore
        try {
            await updateDoc(configDocRef, {
                [field]: newValue,
                lastUpdated: Timestamp.fromDate(new Date())
            });
            console.log(`Champ ${field} mis à jour dans Firestore.`);
        } catch (error) {
            console.error(`Erreur FATALE lors de la mise à jour de ${field} dans Firestore. Vérifiez les règles Firestore:`, error);
            alert(`Erreur: La configuration Arsenal n'a pas pu être sauvegardée. Consultez la console.`);
        }
    };


    // --- HANDLERS FOR CONFIGURATION (AVEC MODIFICATION) ---
    
    // Fonction générique pour renommer un item
    const handleEditItem = (field: keyof ArsenalConfig, oldValue: string, newValue: string) => {
        // On force le typage ici avec (as string[]) pour rassurer TypeScript
        const currentList = (arsenalConfig[field] as string[]) ?? [];
        
        // On type explicitement 'item' en string
        const newList = currentList.map((item: string) => item === oldValue ? newValue : item);
        
        updateArsenal(field, newList);
    };

    const handleAddZone = (zone: string) => {
        const currentZones = arsenalConfig.zones ?? []; 
        if (!currentZones.includes(zone)) {
            const newZones = [...currentZones, zone];
            updateArsenal('zones', newZones);
        }
    }; 
    const handleDeleteZone = (zone: string) => {
        const currentZones = arsenalConfig.zones ?? []; 
        const newZones = currentZones.filter(z => z !== zone);
        updateArsenal('zones', newZones);
    }; 
    // NOUVEAU
    const handleEditZone = (oldVal: string, newVal: string) => handleEditItem('zones', oldVal, newVal);

    const handleAddSetup = (setup: string) => {
        const currentSetups = arsenalConfig.setups ?? [];
        if (!currentSetups.includes(setup)) {
            const newSetups = [...currentSetups, setup];
            updateArsenal('setups', newSetups);
        }
    }; 
    const handleDeleteSetup = (setup: string) => {
        const currentSetups = arsenalConfig.setups ?? [];
        const newSetups = currentSetups.filter(s => s !== setup);
        updateArsenal('setups', newSetups);
    }; 
    // NOUVEAU
    const handleEditSetup = (oldVal: string, newVal: string) => handleEditItem('setups', oldVal, newVal);

    const handleAddTechnique = (tech: string) => {
        const currentTechniques = arsenalConfig.techniques ?? [];
        if (!currentTechniques.includes(tech)) {
            const newTechniques = [...currentTechniques, tech];
            updateArsenal('techniques', newTechniques);
        }
    }; 
    const handleDeleteTechnique = (tech: string) => {
        const currentTechniques = arsenalConfig.techniques ?? [];
        const newTechniques = currentTechniques.filter(t => t !== tech);
        updateArsenal('techniques', newTechniques);
    }; 
    // NOUVEAU
    const handleEditTechnique = (oldVal: string, newVal: string) => handleEditItem('techniques', oldVal, newVal);
    // --- FIN HANDLERS ARSENAL ---


    // --- SESSION HANDLERS (CRUD: CREATE) ---
    const handleAddSession = async (newSession: Session) => { 
        try {
            const { id, date, ...dataToSave } = newSession; 
            const dateTimestamp = Timestamp.fromDate(new Date(date));
    
            await addDoc(sessionsCollection, {
                date: dateTimestamp,
                ...dataToSave
            });
    
            console.log("Nouvelle session ajoutée à Firestore avec succès !");
            setCurrentView('dashboard'); 
            
        } catch (error) {
            console.error("Erreur lors de l'ajout de la session:", error);
            alert("Erreur lors de l'enregistrement de la session. Consultez la console.");
        }
    };

    // --- SESSION HANDLERS (CRUD: DELETE) ---
    const handleDeleteSession = async (id: string) => { 
        if (!id) return;

        try {
            const sessionDocRef = doc(sessionsCollection, id);
            await deleteDoc(sessionDocRef);
            console.log(`Session ${id} supprimée de Firestore avec succès.`);
            
        } catch (error) {
            console.error("Erreur lors de la suppression de la session:", error);
            alert("Erreur lors de la suppression de la session. Consultez la console.");
        }
    };

    const renderContent = () => { 
        // Attendre que les deux chargements soient terminés
        if (isLoading || isArsenalLoading) { 
            return (
                <div className="text-center p-20">
                    <div className="animate-spin h-8 w-8 border-4 border-amber-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-stone-500 font-semibold">Chargement des données de pêche...</p>
                </div>
            );
        }
        
        switch (currentView) {
            case 'dashboard':
                return <Dashboard sessions={sessions} onDeleteSession={handleDeleteSession} />; 
            case 'session':
                return ( 
                    <SessionForm 
                        onAddSession={handleAddSession} 
                        availableZones={arsenalConfig.zones}
                        availableSetups={arsenalConfig.setups}
                        availableTechniques={arsenalConfig.techniques}
                    />
                );
            case 'history':
                return <HistoryView sessions={sessions} onDeleteSession={handleDeleteSession} />; 
            case 'arsenal':
                return ( 
                    <ArsenalView 
                        zones={arsenalConfig.zones} onAddZone={handleAddZone} onDeleteZone={handleDeleteZone} onEditZone={handleEditZone}
                        setups={arsenalConfig.setups} onAddSetup={handleAddSetup} onDeleteSetup={handleDeleteSetup} onEditSetup={handleEditSetup}
                        techniques={arsenalConfig.techniques} onAddTechnique={handleAddTechnique} onDeleteTechnique={handleDeleteTechnique} onEditTechnique={handleEditTechnique}
                    />
                );
            case 'coach': 
                return <CoachView />;
            default:
                return <Dashboard sessions={sessions} onDeleteSession={handleDeleteSession} />; 
        }
    };

    return ( 
        <div className="min-h-screen bg-cream text-stone-600 font-sans pb-24">
            
            {/* Top Bar */}
            <header className="bg-white/80 backdrop-blur-md border-b border-stone-100 sticky top-0 z-30 px-6 py-4"> 
                <div className="max-w-5xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-xl shadow-lg shadow-amber-500/30">
                            <Fish size={20} /> 
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-stone-800 leading-none tracking-tight">Fishing Oracle</h1> 
                            <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Nanterre</span>
                        </div>
                    </div> 
                    
                    {/* Status Dot (Indique la connexion Firebase/IA) */}
                    <div className="flex items-center gap-2">
                        <span className="relative flex h-2 w-2"> 
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span> 
                    </div>
                </div>
            </header>

            <main className="max-w-xl mx-auto p-4 md:p-6 lg:max-w-5xl"> 
                {renderContent()}
            </main>

            {/* Bottom Navigation Bar */}
            <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-40 pb-safe"> 
                <div className="max-w-lg mx-auto flex justify-around items-center px-2 py-3">
                    
                    <button 
                        onClick={() => setCurrentView('dashboard')}
                        className={`flex flex-col items-center gap-1 p-2 min-w-[64px] transition-colors ${currentView === 'dashboard' ?
                        'text-amber-600' : 'text-stone-400 hover:text-stone-600'}`} 
                    >
                        <Home size={24} strokeWidth={currentView === 'dashboard' ? 2.5 : 2} />
                        <span className="text-[10px] font-bold">Oracle</span>
                    </button>

                    <button 
                        onClick={() => setCurrentView('history')} 
                        className={`flex flex-col items-center gap-1 p-2 min-w-[64px] transition-colors ${currentView === 'history' ?
                        'text-amber-600' : 'text-stone-400 hover:text-stone-600'}`} 
                    >
                        <ScrollText size={24} strokeWidth={currentView === 'history' ? 2.5 : 2} />
                        <span className="text-[10px] font-bold">Historique</span>
                    </button>

                    {/* Central Action Button */}
                    <div className="relative -top-6">
                        <button 
                            onClick={() => setCurrentView('session')} 
                            className="bg-stone-800 text-white p-4 rounded-full shadow-xl shadow-stone-800/30 border-4 border-[#FAF9F6] transform transition-transform active:scale-95 hover:bg-stone-900" 
                        >
                            <PlusCircle size={32} />
                            </button>
                            <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-stone-800">Session</span>
                    </div>

                    {/* Nouveau Bouton COACH */}
                    <button 
                        onClick={() => setCurrentView('coach')}
                        className={`flex flex-col items-center gap-1 p-2 min-w-[64px] transition-colors ${currentView === 'coach' ?
                        'text-emerald-600' : 'text-stone-400 hover:text-stone-600'}`}
                    >
                        <Bot size={24} strokeWidth={currentView === 'coach' ? 2.5 : 2} />
                        <span className="text-[10px] font-bold">Coach</span>
                    </button>

                    <button 
                        onClick={() => setCurrentView('arsenal')} 
                        className={`flex flex-col items-center gap-1 p-2 min-w-[64px] transition-colors ${currentView === 'arsenal' ? 
                        'text-amber-600' : 'text-stone-400 hover:text-stone-600'}`}
                    >
                        <Settings size={24} strokeWidth={currentView === 'arsenal' ? 2.5 : 2} />
                        <span className="text-[10px] font-bold">Arsenal</span>
                    </button>

                    <div className="w-[64px] hidden"></div> 

                </div>
            </nav>

        </div>
    );
}; 

export default App;