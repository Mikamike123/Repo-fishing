// components/ArsenalView.tsx - Version 3.3 (Wide-Responsive & Ultra-Visibility)
import React, { useState, useMemo } from 'react';
import { Anchor, Crosshair, Plus, Edit2, Check, Palette, Ruler, Scale, Fish, Lock, Archive, ChevronUp, ChevronDown } from 'lucide-react';
import { Setup, Technique, RefLureType, RefColor, RefSize, RefWeight } from '../types';

interface ArsenalViewProps {
  // SETUPS
  setups: Setup[];
  onAddSetup: (label: string) => void;
  onDeleteSetup: (id: string) => void;
  onEditSetup: (id: string, label: string) => void;
  onMoveSetup: (id: string, direction: 'up' | 'down') => void;

  // TECHNIQUES
  techniques: Technique[];
  onAddTechnique: (label: string) => void;
  onDeleteTechnique: (id: string) => void;
  onEditTechnique: (id: string, label: string) => void;
  onMoveTechnique: (id: string, direction: 'up' | 'down') => void;
  
  // --- COLLECTIONS LEURRES ---
  lureTypes: RefLureType[];
  onAddLureType: (label: string) => void;
  onDeleteLureType: (id: string) => void;
  onEditLureType: (id: string, label: string) => void;
  onMoveLureType: (id: string, direction: 'up' | 'down') => void;
  
  colors: RefColor[];
  onAddColor: (label: string) => void;
  onDeleteColor: (id: string) => void;
  onEditColor: (id: string, label: string) => void;
  onMoveColor: (id: string, direction: 'up' | 'down') => void;
  
  sizes: RefSize[];
  onAddSize: (label: string) => void;
  onDeleteSize: (id: string) => void;
  onEditSize: (id: string, label: string) => void;
  onMoveSize: (id: string, direction: 'up' | 'down') => void;
  
  weights: RefWeight[];
  onAddWeight: (label: string) => void;
  onDeleteWeight: (id: string) => void;
  onEditWeight: (id: string, label: string) => void;
  onMoveWeight: (id: string, direction: 'up' | 'down') => void;

  // AJOUT SÉCURITÉ
  currentUserId: string; 
}

// --- SECTION GÉNÉRIQUE ---
const ConfigSection: React.FC<{
  title: string;
  icon: React.ReactNode;
  items: any[];
  onAdd: (label: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, label: string) => void;
  onMove: (id: string, direction: 'up' | 'down') => void;
  placeholder: string;
  colorClass: string;
  isReadOnly: boolean;
}> = ({ title, icon, items, onAdd, onDelete, onEdit, onMove, placeholder, colorClass, isReadOnly }) => {
  const [newItemLabel, setNewItemLabel] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState('');

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const orderA = a.displayOrder ?? 999;
      const orderB = b.displayOrder ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      return (a.label || '').localeCompare(b.label || '');
    });
  }, [items]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newItemLabel.trim()) {
      onAdd(newItemLabel.trim());
      setNewItemLabel('');
    }
  };

  return (
    <div className="bg-white rounded-[2.5rem] p-6 lg:p-8 shadow-sm border border-stone-100 relative overflow-hidden h-full flex flex-col transition-all duration-300">
      {isReadOnly && (
        <div className="absolute top-6 right-6 text-stone-300"><Lock size={16} /></div>
      )}

      <div className={`flex items-center gap-4 mb-8 ${colorClass}`}>
        <div className="p-3 rounded-2xl bg-stone-50 border border-stone-100 shadow-sm">{icon}</div>
        <h3 className="font-black text-xl text-stone-800 tracking-tight italic uppercase">{title}</h3>
      </div>
      
      <ul className="space-y-3 mb-6 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin flex-1">
        {sortedItems.map((item, index) => (
          <li key={item.id} className="flex justify-between items-center bg-stone-50/50 p-4 rounded-2xl border border-stone-100 group hover:border-amber-200 hover:bg-white transition-all duration-200">
            {editingId === item.id && !isReadOnly ? (
              <div className="flex flex-1 gap-2">
                <input value={editingLabel} onChange={(e) => setEditingLabel(e.target.value)} className="flex-1 px-3 py-2 rounded-xl border border-amber-300 text-sm outline-none shadow-inner" autoFocus />
                <button onClick={() => { onEdit(item.id, editingLabel); setEditingId(null); }} className="text-emerald-600 bg-emerald-50 p-2 rounded-xl border border-emerald-100"><Check size={18}/></button>
              </div>
            ) : (
              <>
                <span className="font-bold text-stone-600 text-sm flex-1 pr-4 leading-relaxed">{item.label}</span>
                
                {!isReadOnly && (
                    <div className="flex gap-2 items-center shrink-0">
                        <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                            {index > 0 && (
                                <button onClick={() => onMove(item.id, 'up')} className="p-1 hover:bg-stone-200 rounded text-stone-400 hover:text-stone-700">
                                    <ChevronUp size={14} strokeWidth={3} />
                                </button>
                            )}
                            {index < sortedItems.length - 1 && (
                                <button onClick={() => onMove(item.id, 'down')} className="p-1 hover:bg-stone-200 rounded text-stone-400 hover:text-stone-700">
                                    <ChevronDown size={14} strokeWidth={3} />
                                </button>
                            )}
                        </div>
                        <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity pl-3 border-l border-stone-200">
                            <button onClick={() => { setEditingId(item.id); setEditingLabel(item.label); }} className="p-2 text-stone-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-colors"><Edit2 size={14}/></button>
                            <button title="Archiver" onClick={() => onDelete(item.id)} className="p-2 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"><Archive size={14}/></button>
                        </div>
                    </div>
                )}
              </>
            )}
          </li>
        ))}
        {items.length === 0 && <div className="text-center text-xs text-stone-300 italic py-8">Aucune donnée configurée</div>}
      </ul>

      {!isReadOnly ? (
          <form onSubmit={handleSubmit} className="flex gap-3 mt-auto pt-4 border-t border-stone-50">
            <input 
              type="text" 
              value={newItemLabel} 
              onChange={(e) => setNewItemLabel(e.target.value)} 
              placeholder={placeholder}
              className="flex-1 bg-stone-50 border border-stone-200 rounded-2xl px-5 py-4 text-sm font-medium outline-none focus:ring-4 focus:ring-amber-500/10 focus:bg-white focus:border-amber-200 transition-all shadow-inner"
            />
            <button 
              type="submit" 
              disabled={!newItemLabel.trim()}
              className="p-4 bg-stone-900 text-white rounded-2xl hover:bg-amber-600 disabled:opacity-20 transition-all shadow-lg active:scale-95"
            >
              <Plus size={20} />
            </button>
          </form>
      ) : (
          <div className="text-center py-3 text-[10px] text-stone-400 font-black uppercase tracking-[0.2em] bg-stone-50 rounded-2xl border border-dashed border-stone-200">
              Lecture Seule • Admin Uniquement
          </div>
      )}
    </div>
  );
};

