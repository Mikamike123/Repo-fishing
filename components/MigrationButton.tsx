import React, { useState } from 'react';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';

const MigrationButton = () => {
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [count, setCount] = useState(0);

    const runMigration = async () => {
        if (!window.confirm("Lancer la migration des spots vers Nanterre ?")) return;
        
        setStatus('loading');
        try {
            const GOLDEN_SECTOR_ID = import.meta.env.VITE_GOLDEN_SECTOR_ID; // ID de "Nanterre - Gold standard"
            const batch = writeBatch(db);
            
            // 1. Récupérer tous les spots (collection 'zones')
            const snapshot = await getDocs(collection(db, 'zones'));
            let operations = 0;

            snapshot.docs.forEach((document) => {
                const data = document.data();
                // Si le spot n'a pas de locationId ou s'il est vide
                if (!data.locationId) {
                    const ref = doc(db, 'zones', document.id);
                    batch.update(ref, { locationId: GOLDEN_SECTOR_ID });
                    operations++;
                }
            });

            // 2. Exécuter
            if (operations > 0) {
                await batch.commit();
                setCount(operations);
                setStatus('success');
            } else {
                setCount(0);
                setStatus('success'); // Succès même si rien à faire
                alert("Aucun spot nécessitant une migration n'a été trouvé.");
            }

        } catch (e) {
            console.error(e);
            setStatus('error');
        }
    };

    return (
        <button 
            onClick={runMigration}
            disabled={status === 'loading' || status === 'success'}
            className={`fixed bottom-4 left-4 z-50 px-4 py-2 rounded-full shadow-xl font-bold text-xs flex items-center gap-2 transition-all ${
                status === 'success' ? 'bg-green-500 text-white' : 
                status === 'error' ? 'bg-red-500 text-white' : 
                'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
        >
            {status === 'loading' && <RefreshCw className="animate-spin" size={14} />}
            {status === 'success' && <CheckCircle size={14} />}
            {status === 'error' && <AlertTriangle size={14} />}
            {status === 'idle' && "MIGRATION SPOTS NANTERRE"}
            {status === 'success' && `${count} Spots Migrés !`}
        </button>
    );
};

export default MigrationButton;