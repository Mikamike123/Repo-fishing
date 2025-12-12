import { BioConditions } from '../types';

// Helper to generate deterministic pseudo-random conditions based on date/time
export const getSimulatedConditions = (dateStr: string, timeStr: string): BioConditions => {
  const date = new Date(`${dateStr}T${timeStr}`);
  // Create a seed from the date string to ensure consistent results for the same input
  const seedStr = `${dateStr}-${timeStr}`;
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = ((hash << 5) - hash) + seedStr.charCodeAt(i);
    hash |= 0;
  }
  const seed = Math.abs(hash);

  // Mock Weather Data
  const pressure = 1015 + (seed % 20) - 10;
  const deltaP = (seed % 7) - 3; 
  const pressurePrev = pressure - deltaP; 
  
  // Mock Hydro Data
  const flow = 200 + (seed % 200);
  const deltaQ = (seed % 40) - 20; 
  const flowPrev = flow - deltaQ;

  const clouds = seed % 101;
  const windSpeed = seed % 30;
  
  // Calculate sun times (rough approximation)
  const sunrise = new Date(date); sunrise.setHours(7, 0, 0, 0);
  const sunset = new Date(date); sunset.setHours(19, 0, 0, 0);

  return {
    date: date,
    currentWeather: { temperature: 12 + (seed % 10), pressure, clouds, windSpeed },
    currentHydro: { flow, level: 2 },
    pressureTMinus3h: pressurePrev,
    flowTMinus24h: flowPrev,
    sunrise,
    sunset,
  };
};

// Helper to get conditions for "Right Now"
export const getCurrentConditions = (): BioConditions => {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0].substring(0, 5);
    return getSimulatedConditions(dateStr, timeStr);
};