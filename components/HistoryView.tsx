import React, { useState, useMemo } from 'react';
import { ScrollText, Users, User, Search, Clock, Calendar, ChevronDown, ChevronUp, Fish } from 'lucide-react';
import { Session } from '../types';
import SessionCard from './SessionCard';
import SessionDetailModal from './SessionDetailModal';
import DeleteConfirmDialog from './DeleteConfirmDialog';

interface HistoryViewProps {
  sessions: Session[];
  onDeleteSession: (id: string) => void;
  onEditSession: (session: Session) => void;
  currentUserId: string;
}

const HistoryView: React.FC<HistoryViewProps> = ({ sessions, onDeleteSession, onEditSession, currentUserId }) => {
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [sessionIdToDelete, setSessionIdToDelete] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [showOnlyMine, setShowOnlyMine] = useState(true); 
  const [searchTerm, setSearchTerm] = useState('');
  
  // Michael : État pour gérer l'ouverture des accordéons par année
  const [expandedYears, setExpandedYears] = useState<Record<string, boolean>>({});

  // --- LOGIQUE DE FILTRAGE & GROUPEMENT ---
  
  const groupedSessions = useMemo(() => {
    // Helper pour extraire un timestamp numérique peu importe le format d'entrée (String ou Object)
    const getTs = (dateVal: any): number => {
      if (!dateVal) return 0;
      // Cas Firestore : objet avec seconds ou _seconds
      if (typeof dateVal === 'object') {
        return (dateVal.seconds || dateVal._seconds || 0) * 1000;
      }
      // Cas String : ISO date ou autre format parsable
      const parsed = new Date(dateVal).getTime();
      return isNaN(parsed) ? 0 : parsed;
    };

    // 1. Filtrage (Secteur ou Observation/Note seulement)
    const filtered = sessions.filter(session => {
      const matchesUser = showOnlyMine ? session.userId === currentUserId : true;
      
      const searchLower = searchTerm.toLowerCase();
      // Michael : Filtre restreint au Secteur (location/spot) ou aux Notes
      const matchesSearch = 
          (session.locationName || "").toLowerCase().includes(searchLower) || 
          (session.spotName || "").toLowerCase().includes(searchLower) || 
          (session.notes || "").toLowerCase().includes(searchLower);
      
      return matchesUser && matchesSearch;
    });

    // 2. Groupement par année avec calcul du total des prises
    const groups: Record<string, { sessions: Session[], totalCatches: number }> = {};
    
    filtered.forEach(s => {
      const ts = getTs(s.date);
      const year = new Date(ts).getFullYear().toString();
      
      if (!groups[year]) {
        groups[year] = { sessions: [], totalCatches: 0 };
      }
      
      groups[year].sessions.push(s);
      // Michael : On additionne le catchCount de chaque session pour le total annuel
      groups[year].totalCatches += (s.catchCount || 0);
    });

    // 3. Tri interne par date décroissante
    Object.keys(groups).forEach(y => {
      groups[y].sessions.sort((a, b) => getTs(b.date) - getTs(a.date));
    });

    return groups;
  }, [sessions, showOnlyMine, currentUserId, searchTerm]);

  // Michael : Liste des années triées (décroissant)
  const sortedYears = useMemo(() => 
    Object.keys(groupedSessions).sort((a, b) => Number(b) - Number(a))
  , [groupedSessions]);

  const toggleYear = (year: string) => {
    setExpandedYears(prev => ({ ...prev, [year]: !prev[year] }));
  };

  const handleDeleteRequest = (id: string) => {
    setSessionIdToDelete(id);
    setIsDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    if (sessionIdToDelete) {
      setIsDeleteConfirmOpen(false);
      setDeletingId(sessionIdToDelete);
      setTimeout(() => {
        onDeleteSession(sessionIdToDelete);
        setDeletingId(null);
        setSessionIdToDelete(null);
      }, 300);
    }
  };

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-500">
      
      {/* HEADER & FILTRES */}
      <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-stone-100 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-stone-800 uppercase tracking-tighter flex items-center gap-3 italic">
              <ScrollText className="text-amber-500" size={28} />
              Journal
            </h2>
            <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest mt-1 ml-1">
              Historique complet • Archivage annuel
            </p>
          </div>

          <div className="flex bg-stone-100 p-1 rounded-xl border border-stone-200 shadow-inner self-start">
              <button 
                  onClick={() => setShowOnlyMine(false)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${!showOnlyMine ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
              >
                  <Users size={14} /> Tous
              </button>
              <button 
                  onClick={() => setShowOnlyMine(true)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${showOnlyMine ? 'bg-white text-amber-600 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
              >
                  {/* FIX Michael : size={14} au lieu de size(14) */}
                  <User size={14} /> Mes Sessions
              </button>
          </div>
        </div>

        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300 group-focus-within:text-amber-500 transition-colors" size={18} />
          <input 
            type="text"
            placeholder="Chercher un secteur ou une observation..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-stone-50 border border-stone-100 rounded-2xl outline-none focus:ring-2 focus:ring-amber-500/20 transition-all text-sm font-medium shadow-inner"
          />
        </div>
      </div>

      {/* LISTE GROUPÉE PAR ANNÉE (ACCORDÉONS) */}
      <div className="space-y-6">
        {sortedYears.length > 0 ? (
          sortedYears.map((year) => {
            const yearData = groupedSessions[year];
            const isExpanded = expandedYears[year] !== false; 
            
            return (
              <div key={year} className="space-y-3">
                {/* HEADER DE L'ANNÉE */}
                <button 
                    onClick={() => toggleYear(year)}
                    className="w-full flex items-center justify-between px-6 py-3 bg-white border border-stone-100 rounded-2xl shadow-sm hover:bg-stone-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Calendar size={18} className="text-amber-500/60" />
                    <span className="text-sm font-black text-stone-700 tracking-widest">{year}</span>
                    <div className="flex items-center gap-2 ml-2">
                        <span className="text-[10px] font-bold text-stone-400 bg-stone-50 px-2 py-0.5 rounded-full border border-stone-100">
                          {yearData.sessions.length} sessions
                        </span>
                        {/* Michael : Badge pour le nombre de prises annuel */}
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 flex items-center gap-1">
                          <Fish size={10} />
                          {yearData.totalCatches} prises
                        </span>
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp size={18} className="text-stone-300" /> : <ChevronDown size={18} className="text-stone-300" />}
                </button>

                {/* SESSIONS CORRESPONDANTES */}
                {isExpanded && (
                  <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                    {yearData.sessions.map((session) => (
                      <div 
                        key={session.id}
                        className={`transition-all duration-300 transform ${
                          deletingId === session.id ? 'opacity-0 scale-95 -translate-y-4 pointer-events-none' : 'opacity-100 scale-100'
                        }`}
                      >
                        <SessionCard 
                            session={session} 
                            onDelete={handleDeleteRequest} 
                            onEdit={onEditSession}
                            onClick={(s) => { setSelectedSession(s); setIsDetailOpen(true); }}
                            currentUserId={currentUserId}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center border border-dashed border-stone-200 rounded-[2.5rem] bg-white shadow-sm">
             <div className="bg-stone-50 p-6 rounded-full mb-4">
                <Clock className="text-stone-200" size={40} />
             </div>
             <h3 className="text-stone-500 font-black uppercase tracking-tighter text-lg">Aucun résultat</h3>
             <p className="text-stone-400 text-sm italic mt-1 max-w-xs font-medium">
               {searchTerm ? "Aucun secteur ou note ne correspond à cette recherche." : "Ton journal est vide."}
             </p>
          </div>
        )}
      </div>

      <SessionDetailModal 
        session={selectedSession} 
        isOpen={isDetailOpen} 
        onClose={() => setIsDetailOpen(false)} 
      />

      <DeleteConfirmDialog 
        isOpen={isDeleteConfirmOpen}
        onClose={() => { setIsDeleteConfirmOpen(false); setSessionIdToDelete(null); }}
        onConfirm={handleConfirmDelete}
      />

    </div>
  );
};

export default HistoryView;