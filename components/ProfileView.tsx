import React, { useState, useMemo, useRef } from 'react';
// Ajout de Trophy, Upload, Camera, etc.
import { User, Edit2, Check, ChevronDown, Calendar, Fish, AlertOctagon, Anchor, Activity, TrendingUp, Trophy, Upload, Camera } from 'lucide-react';
import { Session, UserProfile } from '../types';
import { updateUserPseudo } from '../lib/user-service';
import { doc, updateDoc } from 'firebase/firestore'; 
import { db } from '../lib/firebase';

interface ProfileViewProps {
  userProfile: UserProfile;
  sessions: Session[];
  onUpdateProfile: (newProfile: UserProfile) => void;
}

const ProfileView: React.FC<ProfileViewProps> = ({ userProfile, sessions, onUpdateProfile }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editPseudo, setEditPseudo] = useState(userProfile.pseudo);
  const [expandedYear, setExpandedYear] = useState<number | null>(new Date().getFullYear());
  
  // États interactifs
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number | null>(null);
  const [highlightedSpecies, setHighlightedSpecies] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- 1. LOGIQUE D'AGRÉGATION ---
  const statsByYear = useMemo(() => {
    const stats: Record<number, any> = {};

    sessions.forEach(session => {
      const date = new Date(session.date);
      const year = date.getFullYear();
      const month = date.getMonth(); 

      if (!stats[year]) {
        stats[year] = {
          sessionsCount: 0,
          catchesCount: 0,
          missesCount: 0,
          speciesBreakdown: {} as Record<string, number>,
          monthlyActivity: Array(12).fill(0).map(() => ({ 
              sessions: 0, catches: 0, misses: 0,
              cumulSessions: 0, cumulCatches: 0, cumulMisses: 0
          }))
        };
      }

      stats[year].sessionsCount += 1;
      stats[year].catchesCount += session.catchCount;
      const sessionMisses = session.misses?.length || 0;
      stats[year].missesCount += sessionMisses;

      stats[year].monthlyActivity[month].sessions += 1;
      stats[year].monthlyActivity[month].catches += session.catchCount;
      stats[year].monthlyActivity[month].misses += sessionMisses;

      session.catches?.forEach(c => {
        if (c.species) {
            stats[year].speciesBreakdown[c.species] = (stats[year].speciesBreakdown[c.species] || 0) + 1;
        }
      });
    });

    Object.values(stats).forEach((yearStat: any) => {
        let rs = 0, rc = 0, rm = 0;
        yearStat.monthlyActivity.forEach((month: any) => {
            rs += month.sessions; rc += month.catches; rm += month.misses;
            month.cumulSessions = rs; month.cumulCatches = rc; month.cumulMisses = rm;
        });
    });

    return Object.entries(stats)
      .sort(([yearA], [yearB]) => Number(yearB) - Number(yearA))
      .map(([year, data]) => ({ year: Number(year), ...data }));
  }, [sessions]);

  // --- GESTION PHOTO ---
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (file.size > 2 * 1024 * 1024) {
          alert("L'image est trop lourde (Max 2MB)");
          return;
      }

      const reader = new FileReader();
      reader.onloadend = async () => {
          const base64String = reader.result as string;
          try {
              const userRef = doc(db, "users", userProfile.id);
              await updateDoc(userRef, { avatarBase64: base64String });
              onUpdateProfile({ ...userProfile, avatarBase64: base64String });
          } catch (e) {
              console.error("Erreur upload photo", e);
          }
      };
      reader.readAsDataURL(file);
  };

  const handleSavePseudo = async () => {
    if (!editPseudo.trim()) return;
    try {
      await updateUserPseudo(userProfile.id, editPseudo);
      onUpdateProfile({ ...userProfile, pseudo: editPseudo });
      setIsEditing(false);
    } catch (e) {
      console.error("Erreur update pseudo", e);
    }
  };

  // --- DONUT DYNAMIQUE ---
  const getConicGradient = (breakdown: Record<string, number>, total: number) => {
      if (total === 0) return 'conic-gradient(#e5e7eb 0deg 360deg)';

      let currentDeg = 0;
      const colors: Record<string, string> = {
          'Brochet': '#a8a29e', 'Sandre': '#fbbf24', 'Perche': '#34d399',
          'Silure': '#64748b', 'Black-Bass': '#a3e635', 'Chevesne': '#fca5a5',
          'Truite': '#60a5fa', 'Aspe': '#c084fc',
      };
      
      const segments = Object.entries(breakdown)
        .sort(([,a], [,b]) => (b as number) - (a as number))
        .map(([species, count]) => {
          const deg = (count / total) * 360;
          const isActive = highlightedSpecies === null || highlightedSpecies === species;
          const color = isActive ? (colors[species] || '#cbd5e1') : '#f3f4f6';
          
          const segment = `${color} ${currentDeg}deg ${currentDeg + deg}deg`;
          currentDeg += deg;
          return segment;
      });
      
      return `conic-gradient(${segments.join(', ')})`;
  };

  const getSpeciesColor = (species: string) => {
      const colors: Record<string, string> = {
          'Brochet': 'bg-stone-400', 'Sandre': 'bg-amber-400', 'Perche': 'bg-emerald-400',
          'Silure': 'bg-slate-500', 'Black-Bass': 'bg-lime-400', 'Chevesne': 'bg-rose-300',
          'Truite': 'bg-blue-400', 'Aspe': 'bg-purple-400'
      };
      return colors[species] || 'bg-gray-300';
  };

  const getSmoothPath = (dataPoints: number[], maxVal: number) => {
      if (maxVal === 0) return "";
      return dataPoints.map((val, idx) => {
          const x = (idx * 8.33) + 4.16; 
          const y = 100 - (val / maxVal) * 100;
          return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
      }).join(' ');
  };

  return (
    <div className="pb-24 animate-in fade-in duration-300 space-y-6 px-4">
      
      {/* EN-TÊTE AVEC PHOTO */}
      <div className="bg-white rounded-3xl p-6 shadow-soft border border-stone-100 flex flex-col items-center text-center relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-stone-50 to-transparent"></div>
        
        {/* AVATAR */}
        <div 
            className="relative z-10 w-28 h-28 bg-white rounded-full flex items-center justify-center mb-3 border-4 border-stone-50 shadow-xl cursor-pointer overflow-hidden"
            onClick={() => fileInputRef.current?.click()}
        >
            {userProfile.avatarBase64 ? (
                <img src={userProfile.avatarBase64} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
                <User size={48} className="text-stone-300" />
            )}
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera size={24} className="text-white" />
            </div>
        </div>
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
        
        {isEditing ? (
          <div className="relative z-10 flex gap-2 items-center w-full max-w-xs animate-in zoom-in duration-200">
            <input 
              value={editPseudo}
              onChange={(e) => setEditPseudo(e.target.value)}
              className="flex-1 text-center text-2xl font-black text-stone-800 border-b-2 border-amber-400 outline-none pb-1 bg-transparent"
              autoFocus
            />
            <button onClick={handleSavePseudo} className="p-2 bg-emerald-100 text-emerald-600 rounded-full hover:bg-emerald-200 transition-colors">
              <Check size={20} />
            </button>
          </div>
        ) : (
          <div className="relative z-10 flex gap-2 items-center justify-center group cursor-pointer" onClick={() => setIsEditing(true)}>
            <h1 className="text-3xl font-black text-stone-800 tracking-tight">{userProfile.pseudo}</h1>
            <Edit2 size={14} className="text-stone-300 opacity-50 group-hover:opacity-100 transition-opacity" />
          </div>
        )}
        <p className="relative z-10 text-xs text-stone-400 font-bold uppercase mt-2 tracking-widest">Membre depuis {new Date(userProfile.createdAt?.seconds * 1000 || Date.now()).getFullYear()}</p>
      </div>

      {/* STATS ANNUELLES */}
      <div className="space-y-6">
        {statsByYear.map((stat) => {
          const isOpen = expandedYear === stat.year;
          const maxCumul = Math.max(stat.catchesCount, stat.sessionsCount, stat.missesCount) || 1;
          const maxMensuel = Math.max(...stat.monthlyActivity.map((x: any) => Math.max(x.catches, x.sessions, x.misses))) || 1;

          const donutValue = highlightedSpecies 
                ? (stat.speciesBreakdown[highlightedSpecies] || 0) 
                : stat.catchesCount;
          const donutLabel = highlightedSpecies || "Total";

          return (
            <div key={stat.year} className={`bg-white rounded-[2rem] border transition-all duration-500 ease-out ${isOpen ? 'shadow-xl border-amber-200 ring-4 ring-amber-50/50' : 'shadow-sm border-stone-100'}`}>
              
              {/* HEADER ANNÉE */}
              <button 
                onClick={() => {
                    setExpandedYear(isOpen ? null : stat.year);
                    setSelectedMonthIndex(null); 
                    setHighlightedSpecies(null);
                }}
                className="w-full flex justify-between items-center p-6 bg-transparent outline-none"
              >
                <div className="flex items-center gap-4">
                  <div className={`p-3.5 rounded-2xl transition-colors ${isOpen ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30' : 'bg-stone-100 text-stone-400'}`}>
                    <Calendar size={24} strokeWidth={2.5} />
                  </div>
                  <div className="text-left">
                    <span className="block text-3xl font-black text-stone-800 leading-none mb-1">{stat.year}</span>
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-stone-400">
                        <span>{stat.sessionsCount} Sorties</span>
                        <span className="w-1 h-1 bg-stone-300 rounded-full"></span>
                        <span>{stat.catchesCount} Prises</span>
                    </div>
                  </div>
                </div>
                <div className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
                    <ChevronDown className="text-stone-300" />
                </div>
              </button>

              {/* DÉTAIL */}
              {isOpen && (
                <div className="px-6 pb-8 animate-in fade-in slide-in-from-top-4 duration-500">
                  
                  {/* KPI */}
                  <div className="grid grid-cols-3 gap-3 mb-8">
                    <StatBox label="Sessions" value={stat.sessionsCount} icon={<Anchor size={18}/>} theme="stone" />
                    <StatBox label="Prises" value={stat.catchesCount} icon={<Fish size={18}/>} theme="amber" />
                    <StatBox label="Ratés" value={stat.missesCount} icon={<AlertOctagon size={18}/>} theme="rose" />
                  </div>

                  {/* GRAPH */}
                  <div className="bg-stone-50/50 rounded-3xl p-5 border border-stone-100 mb-8 relative overflow-hidden">
                    <div className="flex justify-between items-start mb-6 h-8">
                        <h3 className="text-xs font-black text-stone-400 uppercase tracking-widest flex items-center gap-2 mt-1">
                            <Activity size={14} /> Dynamique {stat.year}
                        </h3>
                        {selectedMonthIndex !== null && (
                            <div className="flex items-center gap-3 bg-white border border-stone-200 shadow-sm px-3 py-1.5 rounded-full animate-in fade-in zoom-in absolute right-5 top-4 z-30">
                                <span className="text-xs font-black text-stone-800 capitalize">
                                    {new Date(2024, selectedMonthIndex, 1).toLocaleDateString('fr-FR', { month: 'long' })}
                                </span>
                                <div className="w-px h-3 bg-stone-200"></div>
                                <div className="flex items-center gap-2 text-[10px] font-bold">
                                    <span className="text-stone-500">{stat.monthlyActivity[selectedMonthIndex].sessions} Sess.</span>
                                    <span className="text-amber-500">{stat.monthlyActivity[selectedMonthIndex].catches} Prises</span>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <div className="h-48 relative w-full pt-4 pb-6">
                        <svg className="absolute inset-0 w-full h-full z-20 pointer-events-none overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
                            <path d={getSmoothPath(stat.monthlyActivity.map((m: any) => m.cumulSessions), maxCumul)}
                                fill="none" stroke="#d6d3d1" strokeWidth="2" strokeLinecap="round" strokeDasharray="4,4" vectorEffect="non-scaling-stroke" />
                            <path d={getSmoothPath(stat.monthlyActivity.map((m: any) => m.cumulMisses), maxCumul)}
                                fill="none" stroke="#fda4af" strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                            <path d={getSmoothPath(stat.monthlyActivity.map((m: any) => m.cumulCatches), maxCumul)}
                                fill="none" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" className="drop-shadow-sm" />
                        </svg>

                        <div className="absolute inset-0 flex items-end justify-between px-1 gap-1 z-10 w-full h-full">
                            {stat.monthlyActivity.map((m: any, idx: number) => {
                                const sessionHeight = (m.sessions / maxMensuel) * 40; 
                                const catchHeight = (m.catches / maxMensuel) * 40;
                                const missHeight = (m.misses / maxMensuel) * 40;
                                const monthLetter = new Date(2024, idx, 1).toLocaleDateString('fr-FR', { month: 'narrow' });

                                return (
                                    <div key={idx} 
                                        className="flex-1 flex flex-col justify-end items-center relative group cursor-pointer h-full"
                                        onClick={() => setSelectedMonthIndex(idx === selectedMonthIndex ? null : idx)}
                                    >
                                        <div className="w-full flex gap-[1px] sm:gap-0.5 items-end justify-center h-full pb-6">
                                            <div className={`w-1 sm:w-1.5 bg-stone-300 rounded-t-sm transition-all duration-300 ${selectedMonthIndex === idx ? 'bg-stone-500' : ''}`} style={{ height: `${sessionHeight}%` }} />
                                            <div className={`w-1 sm:w-1.5 bg-rose-300 rounded-t-sm transition-all duration-300 ${selectedMonthIndex === idx ? 'bg-rose-500' : ''}`} style={{ height: `${missHeight}%` }} />
                                            <div className={`w-1 sm:w-1.5 bg-amber-300 rounded-t-sm transition-all duration-300 ${selectedMonthIndex === idx ? 'bg-amber-500' : ''}`} style={{ height: `${catchHeight}%` }} />
                                        </div>
                                        <span className={`absolute bottom-0 text-[9px] font-black uppercase transition-colors ${selectedMonthIndex === idx ? 'text-amber-600' : 'text-stone-300'}`}>{monthLetter}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                  </div>

                  {/* ESPÈCES */}
                  {Object.keys(stat.speciesBreakdown).length > 0 && (
                    <div className="bg-white rounded-3xl p-6 border border-stone-100 shadow-sm flex flex-col items-center">
                        <h3 className="text-xs font-black text-stone-400 uppercase tracking-widest mb-6 flex items-center gap-2 w-full">
                            <Trophy size={14} /> Espèces
                        </h3>
                        
                        <div className="flex flex-col items-center w-full gap-6">
                            <div className="relative w-40 h-40 flex-shrink-0 cursor-pointer" onClick={() => setHighlightedSpecies(null)}>
                                <div className="w-full h-full rounded-full transition-all duration-500" style={{ background: getConicGradient(stat.speciesBreakdown, stat.catchesCount) }}></div>
                                <div className="absolute inset-0 m-auto w-24 h-24 bg-white rounded-full flex flex-col items-center justify-center shadow-inner transition-transform active:scale-95">
                                    <span className={`text-3xl font-black ${highlightedSpecies ? 'text-stone-800' : 'text-stone-300'}`}>{donutValue}</span>
                                    <span className="text-[10px] font-bold uppercase text-stone-400 max-w-[80px] truncate text-center px-1">{donutLabel}</span>
                                </div>
                            </div>

                            <div className="w-full grid grid-cols-2 gap-2">
                                {Object.entries(stat.speciesBreakdown).sort(([,a], [,b]) => (b as number) - (a as number)).map(([species, count]) => {
                                    const isActive = highlightedSpecies === species;
                                    const isDimmed = highlightedSpecies !== null && !isActive;
                                    return (
                                        <div key={species} onClick={() => setHighlightedSpecies(isActive ? null : species)} className={`flex justify-between items-center p-3 rounded-xl border cursor-pointer transition-all duration-300 ${isActive ? 'bg-stone-50 border-stone-300 shadow-sm scale-[1.02]' : 'bg-white border-stone-100 hover:border-stone-200'} ${isDimmed ? 'opacity-40 grayscale' : 'opacity-100'}`}>
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                <div className={`w-2.5 h-2.5 rounded-full ${getSpeciesColor(species)}`}></div>
                                                <span className="text-xs font-bold text-stone-600 truncate">{species}</span>
                                            </div>
                                            <span className="text-xs font-black text-stone-800">{count as number}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// CORRECTION ICI : Typage explicite du thème
const StatBox = ({ label, value, icon, theme }: { label: string, value: number, icon: React.ReactNode, theme: string }) => {
    // Définition typée pour éviter l'erreur d'indexation implicite 'any'
    const themes: Record<string, { bg: string, border: string, iconBg: string, iconColor: string, text: string }> = {
        stone: { bg: 'bg-stone-50', border: 'border-stone-100', iconBg: 'bg-white', iconColor: 'text-stone-400', text: 'text-stone-700' },
        amber: { bg: 'bg-amber-50', border: 'border-amber-100', iconBg: 'bg-white', iconColor: 'text-amber-500', text: 'text-amber-800' },
        rose: { bg: 'bg-rose-50', border: 'border-rose-100', iconBg: 'bg-white', iconColor: 'text-rose-400', text: 'text-rose-800' }
    };
    
    // Accès sécurisé
    const t = themes[theme] || themes.stone;

    if (value === 0) return null;

    return (
        <div className={`flex flex-col items-center justify-center p-4 rounded-2xl ${t.bg} border ${t.border} shadow-sm`}>
            <div className={`mb-2 p-2 rounded-full ${t.iconBg} ${t.iconColor} shadow-sm`}>{icon}</div>
            <span className={`text-2xl font-black ${t.text} leading-none`}>{value}</span>
            <span className="text-[9px] font-bold uppercase text-stone-400 mt-1">{label}</span>
        </div>
    );
};

export default ProfileView;