// lib/useArsenal.ts
import { useState, useEffect } from 'react';
import { 
  collection, query, where, orderBy, onSnapshot, 
  addDoc, updateDoc, deleteDoc, doc, Timestamp, writeBatch 
} from 'firebase/firestore';
import { db } from './firebase';
import { AppData, Location, Spot, Setup, Technique, RefLureType, RefColor, RefSize, RefWeight } from '../types';

export const useArsenal = (currentUserId: string) => {
    const [arsenalData, setArsenalData] = useState<AppData>({
        locations: [], 
        spots: [], setups: [], techniques: [], lures: [], 
        lureTypes: [], colors: [], sizes: [], weights: []
    });

    // --- CHARGEMENT DES DONNÉES ---
    useEffect(() => {
        const getQuery = (colName: string) => query(
            collection(db, colName), 
            where('userId', '==', currentUserId), 
            where('active', '==', true),          
            orderBy('label')                      
        );

        const unsubLocations = onSnapshot(getQuery('locations'), (snap) => setArsenalData(prev => ({ ...prev, locations: snap.docs.map(d => ({ id: d.id, ...d.data() } as Location)) })));
        const unsubSpots = onSnapshot(getQuery('zones'), (snap) => setArsenalData(prev => ({ ...prev, spots: snap.docs.map(d => ({ id: d.id, ...d.data() } as Spot)) })));
        const unsubSetups = onSnapshot(getQuery('setups'), (snap) => setArsenalData(prev => ({ ...prev, setups: snap.docs.map(d => ({ id: d.id, ...d.data() } as Setup)) })));
        const unsubTechs = onSnapshot(getQuery('techniques'), (snap) => setArsenalData(prev => ({ ...prev, techniques: snap.docs.map(d => ({ id: d.id, ...d.data() } as Technique)) })));
        const unsubLureTypes = onSnapshot(getQuery('ref_lure_types'), (snap) => setArsenalData(prev => ({ ...prev, lureTypes: snap.docs.map(d => ({ id: d.id, ...d.data() } as RefLureType)) })));
        const unsubColors = onSnapshot(getQuery('ref_colors'), (snap) => setArsenalData(prev => ({ ...prev, colors: snap.docs.map(d => ({ id: d.id, ...d.data() } as RefColor)) })));
        const unsubSizes = onSnapshot(getQuery('ref_sizes'), (snap) => setArsenalData(prev => ({ ...prev, sizes: snap.docs.map(d => ({ id: d.id, ...d.data() } as RefSize)) })));
        const unsubWeights = onSnapshot(getQuery('ref_weights'), (snap) => setArsenalData(prev => ({ ...prev, weights: snap.docs.map(d => ({ id: d.id, ...d.data() } as RefWeight)) })));
        
        return () => { unsubLocations(); unsubSpots(); unsubSetups(); unsubTechs(); unsubLureTypes(); unsubColors(); unsubSizes(); unsubWeights(); };
    }, [currentUserId]);

    // --- CRUD ACTIONS ---

    // Ajout générique (avec support extraData pour GPS etc.)
    const handleAddItem = async (col: string, label: string, extraData?: any) => {
        if (!label.trim()) return;
        try { 
            await addDoc(collection(db, col), { 
                label: label.trim(), 
                userId: currentUserId, 
                active: true,        
                displayOrder: 999, 
                createdAt: Timestamp.now(),
                ...extraData 
            }); 
        } catch (e) { console.error(e); }
    };

    // Suppression (Soft Delete)
    // MODIFICATION : Retrait de window.confirm pour laisser l'UI gérer la confirmation
    const handleDeleteItem = async (col: string, id: string) => { 
        try { 
            await updateDoc(doc(db, col, id), { 
                active: false, 
                updatedAt: Timestamp.now() 
            }); 
        } catch (e) { console.error(e); } 
    };

    // Édition Générique (La clé pour ton problème GPS)
    const handleEditItem = async (col: string, id: string, label: string, extraData?: any) => { 
        try { 
            const payload: any = { label, updatedAt: Timestamp.now(), ...extraData };
            await updateDoc(doc(db, col, id), payload); 
        } catch (e) { console.error(e); } 
    };

    // Toggle Favoris (Spécifique Locations)
    const handleToggleLocationFavorite = async (location: Location) => {
        try {
            await updateDoc(doc(db, 'locations', location.id), {
                isFavorite: !location.isFavorite,
                updatedAt: Timestamp.now()
            });
        } catch (e) { console.error("Erreur toggle favori:", e); }
    };

    // Reorder (Tri)
    const handleMoveItem = async (colName: string, id: string, direction: 'up' | 'down') => {
        let items: any[] = [];
        // AJOUT : Support du tri pour les Locations
        if (colName === 'locations') items = arsenalData.locations; 
        else if (colName === 'zones') items = arsenalData.spots;
        else if (colName === 'setups') items = arsenalData.setups;
        else if (colName === 'techniques') items = arsenalData.techniques;
        else if (colName === 'ref_lure_types') items = arsenalData.lureTypes;
        else if (colName === 'ref_colors') items = arsenalData.colors;
        else if (colName === 'ref_sizes') items = arsenalData.sizes;
        else if (colName === 'ref_weights') items = arsenalData.weights;
        
        if (items.length < 2) return;

        const sortedItems = [...items].sort((a, b) => {
            const orderA = a.displayOrder ?? 999;
            const orderB = b.displayOrder ?? 999;
            if (orderA !== orderB) return orderA - orderB;
            return (a.label || '').localeCompare(b.label || '');
        });

        const currentIndex = sortedItems.findIndex(i => i.id === id);
        if (currentIndex === -1) return;

        const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (newIndex < 0 || newIndex >= sortedItems.length) return; 

        const temp = sortedItems[currentIndex];
        sortedItems[currentIndex] = sortedItems[newIndex];
        sortedItems[newIndex] = temp;

        const batch = writeBatch(db);
        sortedItems.forEach((item, index) => {
            const ref = doc(db, colName, item.id);
            batch.update(ref, { displayOrder: index });
        });

        try { await batch.commit(); } catch (e) { console.error("Erreur tri:", e); }
    };

    return {
        arsenalData,
        handleAddItem,
        handleDeleteItem,
        handleEditItem,
        handleMoveItem,
        handleToggleLocationFavorite
    };
};