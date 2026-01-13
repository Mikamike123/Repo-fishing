// components/FeedEventsList.tsx - Version 13.9.5 (Restore Logic & Year Fix)
import React, { useMemo, useEffect } from 'react';
import { Clock, Trash2, ChevronRight, User, CheckCheck, RefreshCw } from 'lucide-react';
import { Session, UserProfile } from '../types';
import { SARDONIC_PHRASES, getSpeciesGrammar } from '../constants/feedPhrases';

interface FeedEventsListProps {
    sessions: Session[];
    currentUserId: string;
    userProfile: UserProfile | null;
    usersRegistry: Record<string, UserProfile>;
    isActuallyNight?: boolean;
    onNavigateToSession: (sessionId: string) => void;
    onMarkAsRead: (id: string) => void;
    onHideSession: (id: string) => void;
    onToggleReaction: (sessionId: string, reactionKey: string) => void;
    showArchive?: boolean;
}

const FeedEventsList: React.FC<FeedEventsListProps> = ({ 
    sessions, currentUserId, userProfile, usersRegistry, isActuallyNight, 
    onNavigateToSession, onMarkAsRead, onHideSession, onToggleReaction,
    showArchive = false
}) => {
    
    const getTime = (val: any): number => {
        if (!val) return 0;
        if (typeof val === 'object' && (val.seconds || val._seconds)) return (val.seconds || val._seconds) * 1000;
        return new Date(val).getTime();
    };

    const warLog = useMemo(() => {
        const logs: any[] = [];
        const now = Date.now();
        const FIFTEEN_DAYS = 15 * 24 * 60 * 60 * 1000;

        sessions.forEach(s => {
            const sessionTime = getTime(s.createdAt || s.date);
            const isFresh = (now - sessionTime) < FIFTEEN_DAYS;

            if (!isFresh) return;

            const isRead = s.readBy?.includes(currentUserId);
            const isHidden = s.hiddenBy?.includes(currentUserId);
            const avatar = usersRegistry[s.userId]?.avatarUrl || (s.userId === currentUserId ? userProfile?.avatarUrl : null);
            const seed = s.id.charCodeAt(s.id.length - 1);

            if (showArchive) {
                if (!isRead && !isHidden) return;
            } else {
                if (isRead || isHidden) return;
            }

            const logBase = { 
                sessionId: s.id, date: s.date, createdAt: s.createdAt, userId: s.userId, 
                readBy: s.readBy || [], reactions: s.reactions || {}, isRead, isHidden, avatar 
            };

            if (s.catches.length === 0 && s.misses.length === 0) {
                logs.push({ ...logBase, type: 'skunk', text: SARDONIC_PHRASES.skunk[seed % SARDONIC_PHRASES.skunk.length].replace('{avatar}', s.userPseudo || "Pêcheur") });
            }
            s.catches.forEach((c, i) => {
                const g = getSpeciesGrammar(c.species);
                logs.push({ ...logBase, type: 'catch', text: SARDONIC_PHRASES.catch[(seed + i) % SARDONIC_PHRASES.catch.length].replace('{avatar}', s.userPseudo || "Pêcheur").replace('{species}', c.species).replace('{article}', g.article).replace('{status}', g.v).replace('{size}', c.size.toString()) });
            });
            s.misses.forEach((m, i) => {
                logs.push({ ...logBase, type: 'fail', text: SARDONIC_PHRASES.fail[(seed + i + 5) % SARDONIC_PHRASES.fail.length].replace('{avatar}', s.userPseudo || "Pêcheur") });
            });
        });

        return logs.sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt));
    }, [sessions, currentUserId, showArchive, userProfile, usersRegistry]);

    useEffect(() => {
        const now = Date.now();
        const FIFTEEN_DAYS = 15 * 24 * 60 * 60 * 1000;
        sessions.forEach(s => {
            if ((now - getTime(s.createdAt || s.date)) >= FIFTEEN_DAYS && !s.readBy?.includes(currentUserId)) {
                onMarkAsRead(s.id);
            }
        });
    }, [sessions.length, currentUserId]);

    const SocialVibe = ({ emoji, count, active, onClick, colorClass }: any) => (
        <button 
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}
            className={`flex items-center gap-1 px-2 py-1 rounded-xl border transition-all ${active ? `${colorClass} border-current shadow-sm` : 'border-stone-100 bg-stone-50/50 text-stone-300'}`}
        >
            <span className={`text-base ${active ? 'animate-bounce' : 'grayscale opacity-50'}`}>{emoji}</span>
            {count > 0 && <span className="text-[9px] font-black">{count}</span>}
        </button>
    );

    return (
        <div className="relative pl-7 space-y-4">
            <div className={`absolute left-[39px] top-2 bottom-2 w-0.5 ${isActuallyNight ? 'bg-indigo-500/10' : 'bg-stone-100'}`} />
            
            {warLog.length === 0 && (
                <div className="text-center py-10 px-6 text-stone-400 italic text-xs">
                    {showArchive ? "Archive vide (Règle des 15j)." : "Zéro notification. Tout est lu !"}
                </div>
            )}

            {warLog.map((log, idx) => (
                <div key={`${log.sessionId}-${idx}`} className={`relative group animate-in slide-in-from-left duration-300 ${log.isRead || log.isHidden ? 'opacity-60' : ''}`}>
                    <div className={`absolute -left-[45px] top-4 w-3 h-3 rounded-full border-2 z-10 transition-all ${!log.isRead ? 'bg-emerald-500 border-emerald-900 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-stone-200 border-stone-300'}`} />
                    <div 
                        className={`${isActuallyNight ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-100 shadow-lg'} rounded-[1.5rem] p-4 border flex flex-col gap-3 cursor-pointer transition-all`} 
                        onClick={() => { if (!log.isRead) onMarkAsRead(log.sessionId); onNavigateToSession(log.sessionId); }}
                    >
                        <div className="flex items-start gap-3">
                            <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 bg-stone-100 border border-stone-200 shadow-inner">
                                {log.avatar ? <img src={log.avatar} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-stone-300 bg-stone-50"><User size={18} /></div>}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className={`text-[13px] leading-tight font-bold italic ${isActuallyNight ? 'text-stone-100' : 'text-stone-800'}`}>"{log.text}"</p>
                                <div className="flex items-center gap-1.5 mt-1 opacity-40">
                                    <span className="text-[8px] font-black uppercase flex items-center gap-1 tracking-tighter text-stone-400">
                                        <Clock size={10} /> {new Date(getTime(log.date)).toLocaleDateString('fr-FR', {day:'numeric', month:'short', year: 'numeric'})}
                                    </span>
                                    {log.isRead && <span className="flex items-center gap-0.5 text-[8px] font-black uppercase text-sky-500 tracking-tighter"><CheckCheck size={10} /> LU</span>}
                                    {log.isHidden && <span className="text-[8px] font-black uppercase text-rose-500 tracking-tighter flex items-center gap-0.5"><Trash2 size={10} /> CACHÉ</span>}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-stone-100/50">
                            <div className="flex gap-1.5">
                                <SocialVibe emoji="😍" count={log.reactions?.love?.length || 0} active={log.reactions?.love?.includes(currentUserId)} onClick={() => onToggleReaction(log.sessionId, 'love')} colorClass="text-rose-500 bg-rose-50 border-rose-200" />
                                <SocialVibe emoji="😂" count={log.reactions?.laugh?.length || 0} active={log.reactions?.laugh?.includes(currentUserId)} onClick={() => onToggleReaction(log.sessionId, 'laugh')} colorClass="text-amber-500 bg-amber-50 border-amber-200" />
                                <SocialVibe emoji="👍" count={log.reactions?.like?.length || 0} active={log.reactions?.like?.includes(currentUserId)} onClick={() => onToggleReaction(log.sessionId, 'like')} colorClass="text-sky-500 bg-sky-50 border-sky-200" />
                            </div>
                            <div className="flex items-center gap-2">
                                {/* Michael: Bouton Restaurer (Archive vers Actif) */}
                                {showArchive && (
                                    <button 
                                        onClick={(e) => { 
                                            e.stopPropagation(); 
                                            if (log.isRead) onMarkAsRead(log.sessionId);
                                            if (log.isHidden) onHideSession(log.sessionId);
                                        }} 
                                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 text-[9px] font-black uppercase hover:bg-emerald-500 hover:text-white transition-all"
                                    >
                                        <RefreshCw size={10} /> Restaurer
                                    </button>
                                )}
                                {!log.isHidden && !showArchive && (
                                    <button onClick={(e) => { e.stopPropagation(); onHideSession(log.sessionId); }} className="p-1 text-stone-300 hover:text-rose-500"><Trash2 size={14} /></button>
                                )}
                                <span className={`text-[9px] font-black uppercase flex items-center gap-0.5 ${log.isRead ? 'text-stone-400' : 'text-amber-500'}`}>Détails <ChevronRight size={12} /></span>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default FeedEventsList;