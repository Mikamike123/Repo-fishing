// lib/fishingNarrativeService.ts
import { Session, AppData, Catch, Miss } from '../types';

export const generateFishingNarrative = (sessions: Session[], arsenal: AppData): string => {
    if (!sessions || sessions.length === 0) return "Aucune session à analyser.";

    const formatDate = (date: any): string => {
        if (!date) return 'Date inconnue';
        if (typeof date === 'string') return date;
        
        // Gestion des Timestamps Firestore (seconds / _seconds)
        const seconds = date.seconds ?? date._seconds;
        if (seconds !== undefined) {
            return new Date(seconds * 1000).toLocaleDateString('fr-FR');
        }
        
        if (date instanceof Date) return date.toLocaleDateString('fr-FR');
        if (typeof date === 'number') return new Date(date).toLocaleDateString('fr-FR');
        
        return 'Format date non reconnu';
    };

    const resolve = (id: string | undefined, collection: any[]): string => {
        if (!id || !collection) return "Non précisé";
        return collection.find(item => item.id === id)?.label || "Inconnu";
    };

    const narratives = sessions.map(session => {
        const env = session.envSnapshot;
        let text = `--- SESSION DU ${formatDate(session.date)} ---\n`;
        text += `Lieu: ${session.locationName || 'Secteur Inconnu'} (Spot: ${session.spotName || 'Spot Inconnu'})\n`;
        text += `Setup: ${session.setupName || 'Standard'}\n`;
        
        if (env) {
            const w = env.weather;
            const temp = typeof w?.temperature === 'number' ? w.temperature.toFixed(1) : 'N/A';
            const press = typeof w?.pressure === 'number' ? w.pressure.toFixed(0) : 'N/A';
            const wind = typeof w?.windSpeed === 'number' ? w.windSpeed.toFixed(1) : 'N/A';
            const clouds = w?.clouds !== undefined ? w.clouds : 'N/A';
            const windDir = w?.windDirection !== undefined ? `${w.windDirection}°` : 'N/A';
            
            text += `ATMOSPHÈRE: Temp ${temp}°C, Pression ${press}hPa, Vent ${wind}km/h (Dir: ${windDir}), Nuages ${clouds}%\n`;
            
            const h = env.hydro;
            const wTemp = typeof h?.waterTemp === 'number' ? h.waterTemp.toFixed(1) : 'N/A';
            const flow = typeof h?.flowLagged === 'number' ? h.flowLagged.toFixed(1) : 'N/A';
            const turb = typeof h?.turbidityIdx === 'number' ? h.turbidityIdx.toFixed(2) : 'N/A';
            
            text += `HYDROLOGIE: Eau ${wTemp}°C, Débit ${flow}m3/s (Brut: ${h?.flowRaw || 'N/A'}), Niveau ${h?.level || 'N/A'}mm, Turbidité Idx ${turb}\n`;
            
            const s = env.scores;
            text += `BIOSCORES: Sandre ${s?.sandre?.toFixed(0) || 'N/A'}, Brochet ${s?.brochet?.toFixed(0) || 'N/A'}, Perche ${s?.perche?.toFixed(0) || 'N/A'}\n`;
        }

        if (session.catches && session.catches.length > 0) {
            text += `PRISES (${session.catches.length}):\n`;
            session.catches.forEach((c: Catch, index: number) => {
                const lureType = resolve(c.lureTypeId, arsenal.lureTypes);
                const tech = resolve(c.techniqueId, arsenal.techniques);
                const color = resolve(c.lureColorId, arsenal.colors);
                text += `- #${index + 1}: ${c.species || 'Poisson'} ${c.size || '?'}cm. Tech: ${tech}. Leurre: ${lureType} (${c.lureName || 'Inconnu'}), Coloris: ${color}.\n`;
            });
        }

        if (session.misses && session.misses.length > 0) {
            text += `RATÉS (${session.misses.length}):\n`;
            session.misses.forEach((m: Miss) => {
                const lureType = resolve(m.lureTypeId, arsenal.lureTypes);
                text += `- ${m.type || 'Événement'} sur ${lureType} (${m.lureName || 'Sans nom'}).\n`;
            });
        }

        if (session.notes) text += `NOTES DE TERRAIN: "${session.notes}"\n`;
        return text;
    });

    return narratives.join('\n\n');
};