'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { supabase, type ManajemenStrategi, type UnitKerja } from '@/lib/supabase';
import { PageHeader, ScoreCard, FilterBar, TopActionBar } from '@/components/SharedUI';
import DataTable, { type Column } from '@/components/DataTable';
import FormInputAI from '@/components/FormInputAI';
import { Plus, Download, Upload, FileText, TrendingUp, Target, CheckCircle2, Clock, Save, X, Loader2, Eye, Search } from 'lucide-react';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useAppSettings } from '@/hooks/useAppSettings';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const CURRENT_YEAR = new Date().getFullYear();

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const PERIODE_LABELS: Record<string, string[]> = {
    tahunan: ['Tahunan'],
    semesteran: ['Semester 1', 'Semester 2'],
    triwulanan: ['Triwulan 1', 'Triwulan 2', 'Triwulan 3', 'Triwulan 4'],
    bulanan: MONTHS,
};

// --- Realisasi JSON encoding/decoding ---
interface RealisasiData { tipe: string; inputs: string[]; rata_rata: number; }

const serializeRealisasi = (tipe: string, inputs: string[]): string => {
    const validNums = inputs.map(i => parseFloat(i)).filter(n => !isNaN(n));
    const avg = validNums.length > 0 ? Math.round((validNums.reduce((a, b) => a + b, 0) / validNums.length) * 100) / 100 : 0;
    return JSON.stringify({ tipe, inputs, rata_rata: avg });
};

const deserializeRealisasi = (val: string | null | undefined): RealisasiData & { rawText: string } => {
    const def = { tipe: 'tahunan', inputs: [''], rata_rata: 0, rawText: val || '' };
    if (!val) return def;
    try {
        const p = JSON.parse(val);
        if (p && typeof p === 'object' && p.tipe) {
            return { tipe: p.tipe, inputs: p.inputs || [''], rata_rata: p.rata_rata || 0, rawText: String(p.rata_rata || '') };
        }
    } catch {
        const num = parseFloat(val);
        return { tipe: 'tahunan', inputs: [val], rata_rata: isNaN(num) ? 0 : num, rawText: val };
    }
    return def;
};

export const getDisplayRealisasi = (val: string | null | undefined): string => {
    const d = deserializeRealisasi(val);
    if (d.rata_rata) return String(d.rata_rata);
    return d.rawText || '-';
};

