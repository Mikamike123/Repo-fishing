// lib/fishingNarrativeService.ts
import { Session, AppData, Catch, Miss, FullEnvironmentalSnapshot } from '../types';

export const generateFishingNarrative = (sessions: Session[], arsenal: AppData): string => {
    if (!sessions || sessions.length === 0) return "Aucune session à analyser.";

    const formatDate = (date: any): string => {
        if (!date) return 'Date inconnue';
        if (typeof date === 'string') return date;
        const seconds = date.seconds ?? date._seconds;
        if (seconds !== undefined) return new Date(seconds * 1000).toLocaleDateString('fr-FR');
        if (date instanceof Date) return date.toLocaleDateString('fr-FR');
        if (typeof date === 'number') return new Date(date).toLocaleDateString('fr-FR');
        return 'Format date non reconnu';
    };

    /**
     * Michael : Résolution générique des IDs vers les labels.
     * On s'appuie sur les collections d'AppData (lureTypes, colors, sizes, weights, techniques).
     */
    const resolve = (id: string | undefined, collection: any[]): string => {
        if (!id || !collection) return "Non précisé";
        return collection.find(item => item.id === id)?.label || "Inconnu";
    };

    const narratives = sessions.map(session => {
        const env = session.envSnapshot as FullEnvironmentalSnapshot;
        let text = `--- SESSION DU ${formatDate(session.date)} ---\n`;
        text += `LIEU: ${session.locationName || 'Secteur Inconnu'} (Spot: ${session.spotName || 'Spot Inconnu'})\n`;
        text += `SETUP: ${session.setupName || 'Standard'}\n`;
        
        if (env) {
            // Section MÉTÉO (Complète)
            const w = env.weather;
            const wDetails = [
                `Air ${w.temperature.toFixed(1)}°C`,
                `Pres. ${w.pressure}hPa`,
                `Vent ${w.windSpeed}km/h (${w.windDirection}°)`,
                `Nuages ${w.clouds}%`,
                `Précip. ${w.precip}mm`
            ].join(', ');
            text += `ATMOSPHÈRE: ${wDetails} (Code: ${w.conditionCode})\n`;
            
            // Section HYDRO (Standardisée avec flowRaw en %)
            const h = env.hydro;
            const hDetails = [
                `Eau ${h.waterTemp?.toFixed(1) || 'N/A'}°C`,
                `Courant ${h.flowRaw}%`, // Michael : Utilisation de l'unité demandée
                `Turb. ${h.turbidityIdx?.toFixed(2) || 'N/A'} (NTU: ${h.turbidityNTU || 'N/A'})`,
                `O2 ${h.dissolvedOxygen || 'N/A'}mg/L`,
                `Vagues ${h.waveHeight || 'N/A'}cm`
            ].join(', ');
            text += `HYDROLOGIE: ${hDetails}\n`;
            
            // Section METADATA (Détails morpho et tendance)
            const meta = env.metadata;
            if (meta) {
                text += `CONTEXTE: Mode ${meta.calculationMode || 'N/A'}, Tendance ${meta.flowStatus || 'Stable'}, Morpho ${meta.morphologyType || 'Inconnue'}\n`;
            }

            // Section BIOSCORES
            const s = env.scores;
            text += `BIOSCORES: Sandre ${s?.sandre?.toFixed(0) || '0'}, Perche ${s?.perche?.toFixed(0) || '0'}, Brochet ${s?.brochet?.toFixed(0) || '0'}${s?.blackbass ? `, Bass ${s.blackbass.toFixed(0)}` : ''}\n`;
        }

        // Section PRISES (Détails précis du matos)
        if (session.catches && session.catches.length > 0) {
            text += `PRISES (${session.catches.length}):\n`;
            session.catches.forEach((c: Catch, index: number) => {
                const type = resolve(c.lureTypeId, arsenal.lureTypes);
                const color = resolve(c.lureColorId, arsenal.colors);
                const size = resolve(c.lureSizeId, arsenal.sizes);
                const weight = resolve(c.lureWeightId, arsenal.weights);
                const tech = resolve(c.techniqueId, arsenal.techniques);

                text += `- #${index + 1} à ${c.time || '??'}: ${c.species} (${c.size}cm). `;
                text += `TECH: ${tech}. LEURRE: ${type} ${c.lureName} (${size}, ${weight}), COLORIS: ${color}.\n`;
            });
        }

        // Section RATÉS
        if (session.misses && session.misses.length > 0) {
            text += `RATÉS (${session.misses.length}):\n`;
            session.misses.forEach((m: Miss) => {
                const type = resolve(m.lureTypeId, arsenal.lureTypes);
                text += `- ${m.type} à ${m.time} sur ${type} (${m.lureName || 'Sans nom'}).\n`;
            });
        }

        if (session.notes) text += `NOTES DE TERRAIN: "${session.notes}"\n`;
        return text;
    });

    return narratives.join('\n\n');
};