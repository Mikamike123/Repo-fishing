// components/HistoryView.tsx - Version 8.7.0 (Turbo Virtualization & Performance Edition)
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ScrollText, Users, User, Search, Clock, Calendar, ChevronDown, ChevronUp, Fish, Filter } from 'lucide-react';
import { Session, UserProfile } from '../types';
import SessionCard from './SessionCard';
import SessionDetailModal from './SessionDetailModal';
import DeleteConfirmDialog from './DeleteConfirmDialog';

interface HistoryViewProps {
  sessions: Session[];
  onDeleteSession: (id: string) => void;
  onEditSession: (session: Session) => void;
  currentUserId: string;
  userProfile: UserProfile | null;
  usersRegistry: Record<string, UserProfile>;
  isActuallyNight?: boolean; 
  highlightSessionId?: string | null; // Michael : ID de la session à mettre en avant
  onClearHighlight?: () => void;      // Michael : Nettoyeur de focus
}

/**
 * Michael : Composant Interne de Virtualisation (Wrapper)
 * Il utilise l'IntersectionObserver pour ne rendre le contenu lourd
 * que lorsqu'il approche de l'écran.
 */
const VirtualSessionWrapper = ({ children, id, isHighlighted }: { children: React.ReactNode, id: string, isHighlighted: boolean }) => {
    const [isVisible, setIsVisible] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Michael : Si c'est la session "Focus", on force l'affichage immédiat
        if (isHighlighted) {
            setIsVisible(true);
            return;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                // On charge la carte 600px avant qu'elle n'entre à l'écran pour un scroll fluide
                if (entry.isIntersecting) {
                    setIsVisible(true);
                } else {
                    // On libère la mémoire si on est très loin (1000px)
                    setIsVisible(false);
                }
            },
            { rootMargin: '600px' } 
        );

        if (containerRef.current) observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, [isHighlighted]);

    return (
        <div ref={containerRef} id={id} className="min-h-[160px] w-full">
            {isVisible ? (
                children
            ) : (
                /* Michael : Espace fantôme transparent pour garder la structure du scroll */
                <div className="w-full h-[160px] rounded-[2.5rem] bg-stone-500/5" />
            )}
        </div>
    );
};

