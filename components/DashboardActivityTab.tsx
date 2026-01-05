// components/DashboardActivityTab.tsx - Version 8.0 (Night Ops V8.0 & Prop Propagation)
import React, { useState, useMemo } from 'react';
import { Clock, Users, User as UserIcon } from 'lucide-react';
import SessionCard from './SessionCard';
import SessionDetailModal from './SessionDetailModal';
import DeleteConfirmDialog from './DeleteConfirmDialog';

export const DashboardActivityTab: React.FC<any> = ({ 
    sessions, 
    currentUserId, 
    onDeleteSession, 
    onEditSession,
    isActuallyNight // Michael : Récupération du signal de nuit depuis le Dashboard
}) => {
    const [selectedSession, setSelectedSession] = useState<any>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [sessionIdToDelete, setSessionIdToDelete] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    return (
        <div className="space-y-4 animate-in slide-in-from-bottom-10 duration-500 mx-2">
            {/* Michael : Plus de Trophées ici, déplacés vers l'onglet Expérience [cite: 112] */}
            <ActivityFeed 
                sessions={sessions} 
                currentUserId={currentUserId} 
                onDelete={(id: string) => { setSessionIdToDelete(id); setIsDeleteConfirmOpen(true); }} 
                onEdit={onEditSession} 
                onSelect={(s: any) => { setSelectedSession(s); setIsDetailOpen(true); }} 
                deletingId={deletingId} 
                isActuallyNight={isActuallyNight} // Michael : Transmission au feed
            />

            <SessionDetailModal session={selectedSession} isOpen={isDetailOpen} onClose={() => setIsDetailOpen(false)} />
            <DeleteConfirmDialog 
                isOpen={isDeleteConfirmOpen} 
                onClose={() => { setIsDeleteConfirmOpen(false); setSessionIdToDelete(null); }} 
                onConfirm={() => { 
                    if (sessionIdToDelete) { 
                        setIsDeleteConfirmOpen(false); 
                        setDeletingId(sessionIdToDelete); 
                        setTimeout(() => { onDeleteSession(sessionIdToDelete); setDeletingId(null); setSessionIdToDelete(null); }, 300); 
                    } 
                }} 
            />
        </div>
    );
};

const ActivityFeed: React.FC<any> = ({ 
    sessions, 
    currentUserId, 
    onDelete, 
    onEdit, 
    onSelect, 
    deletingId,
    isActuallyNight // Michael : Signal reçu
}) => {
    const [filter, setFilter] = useState<'all' | 'my'>('my');
    
    // Logic de filtrage Michael : 10 dernières sessions [cite: 111]
    const filtered = useMemo(() => (
        filter === 'my' ? sessions.filter((s: any) => s.userId === currentUserId) : sessions
    ).slice(0, 10), [sessions, filter, currentUserId]);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
                <h3 className={`font-bold text-lg flex items-center gap-2 ${isActuallyNight ? 'text-stone-100' : 'text-stone-800'}`}>
                    <Clock size={20} className="text-stone-400" /> Fil d'Actualité
                </h3>
                
                {/* Sélecteur de filtre Night Ops V8.0 (#1c1917) */}
                <div className={`flex p-1 rounded-xl border ${isActuallyNight ? 'bg-stone-900 border-stone-800' : 'bg-stone-100 border-stone-200'}`}>
                    <button 
                        onClick={() => setFilter('all')} 
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${
                            filter === 'all' 
                                ? (isActuallyNight ? 'bg-stone-800 text-stone-100 shadow-sm' : 'bg-white text-amber-600 shadow-sm') 
                                : 'text-stone-400 hover:text-stone-500'
                        }`}
                    >
                        <Users size={12} /> TOUS
                    </button>
                    <button 
                        onClick={() => setFilter('my')} 
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${
                            filter === 'my' 
                                ? (isActuallyNight ? 'bg-amber-900/40 text-amber-500 shadow-sm border border-amber-900/20' : 'bg-white text-amber-600 shadow-sm') 
                                : 'text-stone-400 hover:text-stone-500'
                        }`}
                    >
                        <UserIcon size={12} /> MOI
                    </button>
                </div>
            </div>

            <div className="space-y-4">
                {filtered.map((s: any) => (
                    <div 
                        key={s.id} 
                        className={`transition-all duration-300 transform ${deletingId === s.id ? 'opacity-0 scale-95 -translate-y-4 pointer-events-none' : 'opacity-100 scale-100'}`}
                    >
                        <SessionCard 
                            session={s} 
                            onDelete={onDelete} 
                            onEdit={onEdit} 
                            onClick={onSelect} 
                            currentUserId={currentUserId} 
                            isActuallyNight={isActuallyNight} // Michael : Connexion rétablie ici aussi
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};