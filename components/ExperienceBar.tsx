import React from 'react';
import { Trophy, Zap } from 'lucide-react';

interface ExperienceBarProps {
  totalCatches: number;
  userName?: string; // Nom dynamique
  variant?: 'compact' | 'full';
}

export const ExperienceBar: React.FC<ExperienceBarProps> = ({ totalCatches, userName, variant = 'full' }) => {
  const level = Math.floor(totalCatches / 10) + 1;
  const xpCurrentLevel = totalCatches % 10;
  const progress = xpCurrentLevel * 10; 
  
  const getRank = (lvl: number) => {
    if (lvl < 3) return "Novice du Quai";
    if (lvl < 6) return "Soldat du Quai";
    if (lvl < 10) return "Expert Oracle";
    return "Maître de la Seine";
  };

  return (
    <div className={`w-full ${variant === 'full' ? 'bg-white rounded-[2.5rem] p-6 border border-stone-100 shadow-sm' : ''}`}>
      <div className="flex justify-between items-end mb-4">
        <div>
          <h2 className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">
            Salut, <span className="text-amber-500">{userName?.toUpperCase() || 'PÊCHEUR'}</span> !
          </h2>
          <div className="flex items-center gap-2">
             <Trophy size={18} className="text-amber-500 fill-amber-500/20" />
             <h3 className="text-xl font-black text-stone-800 tracking-tight">{getRank(level)}</h3>
          </div>
        </div>
        <div className="text-right">
          <span className="text-4xl font-black text-stone-200 tracking-tighter italic">LVL {level}</span>
        </div>
      </div>

      <div className="relative h-4 bg-stone-100 rounded-full overflow-hidden p-1 border border-stone-50 shadow-inner">
        <div 
          className="h-full bg-gradient-to-r from-amber-400 via-orange-500 to-amber-600 rounded-full transition-all duration-1000 ease-out shadow-lg"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
      
      <div className="flex justify-between mt-2 px-1">
        <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest">XP: {xpCurrentLevel * 100} / 1000</span>
        {progress >= 80 && (
          <span className="text-[9px] font-bold text-orange-500 uppercase animate-pulse">
            Prochain niveau proche ! <Zap size={8} className="inline fill-orange-500" />
          </span>
        )}
      </div>
    </div>
  );
};