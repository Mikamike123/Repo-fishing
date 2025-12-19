import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// --- CONFIGURATION ---
const COLLECTION_NAME = 'environmental_logs'; // ⚠️ Mets ici le nom de ta collection existante
const DATA_FILE = 'fishing-data.json';
const SERVICE_ACCOUNT_FILE = 'serviceAccountKey.json'; // ⚠️ Vérifie le nom

// Interface de tes données
interface RiverData {
  date: string;
  debit: number;
  niveau: number | null;
}

async function uploadHistory() {
  // 1. Initialisation de Firebase
  const serviceAccountPath = path.join(process.cwd(), SERVICE_ACCOUNT_FILE);
  
  if (!fs.existsSync(serviceAccountPath)) {
    console.error(`❌ ERREUR: Le fichier ${SERVICE_ACCOUNT_FILE} est introuvable.`);
    console.error("   Télécharge-le depuis la console Firebase > Paramètres > Comptes de service.");
    return;
  }

  // On vérifie si l'app est déjà initialisée pour éviter les erreurs en dev
  if (!admin.apps.length) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }

  const db = admin.firestore();

  // 2. Lecture du JSON local
  const jsonPath = path.join(process.cwd(), DATA_FILE);
  if (!fs.existsSync(jsonPath)) {
    console.error(`❌ ERREUR: ${DATA_FILE} introuvable. Lance 'npx tsx import-csv.ts' d'abord.`);
    return;
  }
  
  const rawData = fs.readFileSync(jsonPath, 'utf-8');
  const riverDataList: RiverData[] = JSON.parse(rawData);

  console.log(`🚀 Démarrage de l'upload de ${riverDataList.length} jours...`);

  // 3. Écriture par "Batches" (Firebase limite à 500 opérations par lot)
  const BATCH_SIZE = 400;
  let batchCount = 0;
  let processed = 0;

  // On découpe la liste en morceaux de 400
  for (let i = 0; i < riverDataList.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = riverDataList.slice(i, i + BATCH_SIZE);

    chunk.forEach(entry => {
      // On utilise la DATE comme ID du document (YYYY-MM-DD)
      const docRef = db.collection(COLLECTION_NAME).doc(entry.date);

      // On prépare l'objet à envoyer.
      // On le met sous une clé "river" pour que ce soit propre dans Firebase
      // ex: { weather: {...}, river: { debit: 120, niveau: 1.2 } }
      const payload = {
        river: {
          flow: entry.debit,          // J'utilise des noms anglais génériques
          level: entry.niveau,
          unit_flow: 'l/s',           // Précision importante (vu que tes données sont brutes)
          unit_level: 'mm',
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }
      };

      // { merge: true } est CRUCIAL ici :
      // Il permet de garder les données météo si elles existent déjà pour ce jour-là
      batch.set(docRef, payload, { merge: true });
    });

    // On envoie le paquet
    await batch.commit();
    processed += chunk.length;
    batchCount++;
    console.log(`   ✅ Batch ${batchCount} envoyé (${processed}/${riverDataList.length} documents)`);
  }

  console.log(`\n🎉 TERMINÉ ! ${processed} documents mis à jour dans la collection "${COLLECTION_NAME}".`);
}

uploadHistory().catch(console.error);