// components/FeedEventsList.tsx - Version 1.3.0 (Interactive Read Status)
import React, { useMemo } from 'react';
import { Clock, Trash2, ChevronRight, User, Anchor, Droplets, Flame, CheckCheck } from 'lucide-react';
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
    
    const getTime = (dateVal: any): number => {
        if (!dateVal) return 0;
        if (typeof dateVal === 'object' && (dateVal.seconds || dateVal._seconds)) {
            return (dateVal.seconds || dateVal._seconds) * 1000;
        }
        return new Date(dateVal).getTime();
    };

    const warLog = useMemo(() => {
        const logs: any[] = [];
        const filteredSessions = sessions.filter(s => !s.hiddenBy?.includes(currentUserId));
        const sortedSessions = [...filteredSessions].sort((a, b) => getTime(b.date) - getTime(a.date));

        sortedSessions.forEach(s => {
            const avatar = s.userPseudo || "Pêcheur";
            const seed = s.id.charCodeAt(s.id.length - 1);
            
            const logBase = { 
                sessionId: s.id, 
                date: s.date, 
                userId: s.userId, 
                readBy: s.readBy,
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
        return logs.sort((a, b) => getTime(b.date) - getTime(a.date)).slice(0, 25);
    }, [sessions, currentUserId]);

    const cardClass = isActuallyNight ? "bg-stone-900 border-stone-800" : "bg-white border-stone-100 shadow-xl";

    const VibeButton = ({ icon: Icon, count, active, onClick, colorClass }: any) => (
        <button 
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all active:scale-125 ${
                active 
                ? `${colorClass} border-current shadow-sm` 
                : 'border-transparent text-stone-500 hover:bg-stone-500/10'
            }`}
        >
            <Icon size={14} className={active ? 'vibe-animate-pop' : ''} />
            {count > 0 && <span className="text-[10px] font-black">{count}</span>}
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
                        {/* Point de la Timeline (Status de navigation uniquement) */}
                        <div className={`absolute -left-[58px] top-5 w-4 h-4 rounded-full border-2 z-10 transition-all duration-700 
                            ${!isRead 
                                ? 'bg-emerald-500 border-emerald-900 shadow-[0_0_15px_rgba(16,185,129,0.5)] scale-110' 
                                : 'bg-stone-700 border-stone-800 opacity-40 scale-75'
                            }`} 
                        />

                        <div 
                            className={`${cardClass} rounded-[2rem] p-6 border flex flex-col gap-4 cursor-pointer active:scale-[0.99] transition-all group`} 
                            onClick={() => { onMarkAsRead(log.sessionId); onNavigateToSession(log.sessionId); }}
                        >
                            <div className="flex items-start gap-5">
                                <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 bg-stone-800 border border-stone-500/20 shadow-inner relative">
                                    {avatar ? (
                                        <img src={avatar} className="w-full h-full object-cover" alt="" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-stone-600 bg-stone-900">
                                            <User size={24} />
                                        </div>
                                    )}
                                    {/* Petit overlay si non lu sur l'avatar */}
                                    {!isRead && <div className="absolute inset-0 border-2 border-emerald-500/30 rounded-2xl pointer-events-none" />}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <p className={`text-[14px] leading-relaxed font-bold italic transition-colors ${isActuallyNight ? 'text-stone-100' : 'text-stone-800'}`}>
                                        "{log.text}"
                                    </p>
                                    
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[10px] opacity-30 font-black uppercase flex items-center gap-1.5 tracking-tighter">
                                            <Clock size={12} /> 
                                            {new Date(getTime(log.date)).toLocaleDateString('fr-FR', {day:'numeric', month:'short'})}
                                        </span>
                                        {isRead && (
                                            <span className="flex items-center gap-1 text-[9px] font-black uppercase text-emerald-500/50 tracking-tighter">
                                                <CheckCheck size={12} /> Lu
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* BARRE DE VIBES (Toujours colorée et interactive) */}
                            <div className="flex items-center justify-between pt-2 border-t border-stone-500/5">
                                <div className="flex gap-1">
                                    <VibeButton 
                                        icon={Anchor} 
                                        count={log.reactions?.net?.length || 0}
                                        active={log.reactions?.net?.includes(currentUserId)}
                                        onClick={() => onToggleReaction(log.sessionId, 'net')}
                                        colorClass="text-emerald-500 bg-emerald-500/10"
                                    />
                                    <VibeButton 
                                        icon={Droplets} 
                                        count={log.reactions?.salt?.length || 0}
                                        active={log.reactions?.salt?.includes(currentUserId)}
                                        onClick={() => onToggleReaction(log.sessionId, 'salt')}
                                        colorClass="text-amber-500 bg-amber-500/10"
                                    />
                                    <VibeButton 
                                        icon={Flame} 
                                        count={log.reactions?.fire?.length || 0}
                                        active={log.reactions?.fire?.includes(currentUserId)}
                                        onClick={() => onToggleReaction(log.sessionId, 'fire')}
                                        colorClass="text-orange-500 bg-orange-500/10"
                                    />
                                </div>

                                <div className="flex items-center gap-3">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onHideSession(log.sessionId); }} 
                                        className="p-2 text-stone-500 hover:text-rose-500 transition-colors"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                    <span className={`text-[11px] font-black uppercase flex items-center gap-1 ${isRead ? 'text-stone-500' : 'text-amber-500'}`}>
                                        Détails <ChevronRight size={14} />
                                    </span>
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