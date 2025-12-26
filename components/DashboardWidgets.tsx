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

interface SpeciesScoreProps {
    label: string;
    score?: number;
    color: string;
    borderColor: string;
    loading?: boolean;
}

export const SpeciesScore: React.FC<SpeciesScoreProps> = ({ label, score, color, borderColor, loading }) => (
    <div className="flex flex-col items-center">
        <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center">
            <div className="absolute inset-0 border-8 border-stone-50 rounded-full"></div>
            <div 
                className={`absolute inset-0 border-8 ${borderColor} rounded-full border-t-transparent transition-all duration-1000`} 
                style={{ transform: `rotate(${(score || 0) * 3.6 - 45}deg)`, opacity: loading ? 0.3 : 1 }}
            ></div>
            <div className="text-center z-10">
                {loading ? (
                    <div className="h-6 w-8 bg-stone-100 rounded animate-pulse mx-auto"></div>
                ) : (
                    <span className={`block text-2xl font-black ${color} tracking-tighter`}>
                        {score !== undefined ? Math.round(score) : '0'}
                    </span>
                )}
            </div>
        </div>
        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mt-2">{label}</span>
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