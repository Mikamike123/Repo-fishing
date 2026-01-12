// components/FeedEventsList.tsx - Version 1.1.0 (Unified "New" Status)
import React, { useMemo } from 'react';
import { Clock, Trash2, ChevronRight, User } from 'lucide-react';
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
}

const FeedEventsList: React.FC<FeedEventsListProps> = ({ 
    sessions, currentUserId, userProfile, usersRegistry, isActuallyNight, 
    onNavigateToSession, onMarkAsRead, onHideSession 
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
        // Michael : On filtre les sessions purgées pour rester clean
        const filteredSessions = sessions.filter(s => !s.hiddenBy?.includes(currentUserId));
        const sortedSessions = [...filteredSessions].sort((a, b) => getTime(b.date) - getTime(a.date));

        sortedSessions.forEach(s => {
            const avatar = s.userPseudo || "Pêcheur";
            const seed = s.id.charCodeAt(s.id.length - 1);
            
            // Michael : Gestion des bredouilles (Skunk)
            if (s.catches.length === 0 && s.misses.length === 0) {
                logs.push({ type: 'skunk', text: SARDONIC_PHRASES.skunk[seed % SARDONIC_PHRASES.skunk.length].replace('{avatar}', avatar), sessionId: s.id, date: s.date, userId: s.userId, readBy: s.readBy });
            }
            // Michael : Prises (Catch)
            s.catches.forEach((c, i) => {
                const g = getSpeciesGrammar(c.species);
                logs.push({ type: 'catch', text: SARDONIC_PHRASES.catch[(seed + i) % SARDONIC_PHRASES.catch.length].replace('{avatar}', avatar).replace('{species}', c.species).replace('{article}', g.article).replace('{status}', g.v).replace('{size}', c.size.toString()), sessionId: s.id, date: s.date, userId: s.userId, readBy: s.readBy });
            });
            // Michael : Ratés (Fail)
            s.misses.forEach((m, i) => {
                const seedAdjusted = seed + i + 5;
                logs.push({ type: 'fail', text: SARDONIC_PHRASES.fail[seedAdjusted % SARDONIC_PHRASES.fail.length].replace('{avatar}', avatar), sessionId: s.id, date: s.date, userId: s.userId, readBy: s.readBy });
            });
        });
        
        // Michael : Tri chronologique final et fenêtre de tir sur les 25 derniers événements
        return logs.sort((a, b) => getTime(b.date) - getTime(a.date)).slice(0, 25);
    }, [sessions, currentUserId]);

    const cardClass = isActuallyNight ? "bg-stone-900 border-stone-800" : "bg-white border-stone-100 shadow-xl";

    return (
        <div className="relative pl-10 space-y-6">
            {/* Michael : La ligne de temps verticale */}
            <div className={`absolute left-[51px] top-2 bottom-2 w-0.5 ${isActuallyNight ? 'bg-indigo-500/10' : 'bg-stone-100'}`} />
            
            {warLog.map((log, idx) => {
                const isRead = log.readBy?.includes(currentUserId);
                const avatar = usersRegistry[log.userId]?.avatarUrl || (log.userId === currentUserId ? userProfile?.avatarUrl : null);
                
                return (
                    <div key={`${log.sessionId}-${idx}`} className="relative group animate-in slide-in-from-left duration-300">
                        {/* Michael : LA PASTILLE (L'indicateur d'état)
                           - Non lu : Vert pulsant (Emerald) + Halo (Shadow)
                           - Lu : Gris discret (Stone) + Translucidité (Opacity)
                        */}
                        <div className={`absolute -left-[58px] top-5 w-4 h-4 rounded-full border-2 z-10 transition-all duration-700 
                            ${!isRead 
                                ? 'bg-emerald-500 border-emerald-900 shadow-[0_0_15px_rgba(16,185,129,0.5)] scale-110' 
                                : 'bg-stone-800 border-stone-900 opacity-20 scale-75'
                            }`} 
                        />

                        {/* Michael : La carte de l'événement */}
                        <div className={`${cardClass} rounded-[2rem] p-6 border flex items-start gap-5 cursor-pointer active:scale-[0.98] transition-all group`} onClick={() => { onMarkAsRead(log.sessionId); onNavigateToSession(log.sessionId); }}>
                            <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 bg-stone-800 border border-stone-500/20 shadow-inner">
                                {avatar ? (
                                    <img src={avatar} className={`w-full h-full object-cover transition-all duration-500 ${isRead ? 'grayscale opacity-30' : ''}`} alt="" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-stone-600 bg-stone-900">
                                        <User size={24} />
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className={`text-[14px] leading-relaxed font-bold italic transition-colors ${isRead ? 'text-stone-600' : isActuallyNight ? 'text-stone-100' : 'text-stone-800'}`}>
                                    "{log.text}"
                                </p>
                                <div className="flex justify-between items-center mt-4">
                                    <span className="text-[10px] opacity-30 font-black uppercase flex items-center gap-1.5 tracking-tighter">
                                        <Clock size={12} /> 
                                        {new Date(getTime(log.date)).toLocaleDateString('fr-FR', {day:'numeric', month:'short'})} • {new Date(getTime(log.date)).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'})}
                                    </span>
                                    <div className="flex items-center gap-5">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); onHideSession(log.sessionId); }} 
                                            className="p-2 text-stone-500 hover:text-rose-500 transition-colors"
                                            title="Masquer l'événement"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                        <span className={`text-[11px] font-black uppercase flex items-center gap-1 ${isRead ? 'text-stone-600' : 'text-amber-500'}`}>
                                            Voir <ChevronRight size={14} />
                                        </span>
                                    </div>
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