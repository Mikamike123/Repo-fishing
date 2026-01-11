// components/FeedView.tsx - Version 12.1.0 (Stateless & Event-Only Notification)
import React, { useState, useMemo } from 'react';
import { 
    Zap, Swords, Trophy, ChevronRight, Fish, Calendar, Clock, ChevronDown, ChevronUp, Trash2, User, Medal, ListFilter
} from 'lucide-react';
import { Session, UserProfile, SpeciesType } from '../types';
import { SARDONIC_PHRASES, getSpeciesGrammar } from '../constants/feedPhrases';

interface FeedViewProps {
    sessions: Session[];
    currentUserId: string;
    userProfile: UserProfile | null;
    usersRegistry: Record<string, UserProfile>;
    isActuallyNight?: boolean;
    onNavigateToSession: (sessionId: string) => void;
    unreadFeedCount: number; // Michael : Piloté par useAppEngine (Stateless)
    onMarkAsRead: (id: string) => void;
    onHideSession: (id: string) => void;
}

const FeedView: React.FC<FeedViewProps> = ({ 
    sessions, currentUserId, userProfile, usersRegistry, isActuallyNight, 
    onNavigateToSession, unreadFeedCount, onMarkAsRead, onHideSession
}) => {
    const [activeSubTab, setActiveSubTab] = useState<'events' | 'duel'>('events');
    const [expandedYears, setExpandedYears] = useState<Record<number, boolean>>({ [new Date().getFullYear()]: true });
    
    const triggerHaptic = (i = 10) => window.navigator?.vibrate?.(i);

    const getTime = (dateVal: any): number => {
        if (!dateVal) return 0;
        if (typeof dateVal === 'object' && (dateVal.seconds || dateVal._seconds)) {
            return (dateVal.seconds || dateVal._seconds) * 1000;
        }
        return new Date(dateVal).getTime();
    };

    // --- LOGIQUE DUEL : CALCUL DES RANGS, PODIUMS & AUDIT PRISES ---
    const speciesHierarchy: SpeciesType[] = ['Brochet', 'Sandre', 'Perche', 'Black-Bass'];
    const currentMonthLabel = new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(new Date()).toUpperCase();

    const leaderboardData = useMemo(() => {
        const years: Record<number, any> = {};
        const now = new Date();
        const curM = now.getMonth();
        const curY = now.getFullYear();

        sessions.forEach(s => {
            const ts = getTime(s.date);
            const d = new Date(ts);
            const y = d.getFullYear();
            const m = d.getMonth();

            if (!years[y]) years[y] = { users: {}, seasonPodium: {} };
            const users = years[y].users;
            const podium = years[y].seasonPodium;

            if (!users[s.userId]) {
                users[s.userId] = {
                    id: s.userId,
                    pseudo: s.userPseudo || usersRegistry[s.userId]?.pseudo || "Michael",
                    avatar: usersRegistry[s.userId]?.avatarUrl || (s.userId === currentUserId ? userProfile?.avatarUrl : null),
                    species: speciesHierarchy.reduce((acc, sp) => ({ 
                        ...acc, [sp]: { count: 0, totalSize: 0, monthCount: 0, monthSize: 0, monthCatches: [], bestSessionId: '' } 
                    }), {})
                };
            }

            s.catches.forEach(c => {
                const sp = c.species as SpeciesType;
                const stat = users[s.userId].species[sp];
                if (stat) {
                    stat.count += 1;
                    stat.totalSize += c.size;
                    
                    const avg = stat.totalSize / stat.count;
                    const currentPts = Math.round(stat.count * avg);

                    // Mise à jour podium
                    if (!podium[sp]) podium[sp] = [];
                    const existingUserIdx = podium[sp].findIndex((p: any) => p.pseudo === users[s.userId].pseudo);
                    if (existingUserIdx > -1) {
                        podium[sp][existingUserIdx].pts = currentPts;
                    } else {
                        podium[sp].push({ pts: currentPts, pseudo: users[s.userId].pseudo });
                    }
                    podium[sp].sort((a: any, b: any) => b.pts - a.pts);

                    // Michael : Données du mois + Audit des prises
                    if (y === curY && m === curM) {
                        stat.monthCount += 1;
                        stat.monthSize += c.size;
                        stat.monthCatches.push({
                            size: c.size,
                            date: s.date,
                            id: c.id || Math.random().toString()
                        });
                    }
                    if (c.size > (stat.maxSize || 0)) {
                        stat.maxSize = c.size;
                        stat.bestSessionId = s.id;
                    }
                }
            });
        });
        return years;
    }, [sessions, usersRegistry, userProfile, currentUserId]);

    const warLog = useMemo(() => {
        const logs: any[] = [];
        // Michael : On filtre les sessions purgées (hiddenBy) via Firestore
        const filteredSessions = sessions.filter(s => !s.hiddenBy?.includes(currentUserId));
        
        const sortedSessions = [...filteredSessions]
            .sort((a, b) => getTime(b.date) - getTime(a.date));

        sortedSessions.forEach(s => {
            const avatar = s.userPseudo || "Pêcheur";
            const seed = s.id.charCodeAt(s.id.length - 1);
            
            if (s.catches.length === 0 && s.misses.length === 0) {
                logs.push({ type: 'skunk', text: SARDONIC_PHRASES.skunk[seed % SARDONIC_PHRASES.skunk.length].replace('{avatar}', avatar), sessionId: s.id, date: s.date, userId: s.userId, readBy: s.readBy });
            }
            s.catches.forEach((c, i) => {
                const g = getSpeciesGrammar(c.species);
                logs.push({ type: 'catch', text: SARDONIC_PHRASES.catch[(seed + i) % SARDONIC_PHRASES.catch.length].replace('{avatar}', avatar).replace('{species}', c.species).replace('{article}', g.article).replace('{status}', g.v).replace('{size}', c.size.toString()), sessionId: s.id, date: s.date, userId: s.userId, readBy: s.readBy });
            });
            s.misses.forEach((m, i) => {
                const seedAdjusted = seed + i + 5;
                logs.push({ type: 'fail', text: SARDONIC_PHRASES.fail[seedAdjusted % SARDONIC_PHRASES.fail.length].replace('{avatar}', avatar), sessionId: s.id, date: s.date, userId: s.userId, readBy: s.readBy });
            });
        });
        // Michael : Tri chronologique final pour le log
        return logs.sort((a, b) => getTime(b.date) - getTime(a.date)).slice(0, 25);
    }, [sessions, currentUserId]);

    const handleAction = (id: string) => {
        triggerHaptic();
        onMarkAsRead(id);
        onNavigateToSession(id);
    };

    const cardClass = isActuallyNight ? "bg-stone-900 border-stone-800" : "bg-white border-stone-100 shadow-xl";

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-500 max-w-4xl mx-auto w-full">
            
            {/* TABS AVEC NOTIFICATION SUR ÉVÉNEMENTS UNIQUEMENT */}
            <div className={`flex p-1.5 rounded-3xl border mx-4 ${isActuallyNight ? 'bg-stone-950 border-stone-800' : 'bg-stone-200/50 border-stone-200'}`}>
                <button 
                    onClick={() => { triggerHaptic(); setActiveSubTab('events'); }} 
                    className={`relative flex-1 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${activeSubTab === 'events' ? (isActuallyNight ? 'bg-stone-800 text-amber-500 shadow-lg' : 'bg-white text-amber-600 shadow-md') : 'text-stone-500'}`}
                >
                    <Zap size={16} /> Événements
                    {unreadFeedCount > 0 && (
                        <div className="absolute -top-1 -right-1 flex h-5 min-w-[20px] px-1 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-black text-white shadow-lg animate-in zoom-in duration-300">
                            {unreadFeedCount}
                        </div>
                    )}
                </button>
                <button 
                    onClick={() => { triggerHaptic(); setActiveSubTab('duel'); }} 
                    className={`relative flex-1 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${activeSubTab === 'duel' ? (isActuallyNight ? 'bg-stone-800 text-amber-500 shadow-lg' : 'bg-white text-amber-600 shadow-md') : 'text-stone-500'}`}
                >
                    <Swords size={16} /> Duel
                    {/* Michael : Pastille Duel supprimée selon changement d'avis */}
                </button>
            </div>

            <div className="px-4 pb-32">
                {activeSubTab === 'events' ? (
                    /* --- VUE ÉVÈNEMENTS --- */
                    <div className="relative pl-10 space-y-6">
                        <div className={`absolute left-[51px] top-2 bottom-2 w-0.5 ${isActuallyNight ? 'bg-indigo-500/10' : 'bg-stone-100'}`} />
                        {warLog.map((log, idx) => {
                            const isRead = log.readBy?.includes(currentUserId);
                            const avatar = usersRegistry[log.userId]?.avatarUrl || (log.userId === currentUserId ? userProfile?.avatarUrl : null);
                            return (
                                <div key={`${log.sessionId}-${idx}`} className="relative group animate-in slide-in-from-left duration-300">
                                    <div className={`absolute -left-[58px] top-5 w-4 h-4 rounded-full border-2 z-10 transition-all duration-700 ${isRead ? 'bg-stone-800 border-stone-900 opacity-20 scale-75' : log.type === 'catch' ? 'bg-emerald-500 border-emerald-900 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : log.type === 'fail' ? 'bg-rose-500 border-rose-900 shadow-[0_0_15px_rgba(244,63,94,0.3)]' : 'bg-stone-500 border-stone-900'}`} />
                                    <div className={`${cardClass} rounded-[2rem] p-6 border flex items-start gap-5 cursor-pointer active:scale-[0.98] transition-all group`} onClick={() => handleAction(log.sessionId)}>
                                        <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 bg-stone-800 border border-stone-500/20 shadow-inner">
                                            {avatar ? <img src={avatar} className={`w-full h-full object-cover transition-all duration-500 ${isRead ? 'grayscale opacity-30' : ''}`} alt="" /> : <div className="w-full h-full flex items-center justify-center text-stone-600 bg-stone-900"><User size={24} /></div>}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-[14px] leading-relaxed font-bold italic transition-colors ${isRead ? 'text-stone-600' : isActuallyNight ? 'text-stone-100' : 'text-stone-800'}`}>"{log.text}"</p>
                                            <div className="flex justify-between items-center mt-4">
                                                <span className="text-[10px] opacity-30 font-black uppercase flex items-center gap-1.5 tracking-tighter"><Clock size={12} /> {new Date(getTime(log.date)).toLocaleDateString('fr-FR', {day:'numeric', month:'short'})} • {new Date(getTime(log.date)).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'})}</span>
                                                <div className="flex items-center gap-5">
                                                    <button onClick={(e) => { e.stopPropagation(); onHideSession(log.sessionId); }} className="p-2 text-stone-500 hover:text-rose-500 transition-colors"><Trash2 size={16} /></button>
                                                    <span className={`text-[11px] font-black uppercase flex items-center gap-1 ${isRead ? 'text-stone-600' : 'text-amber-500'}`}>Voir <ChevronRight size={14} /></span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    /* --- VUE DUEL (ARENA) --- */
                    <div className="space-y-10">
                        {Object.keys(leaderboardData).sort((a, b) => Number(b) - Number(a)).map(yearStr => {
                            const y = Number(yearStr);
                            const isExp = expandedYears[y];
                            const podium = leaderboardData[y].seasonPodium;

                            return (
                                <div key={y} className="space-y-6">
                                    <button 
                                        onClick={() => { triggerHaptic(); setExpandedYears(p => ({...p, [y]: !p[y]})); }} 
                                        className={`w-full flex flex-col p-8 rounded-[2.5rem] border transition-all ${cardClass} ${isExp ? 'ring-2 ring-amber-500/30' : ''}`}
                                    >
                                        <div className="w-full flex justify-between items-center mb-6">
                                            <div className="flex items-center gap-5">
                                                <div className="p-4 bg-amber-500/10 rounded-2xl text-amber-500 shadow-inner"><Calendar size={24} /></div>
                                                <span className="font-black text-xl tracking-[0.2em] uppercase italic">SAISON {y}</span>
                                            </div>
                                            {isExp ? <ChevronUp size={28}/> : <ChevronDown size={28}/>}
                                        </div>
                                        
                                        <div className="flex flex-col gap-3 w-full">
                                            {speciesHierarchy.map(sp => podium[sp] && podium[sp].length > 0 && (
                                                <div key={sp} className="flex flex-col gap-2 p-4 bg-stone-500/5 rounded-2xl border border-white/5">
                                                    <div className="flex items-center gap-2">
                                                        <Fish size={14} className="text-amber-500" />
                                                        <span className="text-[10px] font-black uppercase text-stone-500 tracking-widest">{sp}</span>
                                                    </div>
                                                    <div className="flex flex-col gap-1.5 pl-6">
                                                        {podium[sp].slice(0, 2).map((leader: any, i: number) => (
                                                            <div key={leader.pseudo} className="flex justify-between items-center">
                                                                <span className="text-[11px] font-bold text-stone-300">
                                                                    <span className="text-amber-500 mr-2">{i + 1}{i === 0 ? 'er' : 'ème'}</span>
                                                                    {leader.pseudo}
                                                                </span>
                                                                <span className="text-[10px] font-black text-amber-500 opacity-80">{leader.pts} PTS</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </button>

                                    {isExp && (
                                        <div className="grid grid-cols-1 gap-8 animate-in slide-in-from-top-6 duration-500">
                                            {speciesHierarchy
                                                .filter(sp => podium[sp] && podium[sp].length > 0)
                                                .map(sp => {
                                                const users = Object.values(leaderboardData[y].users);
                                                return (
                                                    <div key={sp} className={`${cardClass} rounded-[3rem] p-10 border relative overflow-hidden group`}>
                                                        <div className="absolute -right-6 -top-6 opacity-[0.02] rotate-12 text-stone-500"><Fish size={200} /></div>
                                                        <h4 className="text-[14px] font-black uppercase tracking-[0.4em] mb-10 flex gap-4 items-center text-amber-500">
                                                            <Medal size={20}/> CLASSEMENT {sp}
                                                        </h4>
                                                        <div className="space-y-12">
                                                            {users.filter((u:any) => u.species[sp].count > 0).sort((a:any, b:any) => {
                                                                const ptsA = a.species[sp].count * (a.species[sp].totalSize / a.species[sp].count);
                                                                const ptsB = b.species[sp].count * (b.species[sp].totalSize / b.species[sp].count);
                                                                return ptsB - ptsA;
                                                            }).map((u: any, idx: number) => {
                                                                const s = u.species[sp];
                                                                const avgSize = s.count ? (s.totalSize / s.count) : 0;
                                                                const ptsY = Math.round(s.count * avgSize);
                                                                const ptsM = Math.round(s.monthCount * (s.monthCount ? (s.monthSize / s.monthCount) : 0));
                                                                const mPassed = new Date().getMonth() + 1;
                                                                const projection = Math.round(s.count + ( (s.count / mPassed) * (12 - mPassed) ));
                                                                
                                                                // Michael : Audit des captures du mois trié par taille (descending)
                                                                const sortedMonthCatches = [...s.monthCatches].sort((a,b) => b.size - a.size);

                                                                return (
                                                                    <div key={u.pseudo} className="relative">
                                                                        <div className="flex items-center gap-6 mb-5">
                                                                            <div className="relative">
                                                                                <div className="w-16 h-16 rounded-[1.5rem] border-2 border-amber-500/40 overflow-hidden shrink-0 bg-stone-950 shadow-2xl">
                                                                                    <img src={u.avatar} className="w-full h-full object-cover" alt="" />
                                                                                </div>
                                                                                <div className={`absolute -top-2 -left-2 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black border-2 ${idx === 0 ? 'bg-amber-500 border-amber-900 text-white shadow-lg' : 'bg-stone-800 border-stone-700 text-stone-400'}`}>
                                                                                    {idx + 1}
                                                                                </div>
                                                                            </div>
                                                                            <div className="flex-1 min-w-0">
                                                                                <div className="flex justify-between items-end mb-1.5">
                                                                                    <span className="text-[17px] font-black uppercase tracking-tight italic">{u.pseudo}</span>
                                                                                    <span className="text-xl font-black text-amber-500 tracking-tighter">{ptsY} <span className="text-xs opacity-50">PTS</span></span>
                                                                                </div>
                                                                                <div className="flex justify-between text-[11px] font-black opacity-40 uppercase tracking-widest">
                                                                                    <span>{s.count} prises • moy {Math.round(avgSize)}cm</span>
                                                                                    <span className="text-emerald-500 font-black">{currentMonthLabel} : {ptsM} PTS</span>
                                                                                </div>
                                                                            </div>
                                                                            {s.bestSessionId && (
                                                                                <button onClick={() => handleAction(s.bestSessionId)} className="p-4 bg-amber-500/10 rounded-2xl hover:bg-amber-500 text-amber-500 hover:text-white transition-all shadow-lg active:scale-90">
                                                                                    <Trophy size={20} />
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                        
                                                                        <div className="space-y-4">
                                                                            <div className="h-3.5 w-full bg-stone-500/10 rounded-full overflow-hidden border border-white/5 shadow-inner">
                                                                                <div className="h-full bg-gradient-to-r from-amber-600 via-amber-400 to-orange-500 transition-all duration-1500 ease-out shadow-[0_0_20px_rgba(245,158,11,0.4)]" style={{ width: `${Math.min(100, (ptsY / 5000) * 100)}%` }} />
                                                                            </div>

                                                                            {/* Michael : Audit des prises trié par taille (SANS RÉGRESSION) */}
                                                                            {sortedMonthCatches.length > 0 && (
                                                                                <div className="bg-stone-500/5 rounded-2xl p-4 border border-stone-500/10">
                                                                                    <h5 className="text-[9px] font-black uppercase text-stone-400 mb-3 flex items-center gap-2"><ListFilter size={12}/> Journal de {currentMonthLabel}</h5>
                                                                                    <div className="space-y-2">
                                                                                        {sortedMonthCatches.map((c) => (
                                                                                            <div key={c.id} className="flex justify-between items-center text-[10px] font-bold">
                                                                                                <span className="opacity-40">{new Date(getTime(c.date)).toLocaleDateString('fr-FR', {day: 'numeric', month: 'short'})}</span>
                                                                                                <span className="text-amber-500">{c.size} CM</span>
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>
                                                                            )}

                                                                            {y === new Date().getFullYear() && s.count > 0 && (
                                                                                <div className="flex justify-end pr-2">
                                                                                    <span className="text-[10px] font-black italic text-amber-500/70 uppercase tracking-[0.2em]">Oracle Math : {projection} captures projetées</span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default FeedView;