// components/HistoryView.tsx
import React, { useState, useMemo } from 'react';
import { ScrollText, Anchor, Users, User, Search, Clock } from 'lucide-react';
import { Session } from '../types';
import SessionCard from './SessionCard';
import SessionDetailModal from './SessionDetailModal';
import DeleteConfirmDialog from './DeleteConfirmDialog'; // Import du nouveau composant

interface HistoryViewProps {
  sessions: Session[];
  onDeleteSession: (id: string) => void;
  onEditSession: (session: Session) => void;
  currentUserId: string;
}

const HistoryView: React.FC<HistoryViewProps> = ({ sessions, onDeleteSession, onEditSession, currentUserId }) => {
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  
  // États pour la gestion de la suppression et de l'animation
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [sessionIdToDelete, setSessionIdToDelete] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null); // Pour le fade-out

  // 1. POSITIONNÉ PAR DÉFAUT SUR 'MES SESSIONS' (true)
  const [showOnlyMine, setShowOnlyMine] = useState(true); 
  const [searchTerm, setSearchTerm] = useState('');

  // 2. LOGIQUE DE FILTRAGE COMBINÉE (Auteur + Recherche) - TON CODE INTACT
  const displayedSessions = useMemo(() => {
    return sessions
      .filter(session => {
        // Filtre par utilisateur
        const matchesUser = showOnlyMine ? session.userId === currentUserId : true;
        
        // Filtre par recherche (Spot ou Leurre utilisé)
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = 
            session.spotName.toLowerCase().includes(searchLower) || 
            session.catches.some(c => c.lureName?.toLowerCase().includes(searchLower));
        
        return matchesUser && matchesSearch;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sessions, showOnlyMine, currentUserId, searchTerm]);

  // Handler pour ouvrir la confirmation
  const handleDeleteRequest = (id: string) => {
    setSessionIdToDelete(id);
    setIsDeleteConfirmOpen(true);
  };

  // Handler pour valider la suppression avec animation
  const handleConfirmDelete = () => {
    if (sessionIdToDelete) {
      setIsDeleteConfirmOpen(false);
      setDeletingId(sessionIdToDelete); // On déclenche l'animation de sortie

      // On attend 300ms (durée de l'animation) avant de supprimer réellement du state
      setTimeout(() => {
        onDeleteSession(sessionIdToDelete);
        setDeletingId(null);
        setSessionIdToDelete(null);
      }, 300);
    }
  };

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-500">
      
      {/* HEADER & FILTRES - TON CODE INTACT */}
      <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-stone-100 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-stone-800 uppercase tracking-tighter flex items-center gap-3">
              <ScrollText className="text-amber-500" size={28} />
              Journal
            </h2>
            <p className="text-xs text-stone-400 font-bold uppercase tracking-widest mt-1 ml-1">
              {displayedSessions.length} session{displayedSessions.length > 1 ? 's' : ''} trouvée{displayedSessions.length > 1 ? 's' : ''}
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
                  <User size={14} /> Mes Sessions
              </button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" size={18} />
          <input 
            type="text"
            placeholder="Filtrer par spot ou par leurre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-stone-50 border border-stone-100 rounded-2xl outline-none focus:ring-2 focus:ring-amber-500/20 transition-all text-sm font-medium"
          />
        </div>
      </div>

      {/* LISTE DES SESSIONS */}
      <div className="space-y-4">
        {displayedSessions.length > 0 ? (
          displayedSessions.map((session) => (
            <div 
              key={session.id}
              className={`transition-all duration-300 transform ${
                deletingId === session.id ? 'opacity-0 scale-95 -translate-y-4 pointer-events-none' : 'opacity-100 scale-100'
              }`}
            >
              <SessionCard 
                  session={session} 
                  onDelete={handleDeleteRequest} // On intercepte ici
                  onEdit={onEditSession}
                  onClick={(s) => { setSelectedSession(s); setIsDetailOpen(true); }}
                  currentUserId={currentUserId}
              />
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center border border-dashed border-stone-200 rounded-[2.5rem] bg-white shadow-sm">
             <div className="bg-stone-50 p-6 rounded-full mb-4">
                <Clock className="text-stone-200" size={40} />
             </div>
             <h3 className="text-stone-500 font-black uppercase tracking-tighter text-lg">Aucun résultat</h3>
             <p className="text-stone-400 text-sm italic mt-1 max-w-xs font-medium">
               {searchTerm ? "Aucune session ne correspond à votre recherche." : "Votre journal est vide pour le moment."}
             </p>
          </div>
        )}
      </div>

      <SessionDetailModal 
        session={selectedSession} 
        isOpen={isDetailOpen} 
        onClose={() => setIsDetailOpen(false)} 
      />

      {/* POP-IN DE CONFIRMATION */}
      <DeleteConfirmDialog 
        isOpen={isDeleteConfirmOpen}
        onClose={() => { setIsDeleteConfirmOpen(false); setSessionIdToDelete(null); }}
        onConfirm={handleConfirmDelete}
      />

    </div>
  );
};

export default HistoryView;