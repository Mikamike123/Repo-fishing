import React, { useState } from 'react';
import { Home, PlusCircle, ScrollText, Settings, Fish } from 'lucide-react';
import SessionForm from './components/SessionForm';
import Dashboard from './components/Dashboard';
import HistoryView from './components/HistoryView';
import ArsenalView from './components/ArsenalView';
import { Session } from './types';

type View = 'dashboard' | 'session' | 'history' | 'arsenal';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [sessions, setSessions] = useState<Session[]>([]);

  // --- CONFIGURATION STATE (The Arsenal) ---
  const [zones, setZones] = useState<string[]>(["Jaune", "Rouge", "Papeteries", "Piles de Pont"]);
  const [setups, setSetups] = useState<string[]>(["Combo Hiver (Light)", "Combo Été (Power)", "Combo Test"]);
  const [techniques, setTechniques] = useState<string[]>(["Linéaire", "Gratte", "Verticale", "Surface", "Drop Shot"]);

  // --- HANDLERS FOR CONFIGURATION ---
  const handleAddZone = (zone: string) => setZones([...zones, zone]);
  const handleDeleteZone = (zone: string) => setZones(zones.filter(z => z !== zone));

  const handleAddSetup = (setup: string) => setSetups([...setups, setup]);
  const handleDeleteSetup = (setup: string) => setSetups(setups.filter(s => s !== setup));

  const handleAddTechnique = (tech: string) => setTechniques([...techniques, tech]);
  const handleDeleteTechnique = (tech: string) => setTechniques(techniques.filter(t => t !== tech));

  // --- SESSION HANDLERS ---
  const handleAddSession = (newSession: Session) => {
    setSessions((prev) => [newSession, ...prev]);
    setCurrentView('dashboard');
  };

  const handleDeleteSession = (id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard sessions={sessions} onDeleteSession={handleDeleteSession} />;
      case 'session':
        return (
          <SessionForm 
            onAddSession={handleAddSession} 
            availableZones={zones}
            availableSetups={setups}
            availableTechniques={techniques}
          />
        );
      case 'history':
        return <HistoryView sessions={sessions} onDeleteSession={handleDeleteSession} />;
      case 'arsenal':
        return (
           <ArsenalView 
             zones={zones} onAddZone={handleAddZone} onDeleteZone={handleDeleteZone}
             setups={setups} onAddSetup={handleAddSetup} onDeleteSetup={handleDeleteSetup}
             techniques={techniques} onAddTechnique={handleAddTechnique} onDeleteTechnique={handleDeleteTechnique}
           />
        );
      default:
        return <Dashboard sessions={sessions} onDeleteSession={handleDeleteSession} />;
    }
  };

  return (
    <div className="min-h-screen bg-cream text-stone-600 font-sans pb-24">
      
      {/* Top Bar (Only visible on larger screens or as a minimal header) */}
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
          {/* Status Dot */}
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
            className={`flex flex-col items-center gap-1 p-2 min-w-[64px] transition-colors ${currentView === 'dashboard' ? 'text-amber-600' : 'text-stone-400 hover:text-stone-600'}`}
          >
            <Home size={24} strokeWidth={currentView === 'dashboard' ? 2.5 : 2} />
            <span className="text-[10px] font-bold">Oracle</span>
          </button>

          <button 
             onClick={() => setCurrentView('history')}
             className={`flex flex-col items-center gap-1 p-2 min-w-[64px] transition-colors ${currentView === 'history' ? 'text-amber-600' : 'text-stone-400 hover:text-stone-600'}`}
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

          <button 
             onClick={() => setCurrentView('arsenal')}
             className={`flex flex-col items-center gap-1 p-2 min-w-[64px] transition-colors ${currentView === 'arsenal' ? 'text-amber-600' : 'text-stone-400 hover:text-stone-600'}`}
          >
            <Settings size={24} strokeWidth={currentView === 'arsenal' ? 2.5 : 2} />
            <span className="text-[10px] font-bold">Arsenal</span>
          </button>

           {/* Placeholder for symmetry if needed, or Profile icon */}
           <div className="w-[64px] hidden"></div>

        </div>
      </nav>

    </div>
  );
};

export default App;