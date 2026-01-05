// components/OracleChart.tsx - Version 10.0.0 (Night Ops Visualization Engine)
import React, { useMemo, useState } from 'react';
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
import { Sun, Moon, Maximize2, Search } from 'lucide-react';
import { format, startOfDay, addDays, setHours, getMonth, endOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useHistoricalWeather } from '../lib/hooks';

// --- CONFIGURATION ---
const SPECIES_CONFIG: Record<string, { label: string; color: string; fill: string }> = {
  'sandre': { label: 'Sandre', color: '#f59e0b', fill: '#fef3c7' }, 
  'brochet': { label: 'Brochet', color: '#10b981', fill: '#d1fae5' }, 
  'perche': { label: 'Perche', color: '#f43f5e', fill: '#ffe4e6' }, 
  // [NOUVEAU] Ajout du Black-Bass
  'blackbass': { label: 'Black-Bass', color: '#8b5cf6', fill: '#ede9fe' },
  
  // IDs Legacy
  'VFHQwajXIUyOQO3It7pW': { label: 'Sandre', color: '#f59e0b', fill: '#fef3c7' },
  'WYAjhoUeeikT3mS0hjip': { label: 'Brochet', color: '#10b981', fill: '#d1fae5' },
  'iW3E1yjaAELMagFPxMKD': { label: 'Perche', color: '#f43f5e', fill: '#ffe4e6' },
};

const LOCATION_COLORS = [
  { stroke: '#ea580c', fill: '#ffedd5' }, { stroke: '#0891b2', fill: '#ecfeff' }, 
  { stroke: '#16a34a', fill: '#f0fdf4' }, { stroke: '#7c3aed', fill: '#f5f3ff' }, 
  { stroke: '#4b5563', fill: '#f3f4f6' }, 
];

const SOLAR_PROXY: Record<number, { sunrise: number, sunset: number }> = {
  0: { sunrise: 8, sunset: 17 }, 1: { sunrise: 8, sunset: 18 }, 2: { sunrise: 7, sunset: 19 },
  3: { sunrise: 7, sunset: 20 }, 4: { sunrise: 6, sunset: 21 }, 5: { sunrise: 6, sunset: 22 },
  6: { sunrise: 6, sunset: 21 }, 7: { sunrise: 7, sunset: 20 }, 8: { sunrise: 7, sunset: 19 },
  9: { sunrise: 8, sunset: 18 }, 10: { sunrise: 8, sunset: 17 }, 11: { sunrise: 8, sunset: 17 },
};

const getStyle = (key: string, index: number, isComparisonMode: boolean) => {
    const safeIndex = index < 0 ? 0 : index;
    if (SPECIES_CONFIG[key.toLowerCase()] && !isComparisonMode) return SPECIES_CONFIG[key.toLowerCase()];
    const theme = LOCATION_COLORS[safeIndex % LOCATION_COLORS.length];
    return theme ? { label: key, color: theme.stroke, fill: theme.fill } : { label: key, color: '#a8a29e', fill: '#e7e5e4' };
};

export type ChartMode = 'single' | 'compare'; 
export type TargetSpecies = 'sandre' | 'brochet' | 'perche' | 'blackbass';

interface OracleChartProps {
  lat?: number; lng?: number; date: Date; externalData?: any[]; 
  title?: string; subTitle?: string; mode?: ChartMode; targetSpecies?: TargetSpecies;
  isComparisonMode?: boolean;
  isActuallyNight?: boolean; // Michael : Raccordement final pilier V8.0
}

