// components/OracleChart.tsx - Version 21.0.0 (Celestial Final - Michael Edition)
// Michael : Fading absolu 14j stabilisé, Lune jaune clair, Nuits bleutées et Zero-Blur.

import React, { useMemo, useState, useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { Thermometer, Waves, Droplets, RefreshCw } from 'lucide-react';
import { format, startOfDay, addDays, setHours, isSameDay, addHours, endOfDay } from 'date-fns';
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
  'perche': { label: 'Perche', color: '#a855f7' }, 
  'blackbass': { label: 'Black-Bass', color: '#6366f1' },
};

const SECTOR_COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#06b6d4'];

const HYDRO_META: Record<HydroMetric, { label: string; color: string; unit: string; icon: any }> = {
  waterTemp: { label: 'TEMP. EAU', color: '#3b82f6', unit: '°C', icon: Thermometer },
  dissolvedOxygen: { label: 'OXYGÈNE', color: '#22c55e', unit: 'mg/L', icon: Droplets },
  turbidityNTU: { label: 'TURBIDITÉ', color: '#a8a29e', unit: 'NTU', icon: Waves }
};

const OracleChart: React.FC<OracleChartProps> = ({ externalData, title, isActuallyNight }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const now = useMemo(() => new Date(), []);
  
  // Michael : 14J par défaut
  const [viewMode, setViewMode] = useState<'focus' | 'standard' | 'macro'>('macro');
  const [viewStart, setViewStart] = useState<number>(0);
  
  const windowWidthMs = useMemo(() => {
    if (viewMode === 'macro') return 14 * 24 * 3600 * 1000;
    if (viewMode === 'focus') return 24 * 3600 * 1000;
    return 84 * 3600 * 1000;
  }, [viewMode]);

  const [activeHydro, setActiveHydro] = useState<HydroMetric | null>(null); 
  const [hoverData, setHoverData] = useState<any | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [dimensions, setDimensions] = useState({ width: 0, height: 380 });

  const margin = { top: 65, right: 45, left: 45, bottom: 45 };

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
    return [...externalData].map(d => ({ ...d, time: d.timestamp || d.time })).sort((a, b) => a.time - b.time);
  }, [externalData]);

  // Sync initial du curseur temporel
  useEffect(() => {
    if (rawData.length > 0 && viewStart === 0) {
        setViewStart(rawData[0].time);
    }
  }, [rawData, viewStart]);

  const dayTransitions = useMemo(() => {
    if (rawData.length === 0) return [];
    const days = [];
    const firstDay = startOfDay(new Date(rawData[0].time));
    for (let i = 0; i < 16; i++) {
        const d = addDays(firstDay, i);
        if (d.getTime() > rawData[rawData.length-1].time) break;
        days.push({
            label: isSameDay(d, now) ? "AUJ." : format(d, 'EEE d', { locale: fr }).toUpperCase(),
            start: startOfDay(d).getTime(),
            end: endOfDay(d).getTime(),
        });
    }
    return days;
  }, [rawData, now]);

  const dataKeys = useMemo(() => {
    if (rawData.length === 0) return [];
    const forbidden = ['time', 'timestamp', 'waterTemp', 'dissolvedOxygen', 'turbidityNTU', 'confidence'];
    return Object.keys(rawData[0]).filter(k => !forbidden.includes(k));
  }, [rawData]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (viewMode !== 'standard') return;
    const target = e.currentTarget;
    const scrollMax = target.scrollWidth - target.clientWidth;
    if (scrollMax <= 0) return;
    const scrollPercent = target.scrollLeft / scrollMax;
    const totalTimeSpan = rawData[rawData.length - 1].time - rawData[0].time - windowWidthMs;
    const newStart = rawData[0].time + (totalTimeSpan * scrollPercent);
    setViewStart(newStart);
  };

  useEffect(() => {
    if (!svgRef.current || rawData.length === 0 || dimensions.width === 0 || viewStart === 0) return;

    const width = dimensions.width - margin.left - margin.right;
    const height = dimensions.height - margin.top - margin.bottom;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    const xScale = d3.scaleTime().domain([new Date(viewStart), new Date(viewStart + windowWidthMs)]).range([0, width]);
    const yScaleBio = d3.scaleLinear().domain([0, 100]).range([height, 0]);

    // Michael : Aura Watermark Centré
    const watermarkText = viewMode === 'macro' ? 'VUE 14J' : viewMode === 'focus' ? 'VUE 24H' : 'VUE 84H';
    g.append("text")
        .attr("x", width / 2).attr("y", 15)
        .attr("text-anchor", "middle")
        .attr("fill", isActuallyNight ? "#4f46e5" : "#6366f1").attr("opacity", 0.15)
        .style("font-size", "18px").style("font-weight", "900")
        .text(watermarkText);

    // Michael : Moteur d'opacité glissante (Evanescence)
    const getGlobalOpacity = (time: number) => {
        const progress = (time - now.getTime()) / (14 * 24 * 3600 * 1000);
        return progress <= 0 ? 1 : Math.max(0.15, 1 - (progress * 0.85));
    };

    // --- DEFS : GRADIENTS (Restauration Fading) ---
    const defs = svg.append("defs");
    dataKeys.forEach((key, i) => {
        const color = SPECIES_CONFIG[key]?.color || SECTOR_COLORS[i % SECTOR_COLORS.length];
        const lineGrad = defs.append("linearGradient").attr("id", `line-grad-${i}`).attr("x1", "0%").attr("y1", "0%").attr("x2", "100%").attr("y2", "0%");
        lineGrad.append("stop").attr("offset", "0%").attr("stop-color", color).attr("stop-opacity", getGlobalOpacity(viewStart));
        lineGrad.append("stop").attr("offset", "100%").attr("stop-color", color).attr("stop-opacity", getGlobalOpacity(viewStart + windowWidthMs));
    });

    // --- RENDU PHASES & ASTRES (Nuits Bleutées & Lune Jaune) ---
    dayTransitions.forEach(day => {
        const sr = setHours(new Date(day.start), 7).getTime();
        const ss = setHours(new Date(day.start), 19).getTime();
        const phases = [{ s: day.start, e: sr, t: 'n' }, { s: sr, e: ss, t: 'd' }, { s: ss, e: day.end, t: 'n' }];
        phases.forEach((p, idx) => {
            const sX = xScale(new Date(p.s));
            const eX = xScale(new Date(p.e));
            if (eX > 0 && sX < width) {
                const drawX = Math.max(0, sX);
                const drawW = Math.min(width, eX) - drawX;
                const nightColor = isActuallyNight ? "#172554" : "#eff6ff";

                g.append("rect").attr("x", drawX).attr("y", -margin.top).attr("width", drawW).attr("height", height + margin.top)
                    .attr("fill", p.t === 'n' ? nightColor : "transparent").attr("opacity", 0.5);

                if (drawW > 30 && viewMode !== 'macro') {
                    const iconX = drawX + drawW/2;
                    if (p.t === 'd') {
                        // Soleil XL
                        const sunG = g.append("g");
                        sunG.append("circle").attr("cx", iconX).attr("cy", -28).attr("r", 4.5).attr("fill", "#f59e0b");
                        for(let a=0; a<360; a+=45) {
                            const r = a * Math.PI / 180;
                            sunG.append("line").attr("x1", iconX + Math.cos(r)*6).attr("y1", -28 + Math.sin(r)*6).attr("x2", iconX + Math.cos(r)*11).attr("y2", -28 + Math.sin(r)*11).attr("stroke", "#f59e0b").attr("stroke-width", 1.5);
                        }
                    } else if (idx === 0) { 
                        // Michael : Lune Jaune Clair (Saphir Edition)
                        g.append("path").attr("d", "M-4 -4 a5 5 0 1 0 6 9 6 6 0 1 1-6-9Z")
                         .attr("transform", `translate(${iconX}, -28) scale(1.1)`)
                         .attr("fill", "#fef3c7").attr("opacity", 0.9);
                    }
                }
            }
        });
    });

    // --- LEGENDE INTEGREE Michael (Z-Order Clean) ---
    const legendG = g.append("g").attr("class", "legend-container");
    let legendX = 0;
    const legendYOffset = viewMode === 'macro' ? -30 : -50;
    dataKeys.forEach((key, i) => {
        const color = SPECIES_CONFIG[key]?.color || SECTOR_COLORS[i % SECTOR_COLORS.length];
        const cleanLabel = key.split(' (')[0].toUpperCase();
        const item = legendG.append("g").attr("transform", `translate(${legendX}, ${legendYOffset})`);
        item.append("circle").attr("r", 3).attr("fill", color);
        item.append("text").attr("x", 8).attr("y", 3.5).attr("fill", isActuallyNight ? "#94a3b8" : "#64748b").style("font-size", "8px").style("font-weight", "900").text(cleanLabel);
        legendX += cleanLabel.length * 6 + 25;
    });
    legendG.attr("transform", `translate(${(width - (legendX - 25)) / 2}, 0)`);

    // --- AXES ---
    const tFormat = viewMode === 'macro' ? (d: any) => format(d, 'EEE d', { locale: fr }) : (d: any) => format(d, 'HH:mm', { locale: fr });
    g.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(xScale).ticks(width / 80).tickFormat(tFormat))
        .attr("color", isActuallyNight ? "#333" : "#cbd5e1").style("font-size", "9px").selectAll("text").attr("fill", "#666").attr("dy", "1.2em");

    g.append("g").call(d3.axisLeft(yScaleBio).ticks(5).tickFormat(d => d + "%"))
        .attr("color", isActuallyNight ? "#333" : "#e2e8f0").style("font-size", "8px").selectAll("text").attr("fill", "#666");

    // --- COURBES BIO (Slim-Fit 2.8) ---
    dataKeys.forEach((key, i) => {
        const color = SPECIES_CONFIG[key]?.color || SECTOR_COLORS[i % SECTOR_COLORS.length];
        const lineGen = d3.line<any>().x(d => xScale(new Date(d.time))).y(d => yScaleBio(d[key] || 0)).curve(d3.curveBasis);
        const visibleData = rawData.filter(d => d.time >= viewStart - windowWidthMs/4 && d.time <= viewStart + windowWidthMs + windowWidthMs/4);
        g.append("path").datum(visibleData).attr("fill", "none").attr("stroke", `url(#line-grad-${i})`).attr("stroke-width", 2.8).attr("stroke-linecap", "round").attr("d", lineGen as any);
    });

    if (activeHydro) {
        const hVals = rawData.map(d => d[activeHydro]);
        const yScaleHydro = d3.scaleLinear().domain([d3.min(hVals) * 0.95, d3.max(hVals) * 1.05]).range([height, 0]);
        g.append("g").attr("transform", `translate(${width}, 0)`).call(d3.axisRight(yScaleHydro).ticks(5))
         .attr("color", HYDRO_META[activeHydro].color).style("font-size", "8px").selectAll("text").attr("fill", HYDRO_META[activeHydro].color);
        const lineH = d3.line<any>().x(d => xScale(new Date(d.time))).y(d => yScaleHydro(d[activeHydro] || 0)).curve(d3.curveBasis);
        g.append("path").datum(rawData.filter(d => d.time >= viewStart - 3600000 && d.time <= viewStart + windowWidthMs + 3600000))
            .attr("fill", "none").attr("stroke", HYDRO_META[activeHydro].color).attr("stroke-width", 1.8).attr("opacity", 0.4).attr("stroke-dasharray", "4,2").attr("d", lineH as any);
    }

    // --- TRACKER DYNAMIQUE Michael ---
    const trackerGroup = g.append("g").style("display", "none");
    const vLine = trackerGroup.append("line").attr("y1", 0).attr("y2", height).attr("stroke", isActuallyNight ? "#444" : "#ddd").attr("stroke-width", 1).attr("stroke-dasharray", "4,4");
    const dots = dataKeys.map((key, i) => trackerGroup.append("circle").attr("r", 4.5).attr("fill", "white").attr("stroke", SPECIES_CONFIG[key]?.color || SECTOR_COLORS[i % SECTOR_COLORS.length]).attr("stroke-width", 2));

    const overlay = g.append("rect").attr("width", width).attr("height", height).attr("fill", "transparent").style("pointer-events", "all");
    overlay.on("pointermove touchmove", (event) => {
        const [mX] = d3.pointer(event);
        const d = rawData[d3.bisector((d: any) => d.time).center(rawData, xScale.invert(mX).getTime())];
        if (d && mX >= 0 && mX <= width) { 
            trackerGroup.style("display", null);
            const xPos = xScale(new Date(d.time));
            vLine.attr("x1", xPos).attr("x2", xPos);
            dots.forEach((dot, i) => dot.attr("cx", xPos).attr("cy", yScaleBio(d[dataKeys[i]] || 0)));
            setHoverData(d); setTooltipPos({ x: event.clientX, y: event.clientY }); 
        }
    });
    overlay.on("mouseleave touchend", () => { trackerGroup.style("display", "none"); setHoverData(null); });

  }, [rawData, viewStart, activeHydro, dimensions, isActuallyNight, now, dataKeys, viewMode, windowWidthMs]);

  return (
    <div ref={containerRef} className={`w-full rounded-3xl border transition-all duration-500 overflow-hidden relative select-none flex flex-col ${isActuallyNight ? 'bg-[#0c0a09] border-stone-800' : 'bg-white border-stone-100 shadow-xl'}`}>
      
      <div className="p-4 flex justify-between items-center border-b border-stone-800/20 gap-3">
        <div className={`flex p-0.5 rounded-lg border ${isActuallyNight ? 'bg-stone-900 border-stone-800' : 'bg-stone-50 border-stone-100'}`}>
            {(['waterTemp', 'dissolvedOxygen', 'turbidityNTU'] as HydroMetric[]).map(m => {
                const Icon = HYDRO_META[m].icon;
                return <button key={m} onClick={() => setActiveHydro(activeHydro === m ? null : m)} className={`p-1.5 rounded-md transition-all ${activeHydro === m ? 'bg-indigo-600 text-white shadow-lg' : 'text-stone-400 hover:text-stone-500'}`}><Icon size={12} /></button>;
            })}
        </div>

        <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] italic ${isActuallyNight ? 'text-indigo-400' : 'text-stone-800'}`}>{title || "ORACLE VISION"}</h3>

        <div className={`flex p-0.5 rounded-full border ${isActuallyNight ? 'bg-stone-900 border-stone-800' : 'bg-stone-100 border-stone-200'}`}>
            <button onClick={() => { setViewMode('standard'); setViewStart(addHours(now, -12).getTime()); }} className={`px-3 py-1 rounded-full text-[9px] font-black transition-all ${viewMode !== 'macro' ? 'bg-indigo-600 text-white shadow-lg' : 'text-stone-400'}`}>84H</button>
            <button onClick={() => { setViewMode('macro'); setViewStart(rawData[0].time); }} className={`px-3 py-1 rounded-full text-[9px] font-black transition-all ${viewMode === 'macro' ? 'bg-indigo-600 text-white shadow-lg' : 'text-stone-400'}`}>14J</button>
        </div>
      </div>

      <div className="flex-1 relative pt-4">
        <svg ref={svgRef} width="100%" height={dimensions.height} className="block overflow-visible touch-none" />
      </div>

      {viewMode !== 'macro' && (
        <div className="px-4 pb-6 mt-2">
            <div ref={scrollRef} onScroll={handleScroll} className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide no-scrollbar items-center cursor-ew-resize">
                {dayTransitions.map((day, idx) => {
                    const center = viewStart + (windowWidthMs / 2);
                    const isActive = center >= day.start && center <= day.end;
                    return (
                        <button key={idx} onClick={() => { setViewMode('focus'); setViewStart(day.start); }} className={`flex-shrink-0 min-w-[105px] py-3 rounded-2xl text-[10px] font-black uppercase transition-all border-2 text-center shadow-sm ${
                            isActive ? 'bg-indigo-600 border-indigo-400 text-white shadow-indigo-500/40 scale-105 z-10' : (isActuallyNight ? 'bg-stone-900 border-stone-800 text-stone-500' : 'bg-stone-50 border-stone-100 text-stone-400')
                        }`}>
                            {day.label}
                        </button>
                    );
                })}
            </div>
        </div>
      )}

      {hoverData && (
        <div 
            className="fixed pointer-events-none z-[100] transition-transform duration-100" 
            style={{ 
                left: tooltipPos.x, top: tooltipPos.y - 180,
                transform: tooltipPos.x > (dimensions.width / 2) ? 'translateX(-115%)' : 'translateX(25px)'
            }}
        >
          <div className={`p-4 rounded-3xl border-2 backdrop-blur-3xl shadow-2xl min-w-[180px] ${isActuallyNight ? 'bg-stone-900/95 border-indigo-500/30 text-stone-100' : 'bg-white/95 border-indigo-100 text-stone-800'}`}>
            <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-black text-indigo-500">{format(new Date(hoverData.time), 'HH:mm')}</span>
                <span className="text-[9px] font-bold opacity-50 uppercase">{format(new Date(hoverData.time), 'EEE d MMM', { locale: fr })}</span>
            </div>
            <div className="space-y-1.5">
              {dataKeys.map((key, i) => (
                <div key={key} className="flex justify-between items-center text-[10px] font-black uppercase">
                  <span style={{ color: SPECIES_CONFIG[key]?.color || SECTOR_COLORS[i % SECTOR_COLORS.length] }}>{key.split(' (')[0]}</span>
                  <span>{Math.round(hoverData[key])}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OracleChart;