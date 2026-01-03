import React, { useState, useMemo } from 'react';
import { Clock, Users, User as UserIcon } from 'lucide-react';
import SessionCard from './SessionCard';
import SessionDetailModal from './SessionDetailModal';
import DeleteConfirmDialog from './DeleteConfirmDialog';

export const DashboardActivityTab: React.FC<any> = ({ sessions, currentUserId, onDeleteSession, onEditSession }) => {
    const [selectedSession, setSelectedSession] = useState<any>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [sessionIdToDelete, setSessionIdToDelete] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    return (
        <div className="space-y-4 animate-in slide-in-from-bottom-10 duration-500 mx-2">
            {/* Michael : Plus de Trophées ici, déplacés vers l'onglet Expérience */}
            <ActivityFeed 
                sessions={sessions} 
                currentUserId={currentUserId} 
                onDelete={(id: string) => { setSessionIdToDelete(id); setIsDeleteConfirmOpen(true); }} 
                onEdit={onEditSession} 
                onSelect={(s: any) => { setSelectedSession(s); setIsDetailOpen(true); }} 
                deletingId={deletingId} 
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

const ActivityFeed: React.FC<any> = ({ sessions, currentUserId, onDelete, onEdit, onSelect, deletingId }) => {
    const [filter, setFilter] = useState<'all' | 'my'>('my');
    const filtered = useMemo(() => (filter === 'my' ? sessions.filter((s: any) => s.userId === currentUserId) : sessions).slice(0, 10), [sessions, filter, currentUserId]);
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
                <h3 className="text-stone-800 font-bold text-lg flex items-center gap-2"><Clock size={20} className="text-stone-400" /> Fil d'Actualité</h3>
                <div className="flex bg-stone-100 p-1 rounded-xl border border-stone-200">
                    <button onClick={() => setFilter('all')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${filter === 'all' ? 'bg-white text-amber-600 shadow-sm' : 'text-stone-400'}`}><Users size={12} /> TOUS</button>
                    <button onClick={() => setFilter('my')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${filter === 'my' ? 'bg-white text-amber-600 shadow-sm' : 'text-stone-400'}`}><UserIcon size={12} /> MOI</button>
                </div>
            </div>
            <div className="space-y-4">
                {filtered.map((s: any) => (
                    <div key={s.id} className={`transition-all duration-300 transform ${deletingId === s.id ? 'opacity-0 scale-95 -translate-y-4 pointer-events-none' : 'opacity-100 scale-100'}`}>
                        <SessionCard session={s} onDelete={onDelete} onEdit={onEdit} onClick={onSelect} currentUserId={currentUserId} />
                    </div>
                ))}
            </div>
        </div>
    );
};