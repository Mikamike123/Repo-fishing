import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

const SERVICE_ACCOUNT_FILE = 'serviceAccountKey.json';
// ✅ Correction : Ajout du 's' final
const COLLECTION_NAME = 'environmental_logs';

async function checkStructure() {
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

  console.log(`🔍 Récupération d'un document au hasard dans "${COLLECTION_NAME}"...`);

  const snapshot = await db.collection(COLLECTION_NAME).limit(1).get();

  if (snapshot.empty) {
    console.log(`⚠️ La collection "${COLLECTION_NAME}" semble vide ou inaccessible.`);
    return;
  }

  snapshot.forEach(doc => {
    console.log(`\n📄 ID du document : ${doc.id}`);
    console.log("--- CONTENU JSON (Copie ceci) ---");
    console.log(JSON.stringify(doc.data(), null, 2));
    console.log("---------------------------------\n");
  });
}

checkStructure().catch(console.error);