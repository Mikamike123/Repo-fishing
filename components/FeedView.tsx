// components/FeedView.tsx - Version 13.4.0 (Monthly Calendar Goal & Anti-Ghost Logic)
import React, { useState, useEffect, useMemo } from 'react';
import { Zap, Swords, Target, History } from 'lucide-react';
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

const injectVibeStyles = () => {
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
    `;
    document.head.appendChild(style);
};

const FeedView: React.FC<FeedViewProps> = (props) => {
    const [activeSubTab, setActiveSubTab] = useState<'events' | 'duel'>('events');
    const triggerHaptic = (i = 10) => window.navigator?.vibrate?.(i);

    useEffect(() => {
        injectVibeStyles();
    }, []);

    // --- LOGIQUE "BANDE DE POTES" CALENDAIRE ---
    const communityStats = useMemo(() => {
        if (!props.sessions.length) return null;

        const now = new Date();
        const curM = now.getMonth();
        const curY = now.getFullYear();
        const monthLabel = new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(now);

        // 1. Dernier Relais (Toujours la session la plus récente chronologiquement)
        // sessions[0] est la plus récente grâce au orderBy('date', 'desc') de l'engine
        const lastSession = props.sessions[0]; 
        const lastHero = {
            pseudo: lastSession.userPseudo || "Pêcheur",
            date: lastSession.date
        };

        // 2. Objectif Mensuel Calendaire (Sécurité Anti-2023)
        const monthCatches = props.sessions.reduce((total, s) => {
            const sDate = new Date(s.date as string);
            // Michael : ON VÉRIFIE LE MOIS ET L'ANNÉE STRICTE
            if (sDate.getMonth() === curM && sDate.getFullYear() === curY) {
                return total + s.catches.length;
            }
            return total;
        }, 0);

        const GOAL = 20; 
        const progress = Math.min(100, (monthCatches / GOAL) * 100);

        return { lastHero, monthCatches, progress, goal: GOAL, monthLabel };
    }, [props.sessions]);

    const cardClass = props.isActuallyNight ? "bg-stone-900 border-stone-800" : "bg-white border-stone-100 shadow-xl";
    const textTitle = props.isActuallyNight ? "text-stone-100" : "text-stone-800";

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-500 max-w-4xl mx-auto w-full">
            
            {/* HEADER "LA BANDE" */}
            <div className={`mx-4 p-5 rounded-[2.5rem] border overflow-hidden relative flex flex-col gap-6 ${cardClass}`}>
                
                {/* Dernier Relais */}
                {communityStats && (
                    <div className="flex items-center gap-4">
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

                {/* Objectif Mensuel Dynamique */}
                {communityStats && (
                    <div className="space-y-3">
                        <div className="flex justify-between items-end">
                            <div className="flex items-center gap-2">
                                <Target size={16} className="text-emerald-500" />
                                <span className={`text-[10px] font-black uppercase tracking-widest ${textTitle}`}>Objectif {communityStats.monthLabel}</span>
                            </div>
                            <span className="text-[11px] font-black text-emerald-500">
                                {communityStats.monthCatches} / {communityStats.goal} <span className="opacity-50 text-[9px]">POISSONS</span>
                            </span>
                        </div>
                        <div className="h-3 w-full bg-stone-500/10 rounded-full overflow-hidden border border-white/5 p-0.5">
                            <div 
                                className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.3)] transition-all duration-1000 ease-out" 
                                style={{ width: `${communityStats.progress}%` }}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* TABS NAVIGATION */}
            <div className={`flex p-1.5 rounded-3xl border mx-4 overflow-visible relative z-10 ${props.isActuallyNight ? 'bg-stone-950 border-stone-800' : 'bg-stone-200/50 border-stone-200'}`}>
                <button 
                    onClick={() => { triggerHaptic(); setActiveSubTab('events'); }} 
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
                    onClick={() => { triggerHaptic(); setActiveSubTab('duel'); }} 
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