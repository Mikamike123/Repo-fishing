import React, { useState } from 'react';
import { MapPin, Anchor, Crosshair, Plus, X, Edit2, Check, Palette, Ruler, Scale, Fish } from 'lucide-react';
import { Spot, Setup, Technique, RefLureType, RefColor, RefSize, RefWeight } from '../types';

interface ArsenalViewProps {
  // SPOTS
  spots: Spot[];
  onAddSpot: (label: string) => void;
  onDeleteSpot: (id: string) => void;
  onEditSpot: (id: string, label: string) => void;
  // SETUPS
  setups: Setup[];
  onAddSetup: (label: string) => void;
  onDeleteSetup: (id: string) => void;
  onEditSetup: (id: string, label: string) => void;
  // TECHNIQUES
  techniques: Technique[];
  onAddTechnique: (label: string) => void;
  onDeleteTechnique: (id: string) => void;
  onEditTechnique: (id: string, label: string) => void;
  
  // --- NOUVELLES COLLECTIONS V3.1 ---
  lureTypes: RefLureType[];
  onAddLureType: (label: string) => void;
  onDeleteLureType: (id: string) => void;
  onEditLureType: (id: string, label: string) => void;
  
  colors: RefColor[];
  onAddColor: (label: string) => void;
  onDeleteColor: (id: string) => void;
  onEditColor: (id: string, label: string) => void;
  
  sizes: RefSize[];
  onAddSize: (label: string) => void;
  onDeleteSize: (id: string) => void;
  onEditSize: (id: string, label: string) => void;
  
  weights: RefWeight[];
  onAddWeight: (label: string) => void;
  onDeleteWeight: (id: string) => void;
  onEditWeight: (id: string, label: string) => void;
}

const ConfigSection: React.FC<{
  title: string;
  icon: React.ReactNode;
  items: any[];
  onAdd: (label: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, label: string) => void;
  placeholder: string;
  colorClass: string;
}> = ({ title, icon, items, onAdd, onDelete, onEdit, placeholder, colorClass }) => {
  const [newItemLabel, setNewItemLabel] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newItemLabel.trim()) {
      onAdd(newItemLabel.trim());
      setNewItemLabel('');
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-stone-100 break-inside-avoid">
      <div className={`flex items-center gap-3 mb-6 ${colorClass}`}>
        <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-100">{icon}</div>
        <h3 className="font-bold text-lg text-stone-800">{title}</h3>
      </div>
      
      <ul className="space-y-2 mb-4 max-h-60 overflow-y-auto pr-1 scrollbar-thin">
        {items.map((item) => (
          <li key={item.id} className="flex justify-between items-center bg-stone-50/50 p-2.5 rounded-xl border border-stone-100 group hover:border-amber-200 transition-colors">
            {editingId === item.id ? (
              <div className="flex flex-1 gap-2">
                <input value={editingLabel} onChange={(e) => setEditingLabel(e.target.value)} className="flex-1 px-2 py-1 rounded-lg border border-amber-300 text-sm outline-none" autoFocus />
                <button onClick={() => { onEdit(item.id, editingLabel); setEditingId(null); }} className="text-emerald-600 bg-emerald-50 p-1 rounded-lg"><Check size={14}/></button>
              </div>
            ) : (
              <>
                <span className="font-medium text-stone-600 text-sm truncate">{item.label}</span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setEditingId(item.id); setEditingLabel(item.label); }} className="p-1.5 text-stone-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg"><Edit2 size={12}/></button>
                  <button onClick={() => onDelete(item.id)} className="p-1.5 text-stone-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg"><X size={12}/></button>
                </div>
              </>
            )}
          </li>
        ))}
        {items.length === 0 && <div className="text-center text-xs text-stone-300 italic py-4">Aucune donnée</div>}
      </ul>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input 
          type="text" 
          value={newItemLabel} 
          onChange={(e) => setNewItemLabel(e.target.value)} 
          placeholder={placeholder}
          className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-100 transition-all"
        />
        <button 
          type="submit" 
          disabled={!newItemLabel.trim()}
          className="p-3 bg-stone-800 text-white rounded-xl hover:bg-stone-900 disabled:opacity-30 transition-all"
        >
          <Plus size={18} />
        </button>
      </form>
    </div>
  );
};

const ArsenalView: React.FC<ArsenalViewProps> = (props) => (
  <div className="pb-24 animate-in fade-in duration-300">
    <div className="mb-8 px-4">
      <h2 className="text-2xl font-bold text-stone-800 flex items-center gap-3">
        <div className="p-2 bg-stone-200 rounded-xl text-stone-600"><Anchor size={24} /></div>
        Arsenal V3.1
      </h2>
      <p className="text-sm text-stone-400 mt-1 ml-1 font-medium">Configurez vos référentiels de pêche.</p>
    </div>

    <div className="space-y-6 px-2 md:columns-2 gap-6 space-y-0">
      <div className="break-inside-avoid mb-6">
        <ConfigSection title="Spots (ex-Zones)" icon={<MapPin size={20}/>} items={props.spots} onAdd={props.onAddSpot} onDelete={props.onDeleteSpot} onEdit={props.onEditSpot} placeholder="Ex: Spot A - Ruine..." colorClass="text-amber-600" />
      </div>
      
      <div className="break-inside-avoid mb-6">
        <ConfigSection title="Techniques" icon={<Crosshair size={20}/>} items={props.techniques} onAdd={props.onAddTechnique} onDelete={props.onDeleteTechnique} onEdit={props.onEditTechnique} placeholder="Ex: Contact Fond..." colorClass="text-emerald-600" />
      </div>

      <div className="break-inside-avoid mb-6">
        <ConfigSection title="Types de Leurre" icon={<Fish size={20}/>} items={props.lureTypes} onAdd={props.onAddLureType} onDelete={props.onDeleteLureType} onEdit={props.onEditLureType} placeholder="Ex: Vibrant - Shad..." colorClass="text-indigo-500" />
      </div>

      <div className="break-inside-avoid mb-6">
        <ConfigSection title="Couleurs" icon={<Palette size={20}/>} items={props.colors} onAdd={props.onAddColor} onDelete={props.onDeleteColor} onEdit={props.onEditColor} placeholder="Ex: Flashy - Firetiger..." colorClass="text-purple-500" />
      </div>

      {/* --- CORRECTION ICI : GUILLEMETS SIMPLES --- */}
      <div className="break-inside-avoid mb-6">
        <ConfigSection title="Tailles" icon={<Ruler size={20}/>} items={props.sizes} onAdd={props.onAddSize} onDelete={props.onDeleteSize} onEdit={props.onEditSize} placeholder='Ex: 3" - 4.5"...' colorClass="text-orange-500" />
      </div>

      <div className="break-inside-avoid mb-6">
        <ConfigSection title="Poids" icon={<Scale size={20}/>} items={props.weights} onAdd={props.onAddWeight} onDelete={props.onDeleteWeight} onEdit={props.onEditWeight} placeholder="Ex: 5 - 9g..." colorClass="text-cyan-600" />
      </div>

      <div className="break-inside-avoid mb-6">
        <ConfigSection title="Équipements (Setups)" icon={<Anchor size={20}/>} items={props.setups} onAdd={props.onAddSetup} onDelete={props.onDeleteSetup} onEdit={props.onEditSetup} placeholder="Ex: Combo Big Bait..." colorClass="text-stone-600" />
      </div>
    </div>
  </div>
);

export default ArsenalView;