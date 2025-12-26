import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine
} from 'recharts';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useHistoricalWeather } from '../lib/hooks';

// --- CONFIGURATION ---

const SPECIES_CONFIG: Record<string, { label: string; color: string; fill: string }> = {
  'sandre': { label: 'Sandre', color: '#f59e0b', fill: '#fef3c7' }, 
  'brochet': { label: 'Brochet', color: '#10b981', fill: '#d1fae5' }, 
  'perche': { label: 'Perche', color: '#f43f5e', fill: '#ffe4e6' }, 
  'VFHQwajXIUyOQO3It7pW': { label: 'Sandre', color: '#f59e0b', fill: '#fef3c7' },
  'WYAjhoUeeikT3mS0hjip': { label: 'Brochet', color: '#10b981', fill: '#d1fae5' },
  'iW3E1yjaAELMagFPxMKD': { label: 'Perche', color: '#f43f5e', fill: '#ffe4e6' },
};

const LOCATION_COLORS = [
  { stroke: '#f97316', fill: '#ffedd5' }, 
  { stroke: '#059669', fill: '#d1fae5' }, 
  { stroke: '#d97706', fill: '#fef3c7' }, 
  { stroke: '#0891b2', fill: '#cffafe' }, 
  { stroke: '#a8a29e', fill: '#e7e5e4' }, 
];

const sanitizeId = (str: string) => str.replace(/[^a-zA-Z0-9]/g, '_');

const getStyle = (key: string, index: number, isComparisonMode: boolean) => {
    const safeIndex = index < 0 ? 0 : index;
    if (SPECIES_CONFIG[key.toLowerCase()] && !isComparisonMode) {
        return SPECIES_CONFIG[key.toLowerCase()];
    }
    const theme = LOCATION_COLORS[safeIndex % LOCATION_COLORS.length];
    return theme ? { label: key, color: theme.stroke, fill: theme.fill } : { label: key, color: '#a8a29e', fill: '#e7e5e4' };
};

export type ChartMode = 'single' | 'compare'; 
export type TargetSpecies = 'sandre' | 'brochet' | 'perche';

interface OracleChartProps {
  lat?: number;
  lng?: number;
  date: Date;
  externalData?: any[]; 
  title?: string;
  subTitle?: string;
  mode?: ChartMode; 
  dataSets?: any[];
  targetSpecies?: TargetSpecies;
}

