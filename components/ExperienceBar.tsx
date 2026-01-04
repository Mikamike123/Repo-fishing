import React from 'react';
import { Trophy, Zap, Star, TrendingUp } from 'lucide-react';
import { getNextLevelCap } from '../lib/gamification';

interface ExperienceBarProps {
  xpTotal: number;
  level: number;
  lastXpGain?: number; // Nouveau : Affichage du gain de la session
  userName?: string;
  variant?: 'compact' | 'full';
}

export const ExperienceBar: React.FC<ExperienceBarProps> = ({ xpTotal, level, lastXpGain, userName, variant = 'full' }) => {
  const prevCap = level > 1 ? getNextLevelCap(level - 1) : 0;
  const nextCap = getNextLevelCap(level);
  const xpInLevel = xpTotal - prevCap;
  const levelRange = nextCap - prevCap;
  const progress = Math.min(100, Math.max(0, (xpInLevel / levelRange) * 100));

  const getRank = (lvl: number) => {
    if (lvl < 3) return "Novice du Quai";
    if (lvl < 6) return "Soldat du Quai";
    if (lvl < 12) return "Expert Oracle";
    return "Maître de la Seine";
  };

  return (
    <div className={`w-full overflow-hidden ${variant === 'full' ? 'bg-gradient-to-br from-white to-stone-50 rounded-[2.5rem] p-8 border border-stone-200 shadow-xl' : ''}`}>
      {/* HEADER : Rang et Niveau */}
      <div className="flex justify-between items-start mb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-1">
             <div className="p-2 bg-amber-50 rounded-xl border border-amber-100">
                <Trophy size={20} className="text-amber-500 fill-amber-500/20" />
             </div>
             <h3 className="text-2xl font-black text-stone-800 tracking-tight leading-none">{getRank(level)}</h3>
          </div>
          <p className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] pl-1">
            STATUT : <span className="text-emerald-500">ACTIF</span> • {userName || 'SOLDAT'}
          </p>
        </div>
        
        <div className="relative group">
          <div className="absolute -inset-2 bg-amber-400/20 rounded-full blur opacity-0 group-hover:opacity-100 transition duration-500"></div>
          <span className="relative text-5xl font-black text-stone-800 tracking-tighter italic leading-none">
            {level}
            <span className="text-xs font-bold text-stone-300 not-italic ml-1 uppercase">Lvl</span>
          </span>
        </div>
      </div>

      {/* BARRE DE PROGRESSION : Design "Laser" */}
      <div className="relative mb-4">
        <div className="h-6 bg-stone-200/50 rounded-2xl overflow-hidden p-1 border border-stone-100 backdrop-blur-sm shadow-inner">
          <div 
            className="h-full bg-gradient-to-r from-amber-400 via-orange-500 to-rose-600 rounded-xl transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(245,158,11,0.5)] flex items-center justify-end px-2"
            style={{ width: `${progress}%` }}
          >
            {progress > 15 && <div className="w-1 h-1 bg-white rounded-full animate-pulse shadow-sm"></div>}
          </div>
        </div>
        
        {/* Gain XP flottant (Dopamine Badge) */}
        {lastXpGain && lastXpGain > 0 && (
          <div className="absolute -top-3 right-0 animate-bounce bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg border-2 border-white flex items-center gap-1">
            <TrendingUp size={10} /> +{lastXpGain} XP
          </div>
        )}
      </div>
      
      {/* FOOTER : Détails numériques */}
      <div className="flex justify-between items-center px-1">
        <div className="flex flex-col">
            <span className="text-[11px] font-black text-stone-800 uppercase tabular-nums">
                {Math.floor(xpInLevel)} <span className="text-stone-300 mx-1">/</span> {levelRange} XP
            </span>
            <span className="text-[8px] font-bold text-stone-400 uppercase tracking-widest">Progression Niveau</span>
        </div>

        {progress >= 85 ? (
          <div className="flex items-center gap-1.5 bg-orange-50 px-3 py-1 rounded-lg border border-orange-100 animate-pulse">
            <Zap size={12} className="text-orange-500 fill-orange-500" />
            <span className="text-[9px] font-black text-orange-600 uppercase">Élite imminente</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-stone-300">
            <Star size={10} />
            <span className="text-[9px] font-black uppercase tracking-tight">Objectif : Palier {nextCap}</span>
          </div>
        )}
      </div>
    </div>
  );
};