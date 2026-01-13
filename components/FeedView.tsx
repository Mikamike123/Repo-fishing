// components/FeedView.tsx - Version 13.9.0 (Ultra-Compact Mobile)
import React, { useState, useEffect, useMemo } from 'react';
import { Zap, Swords, Target, History, Trophy, Sparkles, Archive } from 'lucide-react';
import { Session, UserProfile } from '../types';
import FeedEventsList from './FeedEventsList';
import FeedDuelArena from './FeedDuelArena';

interface FeedViewProps {
    sessions: Session[];
    currentUserId: string;
    userProfile: UserProfile | null;
    usersRegistry: Record<string, UserProfile>;
    isActuallyNight?: boolean;
    onNavigateToSession: (sessionId: string) => void;
    unreadFeedCount: number;
    onMarkAsRead: (id: string) => void;
    onHideSession: (id: string) => void;
    onToggleReaction: (sessionId: string, reactionKey: string) => void;
}

const injectOracleStyles = () => {
    if (typeof document === 'undefined' || document.getElementById('oracle-vibe-styles')) return;
    const style = document.createElement('style');
    style.id = 'oracle-vibe-styles';
    style.textContent = `
        @keyframes glassShine {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
        }
        .glass-score {
            background: linear-gradient(110deg, #10b981 40%, #ffffff 50%, #10b981 60%);
            background-size: 200% auto;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            animation: glassShine 4s linear infinite;
        }
        @keyframes tideWave {
            0%, 100% { clip-path: polygon(0% 45%, 15% 44%, 32% 50%, 54% 60%, 70% 61%, 84% 59%, 100% 52%, 100% 100%, 0% 100%); }
            50% { clip-path: polygon(0% 60%, 16% 65%, 34% 66%, 51% 62%, 67% 50%, 84% 45%, 100% 46%, 100% 100%, 0% 100%); }
        }
        .animate-tide::after {
            content: "";
            position: absolute;
            top: 0; right: 0; bottom: 0; left: 0;
            background: rgba(255,255,255,0.2);
            animation: tideWave 2s infinite linear;
        }
    `;
    document.head.appendChild(style);
};

