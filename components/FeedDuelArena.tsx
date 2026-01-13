// components/FeedDuelArena.tsx - Version 1.1.0 (Current Season Focus & Zero-Catch Safety)
import React, { useState, useMemo } from 'react';
import { Calendar, ChevronDown, ChevronUp, Fish, Medal, Trophy, ListFilter } from 'lucide-react';
import { Session, UserProfile, SpeciesType } from '../types';

interface FeedDuelArenaProps {
    sessions: Session[];
    currentUserId: string;
    userProfile: UserProfile | null;
    usersRegistry: Record<string, UserProfile>;
    isActuallyNight?: boolean;
    onNavigateToSession: (id: string) => void;
    onMarkAsRead: (id: string) => void;
}

const FeedDuelArena: React.FC<FeedDuelArenaProps> = ({ 
    sessions, currentUserId, userProfile, usersRegistry, isActuallyNight, onNavigateToSession, onMarkAsRead 
}) => {
    const curY = new Date().getFullYear();
    // Michael : On initialise l'expansion uniquement sur l'année en cours
    const [expandedYears, setExpandedYears] = useState<Record<number, boolean>>({ [curY]: true });
    
    const speciesHierarchy: SpeciesType[] = ['Brochet', 'Sandre', 'Perche', 'Black-Bass'];
    const currentMonthLabel = new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(new Date()).toUpperCase();

    const getTime = (dateVal: any): number => {
        if (!dateVal) return 0;
        if (typeof dateVal === 'object' && (dateVal.seconds || dateVal._seconds)) {
            return (dateVal.seconds || dateVal._seconds) * 1000;
        }
        return new Date(dateVal).getTime();
    };

    const leaderboardData = useMemo(() => {
        const years: Record<number, any> = {};
        const now = new Date();
        const curM = now.getMonth();
        const curY = now.getFullYear();

        // Michael : On s'assure que l'année en cours existe TOUJOURS, même à 0 prises
        years[curY] = { users: {}, seasonPodium: {} };

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
                    
                    // Calcul des points basé sur la somme des tailles (TotalSize)
                    // car pts = count * (totalSize / count) = totalSize
                    const currentPts = Math.round(stat.totalSize);

                    if (!podium[sp]) podium[sp] = [];
                    const existingUserIdx = podium[sp].findIndex((p: any) => p.pseudo === users[s.userId].pseudo);
                    if (existingUserIdx > -1) {
                        podium[sp][existingUserIdx].pts = currentPts;
                    } else {
                        podium[sp].push({ pts: currentPts, pseudo: users[s.userId].pseudo });
                    }
                    podium[sp].sort((a: any, b: any) => b.pts - a.pts);

                    if (y === curY && m === curM) {
                        stat.monthCount += 1;
                        stat.monthSize += c.size;
                        stat.monthCatches.push({ size: c.size, date: s.date, id: c.id || Math.random().toString() });
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

    const cardClass = isActuallyNight ? "bg-stone-900 border-stone-800" : "bg-white border-stone-100 shadow-xl";

    return (
        <div className="space-y-10">
            {Object.keys(leaderboardData).sort((a, b) => Number(b) - Number(a)).map(yearStr => {
                const y = Number(yearStr);
                const isCurrentSeason = y === curY;
                const isExp = expandedYears[y];
                const podium = leaderboardData[y].seasonPodium;

                return (
                    <div key={y} className="space-y-6">
                        {/* BOUTON DE SAISON */}
                        <button 
                            onClick={() => {
                                // Michael : On n'autorise le dépliage QUE pour l'année en cours
                                if (isCurrentSeason) {
                                    setExpandedYears(p => ({...p, [y]: !p[y]}));
                                }
                            }} 
                            className={`w-full flex flex-col p-8 rounded-[2.5rem] border transition-all cursor-default ${cardClass} ${isExp && isCurrentSeason ? 'ring-2 ring-amber-500/30' : ''} ${!isCurrentSeason ? 'opacity-80' : ''}`}
                        >
                            <div className="w-full flex justify-between items-center mb-6">
                                <div className="flex items-center gap-5">
                                    <div className="p-4 bg-amber-500/10 rounded-2xl text-amber-500 shadow-inner">
                                        <Calendar size={24} />
                                    </div>
                                    <span className="font-black text-xl tracking-[0.2em] uppercase italic">SAISON {y}</span>
                                </div>
                                {isCurrentSeason && (isExp ? <ChevronUp size={28}/> : <ChevronDown size={28}/>)}
                            </div>
                            
                            {/* Résumé Podium (Visible sur toutes les années) */}
                            <div className="flex flex-col gap-3 w-full text-left">
                                {speciesHierarchy.map(sp => podium[sp] && podium[sp].length > 0 ? (
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
                                ) : isCurrentSeason && (
                                    /* Michael : On affiche l'espèce même si vide pour l'année en cours */
                                    <div key={sp} className="flex items-center justify-between p-4 bg-stone-500/5 rounded-2xl border border-dashed border-stone-700 opacity-30">
                                        <div className="flex items-center gap-2">
                                            <Fish size={14} className="text-stone-500" />
                                            <span className="text-[10px] font-black uppercase tracking-widest">{sp}</span>
                                        </div>
                                        <span className="text-[9px] font-black uppercase">En attente...</span>
                                    </div>
                                ))}
                            </div>
                        </button>

                        {/* Michael : LA DÉCLINAISON PAR ESPÈCE - Uniquement pour l'année en cours et si étendu */}
                        {isExp && isCurrentSeason && (
                            <div className="grid grid-cols-1 gap-8 animate-in slide-in-from-top-6 duration-500">
                                {speciesHierarchy.map(sp => {
                                    const users = Object.values(leaderboardData[y].users);
                                    const speciesHasData = users.some((u:any) => u.species[sp].count > 0);

                                    if (!speciesHasData) return null;

                                    return (
                                        <div key={sp} className={`${cardClass} rounded-[3rem] p-10 border relative overflow-hidden group`}>
                                            <div className="absolute -right-6 -top-6 opacity-[0.02] rotate-12 text-stone-500"><Fish size={200} /></div>
                                            <h4 className="text-[14px] font-black uppercase tracking-[0.4em] mb-10 flex gap-4 items-center text-amber-500"><Medal size={20}/> CLASSEMENT {sp}</h4>
                                            <div className="space-y-12">
                                                {users.filter((u:any) => u.species[sp].count > 0).sort((a:any, b:any) => {
                                                    return b.species[sp].totalSize - a.species[sp].totalSize;
                                                }).map((u: any, idx: number) => {
                                                    const s = u.species[sp];
                                                    const avgSize = s.count ? (s.totalSize / s.count) : 0;
                                                    const ptsY = Math.round(s.totalSize);
                                                    const ptsM = Math.round(s.monthSize);
                                                    const mPassed = new Date().getMonth() + 1;
                                                    const projection = Math.round(s.count + ( (s.count / mPassed) * (12 - mPassed) ));
                                                    const sortedMonthCatches = [...s.monthCatches].sort((a,b) => b.size - a.size);

                                                    return (
                                                        <div key={u.pseudo} className="relative">
                                                            <div className="flex items-center gap-6 mb-5">
                                                                <div className="relative">
                                                                    <div className="w-16 h-16 rounded-[1.5rem] border-2 border-amber-500/40 overflow-hidden shrink-0 bg-stone-950 shadow-2xl">
                                                                        <img src={u.avatar} className="w-full h-full object-cover" alt="" />
                                                                    </div>
                                                                    <div className={`absolute -top-2 -left-2 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black border-2 ${idx === 0 ? 'bg-amber-500 border-amber-900 text-white shadow-lg' : 'bg-stone-800 border-stone-700 text-stone-400'}`}>{idx + 1}</div>
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
                                                                    <button onClick={() => { onMarkAsRead(s.bestSessionId); onNavigateToSession(s.bestSessionId); }} className="p-4 bg-amber-500/10 rounded-2xl hover:bg-amber-500 text-amber-500 hover:text-white transition-all shadow-lg active:scale-90"><Trophy size={20} /></button>
                                                                )}
                                                            </div>
                                                            <div className="space-y-4">
                                                                <div className="h-3.5 w-full bg-stone-500/10 rounded-full overflow-hidden border border-white/5 shadow-inner">
                                                                    <div className="h-full bg-gradient-to-r from-amber-600 via-amber-400 to-orange-500 transition-all duration-1500 ease-out" style={{ width: `${Math.min(100, (ptsY / 5000) * 100)}%` }} />
                                                                </div>
                                                                {sortedMonthCatches.length > 0 && (
                                                                    <div className="bg-stone-500/5 rounded-2xl p-4 border border-stone-500/10">
                                                                        <h5 className="text-[9px] font-black uppercase text-stone-400 mb-3 flex items-center gap-2"><ListFilter size={12}/> Journal de {currentMonthLabel}</h5>
                                                                        <div className="space-y-2">
                                                                            {sortedMonthCatches.map((c: any) => (
                                                                                <div key={c.id} className="flex justify-between items-center text-[10px] font-bold">
                                                                                    <span className="opacity-40">{new Date(getTime(c.date)).toLocaleDateString('fr-FR', {day: 'numeric', month: 'short'})}</span>
                                                                                    <span className="text-amber-500">{c.size} CM</span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                <div className="flex justify-end pr-2"><span className="text-[10px] font-black italic text-amber-500/70 uppercase tracking-[0.2em]">Oracle Math : {projection} captures projetées</span></div>
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
    );
};

export default FeedDuelArena;