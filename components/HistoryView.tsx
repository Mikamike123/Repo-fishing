// components/HistoryView.tsx - Version 8.9.2 (Precision Deep-Link & TS Safety)
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
  highlightSessionId?: string | null; 
  onClearHighlight?: () => void;      
}

const VirtualSessionWrapper = ({ children, id, isHighlighted }: { children: React.ReactNode, id: string, isHighlighted: boolean }) => {
    const [isVisible, setIsVisible] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Michael : Si c'est la session Focus, on la rend immédiatement sans attendre l'IntersectionObserver
        if (isHighlighted) {
            setIsVisible(true);
            return;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                } else {
                    setIsVisible(false);
                }
            },
            { rootMargin: '800px' } 
        );

        if (containerRef.current) observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, [isHighlighted]);

    return (
        <div ref={containerRef} id={id} className="min-h-[160px] w-full transition-all duration-300">
            {isVisible ? (
                children
            ) : (
                <div className="w-full h-[160px] rounded-[2.5rem] bg-stone-500/5 border border-transparent" />
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

  // Michael : Utilitaire robuste pour extraire le timestamp sans pleurs de TypeScript
  const safeGetTs = (dateVal: any): number => {
    if (!dateVal) return 0;
    if (typeof dateVal === 'object' && dateVal !== null) {
      return (dateVal.seconds || dateVal._seconds || 0) * 1000;
    }
    const parsed = new Date(dateVal).getTime();
    return isNaN(parsed) ? 0 : parsed;
  };

  // Michael : Détection de l'année cible pour neutraliser content-visibility
  const targetYear = useMemo(() => {
    if (!highlightSessionId) return null;
    const s = sessions.find(sess => sess.id === highlightSessionId);
    if (!s) return null;
    return new Date(safeGetTs(s.date)).getFullYear().toString();
  }, [highlightSessionId, sessions]);

  // --- LOGIQUE DE FOCUS STRATÉGIQUE (v8.9.2) ---
  useEffect(() => {
    if (highlightSessionId && targetYear) {
      const targetSession = sessions.find(s => s.id === highlightSessionId);
      if (targetSession) {
        
        // 1. Préparation de l'UI (Expand + Reset Filters)
        setExpandedYears(prev => ({ ...prev, [targetYear]: true }));
        if (targetSession.userId !== currentUserId && showOnlyMine) setShowOnlyMine(false);
        if ((targetSession.catches?.length || 0) === 0 && showOnlySuccess) setShowOnlySuccess(false);
        if (searchTerm !== '') setSearchTerm('');

        // 2. Séquence de scroll haute précision
        // Le délai de 500ms permet à React de déplier l'année et au navigateur de calculer les hauteurs 'visible'
        const timer = setTimeout(() => {
          const element = document.getElementById(`session-${highlightSessionId}`);
          if (element) {
            // Premier saut "invisible" pour caler le moteur de scroll
            element.scrollIntoView({ behavior: 'auto', block: 'center' });
            
            // Second scroll fluide pour l'utilisateur, après stabilisation du layout
            requestAnimationFrame(() => {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });

            // On libère le focus après l'animation
            const clearTimer = setTimeout(() => {
                if (onClearHighlight) onClearHighlight();
            }, 3000);
            return () => clearTimeout(clearTimer);
          }
        }, 500);

        return () => clearTimeout(timer);
      }
    }
  }, [highlightSessionId, sessions, currentUserId, onClearHighlight, showOnlyMine, showOnlySuccess, searchTerm, targetYear]);

  const groupedSessions = useMemo(() => {
    const filtered = sessions.filter(session => {
      const matchesUser = showOnlyMine ? session.userId === currentUserId : true;
      const searchLower = searchTerm.toLowerCase();
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
      const ts = safeGetTs(s.date);
      const year = new Date(ts).getFullYear().toString();
      if (!groups[year]) groups[year] = { sessions: [], totalCatches: 0 };
      groups[year].sessions.push(s);
      groups[year].totalCatches += (s.catches?.length || 0);
    });

    Object.keys(groups).forEach(y => {
      groups[y].sessions.sort((a, b) => safeGetTs(b.date) - safeGetTs(a.date));
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
    <div className="space-y-6 pb-24 animate-in fade-in duration-500 max-w-4xl mx-auto w-full">
      
      {/* HEADER & FILTRES */}
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

          <div className="flex items-center gap-2">
            <button 
                onClick={() => {
                    if (window.navigator?.vibrate) window.navigator.vibrate(10);
                    setShowOnlySuccess(!showOnlySuccess);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-[10px] font-black uppercase transition-all ${
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
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${!showOnlyMine ? (isActuallyNight ? 'bg-stone-800 text-stone-100' : 'bg-white text-stone-800 shadow-sm') : 'text-stone-400'}`}
                >
                    <Users size={14} /> Tous
                </button>
                <button 
                    onClick={() => setShowOnlyMine(true)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${showOnlyMine ? (isActuallyNight ? 'bg-amber-900/40 text-amber-500 shadow-sm border border-amber-900/20' : 'bg-white text-amber-600 shadow-sm') : 'text-stone-400'}`}
                >
                    <User size={14} /> Moi
                </button>
            </div>
          </div>
        </div>

        <div className="relative group transition-all">
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
            
            // Michael : Stabilisation critique - On force l'année cible en rendu visible pour que le scrollIntoView soit exact
            const isTargetYear = year === targetYear;

            return (
              <div 
                key={year} 
                className="space-y-3" 
                style={{ 
                    contentVisibility: isTargetYear ? 'visible' : 'auto', 
                    containIntrinsicSize: '1px 500px' 
                }}
              >
                <button 
                    onClick={() => toggleYear(year)}
                    className={`w-full flex items-center justify-between px-6 py-4 border rounded-2xl transition-all ${
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
                        <VirtualSessionWrapper 
                            key={session.id} 
                            id={`session-${session.id}`}
                            isHighlighted={isHighlighted}
                        >
                            <div className={`transition-all duration-500 transform ${
                                deletingId === session.id ? 'opacity-0 scale-95 -translate-y-4 pointer-events-none' : 'opacity-100 scale-100'
                            } ${
                                isHighlighted 
                                ? 'ring-4 ring-amber-500/50 rounded-[2.5rem] shadow-2xl scale-[1.01] z-10' 
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
        userPseudo={
          selectedSession?.userId === currentUserId 
           ? userProfile?.pseudo 
           : (usersRegistry?.[selectedSession?.userId || '']?.pseudo || selectedSession?.userPseudo || "Michael")
          }
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