const OracleChart: React.FC<OracleChartProps> = ({ lat, lng, date, externalData, title, subTitle }) => {
  const { data: historyData, loading, error } = useHistoricalWeather(lat, lng, date, { 
    enabled: !externalData || externalData.length === 0 
  });

  const chartData = externalData || historyData;
  const isLoading = !externalData && loading;
  const nowTimestamp = new Date().getTime();

  const { pastData, futureData } = useMemo(() => {
    if (!chartData || chartData.length === 0) return { pastData: [], futureData: [] };
    const splitIndex = chartData.findIndex((pt: any) => pt.time > nowTimestamp);
    if (splitIndex === -1) return { pastData: chartData, futureData: [] };
    if (splitIndex === 0) return { pastData: [], futureData: chartData };
    return { pastData: chartData.slice(0, splitIndex + 1), futureData: chartData.slice(splitIndex - 1) };
  }, [chartData, nowTimestamp]);

  const containerStyle = { minHeight: '280px', height: '280px', width: '100%' };
  const containerClass = "w-full bg-white rounded-2xl border border-stone-100 mt-4 overflow-hidden shadow-sm";

  if (isLoading) {
    return (
      <div className={containerClass} style={containerStyle}>
        <div className="h-full flex flex-col items-center justify-center animate-pulse">
            <div className="h-6 w-6 border-b-2 border-amber-500 rounded-full animate-spin mb-3"></div>
            <p className="text-stone-400 text-sm">Calcul des prévisions...</p>
        </div>
      </div>
    );
  }

  if (error || !chartData || chartData.length === 0) {
    return (
        <div className={containerClass} style={containerStyle}>
           <div className="h-full flex items-center justify-center">
             <p className="text-red-400 text-sm">Données indisponibles</p>
           </div>
        </div>
    );
  }

  const keys = Object.keys(chartData[0] || {}).filter(k => 
    k !== 'time' && k !== 'hourLabel' && k !== 'isForecast' && k !== 'timestamp' && k !== 'temperature_2m'
  );

  const finalKeys = keys.length > 0 ? keys : (externalData ? [] : ['temperature_2m']);
  const isComparisonMode = finalKeys.some(k => !SPECIES_CONFIG[k.toLowerCase()]);

  return (
    <div className={containerClass} style={containerStyle}>
      <div className="p-5 h-full flex flex-col">
        <div className="flex justify-between items-start mb-2 flex-shrink-0 border-b border-stone-50 pb-2">
            <div>
                <h3 className="text-sm font-black text-stone-800 uppercase tracking-tight flex items-center gap-2">
                    {title || (isComparisonMode ? 'COMPARATIF SECTEURS' : 'ANALYSE DU SECTEUR')}
                </h3>
                <p className="text-xs text-stone-500 font-medium mt-0.5">{subTitle || 'Prévisions sur 72h'}</p>
            </div>
            <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${isComparisonMode ? 'bg-amber-50 text-amber-600' : 'bg-stone-100 text-stone-500'}`}>
                {isComparisonMode ? 'MULTI-ZONES' : 'FOCUS ZONE'}
            </span>
        </div>

        <div className="flex-1 min-h-0 select-none relative -ml-2">
            <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                {finalKeys.map((key) => {
                    const style = getStyle(key, finalKeys.indexOf(key), isComparisonMode);
                    return (
                    <linearGradient key={key} id={`color-${sanitizeId(key)}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={style.fill} stopOpacity={0.6}/>
                        <stop offset="95%" stopColor={style.fill} stopOpacity={0.1}/>
                    </linearGradient>
                    );
                })}
                </defs>

                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f4" />
                <XAxis dataKey="time" type="number" domain={['dataMin', 'dataMax']} tickFormatter={(unix) => format(new Date(unix), 'HH:mm')} tick={{ fontSize: 10, fill: '#a8a29e' }} axisLine={false} tickLine={false} minTickGap={40} dy={10} />
                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#a8a29e' }} axisLine={false} tickLine={false} dx={-5} />

                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px' }}
                  labelFormatter={(label) => format(new Date(label), 'EEEE d MMMM à HH:mm', { locale: fr })}
                  formatter={(value: any, name: any) => [`${Math.round(value)} %`, String(name || '')]}
                />
                
                <Legend verticalAlign="top" align="right" iconType="circle" iconSize={8} wrapperStyle={{ paddingBottom: '10px', fontSize: '11px', fontWeight: 600, color: '#78716c' }} />
                <ReferenceLine x={nowTimestamp} stroke="#a8a29e" strokeDasharray="3 3" strokeWidth={1} label={{ position: 'insideTopLeft', value: 'LIVE', fill: '#a8a29e', fontSize: 9, fontWeight: 'bold', offset: 5 }} />

                {finalKeys.map((key, index) => {
                const style = getStyle(key, index, isComparisonMode);
                const gradientId = `color-${sanitizeId(key)}`;
                
                return (
                    <React.Fragment key={key}>
                        {/* 1. Remplissage (Aire de fond) - Masqué de l'infobulle via tooltipType="none" */}
                        <Area
                            type="monotone"
                            dataKey={key}
                            stroke="none"
                            fillOpacity={1}
                            fill={`url(#${gradientId})`}
                            legendType="none"
                            tooltipType="none"
                            activeDot={false}
                        />
                        
                        {/* 2. Ligne Passée (Pleine) - Portera les infos de l'infobulle par défaut */}
                        <Line
                            type="monotone"
                            data={pastData}
                            dataKey={key}
                            name={style.label}
                            stroke={style.color}
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff', fill: style.color }}
                        />

                        {/* 3. Ligne Future (Pointillés) - Masquée de l'infobulle via tooltipType="none" */}
                        <Line
                            type="monotone"
                            data={futureData}
                            dataKey={key}
                            stroke={style.color}
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            dot={false}
                            legendType="none"
                            tooltipType="none"
                            activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff', fill: style.color }}
                        />
                    </React.Fragment>
                );
                })}
            </AreaChart>
            </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default OracleChart;