const OracleChart: React.FC<OracleChartProps> = ({ 
    lat, lng, date, externalData, title, subTitle, 
    isComparisonMode: propsIsComparisonMode,
    isActuallyNight // Michael : Activation du mode furtif
}) => {
  const { data: historyData, loading } = useHistoricalWeather(lat, lng, date, { enabled: !externalData || externalData.length === 0 });
  const [zoomRange, setZoomRange] = useState<{ start: number, end: number, label: string } | null>(null);
  
  // --- 1. NORMALISATION DES DONNÉES (Timestamp vs Time) ---
  const rawData = useMemo(() => {
      if (externalData && externalData.length > 0) {
          return externalData.map(d => ({
              ...d,
              time: d.timestamp || d.time 
          }));
      }
      return historyData;
  }, [externalData, historyData]);

  const nowTimestamp = new Date().getTime();

  const chartData = useMemo(() => {
    if (!rawData || !zoomRange) return rawData;
    return rawData.filter((d: any) => d.time >= zoomRange.start && d.time <= zoomRange.end);
  }, [rawData, zoomRange]);

  const dayTransitions = useMemo(() => {
    if (!rawData || rawData.length === 0) return [];
    const transitions = [];
    const maxTime = rawData[rawData.length - 1].time;
    for (let i = 0; i <= 3; i++) {
        const dayDate = addDays(new Date(), i);
        const midnight = startOfDay(dayDate).getTime();
        if (midnight < maxTime) {
            transitions.push({
                midnight,
                center: setHours(startOfDay(dayDate), 12).getTime(),
                label: i === 0 ? `AUJOURD'HUI ${format(midnight, 'd')}` : format(midnight, 'EEEE d', { locale: fr }).toUpperCase(),
                start: startOfDay(dayDate).getTime(),
                end: endOfDay(dayDate).getTime()
            });
        }
    }
    return transitions;
  }, [rawData]);

  const solarCycles = useMemo(() => {
    if (!chartData || chartData.length === 0) return [];
    const cycles = [];
    const minTime = chartData[0].time;
    const maxTime = chartData[chartData.length - 1].time;
    let currentPos = minTime;

    while (currentPos < maxTime) {
      const checkDate = new Date(currentPos);
      const solar = SOLAR_PROXY[getMonth(checkDate)];
      const sunrise = setHours(startOfDay(checkDate), solar.sunrise).getTime();
      const sunset = setHours(startOfDay(checkDate), solar.sunset).getTime();
      const nextSunrise = setHours(addDays(startOfDay(checkDate), 1), solar.sunrise).getTime();

      if (currentPos < sunrise) {
        cycles.push({ start: currentPos, end: Math.min(sunrise, maxTime), type: 'night' });
        currentPos = sunrise;
      } else if (currentPos < sunset) {
        cycles.push({ start: currentPos, end: Math.min(sunset, maxTime), type: 'day' });
        currentPos = sunset;
      } else {
        cycles.push({ start: currentPos, end: Math.min(nextSunrise, maxTime), type: 'night' });
        currentPos = nextSunrise;
      }
    }
    return cycles;
  }, [chartData]);

  const { pastData, futureData } = useMemo(() => {
    if (!chartData || chartData.length === 0) return { pastData: [], futureData: [] };
    const splitIndex = chartData.findIndex((pt: any) => pt.time > nowTimestamp);
    return { 
        pastData: chartData.slice(0, splitIndex === -1 ? chartData.length : splitIndex + 1), 
        futureData: splitIndex === -1 ? [] : chartData.slice(splitIndex) 
    };
  }, [chartData, nowTimestamp]);

  if (!rawData && loading) return <div className={`h-64 flex items-center justify-center animate-pulse font-medium ${isActuallyNight ? 'text-stone-600' : 'text-stone-400'}`}>Analyse...</div>;

  // FIX DOUBLONS #1 : Utilisation d'un Set pour garantir l'unicité des clés
  const finalKeys = useMemo(() => {
      const keys = new Set<string>();
      if (chartData && chartData.length > 0) {
          // On scanne les clés du premier point pour trouver les séries
          Object.keys(chartData[0]).forEach(k => {
              if (!['time', 'hourLabel', 'isForecast', 'timestamp', 'temperature_2m', 'dissolvedOxygen', 'turbidityNTU', 'bestScore', 'waterTemp', 'tFond', 'waveHeight'].includes(k)) {
                  keys.add(k);
              }
          });
      }
      return Array.from(keys);
  }, [chartData]);

  const isComparisonMode = propsIsComparisonMode ?? finalKeys.some(k => !SPECIES_CONFIG[k.toLowerCase()]);

  return (
    <div className={`w-full rounded-xl border mt-2 overflow-hidden transition-colors duration-300 h-[420px] ${
        isActuallyNight ? 'bg-[#1c1917] border-stone-800 shadow-none' : 'bg-white border-stone-50 shadow-sm'
    }`}>
      <div className="p-2 h-full flex flex-col">
        <div className={`flex justify-between items-start mb-2 border-b pb-3 ${isActuallyNight ? 'border-stone-800' : 'border-stone-50'}`}>
            <div>
                <h3 className={`text-[11px] font-black uppercase italic tracking-tight leading-none ${isActuallyNight ? 'text-stone-100' : 'text-stone-800'}`}>
                  {title || (isComparisonMode ? 'COMPARATIF SECTEURS' : 'ORACLE : ANALYSE')}
                </h3>
                <div className="flex items-center gap-2 mt-3">
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${isActuallyNight ? 'text-stone-500' : 'text-stone-400'}`}>
                      {zoomRange ? 'Zoom Temporel' : 'Vue 72 Heures'}
                    </p>
                    {zoomRange && (
                      <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                          isActuallyNight ? 'bg-indigo-900/40 text-indigo-400 border-indigo-800' : 'bg-indigo-50 text-indigo-600 border-indigo-100'
                      }`}>
                        {zoomRange.label}
                      </span>
                    )}
                </div>
            </div>
            {zoomRange && (
                <button 
                  onClick={() => setZoomRange(null)} 
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border transition-all ${
                      isActuallyNight ? 'bg-stone-900 text-stone-400 border-stone-800 hover:bg-stone-800' : 'bg-stone-50 text-stone-500 border-stone-100 hover:bg-stone-100'
                  }`}
                >
                    <Maximize2 size={11} /> Vue 72H
                </button>
            )}
        </div>

        <div className="flex-1 min-h-0 relative -ml-6">
            <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 5, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isActuallyNight ? '#292524' : '#f5f5f4'} />
                
                {solarCycles.map((cycle, idx) => (
                  <ReferenceArea 
                    key={`${cycle.type}-${idx}`} 
                    x1={cycle.start} 
                    x2={cycle.end} 
                    fill={cycle.type === 'night' ? (isActuallyNight ? '#0c0a09' : '#f1f5f9') : 'transparent'} 
                    fillOpacity={0.5} 
                    stroke="none" 
                    label={({ viewBox }: any) => {
                        const { x, y, width } = viewBox;
                        if (width < 25) return null;
                        return (
                            <foreignObject x={x + (width / 2) - 10} y={y + 10} width="20" height="20">
                                {cycle.type === 'day' ? <Sun size={14} className="text-amber-400 opacity-80" /> : <Moon size={14} className="text-slate-400 opacity-80" />}
                            </foreignObject>
                        );
                    }}
                  />
                ))}

                <XAxis dataKey="time" type="number" domain={['dataMin', 'dataMax']} ticks={zoomRange ? [setHours(startOfDay(new Date(zoomRange.start)), 12).getTime()] : []} tickFormatter={() => "MIDI"} tick={zoomRange ? { fontSize: 9, fontWeight: 'bold', fill: isActuallyNight ? '#57534e' : '#a8a29e' } : false} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: isActuallyNight ? '#57534e' : '#a8a29e' }} axisLine={false} tickLine={false} dx={-5} />

                {/* MODIFICATION CRITIQUE : Glassmorphism adapté au mode nuit */}
                <Tooltip 
                    contentStyle={{ backgroundColor: 'transparent', border: 'none', boxShadow: 'none' }}
                    wrapperStyle={{ outline: 'none' }}
                    content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            const dateLabel = label ? new Date(label) : new Date();

                            // DÉDOUBLONNAGE DU PAYLOAD
                            const uniquePayload = Array.from(
                                new Map(payload.map((p: any) => [p.name, p])).values()
                            );

                            return (
                                <div style={{ 
                                    borderRadius: '16px', 
                                    border: isActuallyNight ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(255, 255, 255, 0.3)', 
                                    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)', 
                                    padding: '12px', 
                                    backgroundColor: isActuallyNight ? 'rgba(28, 25, 23, 0.85)' : 'rgba(255, 255, 255, 0.75)',
                                    backdropFilter: 'blur(12px)', 
                                    WebkitBackdropFilter: 'blur(12px)',
                                }}>
                                    <p className={`text-xs font-bold mb-2 border-b pb-1 ${isActuallyNight ? 'text-stone-100 border-stone-700/50' : 'text-stone-800 border-stone-200/50'}`}>
                                        {format(dateLabel, 'EEEE d MMMM à HH:mm', { locale: fr })}
                                    </p>
                                    
                                    {(data.dissolvedOxygen !== undefined || data.turbidityNTU !== undefined) && (
                                        <div className={`grid grid-cols-2 gap-x-4 gap-y-2 mb-3 p-2 rounded-lg ${isActuallyNight ? 'bg-stone-900/60' : 'bg-stone-100/40'}`}>
                                            <div className="flex flex-col">
                                                <span className="text-[9px] text-stone-500 uppercase font-bold">Oxygène</span>
                                                <span className={`text-xs font-black ${data.dissolvedOxygen < 4 ? 'text-red-500' : (isActuallyNight ? 'text-stone-300' : 'text-stone-600')}`}>
                                                    {data.dissolvedOxygen} <span className="text-[8px] font-normal">mg/L</span>
                                                </span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[9px] text-stone-500 uppercase font-bold">Turbidité</span>
                                                <span className={`text-xs font-black ${isActuallyNight ? 'text-stone-300' : 'text-stone-600'}`}>
                                                    {data.turbidityNTU} <span className="text-[8px] font-normal">NTU</span>
                                                </span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[9px] text-stone-500 uppercase font-bold">Temp. Eau</span>
                                                <span className={`text-xs font-black ${isActuallyNight ? 'text-stone-300' : 'text-stone-600'}`}>
                                                    {data.waterTemp || data.temperature_2m}°C
                                                </span>
                                            </div>

                                            {data.tFond !== undefined && (
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] text-indigo-400 uppercase font-bold">Temp. Fond</span>
                                                    <span className={`text-xs font-black ${isActuallyNight ? 'text-indigo-300' : 'text-indigo-600'}`}>
                                                        {data.tFond}°C
                                                    </span>
                                                </div>
                                            )}

                                            {data.waveHeight !== undefined && (
                                                <div className={`flex flex-col col-span-2 border-t pt-1 mt-1 ${isActuallyNight ? 'border-stone-800' : 'border-stone-200/50'}`}>
                                                    <span className="text-[9px] text-stone-500 uppercase font-bold">Hauteur Vagues (Hs)</span>
                                                    <span className={`text-xs font-black ${isActuallyNight ? 'text-stone-300' : 'text-stone-600'}`}>
                                                        {data.waveHeight} <span className="text-[8px] font-normal">cm</span>
                                                        {data.waveHeight > 15 && <span className="ml-2 text-[9px] text-amber-500 font-bold italic">"Walleye Chop"</span>}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {uniquePayload.map((p: any, idx: number) => (
                                        <div key={idx} className="flex items-center justify-between gap-4">
                                            <span style={{ color: p.stroke, fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' }}>
                                                {p.name}
                                            </span>
                                            <span className={`text-xs font-black ${isActuallyNight ? 'text-stone-100' : 'text-stone-800'}`}>
                                                {Math.round(p.value)} %
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            );
                        }
                        return null;
                    }}
                />
                
                <Legend verticalAlign="bottom" align="center" iconType="circle" iconSize={8} wrapperStyle={{ position: 'relative', marginTop: '10px', fontSize: '10px', fontWeight: 800, color: isActuallyNight ? '#57534e' : '#a8a29e', textTransform: 'uppercase', letterSpacing: '0.05em' }} />
                
                <ReferenceLine x={nowTimestamp} stroke={isActuallyNight ? '#44403c' : '#d6d3d1'} strokeDasharray="3 3" strokeWidth={1} label={{ position: 'insideTopLeft', value: 'LIVE', fill: isActuallyNight ? '#78716c' : '#a8a29e', fontSize: 9, fontWeight: 'bold', offset: 5 }} />
                {zoomRange && <ReferenceLine x={setHours(startOfDay(new Date(zoomRange.start)), 12).getTime()} stroke={isActuallyNight ? '#292524' : '#e2e8f0'} strokeDasharray="3 3" />}

                {!zoomRange && dayTransitions.map((dt, idx) => (
                    <ReferenceLine key={`line-${idx}`} x={dt.midnight} stroke={isActuallyNight ? '#292524' : '#e2e8f0'} strokeWidth={1} />
                ))}

                {!zoomRange && dayTransitions.map((dt, idx) => (
                    <ReferenceLine 
                        key={`btn-${idx}`} 
                        x={dt.center} 
                        stroke="transparent" 
                        label={({ viewBox }: any) => {
                            const { x, y, height } = viewBox;
                            return (
                                <g transform={`translate(${x},${y + height + 15})`} onClick={() => setZoomRange({ start: dt.start, end: dt.end, label: dt.label })} style={{ cursor: 'pointer' }}>
                                    <rect x="-40" y="-12" width="80" height="20" rx="6" fill={isActuallyNight ? '#1c1917' : 'white'} stroke={isActuallyNight ? '#44403c' : '#f1f5f9'} strokeWidth="1" className="hover:stroke-indigo-400 transition-colors" />
                                    <text x="-4" y="2" textAnchor="middle" fill={isActuallyNight ? '#818cf8' : '#6366f1'} fontSize="8" fontWeight="900" className="uppercase tracking-tighter">{dt.label}</text>
                                    <foreignObject x="25" y="-7" width="10" height="10"><Search size={9} className={isActuallyNight ? 'text-indigo-400/50' : 'text-indigo-200'} /></foreignObject>
                                </g>
                            );
                        }} 
                    />
                ))}

                {finalKeys.map((key, index) => {
                    const style = getStyle(key, index, isComparisonMode);
                    return (
                        <React.Fragment key={key}>
                            <Area type="monotone" dataKey={key} stroke="none" fill={style.fill} fillOpacity={isActuallyNight ? 0.15 : 0.25} tooltipType="none" legendType="none" />
                            <Line type="monotone" data={pastData} dataKey={key} name={style.label} stroke={style.color} strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 2 }} />
                            <Line type="monotone" data={futureData} dataKey={key} stroke={style.color} strokeWidth={2.5} strokeDasharray="6 4" dot={false} tooltipType="none" legendType="none" />
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