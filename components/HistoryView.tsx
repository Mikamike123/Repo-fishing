import React, { useState } from 'react';
import { ScrollText, Anchor, Users, User } from 'lucide-react';
import { Session } from '../types';
import SessionCard from './SessionCard';
import SessionDetailModal from './SessionDetailModal';

interface HistoryViewProps {
  sessions: Session[];
  onDeleteSession: (id: string) => void;
  onEditSession: (session: Session) => void;
  currentUserId: string;
}

const HistoryView: React.FC<HistoryViewProps> = ({ sessions, onDeleteSession, onEditSession, currentUserId }) => {
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [showOnlyMine, setShowOnlyMine] = useState(false); // TOGGLE PAR DÉFAUT SUR 'TOUT VOIR'

  // Filtrage
  const displayedSessions = sessions
    .filter(s => showOnlyMine ? s.userId === currentUserId : true)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="pb-24 animate-in fade-in duration-300">
      
      {/* Header avec Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 px-2 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-stone-800 tracking-tight flex items-center gap-3">
            <ScrollText className="text-amber-500" size={28} />
            Journal
          </h2>
          <p className="text-sm text-stone-400 mt-1 font-medium ml-1">
            {displayedSessions.length} session{displayedSessions.length > 1 ? 's' : ''} affichée{displayedSessions.length > 1 ? 's' : ''}
          </p>
        </div>

        {/* TOGGLE SWITCH */}
        <div className="flex bg-stone-100 p-1 rounded-xl self-start sm:self-center">
            <button 
                onClick={() => setShowOnlyMine(false)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${!showOnlyMine ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
            >
                <Users size={14} /> Tous
            </button>
            <button 
                onClick={() => setShowOnlyMine(true)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${showOnlyMine ? 'bg-white text-amber-600 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
            >
                <User size={14} /> Mes Sessions
            </button>
        </div>
      </div>

      {/* Liste des Sessions */}
      <div className="space-y-4">
        {displayedSessions.length > 0 ? (
          displayedSessions.map((session) => (
            <SessionCard 
                key={session.id} 
                session={session} 
                onDelete={onDeleteSession}
                onEdit={onEditSession}
                onClick={(s) => { setSelectedSession(s); setIsDetailOpen(true); }}
                currentUserId={currentUserId}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center border-2 border-dashed border-stone-200 rounded-3xl bg-stone-50/50">
             <div className="bg-white p-4 rounded-full shadow-sm mb-4">
                <Anchor className="text-stone-300" size={32} />
             </div>
             <h3 className="text-stone-500 font-bold text-lg mb-2">Aucune session trouvée</h3>
             <p className="text-stone-400 text-sm max-w-xs">
               {showOnlyMine ? "Vous n'avez rien posté encore." : "Le journal est vide pour le moment."}
             </p>
          </div>
        )}
      </div>

      <SessionDetailModal 
        session={selectedSession} 
        isOpen={isDetailOpen} 
        onClose={() => setIsDetailOpen(false)} 
      />

    </div>
  );
};

export default HistoryView;