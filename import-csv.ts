import * as fs from 'fs';
import * as path from 'path';

interface DataRow {
  [key: string]: string;
}

// Structure finale propre qu'on veut obtenir
interface CleanData {
  date: string;
  debit: number;
  niveau: number | null;
}

/**
 * Fonction de lecture CSV (votre version validée)
 */
function parseFrenchCSV(fileName: string): DataRow[] {
  const filePath = path.join(process.cwd(), fileName);
  
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Fichier introuvable : ${fileName}`);
    return [];
  }

  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const lines = fileContent.split(/\r?\n/).filter(line => line.trim() !== '');

  if (lines.length === 0) return [];

  const headers = lines[0].split(';').map(h => h.trim().replace(/^"|"$/g, ''));
  const data: DataRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(';').map(v => v.trim().replace(/^"|"$/g, ''));
    if (values.length === headers.length) {
      const row: DataRow = {};
      headers.forEach((h, idx) => row[h] = values[idx]);
      data.push(row);
    }
  }
  return data;
}

// --- PARTIE PRINCIPALE ---

console.log('--- 🚀 Traitement des données Hydro ---');

// 1. Importation
const rawDebits = parseFrenchCSV('debit.csv');
const rawNiveaux = parseFrenchCSV('niveau.csv');

console.log(`Données brutes : ${rawDebits.length} débits, ${rawNiveaux.length} niveaux.`);

// 2. Création d'un dictionnaire pour retrouver les niveaux par date rapidement
// Cela évite de parcourir tout le tableau à chaque fois
const niveauMap = new Map<string, string>();
rawNiveaux.forEach(row => {
  niveauMap.set(row['date_obs_elab'], row['resultat_obs_elab']);
});

// 3. Fusion et Nettoyage
const mergedData: CleanData[] = rawDebits.map(debitRow => {
  const date = debitRow['date_obs_elab'];
  const niveauVal = niveauMap.get(date);

  return {
    date: date,
    // On convertit "252246.0" en nombre réel. 
    debit: parseFloat(debitRow['resultat_obs_elab']),
    // Si on a un niveau pour cette date, on convertit, sinon null
    niveau: niveauVal ? parseFloat(niveauVal) : null
  };
});

// 4. Sauvegarde en JSON
const outputPath = path.join(process.cwd(), 'fishing-data.json');
fs.writeFileSync(outputPath, JSON.stringify(mergedData, null, 2));

console.log(`\n✅ SUCCÈS ! Fichier généré : fishing-data.json`);
console.log(`   Contient ${mergedData.length} entrées fusionnées.`);
console.log(`\nExemple de donnée finale :`);
console.log(mergedData[0]);