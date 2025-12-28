import React from 'react';
import { 
    Activity, Cloud, Sun, CloudSun, CloudRain, 
    Wind, Droplets, Gauge, Thermometer 
} from 'lucide-react';

// --- HELPERS VISUELS ---

export const getWindDir = (deg?: number) => {
    if (deg === undefined) return '';
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
    return directions[Math.round(deg / 45) % 8];
};

export const getWeatherIcon = (clouds: number) => {
    if (clouds < 20) return <Sun size={20} className="text-amber-500" />;
    if (clouds < 60) return <CloudSun size={20} className="text-stone-400" />;
    if (clouds < 90) return <Cloud size={20} className="text-stone-500" />;
    return <CloudRain size={20} className="text-stone-600" />;
};

// --- COMPOSANTS UI & ICONES ---

export const ActivityIcon = () => <Activity className="text-emerald-500" size={24} />;
export const CloudIcon = () => <Cloud size={16} />;
export const WindIcon = () => <Wind size={16} />;
export const DropletsIcon = () => <Droplets size={16} />;
export const GaugeIcon = () => <Gauge size={16} />;
export const ThermometerIcon = () => <div className="flex justify-center"><Thermometer size={16} /></div>;

/**
 * [ALIGNEMENT & CENTRAGE]
 * Ce wrapper garantit un alignement parfait peu importe le nombre d'espèces.
 * Utilise flex-wrap pour le mobile et justify-center pour l'équilibre visuel.
 */
export const SpeciesScoreGrid: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="flex flex-wrap justify-center items-center gap-6 sm:gap-10 py-4 w-full max-w-4xl mx-auto">
        {children}
    </div>
);

interface SpeciesScoreProps {
    label: string;
    score?: number;
    hexColor: string; // Utilisation du code Hex pour harmonisation totale
    loading?: boolean;
}

/**
 * [HARMONISATION COULEURS]
 * Le composant utilise désormais la propriété 'style' pour injecter les couleurs
 * exactes provenant de SPECIES_CONFIG (ex: #f59e0b pour le Sandre).
 */
export const SpeciesScore: React.FC<SpeciesScoreProps> = ({ label, score, hexColor, loading }) => (
    <div className="flex flex-col items-center min-w-[90px]">
        <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center">
            {/* Cercle de fond (Track) */}
            <div className="absolute inset-0 border-[7px] border-stone-50 rounded-full"></div>
            
            {/* Cercle de progression (Indicator) */}
            <div 
                className="absolute inset-0 border-[7px] rounded-full transition-all duration-1000 ease-out" 
                style={{ 
                    transform: `rotate(${(score || 0) * 3.6 - 90}deg)`, 
                    opacity: loading ? 0.3 : 1,
                    borderColor: hexColor,
                    borderTopColor: 'transparent',
                    borderRightColor: 'transparent',
                    // On utilise le dash pour simuler la progression si nécessaire ou le clip
                }}
            ></div>
            
            <div className="text-center z-10">
                {loading ? (
                    <div className="h-6 w-8 bg-stone-100 rounded animate-pulse mx-auto"></div>
                ) : (
                    <span 
                        className="block text-2xl font-black tracking-tighter"
                        style={{ color: hexColor }}
                    >
                        {score !== undefined ? Math.round(score) : '0'}
                    </span>
                )}
            </div>
        </div>
        <span className="text-[10px] font-black text-stone-400 uppercase tracking-[0.15em] mt-3">{label}</span>
    </div>
);

interface DataTileProps {
    label: string;
    value: string | number;
    unit: string;
    icon: React.ReactNode;
    color: string;
    loading?: boolean;
}

export const DataTile: React.FC<DataTileProps> = ({ label, value, unit, icon, color, loading }) => (
    <div className={`flex flex-col items-center justify-center p-3 rounded-2xl border border-stone-50 ${color.split(' ')[0]} bg-opacity-30 relative`}>
        <div className={`mb-1 ${color.split(' ')[1]}`}>{icon}</div>
        {loading ? (
            <div className="h-4 w-8 bg-stone-200/50 rounded animate-pulse my-1"></div>
        ) : (
            <div className="text-sm font-black text-stone-800 leading-tight text-center">
                {value !== undefined && value !== null ? value : '--'}
                <span className="text-[10px] font-medium ml-0.5 text-stone-500">{unit}</span>
            </div>
        )}
        <div className="text-[9px] font-bold uppercase text-stone-400 mt-0.5">{label}</div>
    </div>
);