// Helper functions for mathematically exact SVG arcs (prevents curve distortion / "benjol")
function polarToCartesian(cx: number, cy: number, r: number, angleInDegrees: number) {
    const angleInRadians = (angleInDegrees * Math.PI) / 180.0;
    return {
        x: cx + r * Math.cos(angleInRadians),
        y: cy - r * Math.sin(angleInRadians),
    };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
    const start = polarToCartesian(cx, cy, r, startAngle);
    const end = polarToCartesian(cx, cy, r, endAngle);
    const largeArcFlag = Math.abs(endAngle - startAngle) > 180 ? '1' : '0';
    return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

export interface KpiEvaluation {
    pct: number;
    targetSkor: number;
    realisasiSkor: number;
    levelName: string;
    statusText: string;
    statusClass: string;
    gaugeColor: string;
    badgeBg: string;
}

export function matchCriteriaLabel(val: number, label: string): boolean {
    if (isNaN(val) || !label) return false;
    const cleanLabel = label.replace(/,/g, '.').trim();

    // Check for Range Pattern: e.g. "0.8 < PPNP <= 1" or "30 hari <= PPP < 40 hari" or "1.00 <= PL < 1.10"
    const numbers = cleanLabel.match(/-?\d+(?:\.\d+)?/g)?.map(Number);

    if (numbers && numbers.length >= 2) {
        const low = numbers[0];
        const high = numbers[1];
        const minVal = Math.min(low, high);
        const maxVal = Math.max(low, high);

        const hasLowInclusive = cleanLabel.includes('<=') || cleanLabel.includes('≤');
        const hasHighInclusive = cleanLabel.includes('<=') || cleanLabel.includes('≤');

        const lowPass = hasLowInclusive ? val >= minVal : val > minVal;
        const highPass = hasHighInclusive ? val <= maxVal : val < maxVal;

        return lowPass && highPass;
    }

    // Single Operator Pattern: e.g. "PPNP > 1", "PL >= 1.10", "WTR <= 0,3", "PPP > 100", "RL = 0"
    if (numbers && numbers.length === 1) {
        const num = numbers[0];
        if (cleanLabel.includes('>=') || cleanLabel.includes('≥')) return val >= num;
        if (cleanLabel.includes('<=') || cleanLabel.includes('≤')) return val <= num;
        if (cleanLabel.includes('>') || cleanLabel.includes('lebih dari')) return val > num;
        if (cleanLabel.includes('<') || cleanLabel.includes('kurang dari')) return val < num;
        if (cleanLabel.includes('=')) return Math.abs(val - num) < 0.0001;
    }

    return false;
}

export function evaluateKpi(targetStr: string, realisasiStr: string | null | undefined, kriteriaJson?: string | null): KpiEvaluation {
    const displayVal = getDisplayRealisasi(realisasiStr);
    const cleanVal = displayVal.replace(/,/g, '.');
    const rMatch = cleanVal.match(/-?\d+(?:\.\d+)?/);
    const r = rMatch ? parseFloat(rMatch[0]) : NaN;

    let targetSkor = 4;
    let realisasiSkor = 0;
    let levelName = '-';

    if (kriteriaJson) {
        try {
            const arr = JSON.parse(kriteriaJson);
            if (Array.isArray(arr) && arr.length > 0) {
                // Find all criteria scores
                const parsedItems = arr.map((item: any) => {
                    const s = parseFloat(String(item.skor ?? '').replace(/,/g, '.'));
                    return {
                        skor: isNaN(s) ? 0 : s,
                        label: String(item.label || item.keterangan || '').trim()
                    };
                });

                // Target score is maximum score defined in criteria array (e.g. 2, 3, 4)
                const scores = parsedItems.map(p => p.skor);
                targetSkor = scores.length > 0 ? Math.max(...scores) : 4;

                if (!isNaN(r)) {
                    // Try exact label match using matchCriteriaLabel
                    let matched = parsedItems.find(p => matchCriteriaLabel(r, p.label));

                    if (matched) {
                        realisasiSkor = matched.skor;
                        levelName = matched.label;
                    } else {
                        // Sort by score descending
                        const sorted = [...parsedItems].sort((a, b) => b.skor - a.skor);
                        const top = sorted[0];
                        const bottom = sorted[sorted.length - 1];

                        // Check if r matched target condition in targetStr
                        if (targetStr && matchCriteriaLabel(r, targetStr)) {
                            realisasiSkor = top.skor;
                            levelName = top.label;
                        } else {
                            realisasiSkor = bottom ? bottom.skor : 0;
                            levelName = bottom ? bottom.label : 'Rendah';
                        }
                    }
                }
            }
        } catch { }
    } else {
        // Fallback for standard 4-level numerical percentage
        const tMatch = targetStr ? targetStr.replace(/,/g, '.').match(/-?\d+(?:\.\d+)?/) : null;
        const t = tMatch ? parseFloat(tMatch[0]) : NaN;
        if (!isNaN(t) && !isNaN(r) && t > 0) {
            let pct = (r / t) * 100;
            if (targetStr.includes('≤') || targetStr.toLowerCase().includes('<=') || targetStr.toLowerCase().includes('maksimal')) {
                pct = r <= t ? 100 : (t / r) * 100;
            }
            if (pct >= 100) { realisasiSkor = 4; levelName = 'Istimewa'; }
            else if (pct >= 80) { realisasiSkor = 3; levelName = 'Baik'; }
            else if (pct >= 70) { realisasiSkor = 2; levelName = 'Cukup'; }
            else { realisasiSkor = 1; levelName = 'Rendah'; }
        }
    }

    const pct = targetSkor > 0 ? (realisasiSkor / targetSkor) * 100 : 0;

    let statusClass = 'text-rose-700 bg-rose-50 border-rose-200';
    let gaugeColor = '#ef4444';
    let badgeBg = 'bg-rose-500/10 text-rose-700 border-rose-200';

    if (pct >= 100) {
        statusClass = 'text-emerald-700 bg-emerald-50 border-emerald-200';
        gaugeColor = '#10b981';
        badgeBg = 'bg-emerald-500/10 text-emerald-700 border-emerald-200';
    } else if (pct >= 75) {
        statusClass = 'text-blue-700 bg-blue-50 border-blue-200';
        gaugeColor = '#3b82f6';
        badgeBg = 'bg-blue-500/10 text-blue-700 border-blue-200';
    } else if (pct >= 50) {
        statusClass = 'text-amber-700 bg-amber-50 border-amber-200';
        gaugeColor = '#f59e0b';
        badgeBg = 'bg-amber-500/10 text-amber-700 border-amber-200';
    }

    return {
        pct,
        targetSkor,
        realisasiSkor,
        levelName,
        statusText: `${levelName} (${realisasiSkor}/${targetSkor})`,
        statusClass,
        gaugeColor,
        badgeBg,
    };
}

// --- Speedometer Gauge Component ---
function SpeedometerGauge({
    target,
    realisasi,
    kpiName,
    kriteriaJson
}: {
    target: string;
    realisasi: string | null | undefined;
    kpiName: string;
    kriteriaJson?: string | null;
}) {
    const displayVal = getDisplayRealisasi(realisasi);
    const evalRes = evaluateKpi(target, realisasi, kriteriaJson);
    const pct = evalRes.pct;
    const clampedPctForNeedle = Math.min(Math.max(pct, 0), 120);
    const needleAngle = -90 + (clampedPctForNeedle / 120) * 180;

    const cx = 60;
    const cy = 60;
    const r = 45;
    const strokeWidth = 9;

    // Arcs for 4 levels (0 - 70% Rendah, 70 - 80% Cukup, 80 - 100% Baik, 100 - 120% Istimewa)
    const redArc = describeArc(cx, cy, r, 180, 75);
    const amberArc = describeArc(cx, cy, r, 75, 60);
    const blueArc = describeArc(cx, cy, r, 60, 30);
    const greenArc = describeArc(cx, cy, r, 30, 0);

    const hasPercent = (target && target.includes('%')) || (displayVal && displayVal.includes('%'));
    const targetDisplay = target ? target.trim() : '-';

    let valueDisplay = displayVal;
    if (displayVal !== '-' && hasPercent && !displayVal.includes('%')) {
        valueDisplay = `${displayVal}%`;
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 flex flex-col justify-between h-full hover:shadow-md transition-all duration-200 group">
            <div className="flex flex-col items-center text-center">
                {/* KPI Title */}
                <h4
                    className="text-xs font-bold text-slate-700 tracking-tight uppercase text-center min-h-[2.5rem] flex items-center justify-center break-words line-clamp-3 w-full mb-2 group-hover:text-[#137fec] transition-colors"
                    title={kpiName}
                >
                    {kpiName}
                </h4>

                {/* Speedometer Arc SVG */}
                <div className="relative w-full max-w-[140px] aspect-[120/70] flex items-center justify-center my-1">
                    <svg className="w-full h-full overflow-visible" viewBox="0 0 120 70">
                        <path d={describeArc(cx, cy, r, 180, 0)} fill="none" stroke="#f1f5f9" strokeWidth={strokeWidth + 2} strokeLinecap="round" />
                        <path d={redArc} fill="none" stroke="#ef4444" strokeWidth={strokeWidth} strokeLinecap="round" />
                        <path d={amberArc} fill="none" stroke="#f59e0b" strokeWidth={strokeWidth} />
                        <path d={blueArc} fill="none" stroke="#3b82f6" strokeWidth={strokeWidth} />
                        <path d={greenArc} fill="none" stroke="#10b981" strokeWidth={strokeWidth} strokeLinecap="round" />

                        {/* Needle */}
                        <g transform={`rotate(${needleAngle} ${cx} ${cy})`} className="transition-transform duration-500 ease-out">
                            <line x1={cx} y1={cy} x2={cx} y2={cy - 34} stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" />
                            <circle cx={cx} cy={cy - 34} r="1.5" fill={evalRes.gaugeColor} />
                        </g>

                        {/* Pivot Cap */}
                        <circle cx={cx} cy={cy} r="6" fill="#1e293b" />
                        <circle cx={cx} cy={cy} r="2.5" fill="#ffffff" />
                    </svg>
                </div>

                {/* Value & Target Display */}
                <div className="mt-1 flex flex-col items-center max-w-full">
                    <div className="flex items-baseline gap-0.5">
                        <span className="text-xl font-black tracking-tight text-slate-800">
                            {valueDisplay}
                        </span>
                    </div>
                    <span className="text-[11px] font-medium text-slate-500 mt-0.5 max-w-full truncate" title={`Target: ${targetDisplay}`}>
                        Target: <span className="font-semibold text-slate-700">{targetDisplay}</span>
                    </span>
                </div>
            </div>

            {/* Status Footer Badge */}
            <div className={`mt-3 w-full py-1 px-2 rounded-lg text-center text-[10px] font-extrabold uppercase tracking-wider border ${evalRes.badgeBg} flex items-center justify-center gap-1.5`}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: evalRes.gaugeColor }} />
                {evalRes.levelName} ({evalRes.pct.toFixed(0)}%)
            </div>
        </div>
    );
}

