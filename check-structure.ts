// Modop (ne pas supprimer): la commande pour lancer à une date est la suivante:
// npx tsx check-structure.ts --date 2025-12-20
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';
import minimist from 'minimist';
import { startOfDay, endOfDay, parseISO } from 'date-fns';

const SERVICE_ACCOUNT_FILE = 'serviceAccountKey.json';
const COLLECTION_NAME = 'environmental_logs';

async function checkStructure() {
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

  let snapshot;

  // 2. Logique de récupération
  if (targetDateStr) {
    console.log(`🔍 Recherche d'un document pour la date du : ${targetDateStr}...`);
    
    const targetDate = parseISO(targetDateStr);
    if (isNaN(targetDate.getTime())) {
        console.error("❌ Date invalide. Utilisez le format YYYY-MM-DD.");
        return;
    }

    const start = startOfDay(targetDate);
    const end = endOfDay(targetDate);

    snapshot = await db.collection(COLLECTION_NAME)
        .where('timestamp', '>=', start)
        .where('timestamp', '<=', end)
        .limit(1)
        .get();

    if (snapshot.empty) {
        console.log(`⚠️ Aucun enregistrement trouvé pour le ${targetDateStr}.`);
        return;
    }

  } else {
    console.log(`🔍 Récupération d'un document au hasard (le plus récent)...`);
    // On trie par date pour avoir le dernier en date, plus pertinent qu'un vrai hasard
    snapshot = await db.collection(COLLECTION_NAME)
        .orderBy('timestamp', 'desc')
        .limit(1)
        .get();
  }

  if (snapshot.empty) {
    console.log(`⚠️ La collection "${COLLECTION_NAME}" semble vide.`);
    return;
  }

  // 3. Affichage
  snapshot.forEach(doc => {
    const data = doc.data();
    
    // Conversion du timestamp pour lecture humaine
    const dateLog = data.timestamp ? data.timestamp.toDate().toLocaleString('fr-FR') : 'Inconnue';

    console.log(`\n📄 Document trouvé (ID: ${doc.id})`);
    console.log(`📅 Date de l'enregistrement : ${dateLog}`);
    console.log("--- CONTENU JSON (Copie ceci pour validation) ---");
    console.log(JSON.stringify(data, null, 2));
    console.log("-------------------------------------------------\n");
  });
}

checkStructure().catch(console.error);