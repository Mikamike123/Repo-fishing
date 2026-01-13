// components/FeedEventsList.tsx - Version 1.6.0 (High Contrast Emojis & Persistence)
import React, { useMemo } from 'react';
import { Clock, Trash2, ChevronRight, User, CheckCheck } from 'lucide-react';
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
}

const FeedEventsList: React.FC<FeedEventsListProps> = ({ 
    sessions, currentUserId, userProfile, usersRegistry, isActuallyNight, 
    onNavigateToSession, onMarkAsRead, onHideSession, onToggleReaction
}) => {
    
    const getTime = (val: any): number => {
        if (!val) return 0;
        if (typeof val === 'object' && (val.seconds || val._seconds)) {
            return (val.seconds || val._seconds) * 1000;
        }
        return new Date(val).getTime();
    };

    const warLog = useMemo(() => {
        const logs: any[] = [];
        const filteredSessions = sessions.filter(s => !s.hiddenBy?.includes(currentUserId));
        
        // Michael : Tri par création (createdAt) pour l'aspect flux social direct
        const sortedSessions = [...filteredSessions].sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt));

        sortedSessions.forEach(s => {
            const avatar = s.userPseudo || "Pêcheur";
            const seed = s.id.charCodeAt(s.id.length - 1);
            
            const logBase = { 
                sessionId: s.id, 
                date: s.date, 
                createdAt: s.createdAt,
                userId: s.userId, 
                readBy: s.readBy || [],
                reactions: s.reactions || {} 
            };

            if (s.catches.length === 0 && s.misses.length === 0) {
                logs.push({ ...logBase, type: 'skunk', text: SARDONIC_PHRASES.skunk[seed % SARDONIC_PHRASES.skunk.length].replace('{avatar}', avatar) });
            }
            s.catches.forEach((c, i) => {
                const g = getSpeciesGrammar(c.species);
                logs.push({ ...logBase, type: 'catch', text: SARDONIC_PHRASES.catch[(seed + i) % SARDONIC_PHRASES.catch.length].replace('{avatar}', avatar).replace('{species}', c.species).replace('{article}', g.article).replace('{status}', g.v).replace('{size}', c.size.toString()) });
            });
            s.misses.forEach((m, i) => {
                const seedAdjusted = seed + i + 5;
                logs.push({ ...logBase, type: 'fail', text: SARDONIC_PHRASES.fail[seedAdjusted % SARDONIC_PHRASES.fail.length].replace('{avatar}', avatar) });
            });
        });
        return logs.sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt)).slice(0, 30);
    }, [sessions, currentUserId]);

    const cardClass = isActuallyNight ? "bg-stone-900 border-stone-800" : "bg-white border-stone-100 shadow-xl";

    /**
     * Michael : SocialVibe revu pour le contraste élevé
     * - Inactif : Grayscale + Opacité 40%
     * - Actif : Couleurs pleines + Animation + Shadow
     */
    const SocialVibe = ({ emoji, count, active, onClick, colorClass }: any) => (
        <button 
            onClick={(e) => { 
                e.preventDefault(); 
                e.stopPropagation(); 
                onClick(); 
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border transition-all duration-300 active:scale-150 ${
                active 
                ? `${colorClass} border-current shadow-md scale-105` 
                : 'border-stone-100 bg-stone-50/30 text-stone-400 grayscale opacity-40 hover:opacity-100 hover:grayscale-0'
            }`}
        >
            <span className={`text-lg transition-transform ${active ? 'animate-bounce' : 'scale-90'}`}>{emoji}</span>
            {count > 0 && <span className="text-[11px] font-black">{count}</span>}
        </button>
    );

    return (
        <div className="relative pl-10 space-y-6">
            <div className={`absolute left-[51px] top-2 bottom-2 w-0.5 ${isActuallyNight ? 'bg-indigo-500/10' : 'bg-stone-100'}`} />
            
            {warLog.map((log, idx) => {
                const isRead = log.readBy?.includes(currentUserId);
                const avatar = usersRegistry[log.userId]?.avatarUrl || (log.userId === currentUserId ? userProfile?.avatarUrl : null);
                
                return (
                    <div key={`${log.sessionId}-${idx}`} className="relative group animate-in slide-in-from-left duration-300">
                        <div className={`absolute -left-[58px] top-5 w-4 h-4 rounded-full border-2 z-10 transition-all duration-700 
                            ${!isRead ? 'bg-emerald-500 border-emerald-900 shadow-[0_0_15px_rgba(16,185,129,0.5)] scale-110' : 'bg-stone-300 border-stone-400 opacity-30 scale-75'}`} 
                        />

                        <div 
                            className={`${cardClass} rounded-[2.5rem] p-6 border flex flex-col gap-4 cursor-pointer hover:shadow-2xl transition-all duration-300`} 
                            onClick={() => { 
                                if (!isRead) onMarkAsRead(log.sessionId); 
                                onNavigateToSession(log.sessionId); 
                            }}
                        >
                            <div className="flex items-start gap-5">
                                <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 bg-stone-100 border border-stone-200 shadow-inner relative">
                                    {avatar ? <img src={avatar} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-stone-300 bg-stone-50"><User size={24} /></div>}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-[15px] leading-relaxed font-bold italic transition-colors ${isActuallyNight ? 'text-stone-100' : 'text-stone-800'}`}>"{log.text}"</p>
                                    <div className="flex items-center gap-2 mt-1.5">
                                        <span className="text-[10px] opacity-40 font-black uppercase flex items-center gap-1.5 tracking-tighter">
                                            <Clock size={12} /> {new Date(getTime(log.date)).toLocaleDateString('fr-FR', {day:'numeric', month:'short'})}
                                        </span>
                                        {isRead && <span className="flex items-center gap-1 text-[10px] font-black uppercase text-sky-500 tracking-tighter animate-in fade-in"><CheckCheck size={14} /> LU</span>}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-3 border-t border-stone-100">
                                <div className="flex gap-2">
                                    <SocialVibe 
                                        emoji="😍" 
                                        count={log.reactions?.love?.length || 0} 
                                        active={log.reactions?.love?.includes(currentUserId)} 
                                        onClick={() => onToggleReaction(log.sessionId, 'love')} 
                                        colorClass="text-rose-500 bg-rose-50 border-rose-200" 
                                    />
                                    <SocialVibe 
                                        emoji="😂" 
                                        count={log.reactions?.laugh?.length || 0} 
                                        active={log.reactions?.laugh?.includes(currentUserId)} 
                                        onClick={() => onToggleReaction(log.sessionId, 'laugh')} 
                                        colorClass="text-amber-500 bg-amber-50 border-amber-200" 
                                    />
                                    <SocialVibe 
                                        emoji="👍" 
                                        count={log.reactions?.like?.length || 0} 
                                        active={log.reactions?.like?.includes(currentUserId)} 
                                        onClick={() => onToggleReaction(log.sessionId, 'like')} 
                                        colorClass="text-sky-500 bg-sky-50 border-sky-200" 
                                    />
                                </div>
                                <div className="flex items-center gap-3">
                                    <button onClick={(e) => { e.stopPropagation(); onHideSession(log.sessionId); }} className="p-2 text-stone-300 hover:text-rose-500 transition-colors"><Trash2 size={16} /></button>
                                    <span className={`text-[11px] font-black uppercase flex items-center gap-1 ${isRead ? 'text-stone-400' : 'text-amber-500'}`}>Détails <ChevronRight size={14} /></span>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default FeedEventsList;