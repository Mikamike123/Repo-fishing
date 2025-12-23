import React, { useRef, useState } from 'react';
import { Wand2, Loader2 } from 'lucide-react';
import { extractSessionDraft } from '../lib/discovery-service';
import { httpsCallable } from 'firebase/functions';
import { functions, storage, USER_ID } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

interface MagicScanButtonProps {
    onDiscoveryComplete: (draft: any) => void;
    userPseudo: string;
    lureTypes: any[]; 
    colors: any[];    
}

const MagicScanButton: React.FC<MagicScanButtonProps> = ({ 
    onDiscoveryComplete, 
    userPseudo, 
    lureTypes, 
    colors 
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        try {
            // 1. Extraction Temporelle (EXIF)
            const draft: any = await extractSessionDraft(file);

            // 2. Préparation Base64 pour l'IA
            const reader = new FileReader();
            const base64Promise = new Promise<string>((resolve) => {
                reader.onload = (ev) => resolve((ev.target?.result as string).split(',')[1]);
                reader.readAsDataURL(file);
            });
            const base64 = await base64Promise;

            // 3. Construction de l'objet referentials pour l'IA Oracle Vision
            const referentials = {
                lureTypes: lureTypes.map(l => ({ id: l.id, label: l.label })),
                colors: colors.map(c => ({ id: c.id, label: c.label }))
            };

            // 4. Appel Cloud Function
            const analyzePromise = httpsCallable(functions, 'analyzeCatchImage')({ 
                image: base64, 
                userPseudo, 
                referentials 
            });

            // 5. Upload Storage
            const storageRef = ref(storage, `catches/${USER_ID}/magic_${Date.now()}_${file.name.replace(/\s/g, '_')}`);
            const uploadPromise = uploadBytes(storageRef, file);

            const [aiResult, uploadResult] = await Promise.all([analyzePromise, uploadPromise]);
            const downloadUrl = await getDownloadURL(uploadResult.ref);
            const aiData: any = aiResult.data;

            // 6. On complète le brouillon avec la prise analysée
            draft.initialCatch = {
                id: `magic_${Date.now()}`,
                species: aiData.species || 'Inconnu',
                size: aiData.size || 30,
                lureTypeId: aiData.lureTypeId || '',
                lureColorId: aiData.lureColorId || '',
                photoUrls: [downloadUrl],
                time: draft.startTime, // Par défaut au début de session
                lureName: 'Identifié par Oracle Vision'
            };

            onDiscoveryComplete(draft);
        } catch (err) {
            console.error("Échec du Magic Scan:", err);
            alert("L'Oracle a eu un problème technique. Vérifie ta connexion.");
        } finally {
            setIsLoading(false);
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    return (
        <>
            <input type="file" ref={fileRef} className="hidden" accept="image/*" onChange={handleFile} />
            <button 
                type="button"
                onClick={() => !isLoading && fileRef.current?.click()}
                className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-orange-200 flex items-center justify-center active:scale-95 transition-all"
                title="Scanner une photo"
            >
                {isLoading ? <Loader2 className="animate-spin" size={24} /> : <Wand2 size={24} />}
            </button>
        </>
    );
};

export default MagicScanButton;