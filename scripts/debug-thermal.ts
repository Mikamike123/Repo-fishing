// npx tsx scripts/debug-thermal.ts
// scripts/debug-thermal.ts
import { solveAir2Water } from '../lib/zeroHydroEngine';

// 1. On crée 45 jours d'historique avec un air constant à 10°C
const mockHistory = Array.from({ length: 45 * 24 }, (_, i) => ({
    date: new Date(Date.now() - (45 * 24 - i) * 3600000).toISOString(),
    temperature: 10 
}));

console.log("🚀 Lancement du Crash Test Thermique Michael...");

// SCÉNARIO : On part de 30°C pour un air à 10°C
let riverTemp: number | undefined = 30;
let pondTemp: number | undefined = 30;

// On simule manuellement la boucle de l'Oracle
for (let h = 0; h < 24 * 10; h++) { // On regarde sur 10 jours
    const point = [mockHistory[h]];
    
    // Test Seine (Delta 12)
    riverTemp = solveAir2Water(point, 'Z_RIVER', 'URBAIN', 'Z_3_15', riverTemp);
    
    // Test Étang (Delta ~5)
    pondTemp = solveAir2Water(point, 'Z_POND', 'AGRICOLE', 'Z_LESS_3', pondTemp, 1.5, 5000, 1.1);

    if (h % 24 === 0) {
        console.log(`Jour ${h/24} | Seine: ${riverTemp?.toFixed(2)}°C | Étang: ${pondTemp?.toFixed(2)}°C`);
    }
}