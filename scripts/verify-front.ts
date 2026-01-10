// scripts/verify-front.ts
import { solveAir2Water, solveDissolvedOxygen } from '../lib/zeroHydroEngine';
import { calculateUniversalBioScores } from '../lib/bioScoreEngine';
import { MorphologyID, BassinType, DepthCategoryID } from '../types';

const TEST_DATE = new Date(2026, 0, 9, 14, 0);
const METEO = Array.from({ length: 45 * 24 }, (_, i) => ({
    date: new Date(2026, 0, 9 - 45 + Math.floor(i/24), i%24).toISOString(),
    temperature: 12 + Math.sin(i / 24) * 8
}));

const MILIEUX = [
    { id: 'Z_RIVER' as MorphologyID, depthId: 'Z_3_15' as DepthCategoryID, D: 6, S: 100000, F: 1.2 },
    { id: 'Z_DEEP' as MorphologyID, depthId: 'Z_MORE_15' as DepthCategoryID, D: 18, S: 800000, F: 1.5 },
    { id: 'Z_POND' as MorphologyID, depthId: 'Z_LESS_3' as DepthCategoryID, D: 2, S: 5000, F: 1.1 },
    { id: 'Z_MED' as MorphologyID, depthId: 'Z_3_15' as DepthCategoryID, D: 4, S: 50000, F: 1.3 }
];

console.log("\n--- 🧪 FRONTEND : VÉRIFICATION DES 4 MILIEUX ---");

MILIEUX.forEach(m => {
    const Tw = solveAir2Water(METEO, m.id, 'AGRICOLE', m.depthId, undefined, m.D, m.S, m.F);
    const DO = solveDissolvedOxygen(Tw, 1013, 15);
    const ctx = { 
        waterTemp: Tw, windSpeed: 15, cloudCover: 20, pressureTrend: 0, 
        turbidityNTU: 8.5, dissolvedOxygen: DO, waveHeight: 5, 
        flowIndex: 15, flowDerivative: 0, flowTrend: 'Stable' as any, 
        date: TEST_DATE, morphoId: m.id 
    };

    const scores = calculateUniversalBioScores(ctx);
    console.log(`📍 ${m.id.padEnd(8)} | Eau: ${Tw.toFixed(1)}°C | Brochet: ${scores.brochet} | Sandre: ${scores.sandre}`);
});