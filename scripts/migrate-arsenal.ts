import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

// ---------------------------------------------------------------------------
// 1. CONFIGURATION & INITIALISATION (Compatible ESM)
// ---------------------------------------------------------------------------

if (!admin.apps.length) {
  try {
    // Lecture du fichier JSON via FileSystem (ESM friendly) au lieu de require()
    // On cherche le fichier à la racine du projet (../ par rapport au dossier scripts)
    const serviceAccountPath = new URL('../serviceAccountKey.json', import.meta.url);
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf-8'));

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (e) {
    console.error("\n❌ ERREUR CRITIQUE : Impossible de lire 'serviceAccountKey.json'.");
    console.error("Vérifie que le fichier est bien à la racine du projet.");
    console.error("Détail de l'erreur :", e);
    process.exit(1);
  }
}

const db = getFirestore();
const TARGET_USER_ID = "user_1"; // L'Admin propriétaire

// ---------------------------------------------------------------------------
// 2. DONNÉES SOURCE
// ---------------------------------------------------------------------------

const SOURCE_DATA = {
  "ref_lure_types": [
    { "id": "28BkcT2EpyOfmRczLSsE", "label": "Benthique - Craw" },
    { "id": "2fOR5VORRKph88UtAH65", "label": "Réactif - Chatterbait" },
    { "id": "3yDevzZBMS6XN9hcdwWf", "label": "Poisson Nageur - Crankbait" },
    { "id": "D06fXV2vROlpsfF9J2Pw", "label": "Poisson Nageur - Jerkbait" },
    { "id": "IbGXC9boHrwpLeRCtBX6", "label": "Vibrant - Grub" },
    { "id": "NLdSQe9gA9cnF5tEwirD", "label": "Non défini" },
    { "id": "TN6pQOD6QBL5mduAnqKC", "label": "Topwater - Insecte" },
    { "id": "Ul0ayttjC1FGA5yTINlC", "label": "Benthique - Créature" },
    { "id": "Vv39qrMoGzAKVcc5XGfo", "label": "Finesse - Worm" },
    { "id": "aAcZBbm9fyatu9z8exHV", "label": "Vibrant - Shad" },
    { "id": "bQh2IeETIRP3X7Q7L2w2", "label": "Finesse - Tanta/Annelé" },
    { "id": "dTHd87x3h5m9x0mkp5iX", "label": "Topwater - Stickbait" },
    { "id": "jOkHsNnOKgnP6tILlD3s", "label": "Benthique - Larve" },
    { "id": "jvCqKgsD9KjoAqlWj7cw", "label": "Réactif - Spinnerbait" },
    { "id": "qht4ijK7gkIedfwZGC6r", "label": "Topwater - Popper" },
    { "id": "z6FLbpCGms9BwXORuG8t", "label": "Finesse - Slug" }
  ],
  "ref_colors": [
    { "id": "17zEfSlc3YG6ZeE61bs1", "label": "Flashy - Firetiger" },
    { "id": "4rOjm4rejQFmu9X7GXlJ", "label": "Naturel - Watermelon" },
    { "id": "CKMfyLqNDxHO8GZPBQrQ", "label": "Naturel - Noir" },
    { "id": "INejUbsgGkqWvAy9ZfOY", "label": "Non défini" },
    { "id": "bQcqjwmXm8bHG2a5Wbyy", "label": "Flashy - Blanc" },
    { "id": "eJMr0eFiXaD8uzU6twu4", "label": "Flashy - Chartreuse" },
    { "id": "lG4BIPHe6LnSWXEgqHlN", "label": "Naturel - Brown" },
    { "id": "mF5WGl35RoKScLN0fbZG", "label": "Spécial Seine - Motor Oil / UV" },
    { "id": "q2TaAWJQon0ph4vsbICW", "label": "Flashy - Rose" },
    { "id": "wQkFF3TND9xsfIpdp3No", "label": "Naturel - Green Pumpkin" }
  ],
  "ref_sizes": [
    { "id": "T6g9OLgmeNuRyR3Dv6RI", "label": "2\" - 3\"" },
    { "id": "Uyw0lhnwmFn7Ry7GXsFb", "label": "3\" - 4.5\"" },
    { "id": "gJyYD3wQkWsY7mgKBXYl", "label": "< 2\"" },
    { "id": "ksBDdO8hvLM2tehqSfRI", "label": "5\"+" },
    { "id": "mZ8WzzxnAiJw5cY76B2C", "label": "N/A" }
  ],
  "ref_weights": [
    { "id": "NmKwdOXb58n2nDQXMZvq", "label": "15 - 20g" },
    { "id": "PoJHZSOWRytVhmuX1lyh", "label": "10 - 14g" },
    { "id": "XQNYOXo0xfxBNZQCw7El", "label": "5 - 9g" },
    { "id": "fGz8nToHgkQp9NtMqITl", "label": "21g+" },
    { "id": "tNUfAwCeye7kBnA2HaD5", "label": "N/A" },
    { "id": "vQ3rLwinuDXQgUVNL08K", "label": "< 5g" }
  ],
  "techniques": [
    { "id": "1qSU5V4XBt88IlF41Xnn", "label": "Animation Saccadée - Twitching / Jerking" },
    { "id": "3PZSalqWDqmvyY5QjZlp", "label": "Contact Fond - Carolina Rig" },
    { "id": "44F1Tvs6POHSKzSFXb60", "label": "Contact Fond - Cheburashka" },
    { "id": "7suco47G5clt3wOVuiWE", "label": "Animation Saccadée - Darting" },
    { "id": "KwHAdwwUCcfG6zG0EEFB", "label": "Animation Saccadée - Walking The Dog" },
    { "id": "MygMhsApMSNvUeLKDfAg", "label": "Animation Saccadée - Drop Shot" },
    { "id": "VxABw8Bd395fuO5ZEZsY", "label": "Inconnu - Je ne m’en souviens pas" },
    { "id": "Z7nUbumpt6HGTYkPZsCD", "label": "Contact Fond - Drop Shot" },
    { "id": "ZwNy9AjW0qsd3Giooi7J", "label": "Linéaire - Cranking" },
    { "id": "b7GKMwQh5DLch3I50nGd", "label": "Contact Fond - Grattage (TP)" },
    { "id": "cNV9cLtom2Q9Mwyy7LZk", "label": "Linéaire - Lancer-Ramener" },
    { "id": "wKx6z9l3q4Ek3Ckzp9kC", "label": "Linéaire - Slow Rolling" }
  ],
  "zones": [
    { "id": "3Wtml8vOk6MCmlJkbR6o", "label": "Spot C - Avant pont piétonnier" },
    { "id": "5HawnkwcPvzKFdbF3NvX", "label": "Spot F - Piles du grand pont" },
    { "id": "6A1D7YPPyY7tD5B79kCm", "label": "Spot H -" },
    { "id": "A03uiL4NbKHioTDVqaDj", "label": "Spot B - Profond" },
    { "id": "Qs42yq3rWBG2eeRulRIJ", "label": "Spot G - Après grand pont" },
    { "id": "bjOTNhO9JqF1H6vIAiuI", "label": "Spot D - Après pont piétonnier" },
    { "id": "m2nLPs6WYcU5DfQDzAy5", "label": "Spot F - Zone très hollow" },
    { "id": "rBnxzUFa1ryOmXLBshh2", "label": "Spot E - Zone hollow ouverte" },
    { "id": "tXnerT4D8elagfFB6YZc", "label": "Spot A - Proche ruine béton" }
  ]
};

// ---------------------------------------------------------------------------
// 3. LOGIQUE DE MIGRATION
// ---------------------------------------------------------------------------

const migrateCollection = async (firebaseCollectionName: string, items: any[]) => {
  if (!items || items.length === 0) return;

  console.log(`\n🚀 Traitement de : ${firebaseCollectionName} (${items.length} items)`);
  const batch = db.batch();
  let addedCount = 0;
  let skippedCount = 0;

  for (const item of items) {
    const docRef = db.collection(firebaseCollectionName).doc(item.id);
    
    // Vérification existence
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      const payload = {
        id: item.id,
        userId: TARGET_USER_ID,
        active: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        label: item.label,
        // Ajout spécifique pour les spots s'ils n'ont pas de type défini
        ...(firebaseCollectionName === 'spots' ? { type: 'Fleuve' } : {}) 
      };

      batch.set(docRef, payload);
      process.stdout.write('+'); // Ajouté
      addedCount++;
    } else {
      process.stdout.write('.'); // Ignoré
      skippedCount++;
    }
  }

  if (addedCount > 0) {
    await batch.commit();
    console.log(`\n✅ ${addedCount} documents restaurés/créés dans ${firebaseCollectionName}.`);
  }
  
  if (skippedCount > 0) {
    console.log(`ℹ️  ${skippedCount} documents existaient déjà (ignorés).`);
  }
};

const runMigration = async () => {
  try {
    console.log(`🔧 RESTAURATION ARSENAL V3.1 - Target User: ${TARGET_USER_ID}`);
    console.log("------------------------------------------------");

    await migrateCollection('ref_lure_types', SOURCE_DATA.ref_lure_types);
    await migrateCollection('ref_colors', SOURCE_DATA.ref_colors);
    await migrateCollection('ref_sizes', SOURCE_DATA.ref_sizes);
    await migrateCollection('ref_weights', SOURCE_DATA.ref_weights);
    await migrateCollection('techniques', SOURCE_DATA.techniques);
    await migrateCollection('spots', SOURCE_DATA.zones);

    console.log("\n------------------------------------------------");
    console.log("🎉 Migration terminée.");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Erreur pendant la migration :", error);
    process.exit(1);
  }
};

runMigration();