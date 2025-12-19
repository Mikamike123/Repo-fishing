import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue, FieldPath } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

// --- CONFIGURATION ---
const COLLECTION_NAME = 'environmental_logs';
const DATA_FILE = 'fishing-data.json';
const SERVICE_ACCOUNT_FILE = 'serviceAccountKey.json';

// 🚨 METTRE À 'false' POUR LANCER L'UPLOAD RÉEL
const DRY_RUN = false; 

interface RiverData {
  date: string;       // Format YYYY-MM-DD
  debit: number;
  niveau: number | null;
}

/**
 * Calcule la date du lendemain au format String YYYY-MM-DD
 * Utile pour chercher "tout ce qui est entre aujourd'hui et demain"
 */
function getNextDayString(dateStr: string): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + 1);
  return date.toISOString().split('T')[0];
}

async function uploadHistory() {
  const serviceAccountPath = path.join(process.cwd(), SERVICE_ACCOUNT_FILE);
  
  // 1. Initialisation
  if (!fs.existsSync(serviceAccountPath)) {
    console.error(`❌ ERREUR: ${SERVICE_ACCOUNT_FILE} introuvable.`);
    return;
  }

  if (getApps().length === 0) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
    initializeApp({ credential: cert(serviceAccount) });
  }

  const db = getFirestore();
  const jsonPath = path.join(process.cwd(), DATA_FILE);
  
  if (!fs.existsSync(jsonPath)) {
    console.error(`❌ ERREUR: ${DATA_FILE} introuvable.`);
    return;
  }
  
  const rawData = fs.readFileSync(jsonPath, 'utf-8');
  const riverDataList: RiverData[] = JSON.parse(rawData);

  console.log(`🚀 PRÊT à traiter ${riverDataList.length} jours de données.`);
  console.log(`ℹ️  Stratégie : Injection de la moyenne journalière sur TOUTES les heures de chaque jour.`);
  if (DRY_RUN) console.log("🚧 MODE SIMULATION (DRY RUN) - Aucune écriture.");

  let totalUpdated = 0;
  let batch = db.batch();
  let batchOpCount = 0;

  // 2. Boucle jour par jour
  // On utilise une boucle for...of pour gérer l'async correctement
  for (const [index, entry] of riverDataList.entries()) {
    
    const currentDay = entry.date;      // ex: "2023-05-01"
    const nextDay = getNextDayString(currentDay); // ex: "2023-05-02"

    // REQUÊTE : Trouver tous les docs dont l'ID est >= "2023-05-01" ET < "2023-05-02"
    // Cela attrape "2023-05-01_0000", "2023-05-01_1500", etc.
    const snapshot = await db.collection(COLLECTION_NAME)
      .where(FieldPath.documentId(), '>=', currentDay)
      .where(FieldPath.documentId(), '<', nextDay)
      .get();

    if (snapshot.empty) {
      // Pas de données météo pour ce jour-là, on passe
      continue;
    }

    // Pour chaque heure trouvée ce jour-là...
    snapshot.docs.forEach(doc => {
      const payload = {
        hydro: {
          flow: entry.debit,
          level: entry.niveau,
          // On précise que c'est une moyenne journalière si besoin plus tard
          isDailyMean: true 
        },
        updatedAt: DRY_RUN ? new Date().toISOString() : FieldValue.serverTimestamp()
      };

      if (DRY_RUN && totalUpdated === 0) {
        console.log(`\n🔍 EXEMPLE (Premier match trouvé) :`);
        console.log(`   ID trouvé : ${doc.id}`);
        console.log(`   Valeur injectée (Moyenne du ${entry.date}) :`);
        console.log(JSON.stringify(payload, null, 2));
      }

      batch.set(doc.ref, payload, { merge: true });
      batchOpCount++;
      totalUpdated++;
    });

    // Gestion du Batch (limite de 500 opérations ou toutes les 50 dates traitées)
    if (batchOpCount >= 400 || index === riverDataList.length - 1) {
      if (!DRY_RUN) {
        await batch.commit();
        process.stdout.write('.'); // Feedback visuel minimaliste
      }
      // On repart sur un nouveau batch
      batch = db.batch();
      batchOpCount = 0;
    }
  }

  if (DRY_RUN) {
    console.log(`\n\n🚧 SIMULATION TERMINÉE.`);
    console.log(`   Nombre total de documents (heures) qui seraient mis à jour : ${totalUpdated}`);
    console.log(`👉 Passe 'DRY_RUN = false' pour exécuter.`);
  } else {
    console.log(`\n\n🎉 TERMINÉ ! ${totalUpdated} entrées horaires mises à jour avec les moyennes journalières.`);
  }
}

uploadHistory().catch(console.error);