const FeedView: React.FC<FeedViewProps> = (props) => {
    const [activeSubTab, setActiveSubTab] = useState<'events' | 'duel'>('events');
    const [displayPoints, setDisplayPoints] = useState(0);
    const [showArchive, setShowArchive] = useState(false);

    const triggerHaptic = (pattern: number | number[] = 10) => {
        if (window.navigator && window.navigator.vibrate) window.navigator.vibrate(pattern);
    };

    useEffect(() => {
        injectOracleStyles();
    }, []);

    const communityStats = useMemo(() => {
        if (!props.sessions.length) return null;
        const now = new Date();
        const curM = now.getMonth();
        const curY = now.getFullYear();
        const currentMonthSessions = props.sessions.filter(s => {
            const sDate = new Date(s.date as string);
            return sDate.getMonth() === curM && sDate.getFullYear() === curY;
        });
        const lastHero = currentMonthSessions.length > 0 ? { pseudo: currentMonthSessions[0].userPseudo || "Pêcheur", date: currentMonthSessions[0].date } : null;
        const totalMonthPts = currentMonthSessions.reduce((total, s) => total + s.catches.reduce((sum, c) => sum + (c.size || 0), 0), 0);
        return { 
            lastHero, 
            totalMonthPts, 
            goal: 200, 
            monthLabel: new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(now), 
            isVictory: totalMonthPts >= 200 
        };
    }, [props.sessions]);

    useEffect(() => {
        if (communityStats) {
            let start = 0;
            const end = communityStats.totalMonthPts;
            const timer = setInterval(() => {
                start += Math.max(end / 60, 1);
                if (start >= end) {
                    setDisplayPoints(end);
                    clearInterval(timer);
                } else {
                    setDisplayPoints(Math.floor(start));
                }
            }, 16);
            return () => clearInterval(timer);
        }
    }, [communityStats?.totalMonthPts]);

    const cardClass = props.isActuallyNight ? "bg-stone-900 border-stone-800 shadow-xl" : "bg-white border-stone-100 shadow-md";
    const textTitle = props.isActuallyNight ? "text-stone-100" : "text-stone-800";

    return (
        <div className="flex flex-col gap-4 animate-in fade-in duration-500 max-w-4xl mx-auto w-full">
            
            {/* HEADER LA BANDE - COMPACT v13.9 */}
            <div className={`mx-4 p-4 rounded-[2rem] border relative flex flex-col gap-3 transition-all ${cardClass}`}>
                
                {/* Ligne 1 : Dernier Relais (Compacté) */}
                <div className="flex flex-col gap-0.5 border-b border-stone-500/5 pb-2">
                    <div className="flex items-center gap-1.5">
                        <History size={12} className="text-amber-500 shrink-0" />
                        <span className="text-[9px] font-black uppercase tracking-[0.15em] text-stone-400">Dernier relais</span>
                    </div>
                    {communityStats?.lastHero ? (
                        <p className={`text-sm font-black italic ${textTitle} truncate`}>
                            {communityStats.lastHero.pseudo} <span className="font-medium text-stone-500 not-italic">au bord de l'eau le {new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' }).format(new Date(communityStats.lastHero.date as string))}</span>
                        </p>
                    ) : (
                        <p className="text-xs font-bold text-stone-400 italic">En attente de sortie...</p>
                    )}
                </div>

                {/* Ligne 2 : Score & Objectif */}
                <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center px-0.5">
                        <div className="flex items-center gap-1.5">
                            {communityStats?.isVictory ? <Trophy size={14} className="text-amber-500 animate-pulse" /> : <Target size={14} className="text-emerald-500" />}
                            <span className={`text-[10px] font-black uppercase tracking-[0.1em] ${textTitle}`}>
                                OBJECTIF {communityStats?.monthLabel.toUpperCase()}
                            </span>
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-black glass-score font-mono leading-none tracking-tighter">
                                {displayPoints}
                            </span>
                            <span className="text-[10px] font-black opacity-30 text-stone-500 font-mono">/ {communityStats?.goal}</span>
                        </div>
                    </div>

                    <div className="h-2 w-full bg-stone-500/10 rounded-full overflow-hidden p-0.5 relative">
                        <div 
                            className="h-full bg-gradient-to-r from-emerald-600 via-emerald-400 to-emerald-300 rounded-full transition-all duration-1000 animate-tide relative overflow-hidden" 
                            style={{ width: `${Math.min(100, (displayPoints / (communityStats?.goal || 200)) * 100)}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* TABS NAVIGATION (Compact) */}
            <div className={`flex p-1 rounded-2xl border mx-4 relative z-10 ${props.isActuallyNight ? 'bg-stone-950 border-stone-800' : 'bg-stone-200/50 border-stone-200'}`}>
                <button 
                    onClick={() => { triggerHaptic(10); setActiveSubTab('events'); }} 
                    className={`relative flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all flex items-center justify-center gap-1.5 ${activeSubTab === 'events' ? (props.isActuallyNight ? 'bg-stone-800 text-amber-500 shadow-md' : 'bg-white text-amber-600 shadow-sm') : 'text-stone-500'}`}
                >
                    <Zap size={14} /> Événements
                    {props.unreadFeedCount > 0 && (
                        <div className="absolute -top-1 -right-0.5 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-emerald-500 text-[8px] font-black text-white border-2 border-white">
                            {props.unreadFeedCount}
                        </div>
                    )}
                </button>
                <button 
                    onClick={() => { triggerHaptic(10); setActiveSubTab('duel'); }} 
                    className={`relative flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all flex items-center justify-center gap-1.5 ${activeSubTab === 'duel' ? (props.isActuallyNight ? 'bg-stone-800 text-amber-500 shadow-md' : 'bg-white text-amber-600 shadow-sm') : 'text-stone-500'}`}
                >
                    <Swords size={14} /> Duel
                </button>
            </div>

            <div className="px-4 pb-32">
                {activeSubTab === 'events' ? (
                    <div className="space-y-3">
                        <div className="flex justify-end px-1">
                            <button 
                                onClick={() => { triggerHaptic(5); setShowArchive(!showArchive); }}
                                className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-wider transition-all ${showArchive ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-stone-100 text-stone-400 border-stone-200'}`}
                            >
                                <Archive size={10} />
                                {showArchive ? 'Fermer Archives' : 'Archives'}
                            </button>
                        </div>
                        <FeedEventsList {...props} showArchive={showArchive} />
                    </div>
                ) : (
                    <FeedDuelArena {...props} />
                )}
            </div>
        </div>
    );
};

export default FeedView;