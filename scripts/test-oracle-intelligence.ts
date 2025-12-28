// scripts/test-oracle-intelligence.ts
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { generateFishingNarrative } from '../lib/fishingNarrativeService';
import { askFishingCoach } from '../lib/ai-service';
import { AppData, Session } from '../types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testOracleIntelligence() {
    console.log("🧠 TEST D'INTELLIGENCE ORACLE (Option 1)...");

    try {
        // 1. Charger les données de test
        const sessions = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../test_sessions_export.json'), 'utf-8'));
        const refs = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../referentials_for_ai.json'), 'utf-8'));

        const arsenalData: AppData = {
            lureTypes: refs.ref_lure_types || [],
            colors: refs.ref_colors || [],
            sizes: refs.ref_sizes || [],
            weights: refs.ref_weights || [],
            techniques: refs.techniques || [],
            spots: refs.zones || [],
            setups: refs.setups || [],
            locations: [], lures: []
        };

        // 2. Générer le narratif
        const narrative = generateFishingNarrative(sessions, arsenalData);

        // 3. Poser la question "piège"
        const question = "Analyse mes sessions de Nanterre où j'ai fait bredouille. Quel est le facteur hydro qui m'a bloqué et que disent mes notes sur mon adaptation ?";
        
        console.log(`\n💬 Question posée : "${question}"`);
        console.log("⏳ L'Oracle analyse le narratif (9 sessions)...");

        const location = { lat: 48.8912, lng: 2.1932 }; // Nanterre
        const response = await askFishingCoach(question, location, narrative);

        console.log("\n==================================================");
        console.log("🤖 RÉPONSE DE L'ORACLE :");
        console.log("==================================================");
        console.log(response);
        console.log("==================================================\n");

    } catch (error) {
        console.error("❌ Erreur lors du test d'intelligence :", error);
    }
}

testOracleIntelligence();