const ArsenalView: React.FC<ArsenalViewProps> = (props) => {
  const ADMIN_ID = "user_1";
  const isReadOnly = props.currentUserId !== ADMIN_ID;

  return (
    <div className="pb-32 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-[1600px] mx-auto">
      <div className="mb-10 px-6">
        <div className="flex justify-between items-center bg-white p-6 rounded-[2.5rem] border border-stone-100 shadow-sm">
            <div className="flex items-center gap-5">
                <div className="p-4 bg-stone-900 rounded-[1.5rem] text-white shadow-xl shadow-stone-200"><Anchor size={32} /></div>
                <div>
                    <h2 className="text-3xl font-black text-stone-800 tracking-tighter uppercase italic leading-none">
                        Arsenal V3.1
                    </h2>
                    <p className="text-sm text-stone-400 mt-2 font-bold uppercase tracking-widest">
                        {isReadOnly ? "Référentiels Globaux" : "Configuration du Système"}
                    </p>
                </div>
            </div>
            {isReadOnly && (
                <div className="hidden sm:flex px-4 py-2 bg-amber-50 text-amber-600 border border-amber-100 rounded-2xl text-xs font-black uppercase tracking-widest items-center gap-2">
                    <Lock size={14} /> Sécurisé
                </div>
            )}
        </div>
      </div>

      {/* Michael : Nouvelle grille intelligente : 1 col mobile, 1 col tablette portrait, 2 cols large, 3 cols ultra-large */}
      <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-8 px-6">
        
        <ConfigSection 
          isReadOnly={isReadOnly} 
          title="Techniques" 
          icon={<Crosshair size={24}/>} 
          items={props.techniques} 
          onAdd={props.onAddTechnique} 
          onDelete={props.onDeleteTechnique} 
          onEdit={props.onEditTechnique} 
          onMove={props.onMoveTechnique} 
          placeholder="Ex: Verticale, Linéaire..." 
          colorClass="text-emerald-600" 
        />

        <ConfigSection 
          isReadOnly={isReadOnly} 
          title="Types de Leurre" 
          icon={<Fish size={24}/>} 
          items={props.lureTypes} 
          onAdd={props.onAddLureType} 
          onDelete={props.onDeleteLureType} 
          onEdit={props.onEditLureType} 
          onMove={props.onMoveLureType} 
          placeholder="Ex: Soft Bait, Hard Bait..." 
          colorClass="text-indigo-600" 
        />

        <ConfigSection 
          isReadOnly={isReadOnly} 
          title="Couleurs" 
          icon={<Palette size={24}/>} 
          items={props.colors} 
          onAdd={props.onAddColor} 
          onDelete={props.onDeleteColor} 
          onEdit={props.onEditColor} 
          onMove={props.onMoveColor} 
          placeholder="Ex: Coloris Naturel..." 
          colorClass="text-purple-600" 
        />

        <ConfigSection 
          isReadOnly={isReadOnly} 
          title="Tailles" 
          icon={<Ruler size={24}/>} 
          items={props.sizes} 
          onAdd={props.onAddSize} 
          onDelete={props.onDeleteSize} 
          onEdit={props.onEditSize} 
          onMove={props.onMoveSize} 
          placeholder='Ex: 4", 5", 12cm...' 
          colorClass="text-orange-600" 
        />

        <ConfigSection 
          isReadOnly={isReadOnly} 
          title="Poids" 
          icon={<Scale size={24}/>} 
          items={props.weights} 
          onAdd={props.onAddWeight} 
          onDelete={props.onDeleteWeight} 
          onEdit={props.onEditWeight} 
          onMove={props.onMoveWeight} 
          placeholder="Ex: 7g, 10g, 21g..." 
          colorClass="text-cyan-600" 
        />

        <ConfigSection 
          isReadOnly={isReadOnly} 
          title="Équipements" 
          icon={<Anchor size={24}/>} 
          items={props.setups} 
          onAdd={props.onAddSetup} 
          onDelete={props.onDeleteSetup} 
          onEdit={props.onEditSetup} 
          onMove={props.onMoveSetup} 
          placeholder="Ex: Combo MH Casting..." 
          colorClass="text-stone-600" 
        />
        
      </div>
    </div>
  );
};

export default ArsenalView;