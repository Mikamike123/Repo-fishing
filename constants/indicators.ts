// constants/indicators.ts
import { 
    Thermometer, Gauge, Wind, Droplets, Waves, Eye, Activity, ShieldCheck, Sun 
} from 'lucide-react';

export interface IndicatorMeta {
    label: string;
    description: string;
    formula?: string;
    unit: string;
    icon: any;
    theme: string;
}

export const INDICATOR_METADATA: Record<string, IndicatorMeta> = {
    tempAir: {
        label: "Temp. Air",
        description: "Température relevée par station météo.",
        unit: "°C",
        icon: Thermometer,
        theme: "rose"
    },
    pressure: {
        label: "Pression",
        description: "Pression atmosphérique au niveau du sol.",
        unit: " hPa",
        icon: Gauge,
        theme: "indigo"
    },
    wind: {
        label: "Vent",
        description: "Vitesse et direction du vent.",
        unit: " km/h",
        icon: Wind,
        theme: "amber"
    },
    waterTemp: {
        label: "Temp. Eau",
        description: "Température de la couche de mélange.",
        formula: "Modèle Air2Water",
        unit: "°C",
        icon: Droplets,
        theme: "orange"
    },
    waves: {
        label: "Vagues",
        description: "Hauteur du clapot (Walleye Chop).",
        formula: "Modèle SMB (Sverdrup-Munk-Bretschneider)",
        unit: " cm",
        icon: Waves,
        theme: "blue"
    },
    turbidity: {
        label: "Clarté",
        description: "Transparence de l'eau (Turbidité).",
        formula: "Modèle EMC / First Flush",
        unit: " NTU",
        icon: Eye,
        theme: "emerald"
    },
    oxygen: {
        label: "Oxygène",
        description: "Oxygène dissous (Saturation).",
        formula: "Loi de Henry & Équations de Benson-Krause",
        unit: " mg/L",
        icon: Activity,
        theme: "cyan"
    },
    flow: {
        label: "Débit",
        description: "Volume d'eau par seconde (Vigicrues).",
        unit: " m³/s",
        icon: Waves,
        theme: "purple"
    },
    level: {
        label: "Niveau",
        description: "Hauteur d'eau par rapport au zéro échelle.",
        unit: " mm",
        icon: ShieldCheck,
        theme: "indigo"
    }
};