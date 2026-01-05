// components/RecordsGrid.tsx - Version 10.0.0 (Night Ops Hall of Fame)
import React from 'react';
import { Fish, Trophy } from 'lucide-react';
import { Session } from '../types';

interface RecordsGridProps {
  sessions: Session[];
  title: string;
  isGold?: boolean; // Utilisé pour le Hall of Fame Michael
  isActuallyNight?: boolean; // Pilier V8.0
}

export const RecordsGrid: React.FC<RecordsGridProps> = ({ 
    sessions, 
    title, 
    isGold, 
    isActuallyNight 
}) => {
  // Calcul des records par espèce (Logique Michael préservée à 100%)
  const records = sessions.reduce((acc, session) => {
    session.catches?.forEach(c => {
      if (!acc[c.species] || c.size > acc[c.species].size) {
        acc[c.species] = { size: c.size, date: session.date };
      }
    });
    return acc;
  }, {} as Record<string, { size: number, date: string }>);

  const speciesList = Object.entries(records).sort(([, a], [, b]) => b.size - a.size);

  if (speciesList.length === 0) return null;

  // Styles dynamiques V8.0
  const cardBg = isActuallyNight ? "bg-[#1c1917]" : "bg-white";
  const cardBorder = isActuallyNight ? "border-stone-800" : "border-stone-100";
  const hoverBorder = isGold 
    ? (isActuallyNight ? "hover:border-amber-500/50" : "hover:border-amber-400")
    : (isActuallyNight ? "hover:border-stone-700" : "hover:border-amber-200");

  return (
    <div className="space-y-3">
      <h4 className={`text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 ml-1 ${isActuallyNight ? 'text-stone-500' : 'text-stone-400'}`}>
        <Trophy size={12} className={isGold ? "text-amber-500" : "text-stone-400"} /> {title}
      </h4>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {speciesList.map(([species, data]) => (
          <div 
            key={species} 
            className={`${cardBg} p-3 rounded-2xl border ${cardBorder} shadow-sm flex items-center justify-between group transition-all ${hoverBorder}`}
          >
            <div className="flex flex-col">
              <span className={`text-[9px] font-black uppercase leading-none mb-1 ${isActuallyNight ? 'text-stone-500' : 'text-stone-400'}`}>
                {species}
              </span>
              <span className={`text-[10px] font-bold italic ${isActuallyNight ? 'text-stone-600' : 'text-stone-300'}`}>
                {new Date(data.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              </span>
            </div>
            <div className={`text-lg font-black tracking-tighter transition-colors ${
                isActuallyNight ? 'text-stone-100 group-hover:text-amber-500' : 'text-stone-800 group-hover:text-amber-600'
            }`}>
              {data.size}<span className={`text-[10px] ml-0.5 font-bold uppercase ${isActuallyNight ? 'text-stone-600' : 'text-stone-300'}`}>cm</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};