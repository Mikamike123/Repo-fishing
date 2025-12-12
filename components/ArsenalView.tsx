import React, { useState } from 'react';
import { MapPin, Anchor, Crosshair, Plus, X, Trash2 } from 'lucide-react';

interface ArsenalViewProps {
  zones: string[];
  onAddZone: (zone: string) => void;
  onDeleteZone: (zone: string) => void;

  setups: string[];
  onAddSetup: (setup: string) => void;
  onDeleteSetup: (setup: string) => void;

  techniques: string[];
  onAddTechnique: (tech: string) => void;
  onDeleteTechnique: (tech: string) => void;
}

const ConfigSection: React.FC<{
  title: string;
  icon: React.ReactNode;
  items: string[];
  onAdd: (item: string) => void;
  onDelete: (item: string) => void;
  placeholder: string;
  colorClass: string;
}> = ({ title, icon, items, onAdd, onDelete, placeholder, colorClass }) => {
  const [newItem, setNewItem] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newItem.trim()) {
      onAdd(newItem.trim());
      setNewItem('');
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 shadow-organic border border-stone-100 mb-6">
      <div className={`flex items-center gap-3 mb-6 ${colorClass}`}>
        <div className="p-2 rounded-xl bg-current opacity-10">
           {icon}
        </div>
        <h3 className="font-bold text-lg text-stone-800">{title}</h3>
      </div>

      <ul className="space-y-3 mb-6">
        {items.map((item, index) => (
          <li key={index} className="flex justify-between items-center group bg-stone-50 p-3 rounded-xl border border-stone-100 hover:border-amber-200 transition-colors">
            <span className="font-medium text-stone-700">{item}</span>
            <button 
              onClick={() => onDelete(item)}
              className="p-1.5 text-stone-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors opacity-60 group-hover:opacity-100"
            >
              <X size={16} />
            </button>
          </li>
        ))}
        {items.length === 0 && (
           <li className="text-center py-4 text-sm text-stone-400 italic">Aucun élément configuré.</li>
        )}
      </ul>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input 
          type="text" 
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-sm font-medium"
        />
        <button 
          type="submit"
          disabled={!newItem.trim()}
          className="p-2 bg-stone-800 text-white rounded-xl hover:bg-stone-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Plus size={20} />
        </button>
      </form>
    </div>
  );
};

const ArsenalView: React.FC<ArsenalViewProps> = ({
  zones, onAddZone, onDeleteZone,
  setups, onAddSetup, onDeleteSetup,
  techniques, onAddTechnique, onDeleteTechnique
}) => {
  return (
    <div className="pb-24 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-8 px-2">
        <div>
          <h2 className="text-2xl font-bold text-stone-800 tracking-tight flex items-center gap-3">
             <div className="p-1.5 bg-stone-200 rounded-lg text-stone-600">
                 <Anchor size={20} />
             </div>
            Mon Arsenal
          </h2>
          <p className="text-sm text-stone-400 mt-1 font-medium ml-1">
            Configurez vos zones, équipements et techniques.
          </p>
        </div>
      </div>

      {/* Grid Layout */}
      <div className="space-y-6">
        
        <ConfigSection 
          title="Zones de Pêche"
          icon={<MapPin size={24} />}
          items={zones}
          onAdd={onAddZone}
          onDelete={onDeleteZone}
          placeholder="Ex: Piles de ponts..."
          colorClass="text-amber-600"
        />

        <ConfigSection 
          title="Mon Armurerie (Setups)"
          icon={<Anchor size={24} />}
          items={setups}
          onAdd={onAddSetup}
          onDelete={onDeleteSetup}
          placeholder="Ex: Combo Big Bait..."
          colorClass="text-stone-600"
        />

        <ConfigSection 
          title="Techniques"
          icon={<Crosshair size={24} />}
          items={techniques}
          onAdd={onAddTechnique}
          onDelete={onDeleteTechnique}
          placeholder="Ex: Verticale..."
          colorClass="text-emerald-600"
        />

      </div>

    </div>
  );
};

export default ArsenalView;