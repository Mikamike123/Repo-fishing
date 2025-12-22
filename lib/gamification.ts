// lib/gamification.ts
import { Session, Catch, SpeciesType, YearlySnapshot } from '../types';
import { getISOWeek, getYear, parseISO } from 'date-fns';

// --- CONFIGURATION DU GAMEPLAY ---

const XP_RULES = {
  SESSION_BASE: 40,
  SNAPSHOT_FULL: 20,
  NOTE_BONUS: 15, // Si notes > 50 chars
  MISS_BONUS: 15,
  STREAK_WEEKLY: 100, // 2 sessions/semaine
  YEARLY_PB: 250,
};

const SPECIES_XP: Record<SpeciesType | 'Inconnu', { base: number; perCm: number; maille: number }> = {
  'Perche': { base: 30, perCm: 4, maille: 20 },
  'Sandre': { base: 60, perCm: 8, maille: 50 },
  'Brochet': { base: 80, perCm: 12, maille: 60 },
  'Black-Bass': { base: 50, perCm: 10, maille: 30 },
  'Silure': { base: 100, perCm: 2, maille: 100 },
  'Chevesne': { base: 30, perCm: 4, maille: 30 },
  'Truite': { base: 40, perCm: 6, maille: 25 },
  'Aspe': { base: 60, perCm: 8, maille: 50 },
  'Bar': { base: 70, perCm: 10, maille: 42 },
  'Inconnu': { base: 10, perCm: 0, maille: 0 },
};

// Seuils Spéciaux (Poutre / Monstre / Métré)
const getSizeBonus = (species: SpeciesType | 'Inconnu', size: number): number => {
  let bonus = 0;
  
  if (species === 'Perche') {
    if (size > 45) bonus += 150; // Monstre
    else if (size > 35) bonus += 75; // Poutre
  }
  
  if (species === 'Sandre') {
    if (size > 80) bonus += 300; // Monstre
    else if (size > 60) bonus += 150; // Poutre
  }

  if (species === 'Brochet') {
    if (size >= 100) bonus += 800; // Métré (Remplace Monstre)
    else if (size > 90) bonus += 400; // Monstre
    else if (size > 70) bonus += 200; // Poutre
  }

  return bonus;
};

// --- MOTEUR DE CALCUL ---

// Fonction courbe de niveau (Progressive)
// 1-10: Rapide (~300xp/lvl) | 11-30: Moyen (~600xp/lvl) | 30+: Dur (~1000xp/lvl)
export const getLevelFromXP = (xp: number): number => {
  let level = 1;
  let currentCap = 0;

  while (true) {
    let costNext = 0;
    if (level < 10) costNext = 200 + (level * 20); 
    else if (level < 30) costNext = 400 + (level * 30); 
    else costNext = 1000 + (level * 50); 

    if (xp >= currentCap + costNext) {
      currentCap += costNext;
      level++;
    } else {
      break;
    }
  }
  return level;
};

// Récupère l'XP requis pour le PROCHAIN niveau (pour la barre de progression)
export const getNextLevelCap = (level: number): number => {
    let currentCap = 0;
    for(let l = 1; l <= level; l++) {
        let costNext = 0;
        if (l < 10) costNext = 200 + (l * 20);
        else if (l < 30) costNext = 400 + (l * 30);
        else costNext = 1000 + (l * 50);
        currentCap += costNext;
    }
    return currentCap;
};

// Calcul XP d'une capture unique
export const calculateCatchXP = (c: Catch, isYearlyPB: boolean): number => {
  const rules = SPECIES_XP[c.species] || SPECIES_XP['Inconnu'];
  
  let xp = rules.base;
  
  // Points par cm AU DESSUS de la maille
  const sizeDelta = Math.max(0, c.size - rules.maille);
  xp += sizeDelta * rules.perCm;

  // Bonus Poutre/Monstre
  xp += getSizeBonus(c.species, c.size);

  // Bonus PB Saison
  if (isYearlyPB) xp += XP_RULES.YEARLY_PB;

  return Math.floor(xp);
};

// Moteur Principal : Time Travel Engine
export const calculateSeasonStats = (allSessions: Session[], year: number): YearlySnapshot => {
  // 1. Filtrer les sessions de l'année cible
  const yearSessions = allSessions.filter(s => getYear(parseISO(s.date)) === year);
  
  // Trier par date pour le calcul chronologique
  yearSessions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let xpTotal = 0;
  let fishCount = 0;
  let weeksWithStreak = 0;
  
  const yearPBs: Record<string, number> = {}; 
  let topCatch: Catch | undefined;
  let topCatchScore = 0;

  // Gestion des semaines pour le streak
  const weeksMap: Record<number, number> = {}; // Semaine ISO -> nombre de sessions

  // --- PASSAGE UNIQUE SUR LES SESSIONS ---
  yearSessions.forEach(session => {
    // A. XP D'EFFORT
    xpTotal += XP_RULES.SESSION_BASE;
    if (session.envSnapshot) xpTotal += XP_RULES.SNAPSHOT_FULL;
    if (session.notes && session.notes.length > 50) xpTotal += XP_RULES.NOTE_BONUS;
    if (session.misses && session.misses.length > 0) xpTotal += XP_RULES.MISS_BONUS;

    // Comptage semaines
    const weekNum = getISOWeek(parseISO(session.date));
    weeksMap[weekNum] = (weeksMap[weekNum] || 0) + 1;

    // B. XP DE PERFORMANCE (Captures)
    session.catches.forEach(fish => {
      fishCount++;
      
      // Check PB Saison
      let isPB = false;
      const currentPB = yearPBs[fish.species] || 0;
      if (fish.size > currentPB) {
        isPB = true;
        yearPBs[fish.species] = fish.size;
      }

      const fishXP = calculateCatchXP(fish, isPB);
      xpTotal += fishXP;

      if (fishXP > topCatchScore) {
        topCatchScore = fishXP;
        topCatch = fish;
      }
    });
  });

  // C. CALCUL FINAL STREAKS
  Object.values(weeksMap).forEach(count => {
    if (count >= 2) {
      weeksWithStreak++;
      xpTotal += XP_RULES.STREAK_WEEKLY;
    }
  });

  return {
    year,
    levelReached: getLevelFromXP(xpTotal),
    xpTotal,
    sessionCount: yearSessions.length,
    fishCount,
    weeksWithStreak,
    topCatch
  };
};

/**
 * Fonction Publique pour récupérer tout l'historique
 */
export const buildUserHistory = (sessions: Session[]): Record<number, YearlySnapshot> => {
  const years = [...new Set(sessions.map(s => getYear(parseISO(s.date))))];
  const history: Record<number, YearlySnapshot> = {};

  years.forEach(year => {
    history[year] = calculateSeasonStats(sessions, year);
  });

  return history;
};