// --- Achievement Badge ---
function AchievementBadge({ target, realisasi, kriteriaJson }: { target: string; realisasi: string; kriteriaJson?: string | null }) {
    const displayVal = getDisplayRealisasi(realisasi);
    const evalRes = evaluateKpi(target, realisasi, kriteriaJson);

    if (displayVal === '-' || !realisasi) {
        return (
            <span className="badge-gray flex items-center justify-center font-bold px-2.5 py-0.5 rounded text-xs whitespace-nowrap bg-slate-100 text-slate-600 border border-slate-200">
                -
            </span>
        );
    }

    const clampedPct = Math.min(Math.max(evalRes.pct, 0), 120);
    const needleAngle = -90 + (clampedPct / 120) * 180;

    const hasPercent = (target && target.includes('%')) || (displayVal && displayVal.includes('%'));
    const valWithUnit = hasPercent && !displayVal.includes('%') ? `${displayVal}%` : displayVal;

    return (
        <div className="flex items-center gap-3 py-1 pl-1 select-none">
            {/* Miniature Gauge */}
            <div className="relative w-12 h-6 flex items-center justify-center">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 60 30">
                    <path d="M 5 26 A 21 21 0 0 1 55 26" fill="none" stroke="#f1f5f9" strokeWidth="5.5" strokeLinecap="round" />
                    <path d="M 5 26 A 21 21 0 0 1 17.25 14.75" fill="none" stroke="#ef4444" strokeWidth="5.5" />
                    <path d="M 17.25 14.75 A 21 21 0 0 1 23.5 10" fill="none" stroke="#f59e0b" strokeWidth="5.5" />
                    <path d="M 23.5 10 A 21 21 0 0 1 42.5 10" fill="none" stroke="#3b82f6" strokeWidth="5.5" />
                    <path d="M 42.5 10 A 21 21 0 0 1 55 26" fill="none" stroke="#10b981" strokeWidth="5.5" strokeLinecap="round" />
                    <g transform={`rotate(${needleAngle} 30 26)`} className="transition-transform duration-500 ease-out">
                        <line x1="30" y1="26" x2="30" y2="8" stroke="#1e293b" strokeWidth="2.2" strokeLinecap="round" />
                    </g>
                    <circle cx="30" cy="26" r="3.5" fill="#1e293b" />
                    <circle cx="30" cy="26" r="1.2" fill="#ffffff" />
                </svg>
            </div>

            {/* Label and Percentage Badge */}
            <div className="flex flex-col items-start leading-none gap-0.5">
                <span className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${evalRes.statusClass} tracking-wider`}>
                    {valWithUnit} ({evalRes.pct.toFixed(0)}%)
                </span>
                <span className="text-[9px] font-semibold text-slate-500 pl-0.5 tracking-tight">{evalRes.levelName}</span>
            </div>
        </div>
    );
}

// --- Form ---
interface FormData {
    tahun: number; unit_kerja_id: string; sasaran_strategis: string; kpi: string;
    target: string; realisasi: string; cascading_id?: string;
    periode_tipe: string; periode_inputs: string[];
}
const defaultForm: FormData = {
    tahun: CURRENT_YEAR, unit_kerja_id: '', sasaran_strategis: '', kpi: '', target: '', realisasi: '',
    periode_tipe: 'tahunan', periode_inputs: [''],
};

export default function MonitoringKPIPage() {
    const { profile } = useUserProfile();
    const { settings } = useAppSettings();
    const [data, setData] = useState<ManajemenStrategi[]>([]);
    const [units, setUnits] = useState<UnitKerja[]>([]);
    const [cascadingData, setCascadingData] = useState<any[]>([]);
    const [cascadingList, setCascadingList] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [year, setYear] = useState(String(CURRENT_YEAR));
    const [filterUnit, setFilterUnit] = useState<string>('all');
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState<FormData>(defaultForm);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (profile?.role === 'user_unit' && profile.unit_kerja_id) setFilterUnit(profile.unit_kerja_id);
    }, [profile]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            let q = supabase.from('manajemen_strategi').select('*, unit_kerja(nama_unit)').order('created_at', { ascending: false });
            if (year) q = q.eq('tahun', Number(year));
            const unitToFilter = profile?.role === 'user_unit' ? profile.unit_kerja_id : (filterUnit === 'all' ? null : filterUnit);
            if (unitToFilter) q = q.eq('unit_kerja_id', unitToFilter);
            const { data: rows, error } = await q;

            let cQ = supabase.from('cascading_kpi').select('*');
            if (year) cQ = cQ.eq('tahun', Number(year));
            if (unitToFilter) cQ = cQ.eq('unit_kerja_id', unitToFilter);
            const { data: cRows } = await cQ;
            setCascadingList(cRows ?? []);

            if (error) { setData([]); } else { setData((rows as ManajemenStrategi[]) ?? []); }
        } catch { setData([]); }
        finally { setLoading(false); }
    }, [year, filterUnit, profile]);

    useEffect(() => {
        fetchData();
        supabase.from('unit_kerja').select('*').order('nama_unit', { ascending: true }).then(({ data: u }: { data: any }) => setUnits(u ?? []));
    }, [fetchData]);

    useEffect(() => {
        if (!form.unit_kerja_id || !form.tahun) { setCascadingData([]); return; }
        supabase.from('cascading_kpi').select('id, kpi, sasaran_strategis, target')
            .eq('unit_kerja_id', form.unit_kerja_id).eq('tahun', form.tahun)
            .then(({ data: cData }: { data: any }) => setCascadingData(cData ?? []));
    }, [form.unit_kerja_id, form.tahun]);

    const handleSelectKpi = (selectedKpiName: string) => {
        const found = cascadingData.find((c: any) => c.kpi === selectedKpiName);
        if (found) setForm(f => ({ ...f, kpi: found.kpi, sasaran_strategis: found.sasaran_strategis || '', target: found.target || '' }));
        else setForm(f => ({ ...f, kpi: selectedKpiName }));
    };

    const handleChangePeriode = (tipe: string) => {
        const labels = PERIODE_LABELS[tipe] || ['Tahunan'];
        setForm(f => ({ ...f, periode_tipe: tipe, periode_inputs: Array(labels.length).fill('') }));
    };

    const handlePeriodeInput = (i: number, val: string) => {
        setForm(f => { const n = [...f.periode_inputs]; n[i] = val; return { ...f, periode_inputs: n }; });
    };

    const getKriteriaForKpi = useCallback((kpiName: string, unitId?: string) => {
        const found = cascadingList.find(c => c.kpi === kpiName && (!unitId || c.unit_kerja_id === unitId));
        return found?.kriteria_nilai || null;
    }, [cascadingList]);

    // Scorecard Detail Modal State
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [detailModalType, setDetailModalType] = useState<'all' | 'achieved' | 'unachieved' | 'summary'>('all');
    const [detailSearch, setDetailSearch] = useState('');

    const evaluatedData = React.useMemo(() => {
        return data.map(item => {
            const crit = getKriteriaForKpi(item.kpi, item.unit_kerja_id);
            const evalRes = evaluateKpi(item.target, item.realisasi, crit);
            const displayVal = getDisplayRealisasi(item.realisasi);
            const isMonitored = displayVal !== '-' && item.realisasi !== null && item.realisasi !== '';
            return {
                ...item,
                crit,
                evalRes,
                displayVal,
                isMonitored,
                isAchieved: evalRes.pct >= 100
            };
        });
    }, [data, cascadingList, getKriteriaForKpi]);

    const filtered = data.filter(d =>
        d.sasaran_strategis?.toLowerCase().includes(search.toLowerCase()) ||
        d.kpi?.toLowerCase().includes(search.toLowerCase())
    );

    const filteredEvaluated = React.useMemo(() => {
        return evaluatedData.filter(d =>
            d.sasaran_strategis?.toLowerCase().includes(search.toLowerCase()) ||
            d.kpi?.toLowerCase().includes(search.toLowerCase())
        );
    }, [evaluatedData, search]);

    const monitoredList = React.useMemo(() => filteredEvaluated.filter(d => d.isMonitored), [filteredEvaluated]);
    const achievedList = React.useMemo(() => filteredEvaluated.filter(d => d.isMonitored && d.isAchieved), [filteredEvaluated]);
    const unachievedList = React.useMemo(() => filteredEvaluated.filter(d => d.isMonitored && !d.isAchieved), [filteredEvaluated]);

    const grandTargetSkor = React.useMemo(() => monitoredList.reduce((acc, curr) => acc + curr.evalRes.targetSkor, 0), [monitoredList]);
    const grandRealSkor = React.useMemo(() => monitoredList.reduce((acc, curr) => acc + curr.evalRes.realisasiSkor, 0), [monitoredList]);
    const overallCapaianPct = grandTargetSkor > 0 ? ((grandRealSkor / grandTargetSkor) * 100).toFixed(1) : '0';

    const openDetailModal = (type: 'all' | 'achieved' | 'unachieved' | 'summary') => {
        setDetailModalType(type);
        setDetailSearch('');
        setDetailModalOpen(true);
    };

    const modalSourceList = React.useMemo(() => {
        if (detailModalType === 'achieved') return achievedList;
        if (detailModalType === 'unachieved') return unachievedList;
        return monitoredList;
    }, [detailModalType, achievedList, unachievedList, monitoredList]);

    const modalFilteredList = React.useMemo(() => {
        if (!detailSearch) return modalSourceList;
        const q = detailSearch.toLowerCase();
        return modalSourceList.filter(item =>
            item.unit_kerja?.nama_unit?.toLowerCase().includes(q) ||
            item.sasaran_strategis?.toLowerCase().includes(q) ||
            item.kpi?.toLowerCase().includes(q)
        );
    }, [modalSourceList, detailSearch]);

    // All KPIs for speedometer gauges
    const gaugeData = filtered.map(d => {
        const crit = getKriteriaForKpi(d.kpi, d.unit_kerja_id);
        return {
            kpi: d.kpi,
            target: d.target || '',
            realisasi: d.realisasi,
            kriteriaJson: crit
        };
    });

    const openAdd = () => {
        setEditId(null);
        const newForm = { ...defaultForm };
        if (profile?.role === 'user_unit' && profile.unit_kerja_id) newForm.unit_kerja_id = profile.unit_kerja_id;
        setForm(newForm); setShowModal(true);
    };

    const openEdit = (row: ManajemenStrategi) => {
        setEditId(row.id);
        const d = deserializeRealisasi(row.realisasi);
        setForm({
            tahun: row.tahun, unit_kerja_id: row.unit_kerja_id,
            sasaran_strategis: row.sasaran_strategis, kpi: row.kpi, target: row.target,
            realisasi: row.realisasi,
            periode_tipe: d.tipe, periode_inputs: d.inputs,
        });
        setShowModal(true);
    };

    const handleDelete = async (row: ManajemenStrategi) => {
        if (!confirm(`Hapus monitoring "${row.kpi.slice(0, 50)}"?`)) return;
        await supabase.from('manajemen_strategi').delete().eq('id', row.id);
        fetchData();
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault(); setSaving(true);
        try {
            const serializedRealisasi = serializeRealisasi(form.periode_tipe, form.periode_inputs);
            const payload = {
                tahun: form.tahun, unit_kerja_id: form.unit_kerja_id,
                sasaran_strategis: form.sasaran_strategis, kpi: form.kpi, target: form.target,
                realisasi: serializedRealisasi,
            };
            let result;
            if (editId) { result = await supabase.from('manajemen_strategi').update(payload).eq('id', editId); }
            else { result = await supabase.from('manajemen_strategi').insert(payload); }
            if (result.error) { alert('Gagal menyimpan data: ' + result.error.message); }
            else { setShowModal(false); fetchData(); }
        } catch { alert('Terjadi kesalahan saat menyimpan data'); }
        finally { setSaving(false); }
    };

    const handleExportPDF = () => {
        const doc = new jsPDF('p', 'pt', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        const hexToRgb = (hex: string): [number, number, number] => {
            const def: [number, number, number] = [19, 127, 236]; // Blue primary
            if (!hex) return def;
            const h = hex.replace('#', '');
            if (h.length !== 6) return def;
            const num = parseInt(h, 16);
            return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
        };

        const primaryColor = settings?.warna_primer || '#137fec';
        const rgbColor = hexToRgb(primaryColor);

        const addHeader = (d: jsPDF, title: string) => {
            d.setDrawColor(226, 232, 240);
            d.setLineWidth(1);
            d.line(40, 55, pageWidth - 40, 55);

            d.setTextColor(71, 85, 105);
            d.setFontSize(8);
            d.setFont('helvetica', 'bold');
            d.text((settings?.nama_rs || 'RUMAH SAKIT').toUpperCase(), 40, 45);

            d.setTextColor(148, 163, 184);
            d.setFont('helvetica', 'normal');
            d.text(title, pageWidth - 40, 45, { align: 'right' });
        };

        const addFooter = (d: jsPDF) => {
            const totalPages = d.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                d.setPage(i);
                if (i === 1) continue; // skip cover
                d.setTextColor(148, 163, 184);
                d.setFontSize(8);
                d.setFont('helvetica', 'normal');
                d.text(settings?.footer || 'Laporan Internal Rumah Sakit', 40, pageHeight - 30);
                d.text(`Halaman ${i - 1} dari ${totalPages - 1}`, pageWidth - 40, pageHeight - 30, { align: 'right' });
                d.setDrawColor(226, 232, 240);
                d.setLineWidth(0.75);
                d.line(40, pageHeight - 40, pageWidth - 40, pageHeight - 40);
            }
        };

        const drawKopSurat = (d: jsPDF) => {
            d.setDrawColor(30, 41, 59);
            d.setLineWidth(1.5);
            d.line(40, 110, pageWidth - 40, 110);
            d.setDrawColor(30, 41, 59);
            d.setLineWidth(0.5);
            d.line(40, 114, pageWidth - 40, 114);

            d.setTextColor(30, 41, 59);
            d.setFont('helvetica', 'bold');
            d.setFontSize(14);
            d.text((settings?.nama_rs || 'RUMAH SAKIT').toUpperCase(), 40, 50);

            d.setFont('helvetica', 'normal');
            d.setFontSize(9);
            d.setTextColor(71, 85, 105);
            d.text(settings?.alamat || '', 40, 68);
            d.text(`Kota: ${settings?.kota || '-'} | Telp: ${settings?.telepon || '-'} | Email: ${settings?.email || '-'} | Web: ${settings?.website || '-'}`, 40, 84);

            if (settings?.tagline) {
                d.setFont('helvetica', 'italic');
                d.setFontSize(8);
                d.text(`"${settings.tagline}"`, 40, 98);
            }
        };

        // Cover Page
        doc.setFillColor(rgbColor[0], rgbColor[1], rgbColor[2]);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');
        doc.setTextColor(255, 255, 255);

        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('LAPORAN MONITORING CAPAIAN KPI', pageWidth / 2, pageHeight / 2 - 60, { align: 'center' });

        doc.setFontSize(16);
        doc.setFont('helvetica', 'normal');
        doc.text(`Tahun: ${year || 'Semua'}`, pageWidth / 2, pageHeight / 2, { align: 'center' });

        doc.setFontSize(12);
        doc.text((settings?.nama_rs || 'RUMAH SAKIT').toUpperCase(), pageWidth / 2, pageHeight / 2 + 50, { align: 'center' });

        doc.addPage();

        // TOC Page
        let tocPageNum = doc.getCurrentPageInfo().pageNumber;
        doc.addPage(); // skip for TOC

        let contentPageStart = doc.getCurrentPageInfo().pageNumber;

        // Draw KOP Surat on first content page
        drawKopSurat(doc);

        doc.setTextColor(30, 41, 59);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('A. Rekapitulasi Capaian Realisasi KPI Unit Kerja', 40, 140);

        let finalY = 160;

        // Group by unit_kerja
        const itemsByUnit: Record<string, ManajemenStrategi[]> = {};
        filtered.forEach(item => {
            const uName = item.unit_kerja?.nama_unit || 'Unit Tidak Diketahui';
            if (!itemsByUnit[uName]) itemsByUnit[uName] = [];
            itemsByUnit[uName].push(item);
        });

        const byUnit = Object.entries(itemsByUnit).sort((a, b) => a[0].localeCompare(b[0]));

        let grandTotalTargetSkor = 0;
        let grandTotalNilaiSkor = 0;
        let countIstimewa = 0;
        let countBaik = 0;
        let countCukup = 0;
        let countRendah = 0;
        let totalKpiCount = 0;

        byUnit.forEach(([unitName, uItems]) => {
            if (finalY > pageHeight - 160) {
                doc.addPage();
                finalY = 70;
            }

            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(30, 41, 59);
            doc.text(`Unit Kerja: ${unitName}`, 40, finalY + 15);

            let rowIdx = 1;
            let unitTotalTargetSkor = 0;
            let unitTotalNilaiSkor = 0;

            const formatNum = (val: number) => Number.isInteger(val) ? String(val) : String(parseFloat(val.toFixed(2)));

            const tableData = uItems.map(item => {
                totalKpiCount++;
                const crit = getKriteriaForKpi(item.kpi, item.unit_kerja_id);
                const evalRes = evaluateKpi(item.target, item.realisasi, crit);
                const displayVal = getDisplayRealisasi(item.realisasi);

                const hasPct = (item.target?.includes('%') || displayVal?.includes('%')) && displayVal !== '-' && !displayVal.includes('%');
                const realisasiExport = hasPct ? `${displayVal}%` : displayVal;

                unitTotalTargetSkor += evalRes.targetSkor;
                unitTotalNilaiSkor += evalRes.realisasiSkor;
                grandTotalTargetSkor += evalRes.targetSkor;
                grandTotalNilaiSkor += evalRes.realisasiSkor;

                if (evalRes.pct >= 100) countIstimewa++;
                else if (evalRes.pct >= 75) countBaik++;
                else if (evalRes.pct >= 50) countCukup++;
                else countRendah++;

                return [
                    rowIdx++,
                    item.sasaran_strategis || '-',
                    item.kpi || '-',
                    item.target || '-',
                    formatNum(evalRes.targetSkor),
                    realisasiExport || '-',
                    formatNum(evalRes.realisasiSkor),
                    evalRes.levelName
                ];
            });

            const unitPct = unitTotalTargetSkor > 0 ? ((unitTotalNilaiSkor / unitTotalTargetSkor) * 100).toFixed(1) : '0';

            autoTable(doc, {
                startY: finalY + 22,
                head: [['No', 'Sasaran Strategis', 'KPI / Indikator', 'Target', 'Skor Target', 'Realisasi', 'Nilai Skor', 'Keterangan']],
                body: tableData,
                foot: [[
                    { content: 'Total Skor Unit', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } },
                    { content: formatNum(unitTotalTargetSkor), styles: { halign: 'center', fontStyle: 'bold' } },
                    { content: '', styles: { halign: 'center' } },
                    { content: formatNum(unitTotalNilaiSkor), styles: { halign: 'center', fontStyle: 'bold' } },
                    { content: `Capaian: ${unitPct}%`, styles: { halign: 'center', fontStyle: 'bold' } }
                ]],
                theme: 'grid',
                headStyles: { fillColor: rgbColor, fontSize: 7.5, fontStyle: 'bold', halign: 'center', valign: 'middle', cellPadding: 3 },
                footStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontSize: 7.5 },
                styles: { fontSize: 7.5, cellPadding: 3.5, overflow: 'linebreak' },
                columnStyles: {
                    0: { cellWidth: 22, halign: 'center' },
                    1: { cellWidth: 110 },
                    2: { cellWidth: 110 },
                    3: { cellWidth: 50, halign: 'center' },
                    4: { cellWidth: 45, halign: 'center' },
                    5: { cellWidth: 50, halign: 'center' },
                    6: { cellWidth: 45, halign: 'center' },
                    7: { cellWidth: 83, halign: 'center' }
                },
                margin: { left: 40, right: 40 },
                didDrawPage: (data) => {
                    const currentPage = doc.getCurrentPageInfo().pageNumber;
                    if (currentPage > contentPageStart) {
                        addHeader(doc, 'Laporan Monitoring Capaian KPI');
                    }
                }
            });
            finalY = (doc as any).lastAutoTable.finalY + 20;
        });

        // Section B: Comparative Analysis
        if (finalY > pageHeight - 220) {
            doc.addPage();
            finalY = 70;
        }

        doc.setTextColor(30, 41, 59);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('B. Analisis Komparasi Capaian Skor KPI', 40, finalY);

        const overallPctSkor = grandTotalTargetSkor > 0 ? (grandTotalNilaiSkor / grandTotalTargetSkor) * 100 : 0;
        let overallLevelName = 'Rendah';
        if (overallPctSkor >= 100) overallLevelName = 'Istimewa';
        else if (overallPctSkor >= 80) overallLevelName = 'Baik';
        else if (overallPctSkor >= 70) overallLevelName = 'Cukup';

        const summaryTableData = [
            ['Total Indikator KPI Ter-monitoring', `${totalKpiCount} Indikator`],
            ['Total Skor Target Maksimal (Batas Target)', `${grandTotalTargetSkor} Poin`],
            ['Total Nilai Skor Realisasi Capaian', `${grandTotalNilaiSkor} Poin`],
            ['Persentase Capaian Skor Keseluruhan', `${overallPctSkor.toFixed(1)}%`],
            ['Kategori Evaluasi Kinerja Keseluruhan', overallLevelName.toUpperCase()],
            ['Distribusi Level Capaian KPI', `Istimewa: ${countIstimewa} | Baik: ${countBaik} | Cukup: ${countCukup} | Rendah: ${countRendah}`],
        ];

        autoTable(doc, {
            startY: finalY + 12,
            head: [['Parameter Evaluasi Komparatif', 'Nilai Capaian / Hasil Analisis']],
            body: summaryTableData,
            theme: 'grid',
            headStyles: { fillColor: rgbColor, fontSize: 8.5, fontStyle: 'bold' },
            styles: { fontSize: 8.5, cellPadding: 5 },
            columnStyles: {
                0: { cellWidth: 200, fontStyle: 'bold' },
                1: { cellWidth: 315 }
            },
            margin: { left: 40, right: 40 },
        });

        let compY = (doc as any).lastAutoTable.finalY + 15;

        doc.setFillColor(248, 250, 252);
        doc.roundedRect(40, compY, pageWidth - 80, 65, 4, 4, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(40, compY, pageWidth - 80, 65, 4, 4, 'S');

        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text('Kesimpulan & Rekomendasi Analisis Komparasi:', 50, compY + 16);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(51, 65, 85);
        const compText = `Berdasarkan analisis komparatif antara nilai skor realisasi (${grandTotalNilaiSkor}) terhadap skor target (${grandTotalTargetSkor}), diperoleh rasio pencapaian skor sebesar ${overallPctSkor.toFixed(1)}% dengan kriteria kinerja '${overallLevelName}'. Sebanyak ${countIstimewa + countBaik} KPI (${(((countIstimewa + countBaik) / (totalKpiCount || 1)) * 100).toFixed(0)}%) berada pada kategori Baik/Istimewa. Unit kerja disarankan mempertahankan tren positif ini dan melakukan mitigasi prioritas pada ${countCukup + countRendah} KPI yang memerlukan perhatian.`;
        const wrappedComp = doc.splitTextToSize(compText, pageWidth - 100);
        doc.text(wrappedComp, 50, compY + 28);

        finalY = compY + 80;

        // Add TOC Content
        doc.setPage(tocPageNum);
        addHeader(doc, 'Daftar Isi');
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(15);
        doc.setFont('helvetica', 'bold');
        doc.text('DAFTAR ISI LAPORAN', 40, 100);

        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(1);
        doc.line(40, 112, pageWidth - 40, 112);

        doc.setFontSize(10.5);
        doc.setFont('helvetica', 'normal');

        doc.text('1. Rekapitulasi Capaian Realisasi KPI Unit Kerja', 40, 140);
        doc.text(`${contentPageStart - 1}`, pageWidth - 40, 140, { align: 'right' });

        doc.text('2. Analisis Komparasi Capaian Skor KPI', 40, 160);
        doc.text(`${contentPageStart - 1}`, pageWidth - 40, 160, { align: 'right' });

        doc.text('3. Lembar Tanda Tangan Pengesahan Laporan', 40, 180);
        const lastPage = doc.getNumberOfPages();
        doc.text(`${lastPage - 1}`, pageWidth - 40, 180, { align: 'right' });

        // Go to last page for signature block
        doc.setPage(lastPage);
        if (finalY > pageHeight - 140) {
            doc.addPage();
            finalY = 70;
        } else {
            finalY += 10;
        }

        doc.setFontSize(9.5);
        doc.setTextColor(51, 65, 85);
        doc.setFont('helvetica', 'normal');
        doc.text('Disiapkan oleh,', 60, finalY);
        doc.text(settings?.jabatan_penandatangan_kiri || 'Penanggungjawab Unit', 60, finalY + 14);
        doc.line(60, finalY + 65, 200, finalY + 65);
        doc.text(settings?.nama_penandatangan_kiri || '............................', 60, finalY + 78);

        doc.text('Disetujui oleh,', pageWidth - 200, finalY);
        doc.setFont('helvetica', 'bold');
        doc.text(settings?.kepala_rs || 'Direktur RS', pageWidth - 200, finalY + 14);
        doc.line(pageWidth - 200, finalY + 65, pageWidth - 60, finalY + 65);
        doc.setFont('helvetica', 'normal');
        doc.text(`NIP: ${settings?.nip_kepala || '-'}`, pageWidth - 200, finalY + 78);

        addFooter(doc);
        doc.save(`Laporan_Monitoring_KPI_${year || 'Semua'}.pdf`);
    };

    const columns: Column<ManajemenStrategi>[] = [
        { key: 'tahun', label: 'Tahun', className: 'w-20' },
        { key: 'unit_kerja_id', label: 'Unit Kerja', render: r => r.unit_kerja?.nama_unit ?? '-' },
        { key: 'sasaran_strategis', label: 'Sasaran Strategis', render: r => <span className="line-clamp-2">{r.sasaran_strategis}</span> },
        { key: 'kpi', label: 'KPI / Indikator' },
        { key: 'target', label: 'Target' },
        { key: 'realisasi', label: 'Realisasi', render: r => <AchievementBadge target={r.target} realisasi={r.realisasi} kriteriaJson={getKriteriaForKpi(r.kpi, r.unit_kerja_id)} /> },
    ];

    const periodeLabels = PERIODE_LABELS[form.periode_tipe] || ['Tahunan'];

    return (
        <div>
            <PageHeader title="Monitoring KPI" subtitle="Pantau realisasi sasaran strategis dan KPI unit kerja per tahun anggaran." />

            {/* Speedometer Gauges */}
            {gaugeData.length > 0 && (
                <div className="mb-8">
                    <h3 className="text-sm font-bold text-slate-600 mb-3 flex items-center gap-2">
                        <TrendingUp size={16} className="text-[#137fec]" /> Dashboard KPI Utama
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                        {gaugeData.map((g, i) => (
                            <SpeedometerGauge key={i} target={g.target} realisasi={g.realisasi} kpiName={g.kpi} kriteriaJson={g.kriteriaJson} />
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
                <ScoreCard
                    icon={<Target size={22} className="text-[#137fec]" />}
                    title="Total Data Monitoring"
                    value={monitoredList.length}
                    subtitle={`dari ${data.length} total KPI terdaftar`}
                    colorClass="bg-blue-50 border-blue-100"
                    action={
                        <button onClick={() => openDetailModal('all')} className="p-1 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors" title="Lihat Rincian Detail">
                            <Eye size={16} />
                        </button>
                    }
                />
                <ScoreCard
                    icon={<CheckCircle2 size={22} className="text-emerald-500" />}
                    title="KPI Tercapai"
                    value={achievedList.length}
                    subtitle="Memenuhi/melebihi target"
                    colorClass="bg-emerald-50 border-emerald-100"
                    action={
                        <button onClick={() => openDetailModal('achieved')} className="p-1 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors" title="Lihat Rincian Detail">
                            <Eye size={16} />
                        </button>
                    }
                />
                <ScoreCard
                    icon={<Clock size={22} className="text-amber-500" />}
                    title="Belum Tercapai"
                    value={unachievedList.length}
                    subtitle="Di bawah target acuan"
                    colorClass="bg-amber-50 border-amber-100"
                    action={
                        <button onClick={() => openDetailModal('unachieved')} className="p-1 text-amber-600 hover:bg-amber-100 rounded-lg transition-colors" title="Lihat Rincian Detail">
                            <Eye size={16} />
                        </button>
                    }
                />
                <ScoreCard
                    icon={<TrendingUp size={22} className="text-violet-500" />}
                    title="Tingkat Capaian"
                    value={`${overallCapaianPct}%`}
                    subtitle={`Skor ${grandRealSkor.toFixed(1)} / ${grandTargetSkor.toFixed(1)}`}
                    colorClass="bg-violet-50 border-violet-100"
                    action={
                        <button onClick={() => openDetailModal('summary')} className="p-1 text-violet-600 hover:bg-violet-100 rounded-lg transition-colors" title="Lihat Rincian Detail">
                            <Eye size={16} />
                        </button>
                    }
                />
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <TopActionBar
                    filters={
                        <div className="flex flex-wrap items-center gap-3">
                            <FilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Cari sasaran / KPI..." yearValue={year} onYearChange={setYear} />
                            {profile?.role === 'user_unit' ? (
                                <div className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold border border-slate-200">
                                    {units.find(u => u.id === filterUnit)?.nama_unit || 'Unit Anda'}
                                </div>
                            ) : (
                                <select className="form-input text-xs py-2 w-48" value={filterUnit} onChange={e => setFilterUnit(e.target.value)}>
                                    <option value="all">Semua Unit Kerja</option>
                                    {units.map(u => <option key={u.id} value={u.id}>{u.nama_unit}</option>)}
                                </select>
                            )}
                        </div>
                    }
                    actions={<>
                        <button className="btn-secondary"><Download size={15} /><span className="hidden sm:inline">Template</span></button>
                        <button className="btn-secondary"><Upload size={15} /><span className="hidden sm:inline">Import</span></button>
                        <button className="btn-secondary border-primary/20 text-primary hover:bg-primary/5" onClick={handleExportPDF}><FileText size={15} /><span className="hidden sm:inline">Laporan</span></button>
                        <button className="btn-primary" onClick={openAdd}><Plus size={15} /><span>Input Realisasi</span></button>
                    </>}
                />
                <DataTable columns={columns} data={filtered} onEdit={openEdit} onDelete={handleDelete} onView={openEdit} isLoading={loading} />
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <h3 className="text-base font-bold text-slate-800">{editId ? 'Edit' : 'Tambah'} Capaian KPI</h3>
                            <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="form-label">Tahun</label>
                                    <input type="number" className="form-input" value={form.tahun} onChange={e => setForm(f => ({ ...f, tahun: Number(e.target.value) }))} required />
                                </div>
                                <div>
                                    <label className="form-label">Unit Kerja</label>
                                    <select className="form-input" value={form.unit_kerja_id} onChange={e => setForm(f => ({ ...f, unit_kerja_id: e.target.value, kpi: '', sasaran_strategis: '', target: '' }))} required disabled={profile?.role === 'user_unit'}>
                                        <option value="">-- Pilih Unit --</option>
                                        {units.map(u => <option key={u.id} value={u.id}>{u.nama_unit}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Dropdown KPI dari Cascading */}
                            <div>
                                <label className="form-label">Pilih KPI / Indikator (dari Cascading)</label>
                                <select className="form-input" value={form.kpi} onChange={e => handleSelectKpi(e.target.value)} required>
                                    <option value="">-- Pilih KPI Cascading --</option>
                                    {cascadingData.map(c => <option key={c.id} value={c.kpi}>{c.kpi}</option>)}
                                </select>
                            </div>

                            {form.kpi && (
                                <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-3">
                                    <div>
                                        <label className="text-xs font-semibold text-slate-500 block mb-1">Sasaran Strategis</label>
                                        <div className="text-sm font-medium text-slate-800 bg-white p-2 border border-slate-200 rounded-md">{form.sasaran_strategis || '-'}</div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-slate-500 block mb-1">Target Berdasarkan Cascading</label>
                                        <div className="text-sm font-medium text-slate-800 bg-white p-2 border border-slate-200 rounded-md">{form.target || '-'}</div>
                                    </div>
                                </div>
                            )}

                            {/* Tipe Periode */}
                            <div>
                                <label className="form-label">Tipe Periode Realisasi</label>
                                <select className="form-input" value={form.periode_tipe} onChange={e => handleChangePeriode(e.target.value)}>
                                    <option value="tahunan">Tahunan</option>
                                    <option value="semesteran">Semesteran</option>
                                    <option value="triwulanan">Triwulanan</option>
                                    <option value="bulanan">Bulanan</option>
                                </select>
                            </div>

                            {/* Periode Inputs */}
                            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                                <p className="text-xs font-bold text-slate-500 mb-3">Input Realisasi ({form.periode_tipe === 'tahunan' ? 'Tahunan' : form.periode_tipe === 'bulanan' ? '12 Bulan' : form.periode_tipe === 'triwulanan' ? '4 Triwulan' : '2 Semester'})</p>
                                <div className={`grid gap-3 ${form.periode_tipe === 'bulanan' ? 'grid-cols-2 md:grid-cols-3' : form.periode_tipe === 'triwulanan' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                    {periodeLabels.map((label, i) => (
                                        <div key={label}>
                                            <label className="text-[11px] text-slate-500 font-semibold block mb-1">{label}</label>
                                            <input
                                                type="text"
                                                className="form-input text-sm"
                                                placeholder="Nilai"
                                                value={form.periode_inputs[i] || ''}
                                                onChange={e => handlePeriodeInput(i, e.target.value)}
                                            />
                                        </div>
                                    ))}
                                </div>
                                {/* Average display */}
                                {form.periode_inputs.some(v => v.trim()) && (
                                    <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-500">Rata-rata Realisasi:</span>
                                        <span className="text-sm font-extrabold text-[#137fec]">
                                            {(() => {
                                                const nums = form.periode_inputs.map(v => parseFloat(v)).filter(n => !isNaN(n));
                                                if (nums.length === 0) return '0';
                                                return (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2);
                                            })()}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Batal</button>
                                <button type="submit" className="btn-primary" disabled={saving}>
                                    {saving ? <><Loader2 size={15} className="animate-spin" /><span>Menyimpan...</span></> : <><Save size={15} /><span>Simpan Realisasi</span></>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Detail Rincian KPI */}
            {detailModalOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    {detailModalType === 'all' && <><Target className="text-blue-500" size={20} /> Rincian Total Data Monitoring KPI</>}
                                    {detailModalType === 'achieved' && <><CheckCircle2 className="text-emerald-500" size={20} /> Rincian KPI Tercapai (Memenuhi Target)</>}
                                    {detailModalType === 'unachieved' && <><Clock className="text-amber-500" size={20} /> Rincian KPI Belum Tercapai (Di Bawah Target)</>}
                                    {detailModalType === 'summary' && <><TrendingUp className="text-violet-500" size={20} /> Rincian Rekapitulasi Capaian Skor KPI</>}
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    {detailModalType === 'all' && `Menampilkan seluruh ${monitoredList.length} KPI yang telah dilakukan monitoring realisasi.`}
                                    {detailModalType === 'achieved' && `Menampilkan ${achievedList.length} KPI yang telah mencapai atau melebihi target.`}
                                    {detailModalType === 'unachieved' && `Menampilkan ${unachievedList.length} KPI yang memerlukan evaluasi karena belum mencapai target.`}
                                    {detailModalType === 'summary' && `Tingkat capaian agregat skor: ${overallCapaianPct}% (Total Skor Realisasi ${grandRealSkor.toFixed(1)} / Total Skor Target ${grandTargetSkor.toFixed(1)}).`}
                                </p>
                            </div>
                            <button onClick={() => setDetailModalOpen(false)} className="p-2 hover:bg-slate-200/60 rounded-xl transition-colors text-slate-500">
                                <X size={18} />
                            </button>
                        </div>

                        {/* Modal Search Bar */}
                        <div className="px-6 py-3 border-b border-slate-100 bg-white flex items-center justify-between gap-4">
                            <div className="relative flex-1 max-w-sm">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    value={detailSearch}
                                    onChange={e => setDetailSearch(e.target.value)}
                                    placeholder="Cari unit kerja, sasaran, atau KPI..."
                                    className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs w-full focus:outline-none focus:ring-2 focus:ring-[#137fec]/40"
                                />
                            </div>
                            <div className="text-xs text-slate-500 font-medium">
                                Total: <span className="font-bold text-slate-700">{modalFilteredList.length}</span> KPI
                            </div>
                        </div>

                        {/* Modal Table Content */}
                        <div className="p-6 overflow-y-auto flex-1">
                            <table className="w-full text-xs text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                                        <th className="p-2.5 text-center w-10">No</th>
                                        <th className="p-2.5">Unit Kerja</th>
                                        <th className="p-2.5">Sasaran Strategis</th>
                                        <th className="p-2.5">KPI / Indikator</th>
                                        <th className="p-2.5 text-center">Target</th>
                                        <th className="p-2.5 text-center">Skor Target</th>
                                        <th className="p-2.5 text-center">Realisasi</th>
                                        <th className="p-2.5 text-center">Nilai Skor</th>
                                        <th className="p-2.5 text-center">Status / Keterangan</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {modalFilteredList.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="p-8 text-center text-slate-400 font-medium">Tidak ada data KPI yang sesuai.</td>
                                        </tr>
                                    ) : (
                                        modalFilteredList.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                                                <td className="p-2.5 text-center font-medium text-slate-500">{idx + 1}</td>
                                                <td className="p-2.5 font-semibold text-slate-700">{item.unit_kerja?.nama_unit || '-'}</td>
                                                <td className="p-2.5 text-slate-600 line-clamp-2">{item.sasaran_strategis || '-'}</td>
                                                <td className="p-2.5 font-medium text-slate-800">{item.kpi || '-'}</td>
                                                <td className="p-2.5 text-center font-mono text-slate-700">{item.target || '-'}</td>
                                                <td className="p-2.5 text-center font-bold text-slate-700">{item.evalRes.targetSkor}</td>
                                                <td className="p-2.5 text-center font-mono text-slate-800">{item.displayVal}</td>
                                                <td className="p-2.5 text-center font-bold text-slate-900">{item.evalRes.realisasiSkor}</td>
                                                <td className="p-2.5 text-center">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${item.evalRes.statusClass}`}>
                                                        {item.evalRes.levelName} ({item.evalRes.pct.toFixed(0)}%)
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                            <div className="text-xs text-slate-500 font-semibold">
                                Menampilkan {modalFilteredList.length} dari {modalSourceList.length} KPI terdaftar.
                            </div>
                            <button onClick={() => setDetailModalOpen(false)} className="px-4 py-2 bg-slate-200 text-slate-700 font-bold rounded-lg text-xs hover:bg-slate-300 transition-colors">
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
