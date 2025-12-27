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
  ReferenceLine,
  ReferenceArea
} from 'recharts';
import { Sun, Moon } from 'lucide-react';
import { format, startOfDay, addDays, setHours, getMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useHistoricalWeather } from '../lib/hooks';

// --- CONFIGURATION COULEURS ---

const SPECIES_CONFIG: Record<string, { label: string; color: string; fill: string }> = {
  'sandre': { label: 'Sandre', color: '#f59e0b', fill: '#fef3c7' }, 
  'brochet': { label: 'Brochet', color: '#10b981', fill: '#d1fae5' }, 
  'perche': { label: 'Perche', color: '#f43f5e', fill: '#ffe4e6' }, 
  'VFHQwajXIUyOQO3It7pW': { label: 'Sandre', color: '#f59e0b', fill: '#fef3c7' },
  'WYAjhoUeeikT3mS0hjip': { label: 'Brochet', color: '#10b981', fill: '#d1fae5' },
  'iW3E1yjaAELMagFPxMKD': { label: 'Perche', color: '#f43f5e', fill: '#ffe4e6' },
};

const LOCATION_COLORS = [
  { stroke: '#ea580c', fill: '#ffedd5' }, 
  { stroke: '#0891b2', fill: '#ecfeff' }, 
  { stroke: '#16a34a', fill: '#f0fdf4' }, 
  { stroke: '#7c3aed', fill: '#f5f3ff' }, 
  { stroke: '#4b5563', fill: '#f3f4f6' }, 
];

const SOLAR_PROXY: Record<number, { sunrise: number, sunset: number }> = {
  0: { sunrise: 8, sunset: 17 }, 1: { sunrise: 8, sunset: 18 }, 2: { sunrise: 7, sunset: 19 },
  3: { sunrise: 7, sunset: 20 }, 4: { sunrise: 6, sunset: 21 }, 5: { sunrise: 6, sunset: 22 },
  6: { sunrise: 6, sunset: 21 }, 7: { sunrise: 7, sunset: 20 }, 8: { sunrise: 7, sunset: 19 },
  9: { sunrise: 8, sunset: 18 }, 10: { sunrise: 8, sunset: 17 }, 11: { sunrise: 8, sunset: 17 },
};

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
  lat?: number; lng?: number; date: Date; externalData?: any[]; 
  title?: string; subTitle?: string; mode?: ChartMode; 
}

