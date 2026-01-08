// components/DashboardActivityTab.tsx - Version 8.2.0 (Multi-User Registry Integration)
import React, { useState, useMemo } from 'react';
import { Clock, Users, User as UserIcon } from 'lucide-react';
import SessionCard from './SessionCard';
import SessionDetailModal from './SessionDetailModal';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import { UserProfile } from '../types';

export const DashboardActivityTab: React.FC<any> = ({ 
    sessions, 
    currentUserId, 
    onDeleteSession, 
    onEditSession,
    isActuallyNight,
    userProfile, 
    usersRegistry // Michael : Réception du registre pour la Phase de Normalisation v10.6
}) => {
    const [selectedSession, setSelectedSession] = useState<any>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [sessionIdToDelete, setSessionIdToDelete] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    return (
        <div className="space-y-4 animate-in slide-in-from-bottom-10 duration-500 mx-2">
            <ActivityFeed 
                sessions={sessions} 
                currentUserId={currentUserId} 
                userProfile={userProfile} 
                usersRegistry={usersRegistry} // Michael : Transmission au feed
                onDelete={(id: string) => { setSessionIdToDelete(id); setIsDeleteConfirmOpen(true); }} 
                onEdit={onEditSession} 
                onSelect={(s: any) => { setSelectedSession(s); setIsDetailOpen(true); }} 
                deletingId={deletingId} 
                isActuallyNight={isActuallyNight}
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
    userProfile, 
    usersRegistry, // Michael : Reçu ici pour la jointure finale
    onDelete, 
    onEdit, 
    onSelect, 
    deletingId,
    isActuallyNight
}) => {
    const [filter, setFilter] = useState<'all' | 'my'>('my');
    
    const filtered = useMemo(() => (
        filter === 'my' ? sessions.filter((s: any) => s.userId === currentUserId) : sessions
    ).slice(0, 10), [sessions, filter, currentUserId]);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
                <h3 className={`font-bold text-lg flex items-center gap-2 ${isActuallyNight ? 'text-stone-100' : 'text-stone-800'}`}>
                    <Clock size={20} className="text-stone-400" /> Fil d'Actualité
                </h3>
                
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
                {filtered.map((s: any) => {
                    // Michael : La Logique de Jointure SSOT v10.6 améliorée
                    // 1. Si c'est ma session -> userProfile (Source directe)
                    // 2. Si c'est un ami -> usersRegistry (Source identifiée)
                    // 3. Sinon -> undefined (SessionCard affichera l'icône par défaut)
                    const authorAvatar = s.userId === currentUserId 
                        ? userProfile?.avatarUrl 
                        : usersRegistry?.[s.userId]?.avatarUrl;

                    return (
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
                                isActuallyNight={isActuallyNight}
                                authorAvatarUrl={authorAvatar} // Michael : On injecte l'avatar résolu via le registre
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};