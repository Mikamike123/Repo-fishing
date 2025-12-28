// Modop : 
// 1. Pour exporter TOUTES les sessions : npx tsx scripts/export-sessions.ts
// 2. Pour exporter les sessions d'une date : npx tsx scripts/export-sessions.ts --date 2025-12-28

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';
import minimist from 'minimist';
import { startOfDay, endOfDay, parseISO } from 'date-fns';

const SERVICE_ACCOUNT_FILE = 'serviceAccountKey.json';
const COLLECTION_NAME = 'sessions'; // Cible la collection des sorties de pêche

async function exportSessions() {
  // 1. Authentification
  const serviceAccountPath = path.join(process.cwd(), SERVICE_ACCOUNT_FILE);
  if (!fs.existsSync(serviceAccountPath)) {
    console.error(`❌ Fichier ${SERVICE_ACCOUNT_FILE} introuvable à la racine !`);
    return;
  }

  if (getApps().length === 0) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
    initializeApp({
      credential: cert(serviceAccount)
    });
  }

  const db = getFirestore();
  const args = minimist(process.argv.slice(2));
  const targetDateStr = args['date'];

  let query: any = db.collection(COLLECTION_NAME);

  // 2. Logique de filtrage
  if (targetDateStr) {
    console.log(`🔍 Extraction des sessions du : ${targetDateStr}...`);
    const targetDate = parseISO(targetDateStr);
    if (isNaN(targetDate.getTime())) {
        console.error("❌ Date invalide. Utilisez le format YYYY-MM-DD.");
        return;
    }
    const start = startOfDay(targetDate);
    const end = endOfDay(targetDate);
    query = query.where('date', '>=', targetDateStr); // Filtre sur le champ string 'date'
  } else {
    console.log(`🔍 Extraction de TOUTES les sessions de la collection...`);
  }

  const snapshot = await query.orderBy('date', 'desc').get();

  if (snapshot.empty) {
    console.log(`⚠️ Aucune session trouvée dans la collection "${COLLECTION_NAME}".`);
    return;
  }

  // 3. Traitement des données
  const allSessions: any[] = [];
  
  snapshot.forEach((doc: any) => {
    const data = doc.data();
    allSessions.push({
      id: doc.id,
      ...data
    });
  });

  // 4. Affichage et Export
  console.log(`\n✅ ${allSessions.length} session(s) récupérée(s).`);
  console.log("--- DÉBUT DU JSON ---");
  console.log(JSON.stringify(allSessions, null, 2));
  console.log("--- FIN DU JSON ---\n");

  // Optionnel : Sauvegarde dans un fichier local pour analyse facile
  const outputPath = path.join(process.cwd(), 'test_sessions_export.json');
  fs.writeFileSync(outputPath, JSON.stringify(allSessions, null, 2));
  console.log(`💾 Export sauvegardé dans : ${outputPath}`);
}

exportSessions().catch(console.error);