import * as fs from 'fs';
import * as path from 'path';

// On définit la structure de nos données (doit correspondre au JSON)
interface CleanData {
  date: string;
  debit: number;
  niveau: number | null;
}

function analyzeData() {
  // On va chercher le fichier fishing-data.json généré par le script précédent
  const filePath = path.join(process.cwd(), 'fishing-data.json');

  if (!fs.existsSync(filePath)) {
    console.error("❌ Pas de fichier fishing-data.json trouvé ! Lancez d'abord l'import.");
    return;
  }

  // Chargement des données
  const rawData = fs.readFileSync(filePath, 'utf-8');
  const data: CleanData[] = JSON.parse(rawData);

  console.log(`📊 ANALYSE SUR ${data.length} JOURS ENREGISTRÉS\n`);

  // --- 1. Trouver les Extremes ---
  
  // Tri par DÉBIT (du plus grand au plus petit)
  const sortedByDebit = [...data].sort((a, b) => b.debit - a.debit);
  const maxDebit = sortedByDebit[0];
  const minDebit = sortedByDebit[sortedByDebit.length - 1];

  // Tri par NIVEAU (en filtrant les valeurs nulles)
  const sortedByNiveau = [...data]
    .filter(d => d.niveau !== null)
    .sort((a, b) => (b.niveau as number) - (a.niveau as number));
    
  const maxNiveau = sortedByNiveau[0];
  const minNiveau = sortedByNiveau[sortedByNiveau.length - 1];

  // --- 2. Affichage des résultats ---

  console.log("🌊 DÉBIT (Courant)");
  // Division par 1000 si les données sont en l/s pour avoir des m3/s (standard hydrologique)
  console.log(`   - 🚀 Max : ${(maxDebit.debit / 1000).toFixed(2)} m³/s (le ${maxDebit.date})`);
  console.log(`   - 🐌 Min : ${(minDebit.debit / 1000).toFixed(2)} m³/s (le ${minDebit.date})`);
  
  console.log("\n📏 NIVEAU D'EAU");
  // Division par 1000 si les données sont en mm pour avoir des mètres
  console.log(`   - 📈 Plus haut : ${(maxNiveau.niveau! / 1000).toFixed(2)} m (le ${maxNiveau.date})`);
  console.log(`   - 📉 Plus bas  : ${(minNiveau.niveau! / 1000).toFixed(2)} m (le ${minNiveau.date})`);

  // --- 3. Moyenne ---
  const totalDebit = data.reduce((acc, curr) => acc + curr.debit, 0);
  const avgDebit = totalDebit / data.length;
  
  console.log(`\n⚖️  DÉBIT MOYEN GLOBAL : ${(avgDebit / 1000).toFixed(2)} m³/s`);
}

analyzeData();