const OracleChart: React.FC<OracleChartProps> = ({ lat, lng, date, externalData, title, subTitle }) => {
  const { data: historyData, loading, error } = useHistoricalWeather(lat, lng, date, { 
    enabled: !externalData || externalData.length === 0 
  });

  const chartData = externalData || historyData;
  const isLoading = !externalData && loading;
  const nowTimestamp = new Date().getTime();

  // --- LOGIQUE TRANSITIONS DE JOURS (CENTREÉS SUR MIDI) ---
  const dayTransitions = useMemo(() => {
    if (!chartData || chartData.length === 0) return [];
    const transitions: { midnight: number, center: number, label: string }[] = [];
    const maxTime = chartData[chartData.length - 1].time;
    
    for (let i = 1; i <= 3; i++) {
        const dayDate = addDays(new Date(), i);
        const midnight = startOfDay(dayDate).getTime();
        const centerOfDay = setHours(startOfDay(dayDate), 12).getTime(); // Position à MIDI
        
        if (midnight < maxTime) {
            transitions.push({
                midnight,
                center: centerOfDay,
                label: format(midnight, 'EEEE', { locale: fr }).toUpperCase()
            });
        }
    }
    return transitions;
  }, [chartData]);

  // --- LOGIQUE CYCLES SOLAIRES ---
  const solarCycles = useMemo(() => {
    if (!chartData || chartData.length === 0) return [];
    const cycles: { start: number, end: number, type: 'day' | 'night' }[] = [];
    const minTime = chartData[0].time;
    const maxTime = chartData[chartData.length - 1].time;
    
    let currentDay = startOfDay(new Date(minTime));
    const endLimit = addDays(startOfDay(new Date(maxTime)), 1);

    while (currentDay < endLimit) {
      const solar = SOLAR_PROXY[getMonth(currentDay)];
      const sunrise = setHours(currentDay, solar.sunrise).getTime();
      const sunset = setHours(currentDay, solar.sunset).getTime();
      const nextSunrise = setHours(addDays(currentDay, 1), solar.sunrise).getTime();
      
      if (sunrise < maxTime && sunset > minTime) {
        cycles.push({ start: Math.max(sunrise, minTime), end: Math.min(sunset, maxTime), type: 'day' });
      }
      if (sunset < maxTime && nextSunrise > minTime) {
        cycles.push({ start: Math.max(sunset, minTime), end: Math.min(nextSunrise, maxTime), type: 'night' });
      }
      currentDay = addDays(currentDay, 1);
    }
    return cycles;
  }, [chartData]);

  const { pastData, futureData } = useMemo(() => {
    if (!chartData || chartData.length === 0) return { pastData: [], futureData: [] };
    const splitIndex = chartData.findIndex((pt: any) => pt.time > nowTimestamp);
    if (splitIndex === -1) return { pastData: chartData, futureData: [] };
    if (splitIndex === 0) return { pastData: [], futureData: chartData };
    return { pastData: chartData.slice(0, splitIndex + 1), futureData: chartData.slice(splitIndex - 1) };
  }, [chartData, nowTimestamp]);

  const containerStyle = { minHeight: '340px', height: '340px', width: '100%' };
  const containerClass = "w-full bg-white rounded-2xl border border-stone-100 mt-4 overflow-hidden shadow-sm";

  if (isLoading) return <div className={containerClass} style={containerStyle}><div className="h-full flex flex-col items-center justify-center animate-pulse"><div className="h-6 w-6 border-b-2 border-amber-500 rounded-full animate-spin mb-3"></div><p className="text-stone-400 text-sm">Calcul des prévisions...</p></div></div>;
  if (error || !chartData || chartData.length === 0) return <div className={containerClass} style={containerStyle}><div className="h-full flex items-center justify-center"><p className="text-red-400 text-sm">Données indisponibles</p></div></div>;

  const finalKeys = Object.keys(chartData[0] || {}).filter(k => 
    !['time', 'hourLabel', 'isForecast', 'timestamp', 'temperature_2m'].includes(k)
  ).length > 0 ? Object.keys(chartData[0] || {}).filter(k => 
    !['time', 'hourLabel', 'isForecast', 'timestamp', 'temperature_2m'].includes(k)
  ) : (externalData ? [] : ['temperature_2m']);
  
  const isComparisonMode = finalKeys.some(k => !SPECIES_CONFIG[k.toLowerCase()]);

  return (
    <div className={containerClass} style={containerStyle}>
      <div className="p-5 h-full flex flex-col">
        <div className="flex justify-between items-start mb-2 flex-shrink-0 border-b border-stone-50 pb-2">
            <div>
                <h3 className="text-sm font-black text-stone-800 uppercase tracking-tight flex items-center gap-2">{title || (isComparisonMode ? 'COMPARATIF SECTEURS' : 'ANALYSE DU SECTEUR')}</h3>
                <p className="text-[10px] text-stone-500 font-medium mt-0.5">{subTitle || 'Prévisions sur 72h'}</p>
            </div>
            <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${isComparisonMode ? 'bg-amber-50 text-amber-600' : 'bg-stone-100 text-stone-500'}`}>{isComparisonMode ? 'MULTI-ZONES' : 'FOCUS ZONE'}</span>
        </div>

        <div className="flex-1 min-h-0 select-none relative -ml-2">
            <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 30, right: 10, left: 0, bottom: 25 }}>
                <defs>
                {finalKeys.map((key, index) => {
                    const style = getStyle(key, index, isComparisonMode);
                    return (
                    <linearGradient key={key} id={`color-${sanitizeId(key)}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={style.fill} stopOpacity={0.6}/><stop offset="95%" stopColor={style.fill} stopOpacity={0.1}/>
                    </linearGradient>
                    );
                })}
                </defs>

                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f4" />
                
                {solarCycles.map((cycle, idx) => (
                  <ReferenceArea 
                    key={`${cycle.type}-${idx}`}
                    x1={cycle.start}
                    x2={cycle.end}
                    fill={cycle.type === 'night' ? '#eef2ff' : 'transparent'} 
                    fillOpacity={0.6}
                    stroke="none"
                    label={({ viewBox }: any) => {
                        const { x, y, width } = viewBox;
                        return (
                            <foreignObject x={x + (width / 2) - 10} y={y - 25} width="20" height="20">
                                {cycle.type === 'day' ? (
                                    <Sun size={14} className="text-amber-400 opacity-80" />
                                ) : (
                                    <Moon size={14} className="text-indigo-400 opacity-80" />
                                )}
                            </foreignObject>
                        );
                    }}
                  />
                ))}

                <XAxis 
                    dataKey="time" 
                    type="number" 
                    domain={['dataMin', 'dataMax']} 
                    tick={false}
                    axisLine={false} 
                    tickLine={false} 
                />
                
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#a8a29e' }} axisLine={false} tickLine={false} dx={-5} />

                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px' }}
                  labelFormatter={(l: number) => format(new Date(l), 'EEEE d MMMM à HH:mm', { locale: fr })}
                  formatter={(v: any, name: any) => [`${Math.round(v)} %`, String(name || '')]}
                />
                
                <Legend verticalAlign="bottom" align="center" iconType="circle" iconSize={8} wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: 700, color: '#78716c', textTransform: 'uppercase' }} />
                
                <ReferenceLine x={nowTimestamp} stroke="#a8a29e" strokeDasharray="3 3" strokeWidth={1} label={{ position: 'insideTopLeft', value: 'LIVE', fill: '#a8a29e', fontSize: 9, fontWeight: 'bold', offset: 5 }} />

                {/* LIGNES DE MINUIT (SANS TEXTE) */}
                {dayTransitions.map((dt, idx) => (
                    <ReferenceLine 
                        key={`line-${idx}`}
                        x={dt.midnight} 
                        stroke="#818cf8" 
                        strokeWidth={1} 
                        strokeOpacity={0.3}
                    />
                ))}

                {/* LABELS DE JOURS (CENTRÉS SUR MIDI) */}
                {dayTransitions.map((dt, idx) => (
                    <ReferenceLine 
                        key={`label-${idx}`}
                        x={dt.center} // On se place au milieu de la journée
                        stroke="transparent" // Ligne invisible, on ne veut que le label
                        label={{ 
                            position: 'bottom',
                            value: dt.label, 
                            fill: '#818cf8', 
                            fontSize: 9, 
                            fontWeight: 'bold',
                            dy: 15,
                            textAnchor: 'middle' // Centrage parfait du texte
                        }} 
                    />
                ))}

                {finalKeys.map((key, index) => {
                const style = getStyle(key, index, isComparisonMode);
                const gradientId = `color-${sanitizeId(key)}`;
                return (
                    <React.Fragment key={key}>
                        <Area type="monotone" dataKey={key} stroke="none" fillOpacity={1} fill={`url(#${gradientId})`} legendType="none" tooltipType="none" activeDot={false} />
                        <Line type="monotone" data={pastData} dataKey={key} name={style.label} stroke={style.color} strokeWidth={2.5} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff', fill: style.color }} />
                        <Line type="monotone" data={futureData} dataKey={key} stroke={style.color} strokeWidth={2.5} strokeDasharray="5 5" dot={false} legendType="none" tooltipType="none" activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff', fill: style.color }} />
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