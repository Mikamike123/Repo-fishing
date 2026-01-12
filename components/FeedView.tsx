// components/FeedView.tsx - Version 13.1.0 (Fixed Notification Pill Visibility)
import React, { useState } from 'react';
import { Zap, Swords } from 'lucide-react';
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
    unreadFeedCount: number; // Michael : Piloté par useAppEngine (Stateless)
    onMarkAsRead: (id: string) => void;
    onHideSession: (id: string) => void;
}

const FeedView: React.FC<FeedViewProps> = (props) => {
    const [activeSubTab, setActiveSubTab] = useState<'events' | 'duel'>('events');
    const triggerHaptic = (i = 10) => window.navigator?.vibrate?.(i);

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-500 max-w-4xl mx-auto w-full">
            
            {/* TABS NAVIGATION - Michael : overflow-visible est vital ici pour laisser respirer la pastille */}
            <div className={`flex p-1.5 rounded-3xl border mx-4 overflow-visible relative z-10 ${props.isActuallyNight ? 'bg-stone-950 border-stone-800' : 'bg-stone-200/50 border-stone-200'}`}>
                <button 
                    onClick={() => { triggerHaptic(); setActiveSubTab('events'); }} 
                    className={`relative flex-1 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${activeSubTab === 'events' ? (props.isActuallyNight ? 'bg-stone-800 text-amber-500 shadow-lg' : 'bg-white text-amber-600 shadow-md') : 'text-stone-500'}`}
                >
                    <Zap size={16} /> Événements
                    
                    {/* Michael : La pastille de notification corrigée (positionnement & z-index) */}
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
                {activeSubTab === 'events' ? (
                    <FeedEventsList {...props} />
                ) : (
                    <FeedDuelArena {...props} />
                )}
            </div>
        </div>
    );
};

export default FeedView;