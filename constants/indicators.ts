// constants/indicators.ts
import { 
    Thermometer, Gauge, Wind, Droplets, Waves, Eye, Activity, ShieldCheck, Cloud, CloudRain, Zap
} from 'lucide-react';

export interface IndicatorMeta {
    label: string;
    description: string;
    formula?: string;
    unit: string;
    icon: any;
    theme: string;
    dataKey: string;
}

export const WEATHER_METADATA: Record<string, IndicatorMeta> = {
    tempAir: {
        label: "Temp. Air",
        description: "Température relevée par station météo.",
        unit: "°C",
        icon: Thermometer,
        theme: "rose",
        dataKey: "temperature"
    },
    pressure: {
        label: "Pression",
        description: "Pression atmosphérique au niveau du sol.",
        unit: " hPa",
        icon: Gauge,
        theme: "indigo",
        dataKey: "pressure"
    },
    wind: {
        label: "Vent",
        description: "Vitesse et direction du vent.",
        unit: " km/h",
        icon: Wind,
        theme: "amber",
        dataKey: "windSpeed"
    },
    clouds: {
        label: "Nuages",
        description: "Couverture nuageuse totale.",
        unit: "%",
        icon: Cloud,
        theme: "blue",
        dataKey: "clouds"
    },
    precip: {
        label: "Pluie",
        description: "Précipitations accumulées.",
        unit: " mm",
        icon: CloudRain,
        theme: "indigo",
        dataKey: "precip"
    }
};

export const HYDRO_METADATA: Record<string, IndicatorMeta> = {
    waterTemp: {
        label: "Temp. Eau",
        description: "Température de la couche de mélange.",
        formula: "Modèle Air2Water",
        unit: "°C",
        icon: Droplets,
        theme: "orange",
        dataKey: "waterTemp"
    },
    flowIndex: {
        label: "Courant",
        description: "Indice de débit proxy (Modèle Ultreia).",
        formula: "Convolution Pluie-Débit",
        unit: "%",
        icon: Zap,
        theme: "emerald",
        dataKey: "flowRaw"
    },
    waves: {
        label: "Vagues",
        description: "Hauteur du clapot (Walleye Chop).",
        formula: "Modèle SMB",
        unit: " cm",
        icon: Waves,
        theme: "blue",
        dataKey: "waveHeight"
    },
    turbidity: {
        label: "Clarté",
        description: "Transparence de l'eau (Turbidité).",
        formula: "Modèle EMC / First Flush",
        unit: " NTU",
        icon: Eye,
        theme: "emerald",
        dataKey: "turbidityNTU"
    },
    oxygen: {
        label: "Oxygène",
        description: "Oxygène dissous (Saturation).",
        formula: "Loi de Henry & Benson-Krause",
        unit: " mg/L",
        icon: Activity,
        theme: "cyan",
        dataKey: "dissolvedOxygen"
    }
};