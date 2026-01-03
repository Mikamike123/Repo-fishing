// lib/analytics-service.ts
import { Session, Catch, Miss, AppData, FullEnvironmentalSnapshot } from '../types';

export interface DeepStrategicKPIs {
    performance: {
        cpue: number;
        conversionRate: number;
        skunkRate: number;
        averageSessionDuration: number;
    };
    atmosphere: {
        goldenPressureRange: string;
        pressureTrendBias: 'Montante' | 'Descendante' | 'Stable' | 'Inconnu';
        bestSkyCondition: string;
    };
    hydrology: {
        thermalWindow: string;
        oxygenSweetSpot: string;
        flowEfficiency: string;
        turbidityPreference: string;
    };
    tactical: {
        topLureByClarity: Record<string, string>;
        bestComboTechnique: string;
        efficiencyByMorphology: Record<string, number>;
    };
    nemesis: {
        worstCondition: string;
        missPattern: string;
    };
}

/**
 * Michael : Calcule le poids d'une session en fonction de son âge.
 * Décroissance linéaire de 1.0 (récent) à 0.3 (vieux) sur 730 jours.
 */
const calculateSessionWeight = (sessionDate: any): number => {
    const now = new Date().getTime();
    let sDate: number;

    if (!sessionDate) return 0.3; 

    if (typeof sessionDate === 'object' && (sessionDate.seconds || sessionDate._seconds)) {
        sDate = (sessionDate.seconds || sessionDate._seconds) * 1000;
    } else {
        sDate = new Date(sessionDate).getTime();
    }

    if (isNaN(sDate)) return 0.3;

    const diffDays = (now - sDate) / (1000 * 60 * 60 * 24);
    const maxDays = 730; 
    const floor = 0.3; 

    if (diffDays <= 0) return 1.0;
    const decay = (diffDays / maxDays) * (1 - floor);
    return Math.max(floor, 1 - decay);
};

/**
 * Michael : Nouvelle fonction pour extraire les données brutes pour l'UI
 * Retourne 6 blocs stratégiques majeurs (KPIs)
 */
export const getDeepStrategicData = (sessions: Session[], userId: string, arsenal: AppData) => {
    const mySessions = sessions.filter(s => s.userId === userId && s.active);
    if (mySessions.length === 0) return null;

    let weightedTotalFish = 0;
    let weightedTotalHours = 0;
    let weightedTotalMisses = 0;
    let weightedSkunkCount = 0;
    let totalWeightSum = 0;

    const successData: { env: any, weight: number }[] = [];
    const lureStats: Record<string, { cWeighted: number, mWeighted: number, rawCount: number }> = {};
    const spotStats: Record<string, { weightedFish: number, weightedHours: number }> = {};
    const techStats: Record<string, number> = {};
    const allMisses = mySessions.flatMap(s => s.misses || []);

    mySessions.forEach(s => {
        const weight = calculateSessionWeight(s.date);
        totalWeightSum += weight;

        const hours = (s.durationMinutes || 0) / 60;
        weightedTotalHours += hours * weight;
        weightedTotalFish += (s.catchCount || 0) * weight;
        weightedTotalMisses += (s.misses?.length || 0) * weight;

        // Michael: Accumulateur pour Spot Master (CPUE par Lieu)
        const loc = s.locationName || "Inconnu";
        if (!spotStats[loc]) spotStats[loc] = { weightedFish: 0, weightedHours: 0 };
        spotStats[loc].weightedFish += (s.catchCount || 0) * weight;
        spotStats[loc].weightedHours += hours * weight;

        if ((s.catchCount || 0) === 0) weightedSkunkCount += weight;

        if (s.catchCount > 0) {
            successData.push({ env: s.envSnapshot, weight });
            
            s.catches?.forEach(c => {
                // Michael : Nomenclature technique via lureTypeId
                const id = c.lureTypeId || "Inconnu";
                if (!lureStats[id]) lureStats[id] = { cWeighted: 0, mWeighted: 0, rawCount: 0 };
                lureStats[id].cWeighted += weight;
                lureStats[id].rawCount += 1;

                // Michael: Accumulateur pour Technique Master
                const tech = c.technique || "Inconnue";
                techStats[tech] = (techStats[tech] || 0) + weight;
            });
        }

        s.misses?.forEach(m => {
            const id = m.lureTypeId || "Inconnu";
            if (!lureStats[id]) lureStats[id] = { cWeighted: 0, mWeighted: 0, rawCount: 0 };
            lureStats[id].mWeighted += weight;
        });
    });

    const cpue = weightedTotalFish / (weightedTotalHours || 1);
    const conversion = (weightedTotalFish / (weightedTotalFish + weightedTotalMisses || 1)) * 100;
    const skunkRate = (weightedSkunkCount / totalWeightSum) * 100;

    // Michael : Résolution Leurre Master
    const topLureId = Object.entries(lureStats)
        .map(([id, s]) => ({ id, score: s.cWeighted / (s.cWeighted + s.mWeighted || 1) }))
        .sort((a, b) => b.score - a.score)[0]?.id || "N/A";
    const topLureLabel = arsenal.lureTypes.find(t => t.id === topLureId)?.label || topLureId;
    const topLurePrises = lureStats[topLureId]?.rawCount || 0;

    // Michael : Résolution Spot Master (Meilleur CPUE)
    const topSpot = Object.entries(spotStats)
        .map(([name, stat]) => ({ name, cpue: stat.weightedFish / (stat.weightedHours || 1) }))
        .sort((a, b) => b.cpue - a.cpue)[0]?.name || "N/A";

    // Michael : Résolution Technique Master
    const topTech = Object.entries(techStats)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || "Inconnue";

    return {
        cpue,
        conversion,
        skunkRate,
        sessionCount: mySessions.length,
        goldenPressure: getWeightedDistributionRange(successData.map(d => d.env?.weather.pressure || 0), successData.map(d => d.weight), 5),
        thermalWindow: getWeightedDistributionRange(successData.map(d => d.env?.hydro.waterTemp || 0), successData.map(d => d.weight), 2),
        topLure: topLureLabel,
        topLureCount: topLurePrises,
        topSpot,
        topTech,
        cloudBias: getWeightedMode(successData.map(d => ({
            val: (d.env?.weather.clouds || 0) > 50 ? 'Temps Couvert' : 'Ciel Dégagé', 
            w: d.weight
        }))),
        nemesis: allMisses.length > 0 ? getMode(allMisses.map(m => m.type)) : 'N/A'
    };
};

