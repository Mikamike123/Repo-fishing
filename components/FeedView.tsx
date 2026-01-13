// components/FeedView.tsx - Version 13.5.1 (Vibration Type Fix)
import React, { useState, useEffect, useMemo } from 'react';
import { Zap, Swords, Target, History, Trophy, Sparkles } from 'lucide-react';
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
        @keyframes vibePop {
            0% { transform: scale(1); }
            50% { transform: scale(1.4); }
            100% { transform: scale(1); }
        }
        .vibe-animate-pop { display: inline-block; animation: vibePop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); }

        /* Animation Marée Montante */
        @keyframes tideWave {
            0%, 100% { clip-path: polygon(0% 45%, 15% 44%, 32% 50%, 54% 60%, 70% 61%, 84% 59%, 100% 52%, 100% 100%, 0% 100%); }
            50% { clip-path: polygon(0% 60%, 16% 65%, 34% 66%, 51% 62%, 67% 50%, 84% 45%, 100% 46%, 100% 100%, 0% 100%); }
        }
        .animate-tide {
            position: relative;
            overflow: hidden;
        }
        .animate-tide::after {
            content: "";
            position: absolute;
            top: 0; right: 0; bottom: 0; left: 0;
            background: rgba(255,255,255,0.2);
            animation: tideWave 2s infinite linear;
        }

        /* Aura Oracle (Célébration) */
        @keyframes oracleAura {
            0%, 100% { box-shadow: 0 0 20px rgba(16, 185, 129, 0.2), inset 0 0 10px rgba(16, 185, 129, 0.1); border-color: rgba(16, 185, 129, 0.3); }
            50% { box-shadow: 0 0 40px rgba(16, 185, 129, 0.5), inset 0 0 20px rgba(16, 185, 129, 0.2); border-color: rgba(16, 185, 129, 0.6); }
        }
        .aura-victory {
            animation: oracleAura 3s infinite ease-in-out;
            background: linear-gradient(to bottom right, rgba(16, 185, 129, 0.05), transparent) !important;
        }

        /* Particules de succès */
        @keyframes particleUp {
            0% { transform: translateY(0) scale(1); opacity: 1; }
            100% { transform: translateY(-40px) scale(0); opacity: 0; }
        }
        .particle {
            position: absolute;
            width: 4px; height: 4px;
            background: #fbbf24;
            border-radius: 50%;
            animation: particleUp 1s forwards;
        }
    `;
    document.head.appendChild(style);
};

const FeedView: React.FC<FeedViewProps> = (props) => {
    const [activeSubTab, setActiveSubTab] = useState<'events' | 'duel'>('events');
    const [displayPoints, setDisplayPoints] = useState(0);

    // Michael : Signature corrigée pour accepter patterns ou durées simples
    const triggerHaptic = (pattern: number | number[] = 10) => {
        if (window.navigator && window.navigator.vibrate) window.navigator.vibrate(pattern);
    };

    useEffect(() => {
        injectOracleStyles();
    }, []);

    // --- LOGIQUE "BANDE DE POTES" CALENDAIRE ---
    const communityStats = useMemo(() => {
        if (!props.sessions.length) return null;

        const now = new Date();
        const curM = now.getMonth();
        const curY = now.getFullYear();
        const monthLabel = new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(now);

        const lastSession = props.sessions[0]; 
        const lastHero = {
            pseudo: lastSession.userPseudo || "Pêcheur",
            date: lastSession.date
        };

        // Calcul des points (Taille totale des captures du mois)
        const totalMonthPts = props.sessions.reduce((total, s) => {
            const sDate = new Date(s.date as string);
            if (sDate.getMonth() === curM && sDate.getFullYear() === curY) {
                const sessionPts = s.catches.reduce((sum, c) => sum + (c.size || 0), 0);
                return total + sessionPts;
            }
            return total;
        }, 0);

        const GOAL = 200; 
        const isVictory = totalMonthPts >= GOAL;

        return { lastHero, totalMonthPts, goal: GOAL, monthLabel, isVictory };
    }, [props.sessions]);

    // Michael : L'animation du Ticker au montage
    useEffect(() => {
        if (communityStats) {
            let start = 0;
            const end = communityStats.totalMonthPts;
            const duration = 1500; 
            const increment = end / (duration / 16);
            
            const timer = setInterval(() => {
                start += increment;
                if (start >= end) {
                    setDisplayPoints(end);
                    clearInterval(timer);
                    if (end >= 200) triggerHaptic([50, 100, 50]); 
                } else {
                    setDisplayPoints(Math.floor(start));
                }
            }, 16);
            return () => clearInterval(timer);
        }
    }, [communityStats?.totalMonthPts]);

    const cardClass = props.isActuallyNight ? "bg-stone-900 border-stone-800" : "bg-white border-stone-100 shadow-xl";
    const textTitle = props.isActuallyNight ? "text-stone-100" : "text-stone-800";

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-500 max-w-4xl mx-auto w-full">
            
            {/* HEADER "LA BANDE" avec Aura si Victoire */}
            <div className={`mx-4 p-5 rounded-[2.5rem] border overflow-hidden relative flex flex-col gap-6 transition-all duration-1000 ${cardClass} ${communityStats?.isVictory ? 'aura-victory' : ''}`}>
                
                {/* Effet Particules si victoire */}
                {communityStats?.isVictory && (
                    <div className="absolute inset-0 pointer-events-none">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="particle" style={{ left: `${20 + i * 15}%`, bottom: '20%', animationDelay: `${i * 0.2}s` }} />
                        ))}
                    </div>
                )}

                {/* Dernier Relais */}
                {communityStats && (
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0 shadow-inner">
                            <History size={24} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-500 mb-0.5">Dernier relais</p>
                            <p className={`text-sm font-black italic truncate ${textTitle}`}>
                                {communityStats.lastHero.pseudo} <span className="font-medium text-stone-500 not-italic">au bord de l'eau le {new Date(communityStats.lastHero.date as string).toLocaleDateString('fr-FR', {day: 'numeric', month: 'short'})}</span>
                            </p>
                        </div>
                    </div>
                )}

                {/* Objectif Mensuel Points (Marée Montante + Ticker) */}
                {communityStats && (
                    <div className="space-y-3 relative z-10">
                        <div className="flex justify-between items-end">
                            <div className="flex items-center gap-2">
                                {communityStats.isVictory ? <Trophy size={18} className="text-amber-500 animate-pulse" /> : <Target size={16} className="text-emerald-500" />}
                                <span className={`text-[10px] font-black uppercase tracking-widest ${textTitle}`}>
                                    {communityStats.isVictory ? `Objectif ${communityStats.monthLabel} Atteint !` : `Objectif ${communityStats.monthLabel}`}
                                </span>
                            </div>
                            <span className="text-[13px] font-black text-emerald-500 font-mono tracking-tighter">
                                {displayPoints} <span className="opacity-40 text-[9px] ml-1">/ {communityStats.goal} PTS</span>
                            </span>
                        </div>
                        <div className="h-4 w-full bg-stone-500/10 rounded-full overflow-hidden border border-white/5 p-1 relative">
                            <div 
                                className={`h-full bg-gradient-to-r from-emerald-600 via-emerald-400 to-emerald-300 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-all duration-500 ease-out animate-tide`} 
                                style={{ width: `${Math.min(100, (displayPoints / communityStats.goal) * 100)}%` }}
                            />
                            {communityStats.isVictory && <Sparkles className="absolute right-2 top-0.5 text-amber-400" size={12} />}
                        </div>
                        {communityStats.isVictory && (
                            <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest text-center animate-bounce">
                                L'Oracle est fier de la team !
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* TABS NAVIGATION */}
            <div className={`flex p-1.5 rounded-3xl border mx-4 overflow-visible relative z-10 ${props.isActuallyNight ? 'bg-stone-950 border-stone-800' : 'bg-stone-200/50 border-stone-200'}`}>
                <button 
                    onClick={() => { triggerHaptic(10); setActiveSubTab('events'); }} 
                    className={`relative flex-1 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${activeSubTab === 'events' ? (props.isActuallyNight ? 'bg-stone-800 text-amber-500 shadow-lg' : 'bg-white text-amber-600 shadow-md') : 'text-stone-500'}`}
                >
                    <Zap size={16} /> Événements
                    {props.unreadFeedCount > 0 && (
                        <div className="absolute -top-2 -right-1 flex h-5 min-w-[20px] px-1.5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-black text-white shadow-lg border-2 border-white animate-in zoom-in duration-300 z-50">
                            {props.unreadFeedCount}
                        </div>
                    )}
                </button>
                <button 
                    onClick={() => { triggerHaptic(10); setActiveSubTab('duel'); }} 
                    className={`relative flex-1 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${activeSubTab === 'duel' ? (props.isActuallyNight ? 'bg-stone-800 text-amber-500 shadow-lg' : 'bg-white text-amber-600 shadow-md') : 'text-stone-500'}`}
                >
                    <Swords size={16} /> Duel
                </button>
            </div>

            <div className="px-4 pb-32">
                {activeSubTab === 'events' ? <FeedEventsList {...props} /> : <FeedDuelArena {...props} />}
            </div>
        </div>
    );
};

export default FeedView;