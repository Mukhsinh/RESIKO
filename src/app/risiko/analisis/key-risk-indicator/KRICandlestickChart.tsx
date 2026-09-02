'use client';

import React, { useState, useMemo } from 'react';
import {
    AlertTriangle, ShieldAlert, CheckCircle2, TrendingUp, TrendingDown,
    Filter, Info, Eye, Layers, BarChart2, Activity, ArrowUpRight, Check,
    Target, Gauge, Sliders
} from 'lucide-react';
import { KRIRow, getKRIStatus } from './page';

interface WorkUnit {
    id: string;
    name: string;
}

interface KRICandlestickChartProps {
    rows: KRIRow[];
    units: WorkUnit[];
    selectedUnitFilter: string;
    onUnitFilterChange: (unitId: string) => void;
    onViewDetail: (row: KRIRow) => void;
}

export default function KRISpeedometerChart({
    rows,
    units,
    selectedUnitFilter,
    onUnitFilterChange,
    onViewDetail
}: KRICandlestickChartProps) {
    const [sortBy, setSortBy] = useState<'status' | 'unit' | 'code'>('status');
    const [hoveredRow, setHoveredRow] = useState<KRIRow | null>(null);
    const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

    // Process & Filter KRI items
    const processedItems = useMemo(() => {
        let items = [...rows];

        // Apply Unit Filter
        if (selectedUnitFilter) {
            items = items.filter(r => r.unit_kerja_id === selectedUnitFilter || r.unit_kerja?.id === selectedUnitFilter);
        }

        // Sorting
        items.sort((a, b) => {
            const statusOrder = { 'Over Limit': 0, 'Mendekati Batas': 1, 'Di Bawah Batas': 2, 'Normal': 3 };
            if (sortBy === 'status') {
                const stA = statusOrder[getKRIStatus(a)] ?? 99;
                const stB = statusOrder[getKRIStatus(b)] ?? 99;
                if (stA !== stB) return stA - stB;
            } else if (sortBy === 'unit') {
                const uA = a.unit_kerja?.nama_unit || '';
                const uB = b.unit_kerja?.nama_unit || '';
                if (uA !== uB) return uA.localeCompare(uB);
            } else if (sortBy === 'code') {
                const cA = a.kode_risiko || a.nama_kri;
                const cB = b.kode_risiko || b.nama_kri;
                return cA.localeCompare(cB);
            }
            return (a.nama_kri || '').localeCompare(b.nama_kri || '');
        });

        return items;
    }, [rows, selectedUnitFilter, sortBy]);

    const handleMouseMove = (e: React.MouseEvent) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setMousePos({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        });
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-8 relative">
            {/* Floating Information Label Tooltip on Hover */}
            {hoveredRow && (
                <div
                    className="pointer-events-none absolute z-50 bg-slate-900/95 text-white backdrop-blur-md rounded-2xl p-4 shadow-2xl border border-slate-700 w-80 transition-all duration-150"
                    style={{
                        left: Math.min(mousePos.x + 15, 600),
                        top: Math.max(10, mousePos.y - 140)
                    }}
                >
                    <div className="flex items-center justify-between gap-2 border-b border-slate-700/80 pb-2 mb-2">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-[10.5px] font-bold text-indigo-300">
                            🏢 {hoveredRow.unit_kerja?.nama_unit || 'Unit Kerja'}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold tracking-wide uppercase ${getKRIStatus(hoveredRow) === 'Over Limit'
                                ? 'bg-red-600 text-white'
                                : getKRIStatus(hoveredRow) === 'Mendekati Batas'
                                    ? 'bg-amber-400 text-slate-950 font-bold'
                                    : getKRIStatus(hoveredRow) === 'Di Bawah Batas'
                                        ? 'bg-blue-500 text-white font-bold'
                                        : 'bg-emerald-500 text-slate-950 font-bold'
                            }`}>
                            {getKRIStatus(hoveredRow)}
                        </span>
                    </div>

                    <div className="mb-3">
                        {hoveredRow.kode_risiko && (
                            <span className="text-[11px] font-mono text-indigo-400 block">
                                {hoveredRow.kode_risiko}
                            </span>
                        )}
                        <h5 className="font-bold text-xs text-slate-100 leading-snug">
                            {hoveredRow.nama_kri}
                        </h5>
                    </div>

                    <div className="grid grid-cols-3 gap-2 bg-slate-800/80 rounded-xl p-2.5 text-center text-[11px] mb-2 font-mono">
                        <div>
                            <span className="text-slate-400 text-[9.5px] block">Min (Bawah)</span>
                            <span className="font-bold text-blue-400">{hoveredRow.batas_bawah ?? 0}</span>
                        </div>
                        <div>
                            <span className="text-slate-400 text-[9.5px] block">Nilai Aktual</span>
                            <span className={`font-extrabold ${getKRIStatus(hoveredRow) === 'Over Limit' ? 'text-red-500 text-xs' : 'text-white'}`}>
                                {hoveredRow.nilai_aktual ?? 0} {hoveredRow.satuan}
                            </span>
                        </div>
                        <div>
                            <span className="text-slate-400 text-[9.5px] block">Max (Atas)</span>
                            <span className="font-bold text-red-400">{hoveredRow.batas_atas ?? 0}</span>
                        </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span>Utilisasi Max: <strong className="text-white">
                            {hoveredRow.batas_atas ? Math.round(((hoveredRow.nilai_aktual ?? 0) / hoveredRow.batas_atas) * 100) : 0}%
                        </strong></span>
                        <span className="text-indigo-300 font-medium">💡 Klik untuk detail KRI</span>
                    </div>
                </div>
            )}

            {/* Header Section */}
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3 shrink-0">
                        <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center shadow-md shadow-red-200 shrink-0">
                            <Gauge size={22} />
                        </div>
                        <div>
                            <h3 className="text-base font-extrabold text-slate-900">
                                Speedometer Position Key Risk Indicator (KRI)
                            </h3>
                        </div>
                    </div>

                    {/* Controls Bar - Fully Responsive */}
                    <div className="flex flex-wrap items-center gap-2.5 max-w-full">
                        {/* Unit Filter */}
                        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm text-xs max-w-full min-w-0 flex-1 sm:flex-initial">
                            <Filter size={13} className="text-slate-400 shrink-0" />
                            <select
                                value={selectedUnitFilter}
                                onChange={e => onUnitFilterChange(e.target.value)}
                                className="bg-transparent font-medium text-slate-700 focus:outline-none cursor-pointer w-full min-w-0 truncate pr-1"
                            >
                                <option value="">Semua Unit Kerja ({rows.length} KRI)</option>
                                {units.map(u => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Sort Order */}
                        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm text-xs max-w-full min-w-0 flex-1 sm:flex-initial">
                            <span className="text-slate-400 font-medium shrink-0">Urut:</span>
                            <select
                                value={sortBy}
                                onChange={e => setSortBy(e.target.value as any)}
                                className="bg-transparent font-medium text-slate-700 focus:outline-none cursor-pointer w-full min-w-0 truncate pr-1"
                            >
                                <option value="status">Status (Prioritas Over Limit)</option>
                                <option value="unit">Nama Unit Kerja</option>
                                <option value="code">Kode KRI</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="p-6" onMouseMove={handleMouseMove}>
                {processedItems.length === 0 ? (
                    <div className="py-16 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
                        <AlertTriangle className="mx-auto mb-2 text-slate-300" size={32} />
                        <p className="font-semibold text-slate-600">Tidak Ada Data Key Risk Indicator</p>
                        <p className="text-xs text-slate-400 mt-1">Pilih unit kerja lain atau tambahkan data KRI terlebih dahulu.</p>
                    </div>
                ) : (
                    /* SPEEDOMETER GAUGES GRID VIEW */
                    <SpeedometerGrid
                        items={processedItems}
                        hoveredRow={hoveredRow}
                        setHoveredRow={setHoveredRow}
                        onViewDetail={onViewDetail}
                    />
                )}
            </div>
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* SPEEDOMETER SVG GAUGE COMPONENT (Vector Semi-Circle Gauge)                 */
/* ─────────────────────────────────────────────────────────────────────────── */
function SpeedometerSVG({
    bawah,
    atas,
    aktual,
    status,
    satuan,
    size = 200
}: {
    bawah: number;
    atas: number;
    aktual: number;
    status: string;
    satuan?: string;
    size?: number;
}) {
    const cx = 100;
    const cy = 95;
    const radius = 70;
    const strokeWidth = 14;

    const pctAktual = atas > 0 ? (aktual / atas) * 100 : 0;
    const pctBawah = atas > 0 ? (bawah / atas) * 100 : 0;
    const pctAtas = 100;

    // Angle mapping: -180 deg (left) to 0 deg (right)
    const valToAngle = (valPct: number) => {
        const ratio = Math.min(1.3, Math.max(0, valPct / 120));
        return -180 + ratio * 180;
    };

    const angleBawah = valToAngle(pctBawah);
    const angleAtas = valToAngle(pctAtas);
    const angleAktual = valToAngle(pctAktual);

    // Color definitions
    const isOverLimit = status === 'Over Limit';
    const isMendekati = status === 'Mendekati Batas';
    const isDiBawah = status === 'Di Bawah Batas';

    const needleColor = isOverLimit
        ? '#dc2626'
        : isMendekati
            ? '#f59e0b'
            : isDiBawah
                ? '#2563eb'
                : '#10b981';

    // Helper for SVG Arc path calculation
    const getArcPath = (startAngle: number, endAngle: number, r = radius) => {
        const rad = (a: number) => (a * Math.PI) / 180;
        const x1 = cx + r * Math.cos(rad(startAngle));
        const y1 = cy + r * Math.sin(rad(startAngle));
        const x2 = cx + r * Math.cos(rad(endAngle));
        const y2 = cy + r * Math.sin(rad(endAngle));
        const largeArc = endAngle - startAngle > 180 ? 1 : 0;
        return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
    };

    // Calculate needle tip point
    const needleRad = (angleAktual * Math.PI) / 180;
    const needleLen = radius - 8;
    const needleX = cx + needleLen * Math.cos(needleRad);
    const needleY = cy + needleLen * Math.sin(needleRad);

    return (
        <svg viewBox="0 0 200 135" width={size} height={size * 0.675} className="overflow-visible select-none mx-auto">
            <defs>
                <filter id="gauge-shadow" x="-10%" y="-10%" width="120%" height="120%">
                    <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.15" />
                </filter>
            </defs>

            {/* Background Arc Track */}
            <path
                d={getArcPath(-180, 0)}
                fill="none"
                stroke="#e2e8f0"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
            />

            {/* Blue Zone (Di Bawah Batas Bawah) */}
            <path
                d={getArcPath(-180, Math.min(-5, angleBawah))}
                fill="none"
                stroke="#2563eb"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
            />

            {/* Green Zone (Normal Aman: Batas Bawah -> 80% Batas Atas) */}
            <path
                d={getArcPath(angleBawah, valToAngle(80))}
                fill="none"
                stroke="#10b981"
                strokeWidth={strokeWidth}
            />

            {/* Amber Zone (Mendekati Batas: 80% -> 100% Batas Atas) */}
            <path
                d={getArcPath(valToAngle(80), angleAtas)}
                fill="none"
                stroke="#f59e0b"
                strokeWidth={strokeWidth}
            />

            {/* Red Zone (Over Limit: > 100% Batas Atas) */}
            <path
                d={getArcPath(angleAtas, 0)}
                fill="none"
                stroke="#dc2626"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
            />

            {/* Batas Bawah Marker Line (SOLID BLUE) */}
            {(() => {
                const rad = (angleBawah * Math.PI) / 180;
                const rInner = radius - strokeWidth / 2 - 4;
                const rOuter = radius + strokeWidth / 2 + 4;
                return (
                    <line
                        x1={cx + rInner * Math.cos(rad)}
                        y1={cy + rInner * Math.sin(rad)}
                        x2={cx + rOuter * Math.cos(rad)}
                        y2={cy + rOuter * Math.sin(rad)}
                        stroke="#1e3a8a"
                        strokeWidth={3}
                    />
                );
            })()}

            {/* Batas Atas Marker Line (SOLID RED) */}
            {(() => {
                const rad = (angleAtas * Math.PI) / 180;
                const rInner = radius - strokeWidth / 2 - 4;
                const rOuter = radius + strokeWidth / 2 + 4;
                return (
                    <line
                        x1={cx + rInner * Math.cos(rad)}
                        y1={cy + rInner * Math.sin(rad)}
                        x2={cx + rOuter * Math.cos(rad)}
                        y2={cy + rOuter * Math.sin(rad)}
                        stroke="#7f1d1d"
                        strokeWidth={3}
                    />
                );
            })()}

            {/* Needle Pointer */}
            <g filter="url(#gauge-shadow)">
                <line
                    x1={cx}
                    y1={cy}
                    x2={needleX}
                    y2={needleY}
                    stroke={needleColor}
                    strokeWidth={4}
                    strokeLinecap="round"
                />
                {/* Center Hub */}
                <circle cx={cx} cy={cy} r={8} fill="#0f172a" stroke="#ffffff" strokeWidth={2.5} />
                <circle cx={cx} cy={cy} r={3.5} fill={needleColor} />
            </g>

            {/* Labels at base */}
            <text x={18} y={cy + 18} className="text-[9.5px] font-mono fill-blue-600 font-extrabold" textAnchor="start">
                Min {bawah}
            </text>
            <text x={182} y={cy + 18} className="text-[9.5px] font-mono fill-red-600 font-extrabold" textAnchor="end">
                Max {atas}
            </text>

            {/* Digital Readout Center Value */}
            <text x={cx} y={cy + 22} textAnchor="middle" className="text-sm font-extrabold fill-slate-900 font-mono">
                {aktual} {satuan || ''}
            </text>
        </svg>
    );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* SPEEDOMETER GRID VIEW                                                      */
/* ─────────────────────────────────────────────────────────────────────────── */
function SpeedometerGrid({
    items,
    hoveredRow,
    setHoveredRow,
    onViewDetail
}: {
    items: KRIRow[];
    hoveredRow: KRIRow | null;
    setHoveredRow: (row: KRIRow | null) => void;
    onViewDetail: (row: KRIRow) => void;
}) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {items.map(row => {
                const status = getKRIStatus(row);
                const unitName = row.unit_kerja?.nama_unit || 'Unit Umum';
                const kodeStr = row.kode_risiko || 'KRI';
                const namaStr = row.nama_kri;

                const bawah = row.batas_bawah ?? 0;
                const atas = row.batas_atas ?? 1;
                const aktual = row.nilai_aktual ?? 0;
                const pct = atas > 0 ? Math.round((aktual / atas) * 100) : 0;

                const isOverLimit = status === 'Over Limit';
                const isMendekati = status === 'Mendekati Batas';
                const isDiBawah = status === 'Di Bawah Batas';
                const isHovered = hoveredRow?.id === row.id;

                const badgeBg = isOverLimit
                    ? 'bg-red-600 text-white'
                    : isMendekati
                        ? 'bg-amber-400 text-slate-950 font-bold'
                        : isDiBawah
                            ? 'bg-blue-600 text-white font-bold'
                            : 'bg-emerald-500 text-slate-950 font-bold';

                return (
                    <div
                        key={row.id}
                        onMouseEnter={() => setHoveredRow(row)}
                        onMouseLeave={() => setHoveredRow(null)}
                        onClick={() => onViewDetail(row)}
                        className={`bg-white border rounded-2xl p-5 shadow-sm transition-all duration-200 cursor-pointer flex flex-col justify-between group ${isHovered
                                ? 'border-red-400 shadow-md ring-2 ring-red-100/60 translate-y-[-2px]'
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                    >
                        {/* Top Card Header */}
                        <div>
                            <div className="flex items-center justify-between gap-2 mb-2">
                                <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-[11px] font-bold text-slate-700 truncate max-w-[65%]">
                                    🏢 {unitName}
                                </span>
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${badgeBg}`}>
                                    {status}
                                </span>
                            </div>

                            <div className="mt-1">
                                <span className="text-xs font-mono font-bold text-red-700 block">{kodeStr}</span>
                                <h4 className="font-bold text-slate-900 text-sm group-hover:text-red-600 transition-colors line-clamp-2">
                                    {namaStr}
                                </h4>
                            </div>
                        </div>

                        {/* Speedometer Gauge Visualizer */}
                        <div className="my-4 py-2 bg-slate-50/70 rounded-2xl border border-slate-100 flex flex-col items-center justify-center">
                            <SpeedometerSVG
                                bawah={bawah}
                                atas={atas}
                                aktual={aktual}
                                status={status}
                                satuan={row.satuan}
                                size={190}
                            />
                            <div className="text-[11px] font-mono text-slate-500 mt-1">
                                Utilisasi Max: <strong className={isOverLimit ? 'text-red-600 font-extrabold' : 'text-slate-800'}>{pct}%</strong>
                            </div>
                        </div>

                        {/* Card Footer */}
                        <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-500">
                            <span>Frekuensi: <strong className="text-slate-700">{row.frekuensi || 'Bulanan'}</strong></span>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onViewDetail(row);
                                }}
                                className="text-red-600 hover:text-red-800 font-bold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform"
                            >
                                <Eye size={14} /> Detail KRI
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
