// scripts/test-coach-rag.ts
import * as fs from 'fs';
import * as path from 'path';
import { generateFishingNarrative } from '../lib/fishingNarrativeService';

async function runTest() {
    console.log("🚀 ETAPE 1: Démarrage du script...");

    try {
        const sessionsPath = path.resolve(process.cwd(), 'test_sessions_export.json');
        const refsPath = path.resolve(process.cwd(), 'referentials_for_ai.json');

        console.log(`📂 ETAPE 2: Lecture de ${sessionsPath}`);
        
        if (!fs.existsSync(sessionsPath)) {
            console.error("❌ Erreur: test_sessions_export.json est introuvable à la racine !");
            return;
        }

        const sessions = JSON.parse(fs.readFileSync(sessionsPath, 'utf-8'));
        const refs = JSON.parse(fs.readFileSync(refsPath, 'utf-8'));

        console.log(`📦 ETAPE 3: ${sessions.length} sessions chargées.`);

        const arsenalData = {
            lureTypes: refs.ref_lure_types || [],
            colors: refs.ref_colors || [],
            sizes: refs.ref_sizes || [],
            weights: refs.ref_weights || [],
            techniques: refs.techniques || [],
            spots: refs.zones || [],
            setups: refs.setups || [],
        };

        console.log("📝 ETAPE 4: Génération du narratif...");
        const narrative = generateFishingNarrative(sessions, arsenalData as any);

        console.log("\n--- RESULTAT DU NARRATIF ---");
        console.log(narrative);
        console.log("----------------------------\n");
        console.log("✅ Test terminé avec succès.");

    } catch (err) {
        console.error("💥 CRASH DU SCRIPT:", err);
    }
}

runTest();