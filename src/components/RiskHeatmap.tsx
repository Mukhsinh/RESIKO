'use client';
import React from 'react';

export interface HeatmapPoint {
    id: string;
    x: number; // Dampak 1-5
    y: number; // Probabilitas 1-5
    label: string;
    type?: 'inherent' | 'residual' | 'appetite';
}

interface RiskHeatmapProps {
    data: HeatmapPoint[];
}

export function getAppetiteCoords(score: number) {
    const sc = Math.max(1, Math.min(25, score));
    if (sc <= 2) return { p: 1, d: sc };
    if (sc <= 4) return { p: 2, d: Math.ceil(sc / 2) };
    if (sc <= 6) return { p: 2, d: 3 };
    if (sc <= 9) return { p: 3, d: Math.ceil(sc / 3) };
    if (sc <= 12) return { p: 3, d: 4 };
    if (sc <= 16) return { p: 4, d: 4 };
    return { p: 5, d: 5 };
}

const PROB_LABELS = ['', 'Sangat Jarang', 'Jarang', 'Kadang', 'Sering', 'Sangat Sering'];
const IMPACT_LABELS = ['', 'Sangat Ringan', 'Ringan', 'Sedang', 'Berat', 'Sangat Berat'];

function getCellClass(x: number, y: number) {
    const s = x * y;
    if (s >= 15) return 'bg-red-500 border-red-600';
    if (s >= 10) return 'bg-orange-500 border-orange-600';
    if (s >= 5) return 'bg-yellow-400 border-yellow-500';
    return 'bg-emerald-500 border-emerald-600';
}

function getCellLabel(x: number, y: number) {
    const s = x * y;
    if (s >= 15) return 'Sangat Tinggi';
    if (s >= 10) return 'Tinggi';
    if (s >= 5) return 'Sedang';
    return 'Rendah';
}

function MarkerDot({ type, label }: { type?: string; label: string }) {
    const base = 'w-5 h-5 flex-shrink-0 shadow-md cursor-pointer relative group border-2 border-white';
    let cls = base;
    let ch = '';
    if (type === 'inherent') { cls += ' bg-red-500 rotate-45'; ch = 'I'; }
    else if (type === 'residual') { cls += ' bg-emerald-500 rounded-full'; ch = 'R'; }
    else if (type === 'appetite') { cls += ' bg-blue-500 rounded-sm'; ch = 'A'; }
    else { cls += ' bg-slate-600 rounded-full'; }

    return (
        <div className="relative flex items-center justify-center group">
            <div className={cls} title={`[${type?.toUpperCase()}] ${label}`}>
                <span className="text-[8px] font-bold text-white absolute inset-0 flex items-center justify-center" style={type === 'inherent' ? { transform: 'rotate(-45deg)' } : {}}>
                    {ch}
                </span>
            </div>
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col z-50 w-56 bg-slate-800 text-white text-xs rounded-lg p-2 shadow-xl pointer-events-none">
                <span className="font-semibold text-amber-300 uppercase">{type}</span>
                <span className="mt-1 leading-snug">{label}</span>
            </div>
        </div>
    );
}

export default function RiskHeatmap({ data }: RiskHeatmapProps) {
    const levels = [5, 4, 3, 2, 1];

    return (
        <div className="w-full flex flex-col items-center select-none">
            <div className="flex w-full overflow-x-auto">
                {/* Y-Axis label */}
                <div className="flex flex-col items-center justify-center pr-3 w-6">
                    <span className="-rotate-90 text-[10px] uppercase font-bold text-slate-500 tracking-widest whitespace-nowrap">
                        Probabilitas
                    </span>
                </div>
                {/* Y-Axis numbers */}
                <div className="flex flex-col justify-around mr-1">
                    {levels.map(y => (
                        <div key={y} className="flex items-center justify-end w-12 text-xs text-slate-400 font-mono" style={{ height: '80px' }}>
                            <span title={PROB_LABELS[y]}>{y}</span>
                        </div>
                    ))}
                </div>
                {/* Grid */}
                <div className="flex-1">
                    <div className="inline-grid w-full" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: '2px' }}>
                        {levels.map(y =>
                            [1, 2, 3, 4, 5].map(x => {
                                const pts = data.filter(d => Math.round(d.x) === x && Math.round(d.y) === y);
                                return (
                                    <div
                                        key={`${x}-${y}`}
                                        className={`relative border ${getCellClass(x, y)} flex flex-wrap items-start content-start gap-1 p-1 transition-all hover:opacity-90`}
                                        style={{ minHeight: '80px' }}
                                        title={`${getCellLabel(x, y)} (P:${y} D:${x}) = ${x * y}`}
                                    >
                                        <span className={`absolute bottom-0.5 right-1 text-[9px] font-mono font-bold ${x * y >= 5 && x * y < 10 ? 'text-slate-800/60' : 'text-white/60'}`}>{x * y}</span>
                                        {pts.map((pt, i) => (
                                            <MarkerDot key={i} type={pt.type} label={pt.label} />
                                        ))}
                                    </div>
                                );
                            })
                        )}
                    </div>
                    {/* X-Axis numbers */}
                    <div className="inline-grid w-full mt-1" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: '2px' }}>
                        {[1, 2, 3, 4, 5].map(x => (
                            <div key={x} className="text-center text-xs text-slate-400 font-mono truncate px-1" title={IMPACT_LABELS[x]}>{x}</div>
                        ))}
                    </div>
                </div>
            </div>
            <div className="mt-1 text-center text-[10px] uppercase font-bold text-slate-500 tracking-widest">Dampak</div>

            {/* Legend */}
            <div className="mt-5 flex flex-wrap items-center gap-4 justify-center text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-xl px-6 py-3 w-full">
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-red-500 border border-red-600 rounded-sm" /><span>Sangat Tinggi (≥15)</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-orange-500 border border-orange-600 rounded-sm" /><span>Tinggi (10–14)</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-yellow-400 border border-yellow-500 rounded-sm" /><span>Sedang (5–9)</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-emerald-500 border border-emerald-600 rounded-sm" /><span>Rendah (&lt;5)</span></div>
                <div className="w-px h-4 bg-slate-200" />
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-red-500 rotate-45 border border-white" /><span className="ml-1">Inherent (I)</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-emerald-500 rounded-full border border-white" /><span>Residual (R)</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-blue-500 rounded-sm border border-white" /><span>Appetite (A)</span></div>
            </div>
        </div>
    );
}
