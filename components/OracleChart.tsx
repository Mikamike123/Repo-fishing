// components/OracleChart.tsx - Version 46.0.0
// Michael : Correction Fading J+14 (Horizontal Gradient), Seeker Blanc "Laser-Aligned", 
// HUD Glassmorphism Haute-Visibilité, Tri Dynamique & Zéro-Vide.

import React, { useMemo, useState, useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { Thermometer, Waves, Droplets, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfDay, addDays, setHours, isSameDay, addHours, endOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';

export type ChartMode = 'single' | 'compare'; 
export type TargetSpecies = 'sandre' | 'brochet' | 'perche' | 'blackbass';
export type HydroMetric = 'waterTemp' | 'dissolvedOxygen' | 'turbidityNTU';

export interface OracleChartProps {
  date: Date; lat?: number; lng?: number; externalData?: any[]; isActuallyNight?: boolean;
}

const SPECIES_CONFIG: Record<string, { label: string; color: string }> = {
  'sandre': { label: 'Sandre', color: '#f59e0b' }, 
  'brochet': { label: 'Brochet', color: '#10b981' }, 
  'perche': { label: 'Perche', color: '#a855f7' }, 
  'blackbass': { label: 'Black-Bass', color: '#6366f1' },
};

const SECTOR_COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#06b6d4'];

const HYDRO_META: Record<HydroMetric, { label: string; color: string; unit: string; icon: any }> = {
  waterTemp: { label: 'TEMP. EAU', color: '#3b82f6', unit: '°C', icon: Thermometer },
  dissolvedOxygen: { label: 'OXYGÈNE', color: '#22c55e', unit: 'mg/L', icon: Droplets },
  turbidityNTU: { label: 'TURBIDITÉ', color: '#a8a29e', unit: 'NTU', icon: Waves }
};

const OracleChart: React.FC<OracleChartProps> = ({ externalData, isActuallyNight }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const now = useMemo(() => new Date(), []);
  const [viewMode, setViewMode] = useState<'focus' | 'standard' | 'macro'>('macro');
  const [centerTime, setCenterTime] = useState<number>(0);
  const [activeHydro, setActiveHydro] = useState<HydroMetric | null>(null); 
  const [hoverData, setHoverData] = useState<any | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 380 });
  const margin = { top: 60, right: 10, left: 10, bottom: 45 };

  // --- DÉCLARATIONS PRIORITAIRES ---
  const rawData = useMemo(() => {
    if (!externalData) return [];
    return [...externalData].map(d => ({ ...d, time: d.timestamp || d.time })).sort((a, b) => a.time - b.time);
  }, [externalData]);

  const dataKeys = useMemo(() => {
    if (rawData.length === 0) return [];
    const forbidden = ['time', 'timestamp', 'waterTemp', 'dissolvedOxygen', 'turbidityNTU', 'confidence'];
    return Object.keys(rawData[0]).filter(k => !forbidden.includes(k) && !k.includes('_'));
  }, [rawData]);

  const sortedKeys = useMemo(() => {
    if (!hoverData) return dataKeys;
    return [...dataKeys].sort((a, b) => (hoverData[b] || 0) - (hoverData[a] || 0));
  }, [dataKeys, hoverData]);

  const windowWidthMs = useMemo(() => {
    if (viewMode === 'macro') return rawData.length > 0 ? (rawData[rawData.length-1].time - rawData[0].time) : 14 * 24 * 3600 * 1000;
    if (viewMode === 'focus') return 24 * 3600 * 1000;
    return 84 * 3600 * 1000;
  }, [viewMode, rawData]);

  const viewStart = useMemo(() => {
    if (rawData.length === 0) return 0;
    const ideal = centerTime - (windowWidthMs / 2);
    return Math.max(rawData[0].time, Math.min(rawData[rawData.length - 1].time - windowWidthMs, ideal));
  }, [centerTime, windowWidthMs, rawData]);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(e => e[0] && setDimensions({ width: e[0].contentRect.width, height: 380 }));
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => { if (rawData.length > 0 && centerTime === 0) setCenterTime(Date.now()); }, [rawData]);

  useEffect(() => {
    if (rawData.length > 0) {
        const d = rawData[d3.bisector((d: any) => d.time).center(rawData, centerTime)];
        if (d) setHoverData(d);
    }
  }, [centerTime, rawData]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const progress = parseFloat(e.target.value) / 100;
    const minT = rawData[0].time;
    const maxT = rawData[rawData.length - 1].time;
    setCenterTime(minT + (maxT - minT) * progress);
  };

  const currentProgress = useMemo(() => {
    if (rawData.length < 2) return 0;
    return ((centerTime - rawData[0].time) / (rawData[rawData.length - 1].time - rawData[0].time)) * 100;
  }, [centerTime, rawData]);

  useEffect(() => {
    if (!svgRef.current || rawData.length === 0 || dimensions.width === 0 || centerTime === 0) return;
    const width = dimensions.width - margin.left - margin.right;
    const height = dimensions.height - margin.top - margin.bottom;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    const xScale = d3.scaleTime().domain([new Date(viewStart), new Date(viewStart + windowWidthMs)]).range([0, width]);
    const yScaleBio = d3.scaleLinear().domain([0, 100]).range([height, 0]);
    const indicatorX = xScale(new Date(centerTime));

    // Moteur d'opacité glissante (Incertitude météo)
    const getGlobalOpacity = (time: number) => {
        const progress = (time - now.getTime()) / (14 * 24 * 3600 * 1000);
        return progress <= 0 ? 1 : Math.max(0.15, 1 - (progress * 0.85));
    };

    // DEFS : Gradients pour surfaces (v) et lignes (h)
    const defs = svg.append("defs");
    dataKeys.forEach((key, i) => {
        const color = SPECIES_CONFIG[key]?.color || SECTOR_COLORS[i % SECTOR_COLORS.length];
        
        // Gradient Vertical pour la matière
        const areaGrad = defs.append("linearGradient").attr("id", `area-grad-${i}`).attr("x1", "0%").attr("y1", "0%").attr("x2", "0%").attr("y2", "100%");
        areaGrad.append("stop").attr("offset", "0%").attr("stop-color", color).attr("stop-opacity", 0.2);
        areaGrad.append("stop").attr("offset", "100%").attr("stop-color", color).attr("stop-opacity", 0);

        // Michael : Gradient Horizontal pour l'évanescence temporelle de la ligne
        const lineGrad = defs.append("linearGradient").attr("id", `line-grad-${i}`).attr("x1", "0%").attr("y1", "0%").attr("x2", "100%").attr("y2", "0%");
        lineGrad.append("stop").attr("offset", "0%").attr("stop-color", color).attr("stop-opacity", getGlobalOpacity(viewStart));
        lineGrad.append("stop").attr("offset", "100%").attr("stop-color", color).attr("stop-opacity", getGlobalOpacity(viewStart + windowWidthMs));
    });

    // Rendu Phases
    const startRange = startOfDay(new Date(viewStart));
    for (let i = 0; i < 20; i++) {
        const d = addDays(startRange, i);
        const sr = setHours(new Date(d), 7).getTime();
        const ss = setHours(new Date(d), 19).getTime();
        const phases = [{ s: d.getTime(), e: sr, t: 'n' }, { s: sr, e: ss, t: 'd' }, { s: ss, e: endOfDay(d).getTime(), t: 'n' }];
        phases.forEach((p, idx) => {
            const sX = xScale(new Date(p.s)); const eX = xScale(new Date(p.e));
            if (eX > 0 && sX < width) {
                const drawX = Math.max(0, sX); const drawW = Math.min(width, eX) - drawX;
                if (p.t === 'n') g.append("rect").attr("x", drawX).attr("y", -margin.top).attr("width", drawW).attr("height", height + margin.top).attr("fill", isActuallyNight ? "#172554" : "#eff6ff").attr("opacity", 0.4);
                if (drawW > 20 && viewMode !== 'macro') {
                    const iconX = drawX + drawW/2;
                    if (p.t === 'd') {
                        const sunG = g.append("g");
                        sunG.append("circle").attr("cx", iconX).attr("cy", -22).attr("r", 4.5).attr("fill", "#f59e0b");
                        for(let a=0; a<360; a+=45) {
                            const r = a * Math.PI / 180;
                            sunG.append("line").attr("x1", iconX + Math.cos(r)*6).attr("y1", -22 + Math.sin(r)*6).attr("x2", iconX + Math.cos(r)*10).attr("y2", -22 + Math.sin(r)*10).attr("stroke", "#f59e0b").attr("stroke-width", 1.5);
                        }
                    } else if (idx === 0) g.append("path").attr("d", "M-4 -4 a5 5 0 1 0 6 9 6 6 0 1 1-6-9Z").attr("transform", `translate(${iconX}, -22) scale(1.1)`).attr("fill", "#f59e0b");
                }
            }
        });
    }

    // Axe Y Gauche
    g.append("g").call(d3.axisLeft(yScaleBio).ticks(4).tickSize(0)).attr("color", "transparent").selectAll("text").attr("x", 6).attr("dy", -6).style("text-anchor", "start").style("font-size", "9px").style("font-weight", "bold").attr("fill", isActuallyNight ? "#94a3b8" : "#4b5563").text((d: any) => d + "%");

    // Courbes Bio avec évanescence
    dataKeys.forEach((key, i) => {
        const visibleData = rawData.filter(d => d.time >= viewStart - 3600000 && d.time <= viewStart + windowWidthMs + 3600000);
        
        // Matière
        const areaGen = d3.area<any>().x(d => xScale(new Date(d.time))).y0(height).y1(d => yScaleBio(d[key] || 0)).curve(d3.curveBasis);
        g.append("path").datum(visibleData).attr("fill", `url(#area-grad-${i})`).attr("d", areaGen as any).style("mix-blend-mode", isActuallyNight ? "screen" : "multiply");

        // Ligne avec Gradient Horizontal (Fading temporel)
        const lineGen = d3.line<any>().x(d => xScale(new Date(d.time))).y(d => yScaleBio(d[key] || 0)).curve(d3.curveBasis);
        g.append("path").datum(visibleData).attr("fill", "none")
            .attr("stroke", `url(#line-grad-${i})`) // Michael : Utilisation du gradient pour l'évanescence
            .attr("stroke-width", 3).attr("stroke-linecap", "round").attr("d", lineGen as any);
    });

    if (activeHydro) {
        const sectorKeys = Object.keys(rawData[0]).filter(k => k.endsWith(`_${activeHydro}`));
        const metricsToDraw = sectorKeys.length > 0 ? sectorKeys : [activeHydro];
        const allVals = rawData.flatMap(d => metricsToDraw.map(m => d[m])).filter(v => v != null);
        const yScaleHydro = d3.scaleLinear().domain([d3.min(allVals) * 0.98, d3.max(allVals) * 1.02]).range([height, 0]);
        g.append("g").attr("transform", `translate(${width}, 0)`).call(d3.axisRight(yScaleHydro).ticks(4).tickSize(0)).attr("color", "transparent").selectAll("text").attr("x", -6).attr("dy", -6).style("text-anchor", "end").style("font-size", "9px").style("font-weight", "bold").attr("fill", HYDRO_META[activeHydro].color).text((d: any) => `${d}${HYDRO_META[activeHydro].unit}`);
        metricsToDraw.forEach((mKey, idx) => {
            const color = sectorKeys.length > 0 ? SECTOR_COLORS[idx % SECTOR_COLORS.length] : HYDRO_META[activeHydro].color;
            const lineH = d3.line<any>().x(d => xScale(new Date(d.time))).y(d => yScaleHydro(d[mKey] || 0)).curve(d3.curveBasis);
            g.append("path").datum(rawData.filter(d => d.time >= viewStart - 3600000 && d.time <= viewStart + windowWidthMs + 3600000)).attr("fill", "none").attr("stroke", color).attr("stroke-width", 2).attr("opacity", 0.6).attr("stroke-dasharray", "4,2").attr("d", lineH as any);
        });
    }

    // Mire Mobile
    const trackerGroup = g.append("g");
    trackerGroup.append("line").attr("x1", indicatorX).attr("x2", indicatorX).attr("y1", 0).attr("y2", height).attr("stroke", isActuallyNight ? "#4f46e5" : "#6366f1").attr("stroke-width", 2).attr("stroke-dasharray", "4,4").attr("opacity", 0.7);
    if (hoverData) {
        dataKeys.forEach((key) => {
            const color = SPECIES_CONFIG[key]?.color || SECTOR_COLORS[dataKeys.indexOf(key) % SECTOR_COLORS.length];
            trackerGroup.append("circle").attr("cx", indicatorX).attr("cy", yScaleBio(hoverData[key] || 0)).attr("r", 5).attr("fill", "white").attr("stroke", color).attr("stroke-width", 2.5);
        });
    }

    const tFormat = viewMode === 'macro' ? (d: any) => format(d, 'EEE d', { locale: fr }) : (d: any) => format(d, 'HH:mm', { locale: fr });
    g.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(xScale).ticks(width / 75).tickFormat(tFormat)).attr("color", "#cbd5e1").style("font-size", "9px").selectAll("text").attr("fill", "#666").attr("dy", "1.2em");
  }, [rawData, centerTime, viewStart, activeHydro, dimensions, isActuallyNight, now, dataKeys, viewMode, windowWidthMs, hoverData]);

  return (
    <div ref={containerRef} className={`w-full rounded-3xl border transition-all duration-500 overflow-hidden relative select-none flex flex-col ${isActuallyNight ? 'bg-[#0c0a09] border-stone-800' : 'bg-white border-stone-100 shadow-xl'}`}>
      
      <style>{`
        .custom-seeker { -webkit-appearance: none; background: transparent; }
        .custom-seeker::-webkit-slider-thumb { 
          -webkit-appearance: none; 
          height: 26px; 
          width: 26px; 
          border-radius: 50%; 
          background: #ffffff; 
          border: 1px solid #d1d5db; 
          cursor: pointer; 
          box-shadow: 0 4px 10px rgba(0,0,0,0.12); 
          margin-top: -11px; /* Centrage Laser */
          transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); 
        }
        .custom-seeker::-webkit-slider-thumb:active { transform: scale(1.35); box-shadow: 0 0 15px rgba(99, 102, 241, 0.5); }
        .custom-seeker::-webkit-slider-runnable-track { 
          width: 100%; 
          height: 6px; 
          cursor: pointer; 
          background: ${isActuallyNight ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}; 
          border-radius: 10px; 
        }
      `}</style>

      <div className="p-4 flex justify-between items-center border-b border-stone-800/20 gap-3 z-10">
        <div className={`flex p-0.5 rounded-lg border ${isActuallyNight ? 'bg-stone-900 border-stone-800' : 'bg-stone-50 border-stone-100'}`}>
            {(['waterTemp', 'dissolvedOxygen', 'turbidityNTU'] as HydroMetric[]).map(m => {
                const IconComp = HYDRO_META[m].icon;
                return <button key={m} onClick={() => setActiveHydro(activeHydro === m ? null : m)} className={`p-1.5 rounded-md transition-all ${activeHydro === m ? 'bg-indigo-600 text-white shadow-lg' : 'text-stone-400'}`}><IconComp size={14} /></button>;
            })}
        </div>
        <div className={`flex p-0.5 rounded-full border ${isActuallyNight ? 'bg-stone-900 border-stone-800' : 'bg-stone-100 border-stone-200'}`}>
            {([['focus', '24H'], ['standard', '84H'], ['macro', '14J']] as const).map(([m, label]) => (
                <button key={m} onClick={() => setViewMode(m)} className={`px-4 py-1.5 rounded-full text-[10px] font-black transition-all ${viewMode === m ? 'bg-indigo-600 text-white shadow-md' : 'text-stone-400'}`}>{label}</button>
            ))}
        </div>
      </div>

      <div className="flex-1 relative pt-4 overflow-hidden" style={{ touchAction: 'none' }}>
        <svg ref={svgRef} width="100%" height={dimensions.height} className="block overflow-visible" />
        
        {hoverData && (
          <div className="absolute top-2 left-2 pointer-events-none z-50">
            <div 
              className="p-3 rounded-2xl border border-white/20 backdrop-blur-3xl shadow-2xl min-w-[130px] max-w-[155px]"
              style={{
                maskImage: 'radial-gradient(circle at center, black 65%, transparent 100%)',
                WebkitMaskImage: 'radial-gradient(circle at center, black 65%, transparent 100%)',
                background: isActuallyNight ? 'rgba(12, 10, 9, 0.85)' : 'rgba(255, 255, 255, 0.85)'
              }}
            >
              <div className="flex justify-between items-baseline mb-1">
                <span className="text-sm font-black text-indigo-500">{format(new Date(hoverData.time), 'HH:mm')}</span>
                <span className="text-[9px] font-bold opacity-40 uppercase text-stone-500">{format(new Date(hoverData.time), 'EEE d', { locale: fr })}</span>
              </div>
              <div className="space-y-1">
                {sortedKeys.map((key) => (
                  <div key={key} className="space-y-0.5 transition-all duration-300">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase">
                      <span style={{ color: SPECIES_CONFIG[key]?.color || SECTOR_COLORS[dataKeys.indexOf(key) % SECTOR_COLORS.length] }}>{key.split(' (')[0]}</span>
                      <span className={isActuallyNight ? 'text-stone-100' : 'text-stone-800'}>{Math.round(hoverData[key])}%</span>
                    </div>
                    {activeHydro && hoverData[`${key}_${activeHydro}`] !== undefined && (
                        <div className="flex justify-between items-center text-[8px] opacity-60 font-bold text-stone-500">
                            <span>{HYDRO_META[activeHydro].label.split(' ')[0]}</span>
                            <span>{hoverData[`${key}_${activeHydro}`].toFixed(1)}{HYDRO_META[activeHydro].unit}</span>
                        </div>
                    )}
                  </div>
                ))}
                {activeHydro && !Object.keys(hoverData).some(k => k.includes('_')) && (
                  <div className="pt-1 mt-1 border-t border-indigo-500/10 flex justify-between items-center text-[10px] font-bold" style={{ color: HYDRO_META[activeHydro].color }}>
                    <span>{HYDRO_META[activeHydro].label.split(' ')[0]}</span>
                    <span>{hoverData[activeHydro]?.toFixed(1)}{HYDRO_META[activeHydro].unit}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={`p-4 pb-12 transition-opacity duration-300 ${isActuallyNight ? 'bg-stone-950 border-t border-stone-900' : 'bg-stone-50 border-t border-stone-100'}`}>
          <div className="flex flex-col items-center mb-6">
            <span className={`text-[11px] font-black uppercase tracking-[0.2em] ${isActuallyNight ? 'text-indigo-400' : 'text-indigo-600'}`}>
                {format(new Date(centerTime), 'EEEE d MMMM', { locale: fr })}
            </span>
            <span className="text-[9px] font-bold text-stone-400 opacity-60 uppercase tracking-widest mt-1">Sélecteur Temporel</span>
          </div>
          <div className="relative w-full h-8 flex items-center px-4">
              <input type="range" min="0" max="100" step="0.01" value={currentProgress} onChange={handleSeek} className="custom-seeker w-full appearance-none bg-transparent focus:outline-none" style={{ touchAction: 'none' }} />
          </div>
      </div>
    </div>
  );
};

export default OracleChart;