export const calculateDeepKPIs = (sessions: Session[], userId: string, arsenal: AppData): string => {
    const stats = getDeepStrategicData(sessions, userId, arsenal);
    if (!stats) return "Aucune donnée historique.";

    return `
### ANALYSE STRATÉGIQUE (PONDÉRATION TEMPORELLE ACTIVE)
*Note : Les succès récents impactent davantage les tendances que les archives (Poids min : 0.3)*

**EFFICACITÉ GLOBALE PONDÉRÉE**
- CPUE Tendanciel : ${stats.cpue.toFixed(2)} poissons/h
- Conversion Ferrage/Prise : **${stats.conversion.toFixed(1)}%**
- Indice de régularité (Bredouille) : ${stats.skunkRate.toFixed(0)}%

**FENÊTRES DE SUCCÈS (ZONES DORÉES)**
- Pression Or : ${stats.goldenPressure} hPa
- Température Eau : ${stats.thermalWindow}°C
- Spot Master (Rendement max) : ${stats.topSpot}
- Meilleure Technique : ${stats.topTech}

**ARSENAL & TACTIQUE**
- Meilleur ratio Leurre : ${stats.topLure} (${stats.topLureCount} captures)
- Morphologie de prédilection : ${getWeightedMode(sessions.filter(s => s.userId === userId && s.catchCount > 0).map(s => ({val: s.envSnapshot?.metadata.morphologyType || 'Inconnu', w: calculateSessionWeight(s.date)})))}
- Nemesis dominante : ${stats.nemesis}
    `.trim();
};

// --- HELPERS PONDÉRÉS ---

const getWeightedDistributionRange = (values: number[], weights: number[], step: number) => {
    const clean = values.filter(v => v > 0);
    if (!clean.length) return "N/A";
    
    const counts: Record<string, number> = {};
    values.forEach((v, i) => {
        if (v <= 0) return;
        const b = Math.floor(v / step) * step;
        const key = `${b}-${b + step}`;
        counts[key] = (counts[key] || 0) + weights[i];
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
};

const getWeightedMode = (data: {val: any, w: number}[]) => {
    if (!data.length) return "Inconnu";
    const counts: Record<string, number> = {};
    data.forEach(d => {
        counts[d.val] = (counts[d.val] || 0) + d.w;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
};

const getMode = (arr: any[]) => {
    const counts: Record<string, number> = {};
    arr.forEach(v => counts[v] = (counts[v] || 0) + 1);
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 ? sorted[0][0] : "Inconnu";
};

const calculatePressureTrend = (sessions: Session[]): string => {
    return "Stable"; 
};