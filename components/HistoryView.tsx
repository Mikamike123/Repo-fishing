import React, { useState } from 'react';
import { ScrollText, Anchor } from 'lucide-react';
import { Session } from '../types';
import SessionCard from './SessionCard';
import SessionDetailModal from './SessionDetailModal';

interface HistoryViewProps {
  sessions: Session[];
  onDeleteSession: (id: string) => void;
  onEditSession: (session: Session) => void;
}

const HistoryView: React.FC<HistoryViewProps> = ({ sessions, onDeleteSession, onEditSession }) => {
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Trier les sessions par date décroissante
  const sortedSessions = [...sessions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleOpenDetail = (session: Session) => {
      setSelectedSession(session);
      setIsDetailOpen(true);
  };

  return (
    <div className="pb-24 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-8 px-2">
        <div>
          <h2 className="text-2xl font-bold text-stone-800 tracking-tight flex items-center gap-3">
            <ScrollText className="text-amber-500" size={28} />
            Journal de Bord
          </h2>
          <p className="text-sm text-stone-400 mt-1 font-medium ml-1">
            {sessions.length} session{sessions.length > 1 ? 's' : ''} enregistrée{sessions.length > 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Liste des Sessions */}
      <div className="space-y-4">
        {sortedSessions.length > 0 ? (
          sortedSessions.map((session) => (
            <SessionCard 
                key={session.id} 
                session={session} 
                onDelete={onDeleteSession}
                onEdit={onEditSession} // Connexion du bouton Modifier
                onClick={handleOpenDetail}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center border-2 border-dashed border-stone-200 rounded-3xl bg-stone-50/50">
             <div className="bg-white p-4 rounded-full shadow-sm mb-4">
                <Anchor className="text-stone-300" size={32} />
             </div>
             <h3 className="text-stone-500 font-bold text-lg mb-2">Aucune session</h3>
             <p className="text-stone-400 text-sm max-w-xs">
               Votre journal est vide. Lancez une nouvelle session pour commencer à construire votre Oracle.
             </p>
          </div>
        )}
      </div>

      {/* Modal de Détail */}
      <SessionDetailModal 
        session={selectedSession} 
        isOpen={isDetailOpen} 
        onClose={() => setIsDetailOpen(false)} 
      />

    </div>
  );
};

export default HistoryView;