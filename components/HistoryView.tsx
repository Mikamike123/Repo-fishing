// components/HistoryView.tsx - Version 8.2 (Filtre Prises sur Barre Annuelle)
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
  isActuallyNight?: boolean; // Michael : Nouveau pour harmonisation Night Ops V8.0
}

const HistoryView: React.FC<HistoryViewProps> = ({ sessions, onDeleteSession, onEditSession, currentUserId, isActuallyNight }) => {
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [sessionIdToDelete, setSessionIdToDelete] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [showOnlyMine, setShowOnlyMine] = useState(true); 
  const [searchTerm, setSearchTerm] = useState('');
  
  // Michael : État du filtre "Uniquement les succès"
  const [showOnlySuccess, setShowOnlySuccess] = useState(false);
  
  const [expandedYears, setExpandedYears] = useState<Record<string, boolean>>({});

  // --- LOGIQUE DE FILTRAGE & GROUPEMENT ---
  const groupedSessions = useMemo(() => {
    const getTs = (dateVal: any): number => {
      if (!dateVal) return 0;
      if (typeof dateVal === 'object') return (dateVal.seconds || dateVal._seconds || 0) * 1000;
      const parsed = new Date(dateVal).getTime();
      return isNaN(parsed) ? 0 : parsed;
    };

    const filtered = sessions.filter(session => {
      const matchesUser = showOnlyMine ? session.userId === currentUserId : true;
      const searchLower = searchTerm.toLowerCase();
      
      // Michael : Intégration du filtre sur le catchCount
      const matchesSuccess = showOnlySuccess ? (session.catchCount || 0) > 0 : true;

      // Michael : Ta logique de recherche originale, strictement préservée.
      const matchesSearch = 
          (session.locationName || "").toLowerCase().includes(searchLower) || 
          (session.spotName || "").toLowerCase().includes(searchLower) || 
          (session.notes || "").toLowerCase().includes(searchLower) ||
          (session.catches?.some(c => (c.species || "").toLowerCase().includes(searchLower) || (c.lureName || "").toLowerCase().includes(searchLower)) || false);
      
      return matchesUser && matchesSearch && matchesSuccess;
    });

    // Archivage Annuel : Groupement par année
    const groups: Record<string, { sessions: Session[], totalCatches: number }> = {};
    filtered.forEach(s => {
      const ts = getTs(s.date);
      const year = new Date(ts).getFullYear().toString();
      if (!groups[year]) groups[year] = { sessions: [], totalCatches: 0 };
      groups[year].sessions.push(s);
      groups[year].totalCatches += (s.catchCount || 0);
    });

    Object.keys(groups).forEach(y => {
      groups[y].sessions.sort((a, b) => getTs(b.date) - getTs(a.date));
    });

    return groups;
  }, [sessions, showOnlyMine, currentUserId, searchTerm, showOnlySuccess]);

  const sortedYears = useMemo(() => 
    Object.keys(groupedSessions).sort((a, b) => Number(b) - Number(a))
  , [groupedSessions]);

  const toggleYear = (year: string) => {
    setExpandedYears(prev => ({ ...prev, [year]: !prev[year] }));
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

  // Styles dynamiques Michael - Adoption du gris anthracite doux (#1c1917) 
  const cardClass = isActuallyNight ? "bg-[#1c1917] border-stone-800 shadow-none" : "bg-white border-stone-100 shadow-sm";
  const textTitle = isActuallyNight ? "text-stone-100" : "text-stone-800";
  const inputBg = isActuallyNight ? "bg-stone-900 border-stone-800 text-stone-200" : "bg-stone-50 border-stone-100 text-stone-800";

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-500">
      
      {/* HEADER & FILTRES (Night Ops Ready) */}
      <div className={`${cardClass} rounded-[2.5rem] p-6 space-y-4 transition-colors duration-500`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className={`text-2xl font-black uppercase tracking-tighter flex items-center gap-3 italic ${textTitle}`}>
              <ScrollText className="text-amber-500" size={28} />
              Ton Journal
            </h2>
            <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest mt-1 ml-1 opacity-60">
              Historique complet • Archivage annuel
            </p>
          </div>

          <div className={`flex p-1 rounded-xl border self-start shadow-inner ${isActuallyNight ? 'bg-stone-900 border-stone-800' : 'bg-stone-100 border-stone-200'}`}>
              <button 
                  onClick={() => setShowOnlyMine(false)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${!showOnlyMine ? (isActuallyNight ? 'bg-stone-800 text-stone-100' : 'bg-white text-stone-800 shadow-sm') : 'text-stone-400 hover:text-stone-50'}`}
              >
                  <Users size={14} /> Tous
              </button>
              <button 
                  onClick={() => setShowOnlyMine(true)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${showOnlyMine ? (isActuallyNight ? 'bg-amber-900/40 text-amber-500 shadow-sm border border-amber-900/20' : 'bg-white text-amber-600 shadow-sm') : 'text-stone-400 hover:text-stone-500'}`}
              >
                  <User size={14} /> Mes Sessions
              </button>
          </div>
        </div>

        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-amber-500 transition-colors" size={18} />
          <input 
            type="text"
            placeholder="Chercher un secteur, une espèce..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full pl-12 pr-4 py-4 rounded-2xl outline-none focus:ring-2 focus:ring-amber-500/20 transition-all text-sm font-medium shadow-inner border ${inputBg}`}
          />
        </div>
      </div>

      {/* LISTE GROUPÉE PAR ANNÉE AVEC ACCORDÉONS */}
      <div className="space-y-6">
        {sortedYears.length > 0 ? (
          sortedYears.map((year) => {
            const yearData = groupedSessions[year];
            const isExpanded = expandedYears[year] !== false; 
            
            return (
              <div key={year} className="space-y-3">
                <button 
                    onClick={() => toggleYear(year)}
                    className={`w-full flex items-center justify-between px-6 py-4 border rounded-2xl transition-colors ${
                        isActuallyNight ? 'bg-stone-900/40 border-stone-800 hover:bg-stone-900/60' : 'bg-white border-stone-100 shadow-sm hover:bg-stone-50'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <Calendar size={18} className="text-amber-500/60" />
                    <span className={`text-sm font-black tracking-widest ${isActuallyNight ? 'text-stone-200' : 'text-stone-700'}`}>{year}</span>
                    <div className="flex items-center gap-2 ml-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${isActuallyNight ? 'bg-stone-800 border-stone-700 text-stone-400' : 'bg-stone-50 border-stone-100 text-stone-400'}`}>
                          {yearData.sessions.length} sessions
                        </span>
                        
                        {/* Michael : Le Toggle "Poisson" est maintenant ici, sur la séparation par année */}
                        <button 
                            onClick={(e) => {
                                e.stopPropagation(); // Évite de fermer l'accordéon au clic
                                if (window.navigator?.vibrate) window.navigator.vibrate(10);
                                setShowOnlySuccess(!showOnlySuccess);
                            }}
                            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-black transition-all active:scale-95 ${
                                showOnlySuccess 
                                    ? (isActuallyNight ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-emerald-100 border-emerald-300 text-emerald-700 shadow-inner')
                                    : (isActuallyNight ? 'bg-stone-800 border-stone-700 text-stone-400' : 'bg-stone-50 border-stone-100 text-stone-400')
                            }`}
                        >
                            <Fish size={10} fill={showOnlySuccess ? "currentColor" : "none"} />
                            {yearData.totalCatches} prises
                        </button>
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp size={18} className="text-stone-400" /> : <ChevronDown size={18} className="text-stone-400" />}
                </button>

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
                            onDelete={(id) => {
                                setSessionIdToDelete(id);
                                setIsDeleteConfirmOpen(true);
                            }} 
                            onEdit={onEditSession}
                            onClick={(s) => { setSelectedSession(s); setIsDetailOpen(true); }}
                            currentUserId={currentUserId}
                            isActuallyNight={isActuallyNight}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className={`flex flex-col items-center justify-center py-20 px-4 text-center border border-dashed rounded-[2.5rem] transition-colors ${
              isActuallyNight ? 'bg-stone-900/20 border-stone-800' : 'bg-white border-stone-200 shadow-sm'
          }`}>
             <div className={`p-6 rounded-full mb-4 ${isActuallyNight ? 'bg-stone-800' : 'bg-stone-50'}`}>
                <Clock className="text-stone-300 opacity-50" size={40} />
             </div>
             <h3 className={`font-black uppercase tracking-tighter text-lg ${isActuallyNight ? 'text-stone-400' : 'text-stone-500'}`}>Aucun résultat</h3>
             <p className="text-stone-400 text-sm italic mt-1 max-w-xs font-medium">
               {searchTerm || showOnlySuccess ? "Aucune session ne correspond à tes filtres actuels." : "Ton journal est vide."}
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