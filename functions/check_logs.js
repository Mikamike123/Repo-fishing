// check_logs.js
const admin = require("firebase-admin");

// Initialisation : utilise tes identifiants locaux (voir étape suivante)
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: "mysupstack" // Remplace par ton ID de projet exact si nécessaire
});

const db = admin.firestore();

async function checkLastEntries() {
  console.log("🔍 Recherche des 5 dernières entrées dans 'environmental_logs'...");

  try {
    const snapshot = await db.collection("environmental_logs")
      .orderBy("timestamp", "desc") // Trie par date décroissante
      .limit(5)
      .get();

    if (snapshot.empty) {
      console.log("❌ Aucune entrée trouvée dans la collection.");
      return;
    }

    console.log(`✅ ${snapshot.size} entrée(s) trouvée(s) :\n`);
    
    snapshot.forEach(doc => {
      console.log(`📄 ID: ${doc.id}`);
      console.log(JSON.stringify(doc.data(), null, 2)); // Affiche les données proprement
      console.log("-----------------------------------");
    });

  } catch (error) {
    console.error("❌ Erreur lors de la lecture :", error);
  }
}

checkLastEntries();