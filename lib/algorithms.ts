import { BioConditions, Session } from '../types';

// Type local pour éviter les erreurs d'import si non exporté de types.ts
type OracleScore = number | null;

/**
 * ORACLE BIOLOGIQUE (ScoreBio)
 * Calcule un score 0-100 basé sur l'activité théorique des poissons.
 */
export const calculateBioScore = (conditions: BioConditions): number => {
  let score = 50; // Depart

  // --- A. Facteur Pression (Delta 3 heures) ---
  const currentPressure = conditions.currentWeather.pressure;
  const oldPressure = conditions.pressureTMinus3h;
  const deltaP = currentPressure - oldPressure;

  if (deltaP > -1 && deltaP < 1) {
    score += 10; // Stable
  } else if (deltaP > -3 && deltaP <= -1) {
    score += 25; // Baisse Lente (Activité pré-frontale)
  } else if (deltaP >= 1) {
    score += -10; // Hausse
  } else if (deltaP <= -3) {
    score += -20; // Crash (Sandre calé)
  }

  // --- B. Facteur Hydrologie (Delta 24 heures) ---
  const currentFlow = conditions.currentHydro.flow;
  const oldFlow = conditions.flowTMinus24h;
  const deltaQ = currentFlow - oldFlow;

  // Seuil Critique : Force Majeure
  if (currentFlow > 700) {
    return 0;
  }

  if (deltaQ <= 0) {
    score += 15; // Décrue/Stable
  } else if (deltaQ > 0 && deltaQ < 30) {
    score += -10; // Crue Légère
  } else if (deltaQ >= 30) {
    score += -30; // Crue Forte
  }

  // --- C. Facteur Lumière & Ciel ---
  const now = conditions.date.getTime();
  const sunriseTime = conditions.sunrise.getTime();
  const sunsetTime = conditions.sunset.getTime();
  const hourMs = 60 * 60 * 1000;

  const isDawn = now >= (sunriseTime - hourMs) && now <= (sunriseTime + hourMs);
  const isDusk = now >= (sunsetTime - hourMs) && now <= (sunsetTime + hourMs);

  if (isDawn || isDusk) {
    score += 15; // Aube ou Crépuscule
  } else {
    const cloudCover = conditions.currentWeather.clouds;
    if (cloudCover > 75) {
      score += 10; // Faible luminosité
    } else if (cloudCover < 25) {
      score += -10; // Grand soleil
    }
  }

  return Math.max(0, Math.min(100, score));
};

/**
 * ORACLE HISTORIQUE (ScoreData)
 * Calcule une probabilité basée sur la correspondance avec les sessions passées.
 */
export const calculateDataScore = (
  currentConditions: BioConditions,
  history: Session[]
): OracleScore => {
  const cDate = currentConditions.date;
  const cMonth = cDate.getMonth(); // 0-11
  const cPressure = currentConditions.currentWeather.pressure;
  const cFlow = currentConditions.currentHydro.flow;

  // 1. Filtrage (Matching)
  const matchingSessions = history.filter((session) => {
    // V3 FIX: La date de session est maintenant une string (YYYY-MM-DD)
    // On doit la convertir en objet Date pour utiliser .getMonth()
    const sDate = new Date(session.date);
    const sMonth = sDate.getMonth();
    
    // Saison: [c.month-1, c.month+1]
    const prevMonth = (cMonth - 1 + 12) % 12;
    const nextMonth = (cMonth + 1) % 12;
    
    const isSeasonMatch = sMonth === cMonth || sMonth === prevMonth || sMonth === nextMonth;
    if (!isSeasonMatch) return false;

    // Pression: abs(s.pressure - c.pressure) <= 8 hPa
    // V3 FIX: Vérification de l'existence de weather
    if (!session.weather) return false;
    const isPressureMatch = Math.abs(session.weather.pressure - cPressure) <= 8;
    if (!isPressureMatch) return false;

    // Débit: abs(s.flow - c.flow) <= (c.flow * 0.15)
    // V3 FIX: Vérification de l'existence de hydro
    if (!session.hydro) return false;
    const flowThreshold = cFlow * 0.15;
    const isFlowMatch = Math.abs(session.hydro.flow - cFlow) <= flowThreshold;
    if (!isFlowMatch) return false;

    return true;
  });

  // 2. Calcul
  const totalMatches = matchingSessions.length;
  
  if (totalMatches < 5) {
    return null; // Données insuffisantes
  }

  const winningMatches = matchingSessions.filter(s => s.catchCount > 0).length;
  
  return (winningMatches / totalMatches) * 100;
};