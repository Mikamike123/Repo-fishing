// components/DeleteConfirmDialog.tsx
import React, { useMemo } from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface DeleteConfirmDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title?: string;
    // Michael : Ajout d'une prop pour passer les messages de deletionMessages.ts
    customMessages?: string[];
}

const SARDONIC_MESSAGES = [
    "Tu sais ce que tu fais mon grand ? Si tu confirmes, pouf, plus de session, plus de poissons.",
    "Aller, avoue... C'est parce que t'as fait capot que tu veux l'effacer de l'histoire ?",
    "C'est ton choix, mais sache que les dieux de la pêche te jugent en ce moment même.",
    "T'es sûr de toi ? C'est pas comme un CTRL+Z sur ton doc word, là c'est pour de vrai.",
    "On efface les preuves ? T'inquiète, ça restera entre nous (et la base de données).",
    "Vraiment ? C'était si moche que ça ? Allez, promis, on ne dira rien à personne.",
    "Attention zone de danger. Un clic de trop et c'est le néant numérique pour cette sortie.",
    "T'as le doigt qui tremble ou tu es vraiment décidé à balancer cette session aux oubliettes ?",
    "En cliquant sur Oui, tu acceptes de perdre tes souvenirs. C'est dur, la vie de pêcheur amateur.",
    "Bon, ok. Mais ne viens pas pleurer si tu voulais juste modifier une faute de frappe."
];

const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({ 
    isOpen, 
    onClose, 
    onConfirm, 
    title = "Supprimer la session ?",
    customMessages
}) => {
    
    // Michael : Sélectionne un message dans la liste fournie ou dans la liste par défaut
    const randomMessage = useMemo(() => {
        if (!isOpen) return "";
        const pool = customMessages && customMessages.length > 0 ? customMessages : SARDONIC_MESSAGES;
        const randomIndex = Math.floor(Math.random() * pool.length);
        return pool[randomIndex];
    }, [isOpen, customMessages]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 h-full w-full">
            <div 
                className="absolute inset-0 bg-stone-900/30 backdrop-blur-sm transition-opacity" 
                onClick={onClose} 
            />
            
            <div className="relative bg-[#FFFCF8] w-full max-w-xs rounded-[2rem] shadow-2xl shadow-amber-100/50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-amber-100/50">
                <div className="p-6 text-center">
                    <div className="mx-auto w-14 h-14 bg-amber-50 rounded-[1.5rem] flex items-center justify-center mb-4 border border-amber-100 rotate-6 group overflow-hidden relative transition-all hover:rotate-0">
                        <div className="absolute inset-0 bg-orange-100/50 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                        <AlertTriangle size={24} className="text-amber-500 relative z-10" />
                    </div>
                    
                    <h3 className="text-lg font-black text-stone-800 uppercase tracking-tight mb-3">
                        {title}
                    </h3>
                    
                    <p className="text-stone-600 text-sm font-medium leading-snug mb-6 italic px-2">
                        "{randomMessage}"
                    </p>

                    <div className="flex flex-col gap-2.5">
                        <button
                            onClick={onConfirm}
                            className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-black text-sm uppercase tracking-wide shadow-lg shadow-amber-200/50 active:scale-[0.98] transition-all"
                        >
                            Oui, je supprime
                        </button>
                        
                        <button
                            onClick={onClose}
                            className="w-full py-3.5 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-2xl font-black text-sm uppercase tracking-wide active:scale-[0.98] transition-all"
                        >
                            Annuler
                        </button>
                    </div>
                </div>

                <button 
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-stone-300 hover:text-amber-500 transition-colors bg-white/50 rounded-full hover:bg-amber-50"
                >
                    <X size={18} />
                </button>
            </div>
        </div>
    );
};

export default DeleteConfirmDialog;