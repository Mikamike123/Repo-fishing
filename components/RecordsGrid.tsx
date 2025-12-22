// components/RecordsGrid.tsx
import React from 'react';
import { Fish, Trophy } from 'lucide-react';
import { Session } from '../types';

interface RecordsGridProps {
  sessions: Session[];
  title: string;
  isGold?: boolean; // Ajout crucial ici
}

export const RecordsGrid: React.FC<RecordsGridProps> = ({ sessions, title }) => {
  // Calcul des records par espèce
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

  return (
    <div className="space-y-3">
      <h4 className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] flex items-center gap-2 ml-1">
        <Trophy size={12} className="text-amber-500" /> {title}
      </h4>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {speciesList.map(([species, data]) => (
          <div key={species} className="bg-white p-3 rounded-2xl border border-stone-100 shadow-sm flex items-center justify-between group transition-all hover:border-amber-200">
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-stone-400 uppercase leading-none mb-1">{species}</span>
              <span className="text-[10px] font-bold text-stone-300 italic">
                {new Date(data.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              </span>
            </div>
            <div className="text-lg font-black text-stone-800 tracking-tighter group-hover:text-amber-600 transition-colors">
              {data.size}<span className="text-[10px] ml-0.5 text-stone-300 font-bold uppercase">cm</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};