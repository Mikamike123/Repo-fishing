import React, { useMemo } from 'react';
import { Wind, Droplets, CloudSun, Database, Activity, Trophy, ArrowRight, Clock } from 'lucide-react';
import { calculateBioScore } from '../lib/algorithms';
import { getCurrentConditions } from '../lib/simulation';
import { Session } from '../types';
import SessionCard from './SessionCard';

interface DashboardProps {
  sessions: Session[];
  onDeleteSession: (id: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ sessions, onDeleteSession }) => {
  // Get Live Data (Mocked via Simulation)
  const currentConditions = useMemo(() => getCurrentConditions(), []);
  const bioScore = useMemo(() => calculateBioScore(currentConditions), [currentConditions]);

  // Derived Values for UI
  const deltaP = (currentConditions.currentWeather.pressure - currentConditions.pressureTMinus3h).toFixed(1);
  const deltaQ = (currentConditions.currentHydro.flow - currentConditions.flowTMinus24h).toFixed(1);

  // Get recent sessions (last 2)
  const recentSessions = useMemo(() => {
    return [...sessions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 2);
  }, [sessions]);

  // Color & Text Helpers
  const getScoreTheme = (score: number) => {
    if (score >= 60) return {
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      border: 'border-emerald-100',
      ring: 'ring-emerald-500/20',
      label: 'Excellent'
    };
    if (score >= 30) return {
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      border: 'border-amber-100',
      ring: 'ring-amber-500/20',
      label: 'Moyen'
    };
    return {
      color: 'text-rose-600',
      bg: 'bg-rose-50',
      border: 'border-rose-100',
      ring: 'ring-rose-500/20',
      label: 'Mauvais'
    };
  };

  const theme = getScoreTheme(bioScore);

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-500">
      
      {/* SECTION A: HEADER PROFIL (GAMIFICATION) */}
      <div className="bg-white rounded-3xl p-6 shadow-organic border border-stone-100">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-stone-400 text-xs font-bold uppercase tracking-widest mb-1">Grade Actuel</h2>
            <div className="flex items-center gap-2">
              <Trophy className="text-amber-500" size={20} />
              <span className="text-xl font-bold text-stone-800 tracking-tight">Soldat du Quai</span>
            </div>
          </div>
          <div className="text-right">
             <span className="text-2xl font-black text-stone-200">LVL 3</span>
          </div>
        </div>
        
        {/* XP Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-medium text-stone-500">
            <span>XP</span>
            <span>350 / 500</span>
          </div>
          <div className="h-2 w-full bg-stone-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-amber-400 to-amber-500 w-[70%] rounded-full shadow-sm" />
          </div>
        </div>
      </div>

      {/* SECTION B: ORACLE BIO (LIVE) */}
      <div className={`relative overflow-hidden rounded-[2rem] p-8 shadow-soft border ${theme.border} bg-white`}>
        {/* Background gradient hint */}
        <div className={`absolute top-0 right-0 w-64 h-64 ${theme.bg} rounded-bl-full opacity-50 pointer-events-none -mr-16 -mt-16`} />

        <div className="relative z-10">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-2">
               <Activity className={theme.color} size={20} />
               <h3 className="text-stone-800 font-bold text-lg">État du Spot</h3>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-white shadow-sm border ${theme.border} ${theme.color}`}>
              En Direct
            </span>
          </div>

          <div className="flex flex-col items-center justify-center mb-8">
            <div className={`relative flex items-center justify-center w-40 h-40 rounded-full border-[6px] ${theme.bg} ${theme.border} shadow-inner mb-4`}>
               <div className="text-center">
                 <span className={`block text-5xl font-black tracking-tighter ${theme.color}`}>{bioScore}</span>
                 <span className={`text-xs font-bold uppercase tracking-wide opacity-60 ${theme.color}`}>Score Bio</span>
               </div>
            </div>
            <p className={`text-sm font-medium ${theme.color} bg-white px-4 py-1 rounded-full shadow-sm border ${theme.border}`}>
               Condition : {theme.label}
            </p>
          </div>

          {/* Sub-Indicators - VIBRANT UPDATE */}
          <div className="grid grid-cols-3 gap-3">
             {/* Pressure - Indigo */}
             <div className="bg-indigo-50 rounded-2xl p-3 flex flex-col items-center text-center border border-indigo-100">
                <Wind size={16} className="text-indigo-500 mb-2" />
                <span className="text-xs font-bold text-indigo-900">{currentConditions.currentWeather.pressure}</span>
                <span className={`text-[10px] font-bold ${Number(deltaP) > 0 ? 'text-indigo-400' : 'text-indigo-600'}`}>
                  {Number(deltaP) > 0 ? '+' : ''}{deltaP} hPa
                </span>
             </div>
             {/* Flow - Cyan */}
             <div className="bg-cyan-50 rounded-2xl p-3 flex flex-col items-center text-center border border-cyan-100">
                <Droplets size={16} className="text-cyan-500 mb-2" />
                <span className="text-xs font-bold text-cyan-900">{currentConditions.currentHydro.flow}</span>
                <span className={`text-[10px] font-bold ${Number(deltaQ) > 0 ? 'text-cyan-400' : 'text-cyan-600'}`}>
                   {Number(deltaQ) > 0 ? '+' : ''}{deltaQ} m³/s
                </span>
             </div>
             {/* Sky - Amber */}
             <div className="bg-amber-50 rounded-2xl p-3 flex flex-col items-center text-center border border-amber-100">
                <CloudSun size={16} className="text-amber-500 mb-2" />
                <span className="text-xs font-bold text-amber-900">{currentConditions.currentWeather.clouds}%</span>
                <span className="text-[10px] text-amber-500 font-medium">Couv.</span>
             </div>
          </div>
        </div>
      </div>

      {/* SECTION C: HISTORIQUE RÉCENT (OR PLACEHOLDER) */}
      <div className="space-y-4">
        <h3 className="text-stone-800 font-bold text-lg px-2 flex items-center gap-2">
           <Clock size={20} className="text-stone-400" />
           Historique Récent
        </h3>
        
        {recentSessions.length > 0 ? (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {recentSessions.map(session => (
              <SessionCard key={session.id} session={session} onDelete={onDeleteSession} />
            ))}
          </div>
        ) : (
          <div className="border border-dashed border-stone-300 rounded-3xl p-8 flex flex-col items-center text-center bg-stone-50/50">
            <div className="bg-white p-4 rounded-full shadow-sm border border-stone-100 mb-4">
              <Database size={24} className="text-stone-300" />
            </div>
            <h3 className="text-stone-500 font-bold mb-1">Oracle Historique</h3>
            <p className="text-sm text-stone-400 max-w-xs mx-auto">
              Base de données en construction. Enregistrez plus de sessions pour activer les prédictions IA.
            </p>
            <div className="mt-4 h-1.5 w-24 bg-stone-200 rounded-full overflow-hidden">
               <div className="h-full bg-stone-300 w-[15%]" />
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default Dashboard;