const HistoryView: React.FC<HistoryViewProps> = ({ 
    sessions, 
    onDeleteSession, 
    onEditSession, 
    currentUserId, 
    userProfile,
    usersRegistry,
    isActuallyNight,
    highlightSessionId,
    onClearHighlight
}) => {
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [sessionIdToDelete, setSessionIdToDelete] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [showOnlyMine, setShowOnlyMine] = useState(true); 
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlySuccess, setShowOnlySuccess] = useState(false);
  const [expandedYears, setExpandedYears] = useState<Record<string, boolean>>({});

  // --- LOGIQUE DE FOCUS (Plan d'action v10.8) ---
  useEffect(() => {
    if (highlightSessionId) {
      const targetSession = sessions.find(s => s.id === highlightSessionId);
      if (targetSession) {
        const getTs = (dateVal: any): number => {
            if (!dateVal) return 0;
            if (typeof dateVal === 'object') return (dateVal.seconds || dateVal._seconds || 0) * 1000;
            const parsed = new Date(dateVal).getTime();
            return isNaN(parsed) ? 0 : parsed;
        };
        const year = new Date(getTs(targetSession.date)).getFullYear().toString();
        
        setExpandedYears(prev => ({ ...prev, [year]: true }));

        if (targetSession.userId !== currentUserId && showOnlyMine) setShowOnlyMine(false);
        
        // Michael : FIX FILTRE - On vérifie la longueur réelle de l'array catches
        if ((targetSession.catches?.length || 0) === 0 && showOnlySuccess) setShowOnlySuccess(false);
        if (searchTerm !== '') setSearchTerm('');

        const timer = setTimeout(() => {
          const element = document.getElementById(`session-${highlightSessionId}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            setTimeout(() => {
                if (onClearHighlight) onClearHighlight();
            }, 3000);
          }
        }, 600);

        return () => clearTimeout(timer);
      }
    }
  }, [highlightSessionId, sessions, currentUserId, onClearHighlight, showOnlyMine, showOnlySuccess, searchTerm]);

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
      
      // Michael : FIX FILTRE - On vérifie la longueur réelle de l'array catches
      const actualCatchCount = session.catches?.length || 0;
      const matchesSuccess = showOnlySuccess ? actualCatchCount > 0 : true;

      const matchesSearch = 
          (session.locationName || "").toLowerCase().includes(searchLower) || 
          (session.spotName || "").toLowerCase().includes(searchLower) || 
          (session.notes || "").toLowerCase().includes(searchLower) ||
          (session.catches?.some(c => (c.species || "").toLowerCase().includes(searchLower) || (c.lureName || "").toLowerCase().includes(searchLower)) || false);
      
      return matchesUser && matchesSearch && matchesSuccess;
    });

    const groups: Record<string, { sessions: Session[], totalCatches: number }> = {};
    filtered.forEach(s => {
      const ts = getTs(s.date);
      const year = new Date(ts).getFullYear().toString();
      if (!groups[year]) groups[year] = { sessions: [], totalCatches: 0 };
      groups[year].sessions.push(s);
      groups[year].totalCatches += (s.catches?.length || 0);
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

  const cardClass = isActuallyNight ? "bg-[#1c1917] border-stone-800 shadow-none" : "bg-white border-stone-100 shadow-sm";
  const textTitle = isActuallyNight ? "text-stone-100" : "text-stone-800";
  const inputBg = isActuallyNight ? "bg-stone-900 border-stone-800 text-stone-200" : "bg-stone-50 border-stone-100 text-stone-800";

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-500">
      
      {/* HEADER & FILTRES */}
      <div className={`${cardClass} rounded-[2.5rem] p-6 space-y-4 transition-colors duration-500 oracle-card-press`}>
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

          <div className="flex items-center gap-2">
            <button 
                onClick={() => {
                    if (window.navigator?.vibrate) window.navigator.vibrate(10);
                    setShowOnlySuccess(!showOnlySuccess);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-[10px] font-black uppercase transition-all oracle-btn-press ${
                    showOnlySuccess 
                        ? (isActuallyNight ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-emerald-100 border-emerald-300 text-emerald-700 shadow-inner')
                        : (isActuallyNight ? 'bg-stone-900 border-stone-800 text-stone-500' : 'bg-stone-50 border-stone-100 text-stone-400')
                }`}
            >
                <Fish size={14} fill={showOnlySuccess ? "currentColor" : "none"} />
                {showOnlySuccess ? "Prises uniquement" : "Tout"}
            </button>

            <div className={`flex p-1 rounded-xl border shadow-inner ${isActuallyNight ? 'bg-stone-900 border-stone-800' : 'bg-stone-100 border-stone-200'}`}>
                <button 
                    onClick={() => setShowOnlyMine(false)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all oracle-btn-press ${!showOnlyMine ? (isActuallyNight ? 'bg-stone-800 text-stone-100' : 'bg-white text-stone-800 shadow-sm') : 'text-stone-400 hover:text-stone-50'}`}
                >
                    <Users size={14} /> Tous
                </button>
                <button 
                    onClick={() => setShowOnlyMine(true)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all oracle-btn-press ${showOnlyMine ? (isActuallyNight ? 'bg-amber-900/40 text-amber-500 shadow-sm border border-amber-900/20' : 'bg-white text-amber-600 shadow-sm') : 'text-stone-400 hover:text-stone-500'}`}
                >
                    <User size={14} /> Moi
                </button>
            </div>
          </div>
        </div>

        <div className="relative group transition-all oracle-btn-press">
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

      {/* LISTE GROUPÉE PAR ANNÉE */}
      <div className="space-y-6">
        {sortedYears.length > 0 ? (
          sortedYears.map((year) => {
            const yearData = groupedSessions[year];
            const isExpanded = expandedYears[year] !== false; 
            
            return (
              /* Michael : Ajout de content-visibility pour un boost de performance natif du navigateur */
              <div key={year} className="space-y-3" style={{ contentVisibility: 'auto', containIntrinsicSize: '1px 500px' }}>
                <button 
                    onClick={() => toggleYear(year)}
                    className={`w-full flex items-center justify-between px-6 py-4 border rounded-2xl transition-all oracle-btn-press ${
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
                        <div className="flex items-center gap-1.5 text-[10px] font-black text-stone-400">
                            <Fish size={10} />
                            {yearData.totalCatches} prises
                        </div>
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp size={18} className="text-stone-400" /> : <ChevronDown size={18} className="text-stone-400" />}
                </button>

                {isExpanded && (
                  <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                    {yearData.sessions.map((session) => {
                      const authorAvatar = session.userId === currentUserId 
                        ? userProfile?.avatarUrl 
                        : usersRegistry?.[session.userId]?.avatarUrl;

                      const isHighlighted = session.id === highlightSessionId;

                      return (
                        /* Michael : Application du Wrapper de Virtualisation */
                        <VirtualSessionWrapper 
                            key={session.id} 
                            id={`session-${session.id}`}
                            isHighlighted={isHighlighted}
                        >
                            <div className={`transition-all duration-500 transform ${
                                deletingId === session.id ? 'opacity-0 scale-95 -translate-y-4 pointer-events-none' : 'opacity-100 scale-100'
                            } ${
                                isHighlighted 
                                ? 'ring-4 ring-amber-500/50 rounded-[2.5rem] shadow-2xl scale-[1.02] z-10' 
                                : ''
                            }`}>
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
                                    authorAvatarUrl={authorAvatar}
                                />
                            </div>
                        </VirtualSessionWrapper>
                      );
                    })}
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
        isActuallyNight={isActuallyNight}
      />

      <DeleteConfirmDialog 
        isOpen={isDeleteConfirmOpen}
        onClose={() => { setIsDeleteConfirmOpen(false); setSessionIdToDelete(null); }}
        onConfirm={handleConfirmDelete}
        isActuallyNight={isActuallyNight}
      />

    </div>
  );
};

export default HistoryView;