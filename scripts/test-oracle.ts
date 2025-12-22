// scripts/test-oracle.ts
// Utilisation : npx tsx scripts/test-oracle.ts --img chemin/vers/ma_photo.jpg

import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import minimist from 'minimist';
import { performance } from 'perf_hooks';

const REFERENTIALS_FILE = 'referentials_for_ai.json';
// URL de ta fonction - À adapter selon ton déploiement (Local emulator ou Prod)
const FUNCTION_URL = "https://analyzecatchimage-bw56x3hfxa-ew.a.run.app";

async function testOracle() {
    const args = minimist(process.argv.slice(2));
    const imgPath = args['img'];

    console.log("\n=== 🔮 ORACLE VISION 3.0 - TEST SUITE ===");

    if (!imgPath || !fs.existsSync(imgPath)) {
        console.error("❌ ERREUR : Chemin d'image invalide ou manquant.");
        console.log("Usage : npx tsx scripts/test-oracle.ts --img poisson.jpg");
        return;
    }

    try {
        // --- 1. CHARGEMENT DES RÉFÉRENTIELS ---
        console.log("📂 Chargement des référentiels locaux...");
        const refsContent = fs.readFileSync(path.join(process.cwd(), REFERENTIALS_FILE), 'utf-8');
        const refs = JSON.parse(refsContent);
        console.log(`   ✅ ${refs.ref_lure_types.length} leurres et ${refs.ref_colors.length} couleurs chargés.`);

        // --- 2. TRAITEMENT DE L'IMAGE ---
        console.log(`📸 Lecture de l'image : ${path.basename(imgPath)}`);
        const imageBuffer = fs.readFileSync(imgPath);
        const base64Image = imageBuffer.toString('base64');
        const payloadSizeKB = Math.round(base64Image.length / 1024);
        console.log(`   📦 Taille du Payload Base64 : ${payloadSizeKB} KB`);

        // --- 3. PRÉPARATION DE LA REQUÊTE ---
        const payload = {
            data: {
                image: base64Image,
                userPseudo: "Michael",
                referentials: {
                    lureTypes: refs.ref_lure_types,
                    colors: refs.ref_colors
                }
            }
        };

        console.log("\n🚀 Envoi de la requête à Gemini 3.0...");
        const startTime = performance.now();

        // --- 4. APPEL CLOUD FUNCTION ---
        const response = await axios.post(FUNCTION_URL, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000 // 30s max pour l'IA
        });

        const endTime = performance.now();
        const latency = ((endTime - startTime) / 1000).toFixed(2);

        // --- 5. ANALYSE DES RÉSULTATS ---
        const result = response.data.result;

        console.log("\n✨ --- RÉSULTATS DE L'ANALYSE --- ✨");
        console.log(`⏱️  Latence totale : ${latency} secondes`);
        console.log(`📊 Score de confiance : ${Math.round(result.confidence_score * 100)}%`);
        console.log("-----------------------------------------");
        console.log(`🐟 Espèce identifiée : ${result.species}`);
        console.log(`📏 Taille estimée    : ${result.size} cm`);
        console.log(`🎣 Type Leurre ID    : ${result.lureTypeId}`);
        console.log(`🎨 Couleur Leurre ID : ${result.lureColorId}`);
        console.log(`💬 Message IA        : "${result.enthusiastic_message}"`);
        console.log("-----------------------------------------");

        // Vérification de la cohérence des IDs
        const lureMatch = refs.ref_lure_types.find((l: any) => l.id === result.lureTypeId);
        const colorMatch = refs.ref_colors.find((c: any) => c.id === result.lureColorId);

        console.log(`🔍 Validation Mapping :`);
        console.log(`   - Leurre  : ${lureMatch ? '✅ ' + lureMatch.label : '❌ ID INCONNU'}`);
        console.log(`   - Couleur : ${colorMatch ? '✅ ' + colorMatch.label : '❌ ID INCONNU'}`);

    } catch (error: any) {
        console.error("\n💀 --- ÉCHEC DU TEST --- 💀");
        if (error.response) {
            console.error(`Status : ${error.response.status}`);
            console.error(`Data   :`, JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(`Message : ${error.message}`);
        }
    }
    console.log("\n=== FIN DU TEST ===\n");
}

testOracle();