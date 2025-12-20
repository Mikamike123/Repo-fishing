// components/MigrationTool.tsx
import React, { useState } from 'react';
import { db } from '../lib/firebase'; // Assure-toi que le chemin est bon
import { collection, getDocs, writeBatch, doc, deleteDoc } from 'firebase/firestore';
import { Database, Trash2, Save, CheckCircle, AlertTriangle } from 'lucide-react';

const ARSENAL_COLLECTIONS = [
  'zones', 
  'setups', 
  'techniques', 
  'ref_lure_types', 
  'ref_colors', 
  'ref_sizes', 
  'ref_weights',
  'lures' // Si tu as une collection d'inventaire
];

export const MigrationTool = () => {
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const ADMIN_ID = "user_1"; // Ton ID administrateur

  const runMigration = async () => {
    if (!window.confirm("ATTENTION : Ceci va SUPPRIMER toutes les sessions et mettre à jour l'Arsenal. Es-tu sûr ?")) return;
    
    setLoading(true);
    setStatus('Démarrage de la migration...');

    try {
      // 1. SUPPRESSION DES SESSIONS (Nettoyage)
      setStatus('Suppression des sessions en cours...');
      const sessionsRef = collection(db, 'sessions');
      const sessionSnapshot = await getDocs(sessionsRef);
      
      // On supprime un par un (Firestore client ne permet pas de supprimer une collection entière d'un coup)
      const deletePromises = sessionSnapshot.docs.map(document => deleteDoc(doc(db, 'sessions', document.id)));
      await Promise.all(deletePromises);
      
      setStatus(`✅ ${sessionSnapshot.size} sessions supprimées.`);

      // 2. MISE À JOUR DE L'ARSENAL (Ajout userId)
      setStatus("Mise à jour de l'Arsenal en cours...");
      
      let totalUpdated = 0;

      // On boucle sur chaque collection de l'arsenal
      for (const colName of ARSENAL_COLLECTIONS) {
        const colRef = collection(db, colName);
        const snapshot = await getDocs(colRef);
        
        if (snapshot.empty) continue;

        // On utilise un batch pour grouper les écritures (plus performant)
        const batch = writeBatch(db);
        
        snapshot.docs.forEach((document) => {
          const docRef = doc(db, colName, document.id);
          // On ajoute userId, on garde le reste
          batch.update(docRef, { userId: ADMIN_ID }); 
        });

        await batch.commit();
        totalUpdated += snapshot.size;
        setStatus(prev => prev + `\n -> Collection '${colName}' mise à jour (${snapshot.size} items).`);
      }

      setStatus(prev => prev + `\n\n🎉 MIGRATION TERMINÉE AVEC SUCCÈS ! \nArsenal mis à jour (${totalUpdated} items). Sessions vidées.`);

    } catch (error) {
      console.error(error);
      setStatus('ERREUR CRITIQUE : Voir la console pour les détails.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-900/90 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border-4 border-amber-500">
        <div className="flex items-center gap-3 mb-6 text-amber-600">
          <Database size={32} />
          <h2 className="text-2xl font-black uppercase">Migration V3.3</h2>
        </div>

        <div className="bg-stone-100 p-4 rounded-xl mb-6 text-sm font-mono whitespace-pre-line h-48 overflow-y-auto border border-stone-200">
          {status || "En attente d'action..."}
        </div>

        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-red-50 text-red-700 rounded-xl border border-red-100">
            <AlertTriangle className="shrink-0" />
            <p className="text-xs font-bold">Action irréversible : Suppression totale de l'historique des sessions pour repartir à zéro.</p>
          </div>

          <button 
            onClick={runMigration} 
            disabled={loading}
            className="w-full py-4 bg-stone-800 hover:bg-black text-white rounded-xl font-bold flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Traitement en cours...' : (
              <>
                <Trash2 size={20} /> Supprimer Sessions
                <span className="opacity-50">|</span>
                <Save size={20} /> Migrer Arsenal
              </>
            )}
          </button>
          
          <p className="text-center text-[10px] text-stone-400 uppercase tracking-widest">
            Outil Admin • Fishing Oracle
          </p>
        </div>
      </div>
    </div>
  );
};