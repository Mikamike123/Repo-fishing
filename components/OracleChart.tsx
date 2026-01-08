// components/OracleChart.tsx - Version 12.2.0 (Stealth Default & Pastel Mastery)
import React, { useMemo, useState, useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { Thermometer, Waves, Droplets, RefreshCw } from 'lucide-react';
import { format, startOfDay, addDays, setHours, getMonth, isSameDay, endOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';

export type ChartMode = 'single' | 'compare'; 
export type TargetSpecies = 'sandre' | 'brochet' | 'perche' | 'blackbass';
export type HydroMetric = 'waterTemp' | 'dissolvedOxygen' | 'turbidityNTU';

export interface OracleChartProps {
  date: Date; lat?: number; lng?: number; externalData?: any[]; title?: string; subTitle?: string; isActuallyNight?: boolean;
}

const SPECIES_CONFIG: Record<string, { label: string; color: string }> = {
  'sandre': { label: 'Sandre', color: '#f59e0b' }, 
  'brochet': { label: 'Brochet', color: '#10b981' }, 
  'perche': { label: 'Perche', color: '#fbbf24' }, 
  'blackbass': { label: 'Black-Bass', color: '#8b5cf6' },
};

const SECTOR_COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#06b6d4'];
const SECTOR_FILLS = ['#818cf8', '#f472b6', '#34d399', '#fbbf24', '#22d3ee']; 

const HYDRO_META: Record<HydroMetric, { label: string; color: string; unit: string; icon: any }> = {
  waterTemp: { label: 'TEMP. EAU', color: '#3b82f6', unit: '°C', icon: Thermometer },
  dissolvedOxygen: { label: 'OXYGÈNE', color: '#22c55e', unit: 'mg/L', icon: Droplets },
  turbidityNTU: { label: 'TURBIDITÉ', color: '#a8a29e', unit: 'NTU', icon: Waves }
};

const OracleChart: React.FC<OracleChartProps> = ({ externalData, title, isActuallyNight }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoomRange, setZoomRange] = useState<{ start: number, end: number, label: string } | null>(null);
  const [activeHydro, setActiveHydro] = useState<HydroMetric | null>(null); // Michael: Initialisé à null
  const [hoverData, setHoverData] = useState<any | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [dimensions, setDimensions] = useState({ width: 0, height: 410 });

  const nowTime = new Date().getTime();
  const margin = { top: 60, right: 35, left: 35, bottom: 65 };

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) setDimensions(prev => ({ ...prev, width: entries[0].contentRect.width }));
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const rawData = useMemo(() => {
    if (!externalData) return [];
    return externalData.map(d => ({ ...d, time: d.timestamp || d.time })).sort((a, b) => a.time - b.time);
  }, [externalData]);

  const displayData = useMemo(() => {
    if (!zoomRange) return rawData;
    return rawData.filter((d: any) => d.time >= zoomRange.start && d.time <= zoomRange.end);
  }, [rawData, zoomRange]);

  const isComparisonMode = useMemo(() => {
    if (displayData.length === 0) return false;
    const keys = Object.keys(displayData[0]);
    return !keys.includes('sandre') && keys.some(k => k.includes('('));
  }, [displayData]);

  const dataKeys = useMemo(() => {
    if (displayData.length === 0) return [];
    const forbidden = ['time', 'timestamp', 'waterTemp', 'dissolvedOxygen', 'turbidityNTU'];
    return Object.keys(displayData[0]).filter(k => !forbidden.includes(k));
  }, [displayData]);

  const dayTransitions = useMemo(() => {
    const transitions = [];
    const baseDate = rawData.length > 0 ? new Date(rawData[0].time) : new Date();
    for (let i = 0; i <= 4; i++) {
        const d = addDays(baseDate, i);
        transitions.push({
            label: isSameDay(d, new Date()) ? "AUJOURD'HUI" : format(d, 'EEEE d', { locale: fr }).toUpperCase(),
            start: startOfDay(d).getTime(),
            end: endOfDay(d).getTime(),
        });
    }
    return transitions;
  }, [rawData]);

  useEffect(() => {
    if (!svgRef.current || displayData.length === 0 || dimensions.width === 0) return;

    const width = dimensions.width - margin.left - margin.right;
    const height = dimensions.height - margin.top - margin.bottom;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // --- ECHELLES ---
    const xScale = d3.scaleTime().domain(d3.extent(displayData, (d: any) => new Date(d.time)) as [Date, Date]).range([0, width]);
    const yScaleBio = d3.scaleLinear().domain([0, 100]).range([height, 0]);

    // Échelle Hydro (Gère le mode null)
    let yScaleHydro = d3.scaleLinear().domain([0, 100]).range([height, 0]);
    if (activeHydro) {
        const hVals = displayData.map((d: any) => d[activeHydro] || 0);
        const hMin = d3.min(hVals) as number;
        const hMax = d3.max(hVals) as number;
        yScaleHydro = d3.scaleLinear().domain([Math.max(0, hMin - (hMax - hMin || 1) * 0.2), hMax + (hMax - hMin || 1) * 0.2]).range([height, 0]);
    }

    // --- MASTER TIMELINE ---
    g.append("text").attr("x", 0).attr("y", -40).text("H-12H").attr("fill", "#78716c").style("font-size", "8px").style("font-weight", "900");
    g.append("text").attr("x", width).attr("y", -40).attr("text-anchor", "end").text("H+72H").attr("fill", "#78716c").style("font-size", "8px").style("font-weight", "900");

    // Unités Conditionnelles
    g.append("text").attr("x", -5).attr("y", -10).text("%").attr("fill", isActuallyNight ? "#78716c" : "#57534e").style("font-size", "9px").style("font-weight", "bold");
    if (activeHydro && !isComparisonMode) {
        g.append("text").attr("x", width + 5).attr("y", -10).attr("text-anchor", "start").text(HYDRO_META[activeHydro].unit).attr("fill", HYDRO_META[activeHydro].color).style("font-size", "9px").style("font-weight", "bold");
    }

    const xDomain = xScale.domain().map(d => d.getTime());
    dayTransitions.forEach(day => {
        const sr = setHours(new Date(day.start), 7).getTime();
        const ss = setHours(new Date(day.start), 19).getTime();
        const phases = [{ s: day.start, e: sr, t: 'n' }, { s: sr, e: ss, t: 'd' }, { s: ss, e: day.end, t: 'n' }];

        phases.forEach((p, idx) => {
            const sX = xScale(new Date(Math.max(p.s, xDomain[0])));
            const eX = xScale(new Date(Math.min(p.e, xDomain[1])));
            if (eX > sX) {
                g.append("rect").attr("x", sX).attr("y", -margin.top).attr("width", eX - sX).attr("height", height + margin.top)
                    .attr("fill", p.t === 'n' ? (isActuallyNight ? "#0c0a09" : "#f8fafc") : "transparent").attr("opacity", 0.6);

                const cX = sX + (eX - sX) / 2;
                if (eX - sX > 25) {
                    const iconG = g.append("g").attr("transform", `translate(${cX-8},-42)`).attr("opacity", 0.6);
                    if (p.t === 'd') {
                        iconG.append("circle").attr("cx", 8).attr("cy", 8).attr("r", 3.2).attr("fill", "#f59e0b");
                        for(let a=0; a<360; a+=45) {
                            const rad = a * Math.PI / 180;
                            iconG.append("line").attr("x1", 8+Math.cos(rad)*4.5).attr("y1", 8+Math.sin(rad)*4.2).attr("x2", 8+Math.cos(rad)*8).attr("y2", 8+Math.sin(rad)*8).attr("stroke", "#f59e0b").attr("stroke-width", 1.5);
                        }
                    } else if (idx === 0) { 
                        iconG.append("path").attr("d", "M11 4a5 5 0 1 0 2 9 6 6 0 1 1-2-9Z").attr("fill", "#818cf8");
                    }
                }
            }
        });
    });

    // --- AXES ---
    g.append("g").call(d3.axisLeft(yScaleBio).ticks(5).tickFormat(d => d.toString())).attr("color", "#444").style("font-size", "9px");
    
    // Axe Hydro (Ligne visible, labels conditionnels)
    const hAxis = g.append("g").attr("transform", `translate(${width}, 0)`)
        .call(d3.axisRight(yScaleHydro).ticks(activeHydro ? 5 : 0).tickFormat(d => activeHydro ? d.toString() : ""));
    hAxis.attr("color", activeHydro ? HYDRO_META[activeHydro].color : "#444").style("font-size", "9px");

    g.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(xScale).ticks(width / 80).tickFormat((d: any) => format(d, 'HH:mm')))
        .attr("color", "#444").style("font-size", "9px");

    // --- COURBES & AIRES ---
    if (activeHydro && !isComparisonMode) {
        const lineH = d3.line().x((d: any) => xScale(new Date(d.time))).y((d: any) => yScaleHydro(d[activeHydro] || 0)).curve(d3.curveMonotoneX);
        g.append("path").datum(displayData).attr("fill", "none").attr("stroke", HYDRO_META[activeHydro].color).attr("stroke-width", 2.5).attr("opacity", 0.4).attr("d", lineH as any);
    }

    dataKeys.forEach((key, i) => {
        const color = isComparisonMode ? SECTOR_COLORS[i % SECTOR_COLORS.length] : (SPECIES_CONFIG[key]?.color || '#ccc');
        const fillColor = isComparisonMode ? SECTOR_FILLS[i % SECTOR_FILLS.length] : color;
        const gradId = `grad-${key.replace(/\s+/g, '-').replace(/[()]/g, '')}`;
        
        const grad = svg.append("defs").append("linearGradient").attr("id", gradId).attr("x1", "0%").attr("y1", "0%").attr("x2", "0%").attr("y2", "100%");
        // Michael: Pastel renforcé (Opacité 0.45 jour / 0.25 nuit)
        grad.append("stop").attr("offset", "0%").attr("stop-color", fillColor).attr("stop-opacity", isActuallyNight ? 0.25 : 0.45);
        grad.append("stop").attr("offset", "100%").attr("stop-color", fillColor).attr("stop-opacity", 0);

        const area = d3.area().x((d: any) => xScale(new Date(d.time))).y0(height).y1((d: any) => yScaleBio(d[key] || 0)).curve(d3.curveMonotoneX);
        const line = d3.line().x((d: any) => xScale(new Date(d.time))).y((d: any) => yScaleBio(d[key] || 0)).curve(d3.curveMonotoneX);
        
        g.append("path").datum(displayData).attr("fill", `url(#${gradId})`).attr("d", area as any);
        const past = displayData.filter((d: any) => d.time <= nowTime);
        const future = displayData.filter((d: any) => d.time >= nowTime);
        if (past.length) g.append("path").datum(past).attr("fill", "none").attr("stroke", color).attr("stroke-width", 3).attr("d", line as any);
        if (future.length) g.append("path").datum(future).attr("fill", "none").attr("stroke", color).attr("stroke-width", 2.5).attr("stroke-dasharray", "6,4").attr("d", line as any);
    });

    // Interaction Line
    const hLine = g.append("line").attr("y1", -15).attr("y2", height).attr("stroke", isActuallyNight ? "#444" : "#ddd").attr("stroke-width", 1).attr("stroke-dasharray", "4,4").style("opacity", 0);
    const overlay = g.append("rect").attr("width", width).attr("height", height).attr("fill", "transparent").style("pointer-events", "all");
    overlay.on("pointermove", (event) => {
        const [mX] = d3.pointer(event);
        const d = displayData[d3.bisector((d: any) => d.time).left(displayData, xScale.invert(mX).getTime(), 1) - 1];
        if (d) { 
            setHoverData(d); setTooltipPos({ x: event.clientX, y: event.clientY }); 
            hLine.attr("x1", xScale(new Date(d.time))).attr("x2", xScale(new Date(d.time))).style("opacity", 1);
        }
    });
    overlay.on("mouseleave touchend", () => { setHoverData(null); hLine.style("opacity", 0); });

    // Navigator
    const navY = height + 45;
    const navG = g.append("g").attr("transform", `translate(0, ${navY})`);
    dayTransitions.forEach(day => {
        const sX = xScale(new Date(Math.max(day.start, xDomain[0])));
        const eX = xScale(new Date(Math.min(day.end, xDomain[1])));
        if (eX > sX) {
            const isActive = zoomRange?.label === day.label;
            const btn = navG.append("g").attr("class", "cursor-pointer").on("click", () => isActive ? setZoomRange(null) : setZoomRange({ start: day.start, end: day.end, label: day.label }));
            btn.append("rect").attr("x", sX).attr("y", -15).attr("width", Math.max(0, eX - sX - 4)).attr("height", 30).attr("rx", 10).attr("fill", isActive ? "#4f46e5" : (isActuallyNight ? "#292524" : "#f5f5f4"));
            btn.append("text").attr("x", sX + (eX - sX) / 2).attr("y", 4).attr("text-anchor", "middle").text(day.label.split(' ')[0]).attr("fill", isActive ? "white" : (isActuallyNight ? "#a8a29e" : "#57534e")).style("font-size", "8px").style("font-weight", "900");
        }
    });

  }, [displayData, isActuallyNight, activeHydro, dataKeys, dayTransitions, nowTime, zoomRange, dimensions, isComparisonMode]);

  return (
    <div ref={containerRef} className={`w-full rounded-2xl border transition-all duration-500 overflow-hidden relative select-none ${isActuallyNight ? 'bg-[#1c1917] border-stone-800' : 'bg-white border-stone-100 shadow-sm'}`}>
      <div className="p-3 flex justify-between items-start border-b border-stone-800/30">
        <div className="flex-1">
          <h3 className={`text-[9px] font-black uppercase tracking-[0.2em] italic ${isActuallyNight ? 'text-indigo-400' : 'text-stone-800'}`}>{title || "ORACLE VISION"}</h3>
          <div className="flex gap-4 mt-1 text-[8px] font-black uppercase tracking-tight">
            <span className="text-amber-500">Bio-Probabilité</span>
            {activeHydro && !isComparisonMode && <span className="text-blue-500">{HYDRO_META[activeHydro].label}</span>}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
            {zoomRange && (
                <button onClick={() => setZoomRange(null)} className="oracle-btn-press px-2 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1.5 text-[8px] font-black uppercase">
                    <RefreshCw size={12} /> Prévisions 72H
                </button>
            )}
            {!isComparisonMode && (
                <div className={`flex p-0.5 rounded-lg border ${isActuallyNight ? 'bg-stone-900 border-stone-800' : 'bg-stone-50 border-stone-100'}`}>
                    {(['waterTemp', 'dissolvedOxygen', 'turbidityNTU'] as HydroMetric[]).map(m => {
                        const Icon = HYDRO_META[m].icon;
                        const isActive = activeHydro === m;
                        return <button key={m} onClick={() => setActiveHydro(isActive ? null : m)} className={`oracle-btn-press p-1.5 rounded-md transition-all ${isActive ? 'bg-indigo-600 text-white shadow-lg' : 'text-stone-500'}`}><Icon size={12} /></button>;
                    })}
                </div>
            )}
        </div>
      </div>

      <svg ref={svgRef} width="100%" height={dimensions.height} className="block overflow-visible touch-none" style={{ touchAction: 'none' }} />

      {hoverData && (
        <div className="fixed pointer-events-none z-50" style={{ left: tooltipPos.x + 15, top: tooltipPos.y - 180 }}>
          <div className={`p-4 rounded-2xl border backdrop-blur-3xl shadow-2xl min-w-[200px] ${isActuallyNight ? 'bg-stone-900/95 border-stone-700 text-stone-100' : 'bg-white/95 border-stone-200 text-stone-800'}`}>
            <div className="flex justify-between items-end mb-3 border-b border-stone-700/50 pb-2">
                <div className="flex flex-col">
                    <span className="text-[13px] font-black text-indigo-400">{format(new Date(hoverData.time), 'HH:mm')}</span>
                    <span className="text-[8px] font-bold text-stone-500 uppercase">{format(new Date(hoverData.time), 'EEEE d MMMM', { locale: fr })}</span>
                </div>
            </div>
            <div className="space-y-2.5">
              {dataKeys.map((key, i) => (
                <div key={key} className="flex justify-between items-center text-[10px] font-black uppercase">
                  <span style={{ color: isComparisonMode ? SECTOR_COLORS[i % SECTOR_COLORS.length] : (SPECIES_CONFIG[key]?.color || '#ccc') }}>{key.split(' (')[0]}</span>
                  <span>{Math.round(hoverData[key])}%</span>
                </div>
              ))}
              <div className="mt-4 pt-3 border-t border-stone-700/50 grid grid-cols-3 gap-2 text-center text-[9px] font-black">
                  <div className="flex flex-col"><span className="text-stone-500 text-[7px]">EAU</span><span className="text-blue-400">{hoverData.waterTemp}°</span></div>
                  <div className="flex flex-col"><span className="text-stone-500 text-[7px]">O2</span><span className="text-emerald-400">{hoverData.dissolvedOxygen}</span></div>
                  <div className="flex flex-col"><span className="text-stone-500 text-[7px]">NTU</span><span className="text-stone-400">{hoverData.turbidityNTU}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OracleChart;