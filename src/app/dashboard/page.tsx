'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ScoreCard } from '@/components/SharedUI';
import {
    ShieldAlert, Target, TrendingUp, AlertTriangle,
    CheckCircle2, Clock, BarChart2, Activity, ShieldCheck, ArrowRight, Eye, X
} from 'lucide-react';
import { useAppSettings } from '@/hooks/useAppSettings';
import { useUserProfile } from '@/hooks/useUserProfile';
import { evaluateKpi, getDisplayRealisasi } from '@/app/strategi/monitoring/page';
import RiskHeatmap, { getAppetiteCoords, type HeatmapPoint } from '@/components/RiskHeatmap';
import {
    PieChart, Pie, Cell, ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';

const CustomDonutTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-slate-900/90 text-white p-3.5 rounded-2xl shadow-xl border border-slate-700/50 backdrop-blur-md max-w-xs text-xs space-y-1.5 animate-in fade-in duration-150">
                <div className="flex items-center gap-2 font-bold text-sm">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: data.color }} />
                    <span>Tingkat {data.name}</span>
                </div>
                <div className="flex justify-between items-center text-slate-200 border-t border-slate-700/60 pt-1.5">
                    <span className="text-slate-400 font-medium">Jumlah Risiko:</span>
                    <span className="font-bold text-white text-sm">{data.value} Risiko</span>
                </div>
                <div className="flex justify-between items-center text-slate-200">
                    <span className="text-slate-400 font-medium">Proporsi / Porsi:</span>
                    <span className="font-bold text-emerald-400">{data.pct}% dari Total</span>
                </div>
                <div className="text-[11px] text-slate-300 font-normal leading-relaxed pt-1 bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-slate-700/40">
                    💡 <span className="font-semibold">{data.desc}</span>
                </div>
            </div>
        );
    }
    return null;
};

const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-slate-900/95 text-white p-3.5 rounded-2xl shadow-xl border border-slate-700/50 backdrop-blur-md text-xs space-y-1.5 animate-in fade-in duration-150 min-w-[200px]">
                <p className="font-bold text-sm text-slate-100 border-b border-slate-700/80 pb-1.5 mb-2">{label}</p>
                {payload.map((entry: any, index: number) => (
                    <div key={`item-${index}`} className="flex items-center justify-between gap-4 font-semibold">
                        <span className="flex items-center gap-1.5" style={{ color: entry.color }}>
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                            {entry.name}:
                        </span>
                        <span className="font-bold text-white text-sm">{entry.value}</span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

export function parseNumericRealisasi(realisasiVal: any): number {
    if (realisasiVal === null || realisasiVal === undefined || realisasiVal === '') return NaN;
    if (typeof realisasiVal === 'number') return realisasiVal;
    const str = String(realisasiVal).trim();
    if (str.startsWith('{')) {
        try {
            const parsed = JSON.parse(str);
            if (parsed.rata_rata != null && !isNaN(Number(parsed.rata_rata))) {
                return Number(parsed.rata_rata);
            }
            if (Array.isArray(parsed.inputs) && parsed.inputs.length > 0) {
                const nums = parsed.inputs.map((v: any) => parseFloat(v)).filter((v: number) => !isNaN(v));
                if (nums.length > 0) return nums[nums.length - 1];
            }
        } catch (e) {
            // ignore
        }
    }
    return parseFloat(str);
}

export default function DashboardPage() {
    const { settings, yearsList } = useAppSettings();
    const { profile } = useUserProfile();

    const [cardModalType, setCardModalType] = useState<'targetKpi' | 'totalRisiko' | 'risikoTinggi' | 'risikoBerjalan' | 'risikoAppetite' | null>(null);

    const [stats, setStats] = useState({
        totalRisiko: 0,
        risikoTinggi: 0,
        risikoSesuaiAppetite: 0,
        risikoBerjalan: 0,
        totalStrategi: 0,
        strategiTercapai: 0,
        risikoClosed: 0,
        avgRiskScore: 0,
        risikoSedang: 0,
        risikoRendah: 0,
        overallCapaianPct: 0,
    });
    const [selectedUnit, setSelectedUnit] = useState<string>('all');
    const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()));
    const [units, setUnits] = useState<{ id: string; nama_unit: string }[]>([]);
    const [years, setYears] = useState<number[]>([]);
    const [loadingStats, setLoadingStats] = useState(true);
    const [rawRisiko, setRawRisiko] = useState<any[]>([]);
    const [rawStrategi, setRawStrategi] = useState<any[]>([]);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Sync user unit if role is user_unit
    useEffect(() => {
        if (profile && profile.role === 'user_unit' && profile.unit_kerja_id) {
            setSelectedUnit(profile.unit_kerja_id);
        }
    }, [profile]);

    const yearsKey = yearsList.join(',');

    // Fetch lists for filters & sync selected year
    useEffect(() => {
        const fetchFilters = async () => {
            const { data: unitsData } = await supabase.from('unit_kerja').select('id, nama_unit').order('nama_unit', { ascending: true });
            if (unitsData) setUnits(unitsData);

            const { data: yearsData } = await supabase.from('tahun_anggaran').select('tahun').order('tahun', { ascending: false });
            let combined = yearsList;
            if (yearsData && yearsData.length > 0) {
                const fetchedYears = yearsData.map((y: any) => y.tahun);
                combined = Array.from(new Set([...yearsList, ...fetchedYears])).sort((a, b) => b - a);
            }
            setYears(combined);

            const currentY = new Date().getFullYear();
            if (combined.length > 0) {
                setSelectedYear(prev => {
                    const prevNum = Number(prev);
                    if (combined.includes(prevNum)) return prev;
                    if (combined.includes(currentY)) return String(currentY);
                    return String(combined[0]);
                });
            }
        };
        fetchFilters();
    }, [yearsKey]);

    // Fetch dashboard stats
    useEffect(() => {
        const fetchStats = async () => {
            setLoadingStats(true);
            try {
                let queryRisiko = supabase.from('manajemen_risiko').select('*');
                let queryStrategi = supabase.from('manajemen_strategi').select('*');
                let queryCascading = supabase.from('cascading_kpi').select('*');

                if (selectedYear) {
                    queryRisiko = queryRisiko.eq('tahun', Number(selectedYear));
                    queryStrategi = queryStrategi.eq('tahun', Number(selectedYear));
                    queryCascading = queryCascading.eq('tahun', Number(selectedYear));
                }

                // If user is a user_unit manager, ignore selection and lock to their own unit_kerja_id
                const unitToFilter = profile?.role === 'user_unit' ? profile.unit_kerja_id : (selectedUnit === 'all' ? null : selectedUnit);
                if (unitToFilter) {
                    queryRisiko = queryRisiko.eq('unit_kerja_id', unitToFilter);
                    queryStrategi = queryStrategi.eq('unit_kerja_id', unitToFilter);
                    queryCascading = queryCascading.eq('unit_kerja_id', unitToFilter);
                }

                const [
                    { data: risikoData, error: rErr },
                    { data: strategiData, error: sErr },
                    { data: cascadingData }
                ] = await Promise.all([
                    queryRisiko,
                    queryStrategi,
                    queryCascading
                ]);

                if (rErr) console.warn('Risiko fetch warning:', rErr.message || rErr.details || rErr);
                if (sErr) console.warn('Strategi fetch warning:', sErr.message || sErr.details || sErr);

                let currentUnits = units;
                if (currentUnits.length === 0) {
                    const { data: uData } = await supabase.from('unit_kerja').select('id, nama_unit').order('nama_unit', { ascending: true });
                    if (uData) currentUnits = uData;
                }
                const unitMap = new Map(currentUnits.map(u => [u.id, u.nama_unit]));

                const cascadingMap = new Map<string, string>();
                ((cascadingData as any[]) ?? []).forEach(c => {
                    if (c.kpi && c.kriteria_nilai) {
                        cascadingMap.set(`${c.kpi}_${c.unit_kerja_id}`, c.kriteria_nilai);
                        cascadingMap.set(c.kpi, c.kriteria_nilai);
                    }
                });

                const rawRList = (risikoData as any[]) ?? [];
                const rawSList = (strategiData as any[]) ?? [];

                const rList = rawRList.map(r => {
                    const skorInherent = r.skor_risiko ?? (r.probabilitas ?? 0) * (r.dampak ?? 0);
                    return {
                        ...r,
                        skor_risiko: skorInherent,
                        unit_kerja: { nama_unit: unitMap.get(r.unit_kerja_id) || '-' }
                    };
                });

                const sList = rawSList.map(s => {
                    const crit = cascadingMap.get(`${s.kpi}_${s.unit_kerja_id}`) || cascadingMap.get(s.kpi) || null;
                    const evalRes = evaluateKpi(s.target, s.realisasi, crit);
                    const displayVal = getDisplayRealisasi(s.realisasi);
                    const isMonitored = displayVal !== '-' && s.realisasi !== null && s.realisasi !== '';
                    return {
                        ...s,
                        unit_kerja: { nama_unit: unitMap.get(s.unit_kerja_id) || '-' },
                        crit,
                        evalRes,
                        displayRealisasi: displayVal,
                        isMonitored,
                        isAchieved: evalRes.pct >= 100
                    };
                });

                const totalRisiko = rList.length;
                const risikoTinggi = rList.filter(r => r.skor_risiko >= 15).length;
                const risikoSedang = rList.filter(r => r.skor_risiko >= 5 && r.skor_risiko < 10).length;
                const risikoRendah = rList.filter(r => r.skor_risiko < 5).length;
                const totalCascading = ((cascadingData as any[]) ?? []).length;
                const totalStrategi = totalCascading;

                const strategiTercapai = sList.filter(s => s.isAchieved).length;

                const monitoredList = sList.filter(s => s.isMonitored);
                const grandTargetSkor = monitoredList.reduce((acc, curr) => acc + (curr.evalRes?.targetSkor || 0), 0);
                const grandRealSkor = monitoredList.reduce((acc, curr) => acc + (curr.evalRes?.realisasiSkor || 0), 0);
                const overallCapaianPct = grandTargetSkor > 0
                    ? parseFloat(((grandRealSkor / grandTargetSkor) * 100).toFixed(1))
                    : (monitoredList.length > 0 ? parseFloat(((strategiTercapai / monitoredList.length) * 100).toFixed(1)) : 0);

                const risikoSesuaiAppetite = rList.filter(r => (r.skor_risiko ?? 0) <= (r.selera_risiko ?? 6)).length;
                const closedRisks = rList.filter(r => r.status === 'Closed').length;
                const totalRiskScore = rList.reduce((sum, r) => sum + (r.skor_risiko || 0), 0);
                const avgRiskScore = totalRisiko > 0 ? Math.round((totalRiskScore / totalRisiko) * 10) / 10 : 0;

                setStats({
                    totalRisiko,
                    risikoTinggi,
                    risikoSesuaiAppetite,
                    risikoBerjalan: totalRisiko - closedRisks,
                    totalStrategi,
                    strategiTercapai,
                    risikoClosed: closedRisks,
                    avgRiskScore,
                    risikoSedang,
                    risikoRendah,
                    overallCapaianPct,
                });

                setRawRisiko(rList);
                setRawStrategi(sList);
            } catch (err) {
                console.error('Error fetching dashboard stats:', err);
            } finally {
                setLoadingStats(false);
            }
        };

        fetchStats();
    }, [selectedUnit, selectedYear, profile]);

    // Data for Risk Donut Chart
    const riskDonutData = React.useMemo(() => {
        const tinggi = stats.risikoTinggi;
        const sedangTinggi = rawRisiko.filter(r => r.skor_risiko >= 10 && r.skor_risiko < 15).length;
        const sedang = stats.risikoSedang;
        const rendah = stats.risikoRendah;
        const total = stats.totalRisiko || 1;

        return [
            {
                name: 'Sangat Tinggi',
                value: tinggi,
                color: '#ef4444',
                desc: 'Skor Inherent ≥ 15 (Eskalasi & Respon Segera Manajemen)',
                pct: Math.round((tinggi / total) * 100)
            },
            {
                name: 'Tinggi',
                value: sedangTinggi,
                color: '#f97316',
                desc: 'Skor Inherent 10 - 14 (Mitigasi Prioritas & Pemantauan Ketat)',
                pct: Math.round((sedangTinggi / total) * 100)
            },
            {
                name: 'Sedang',
                value: sedang,
                color: '#eab308',
                desc: 'Skor Inherent 5 - 9 (Tindakan Penanganan Penyesuaian Rutin)',
                pct: Math.round((sedang / total) * 100)
            },
            {
                name: 'Rendah',
                value: rendah,
                color: '#10b981',
                desc: 'Skor Inherent < 5 (Dapat Diterima & Pengawasan Standar)',
                pct: Math.round((rendah / total) * 100)
            },
        ].filter(item => item.value > 0);
    }, [stats, rawRisiko]);

    // Grouping KPI Achievement by Unit Kerja
    const getKpiPerUnitData = () => {
        const groups: { [key: string]: { total: number; tercapai: number } } = {};
        rawStrategi.forEach(s => {
            const unitName = (s.unit_kerja as any)?.nama_unit || 'Lainnya';
            if (!groups[unitName]) {
                groups[unitName] = { total: 0, tercapai: 0 };
            }
            groups[unitName].total += 1;
            if (s.isAchieved) {
                groups[unitName].tercapai += 1;
            }
        });
        return Object.keys(groups)
            .sort((a, b) => a.localeCompare(b, 'id'))
            .map(name => {
                const total = groups[name].total;
                const tercapai = groups[name].tercapai;
                const belumTercapai = Math.max(0, total - tercapai);
                return {
                    name,
                    'Tercapai': tercapai,
                    'Belum Tercapai': belumTercapai,
                    'Total Indikator': total,
                };
            });
    };

    const kpiPerUnitData = getKpiPerUnitData();

    // Map raw risks to Heatmap points (Inherent, Residual, and Appetite)
    const heatmapPoints: HeatmapPoint[] = rawRisiko.flatMap(r => {
        const p_res = (r.p_residual != null ? r.p_residual : Math.ceil((r.probabilitas || 1) * 0.5)) || 1;
        const d_res = (r.d_residual != null ? r.d_residual : Math.ceil((r.dampak || 1) * 0.8)) || 1;
        const appScore = r.selera_risiko ?? 6;
        const appCoord = getAppetiteCoords(appScore);

        return [
            { id: `${r.id}_inh`, x: r.dampak || 1, y: r.probabilitas || 1, label: `Inherent: ${r.identifikasi_risiko}`, type: 'inherent' as const },
            { id: `${r.id}_res`, x: d_res, y: p_res, label: `Residual: ${r.identifikasi_risiko}`, type: 'residual' as const },
            { id: `${r.id}_app`, x: appCoord.d, y: appCoord.p, label: `Target Appetite (${appScore}): ${r.identifikasi_risiko}`, type: 'appetite' as const },
        ];
    });

    // Top 5 risks
    const topRisks = [...rawRisiko].sort((a, b) => b.skor_risiko - a.skor_risiko).slice(0, 5);

    // KPI Failures (Realisasi < Target / Unachieved)
    const kpiFailures = [...rawStrategi]
        .filter(s => !s.isAchieved && (s.isMonitored || s.realisasi !== null))
        .sort((a, b) => (a.evalRes?.pct ?? 0) - (b.evalRes?.pct ?? 0))
        .slice(0, 5);

    const kpiPct = stats.overallCapaianPct ?? 0;
    const closedPct = stats.totalRisiko ? Math.round(stats.risikoClosed * 100 / stats.totalRisiko) : 0;

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">Dashboard Utama</h1>
                    <p className="text-sm font-semibold text-slate-500 mt-1 flex items-center">
                        <TrendingUp size={16} className="text-blue-500 mr-2" />
                        Ringkasan Profil Risiko & Kinerja Strategis Tahun <span className="font-bold text-slate-700 ml-1">{selectedYear}</span>
                        {loadingStats && <span className="text-xs text-amber-500 ml-3">⟳ Memuat data...</span>}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    {/* Unit Kerja Filter */}
                    <div className="flex flex-col">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Unit Kerja</label>
                        {profile?.role === 'user_unit' ? (
                            <div className="px-3.5 py-2.5 bg-slate-100/80 text-slate-650 rounded-xl border border-slate-200 text-xs font-bold min-w-[200px]">
                                {profile.unit_kerja_name || 'Unit Kerja Anda'}
                            </div>
                        ) : (
                            <select
                                value={selectedUnit}
                                onChange={e => setSelectedUnit(e.target.value)}
                                className="px-3.5 py-2.5 bg-white text-slate-800 rounded-xl border border-slate-200 hover:border-slate-300 focus:border-[#137fec] focus:ring-1 focus:ring-[#137fec] transition-all text-xs font-bold outline-none cursor-pointer min-w-[200px] shadow-sm"
                            >
                                <option value="all">Semua Unit Kerja</option>
                                {units.map(u => (
                                    <option key={u.id} value={u.id}>{u.nama_unit}</option>
                                ))}
                            </select>
                        )}
                    </div>

                    {/* Tahun Filter */}
                    <div className="flex flex-col">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tahun Anggaran</label>
                        <select
                            value={selectedYear}
                            onChange={e => setSelectedYear(e.target.value)}
                            className="px-3.5 py-2.5 bg-white text-slate-800 rounded-xl border border-slate-200 hover:border-slate-300 focus:border-[#137fec] focus:ring-1 focus:ring-[#137fec] transition-all text-xs font-bold outline-none cursor-pointer min-w-[100px] shadow-sm"
                        >
                            {years.map(y => (
                                <option key={y} value={String(y)}>{y}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Premium Clean White Summary Banner */}
            <div className="relative overflow-hidden rounded-3xl bg-white p-6 border border-slate-200/80 shadow-xs">
                <div className="absolute top-0 right-0 w-80 h-80 bg-slate-50 rounded-full blur-3xl -translate-y-20 translate-x-20 pointer-events-none"></div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 z-10 relative w-full">
                    <div className="bg-blue-600 rounded-2xl p-4 text-center shadow-sm hover:shadow-md transition-shadow">
                        <p className="text-2xl font-black text-white">{kpiPct}%</p>
                        <p className="text-[10px] text-blue-100 font-bold uppercase mt-1 font-sans">Capaian KPI</p>
                    </div>
                    <div className="bg-emerald-600 rounded-2xl p-4 text-center shadow-sm hover:shadow-md transition-shadow">
                        <p className="text-2xl font-black text-white">{closedPct}%</p>
                        <p className="text-[10px] text-emerald-100 font-bold uppercase mt-1 font-sans">Mitigasi Selesai</p>
                    </div>
                    <div className="bg-teal-600 rounded-2xl p-4 text-center shadow-sm hover:shadow-md transition-shadow">
                        <p className="text-2xl font-black text-white">{stats.risikoSesuaiAppetite}</p>
                        <p className="text-[10px] text-teal-100 font-bold uppercase mt-1 font-sans">Risiko Inherent Sesuai Appetite</p>
                    </div>
                    <div className="bg-amber-500 rounded-2xl p-4 text-center shadow-sm hover:shadow-md transition-shadow">
                        <p className="text-2xl font-black text-white">{stats.avgRiskScore}</p>
                        <p className="text-[10px] text-amber-50 font-bold uppercase mt-1 font-sans">Rerata Skor Risiko</p>
                    </div>
                </div>
            </div>

            {/* Modal Detail for ScoreCards */}
            {cardModalType && (
                <DashboardCardDetailModal
                    type={cardModalType}
                    rawRisiko={rawRisiko}
                    rawStrategi={rawStrategi}
                    onClose={() => setCardModalType(null)}
                />
            )}

            {/* Modern Score Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
                <ScoreCard
                    icon={<Target size={22} className="text-[#137fec]" />}
                    title="Total KPI"
                    value={stats.totalStrategi}
                    subtitle={`Tercapai: ${stats.strategiTercapai} KPI (${kpiPct}%)`}
                    colorClass="bg-white border-slate-200/80 shadow-xs hover:border-blue-300"
                    action={
                        <button
                            onClick={() => setCardModalType('targetKpi')}
                            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Lihat Detail Total KPI"
                        >
                            <Eye size={15} />
                        </button>
                    }
                />
                <ScoreCard
                    icon={<ShieldAlert size={22} className="text-rose-500" />}
                    title="Total Daftar Risiko"
                    value={stats.totalRisiko}
                    subtitle={`Status Closed: ${stats.risikoClosed} (${closedPct}%)`}
                    colorClass="bg-white border-slate-200/80 shadow-xs hover:border-rose-300"
                    action={
                        <button
                            onClick={() => setCardModalType('totalRisiko')}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Lihat Detail Total Daftar Risiko"
                        >
                            <Eye size={15} />
                        </button>
                    }
                />
                <ScoreCard
                    icon={<ShieldCheck size={22} className="text-teal-500" />}
                    title="Risiko Inherent Sesuai Appetite"
                    value={stats.risikoSesuaiAppetite}
                    subtitle="Skor inherent <= selera risiko"
                    colorClass="bg-white border-slate-200/80 shadow-xs hover:border-teal-300"
                    action={
                        <button
                            onClick={() => setCardModalType('risikoAppetite')}
                            className="p-1 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer"
                            title="Lihat Detail Risiko Inherent Sesuai Appetite"
                        >
                            <Eye size={15} />
                        </button>
                    }
                />
                <ScoreCard
                    icon={<Activity size={22} className="text-emerald-500" />}
                    title="Risiko Aktif Berjalan"
                    value={stats.risikoBerjalan}
                    subtitle="Menjalani proses pemantauan mitigasi"
                    colorClass="bg-white border-slate-200/80 shadow-xs hover:border-emerald-300"
                    action={
                        <button
                            onClick={() => setCardModalType('risikoBerjalan')}
                            className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                            title="Lihat Detail Risiko Aktif Berjalan"
                        >
                            <Eye size={15} />
                        </button>
                    }
                />
            </div>

            {/* Charts Visual section */}
            {isMounted && (
                <div className="space-y-8">
                    {/* 1. Peta Sebaran Risiko (Heatmap) - POSISI ATAS & FULL WIDTH */}
                    <div className="card bg-white border border-slate-200/60 shadow-xs p-6 sm:p-8 rounded-3xl">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
                            <div>
                                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                                    <ShieldCheck size={20} className="text-rose-500" /> Peta Sebaran Risiko (Heatmap)
                                </h3>
                                <p className="text-xs text-slate-400 font-medium mt-0.5">
                                    Penempatan titik matriks 5x5 risiko Inherent (I), Residual (R), dan Risk Appetite (A) seluruh unit kerja
                                </p>
                            </div>
                            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 self-start sm:self-auto">
                                <span>Total Titik Terdaftar:</span>
                                <span className="font-bold text-slate-900">{rawRisiko.length} Risiko</span>
                            </div>
                        </div>
                        <div className="flex justify-center">
                            <div className="w-full max-w-4xl">
                                <RiskHeatmap data={heatmapPoints} />
                            </div>
                        </div>
                    </div>

                    {/* 2. Donut Chart Sebaran Tingkat Risiko - POSISI DI BAWAH HEATMAP & FULL WIDTH DIPERBESAR */}
                    <div className="card bg-white border border-slate-200/60 shadow-xs p-6 sm:p-8 rounded-3xl">
                        <div className="mb-6">
                            <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                                <Activity size={20} className="text-[#137fec]" /> Sebaran & Analisis Tingkat Risiko
                            </h3>
                            <p className="text-xs text-slate-400 font-medium mt-0.5">
                                Proporsi kuantitas risiko aktif berdasarkan kategori tingkat keparahan risiko (Sangat Tinggi, Tinggi, Sedang, Rendah)
                            </p>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                            {/* Visual Chart - Left Side (Enlarged) */}
                            <div className="lg:col-span-5 flex justify-center items-center">
                                <div className="h-80 sm:h-96 w-full max-w-md relative block">
                                    {riskDonutData.length === 0 ? (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                            <span className="text-xs text-slate-400 font-medium">Tidak ada data risiko untuk ditampilkan</span>
                                        </div>
                                    ) : (
                                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                            <PieChart>
                                                <Pie
                                                    data={riskDonutData}
                                                    innerRadius={80}
                                                    outerRadius={125}
                                                    paddingAngle={4}
                                                    dataKey="value"
                                                >
                                                    {riskDonutData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.color} stroke="#ffffff" strokeWidth={2} />
                                                    ))}
                                                </Pie>
                                                <Tooltip content={<CustomDonutTooltip />} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    )}
                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                        <span className="text-4xl font-black text-slate-800 tracking-tight">{stats.totalRisiko}</span>
                                        <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-1">Total Risiko</span>
                                    </div>
                                </div>
                            </div>

                            {/* Legend & Breakdown Cards - Right Side */}
                            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {riskDonutData.map(item => (
                                    <div
                                        key={item.name}
                                        className="p-4 rounded-2xl border border-slate-100 bg-slate-50/70 hover:bg-white hover:border-slate-300 hover:shadow-sm transition-all duration-200 group"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: item.color }} />
                                                <span className="font-bold text-sm text-slate-800">Tingkat {item.name}</span>
                                            </div>
                                            <span className="text-xs font-black px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-slate-700">
                                                {item.pct}%
                                            </span>
                                        </div>
                                        <div className="flex items-baseline justify-between text-xs text-slate-500 mb-1.5">
                                            <span>Jumlah Risiko:</span>
                                            <span className="text-base font-black text-slate-800">{item.value} <span className="text-xs font-medium text-slate-400">Risiko</span></span>
                                        </div>
                                        <p className="text-[11px] text-slate-400 font-medium leading-relaxed border-t border-slate-200/60 pt-2 mt-2">
                                            {item.desc}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* 3. KPI Achievement Bar Chart per Unit */}
                    {kpiPerUnitData.length > 0 && (
                        <div className="card bg-white border border-slate-200/60 shadow-xs p-6 sm:p-8 rounded-3xl">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
                                <div>
                                    <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                                        <Target size={20} className="text-[#137fec]" /> Tren Pencapaian KPI per Unit Kerja
                                    </h3>
                                    <p className="text-xs text-slate-400 font-medium mt-0.5">Membandingkan target sasaran strategis dengan capaian realisasi</p>
                                </div>
                                <div className="flex items-center gap-4 text-xs font-semibold self-start sm:self-auto bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-xl">
                                    <span className="flex items-center gap-1.5 text-emerald-700">
                                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                                        Tercapai
                                    </span>
                                    <span className="flex items-center gap-1.5 text-rose-700">
                                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                                        Belum Tercapai
                                    </span>
                                    <span className="flex items-center gap-1.5 text-blue-700">
                                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                                        Total
                                    </span>
                                </div>
                            </div>
                            <div className="h-72 w-full block relative">
                                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                    <BarChart data={kpiPerUnitData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                        <XAxis dataKey="name" stroke="#64748b" fontSize={10} fontWeight="600" />
                                        <YAxis stroke="#64748b" fontSize={10} fontWeight="500" />
                                        <Tooltip content={<CustomBarTooltip />} />
                                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                                        <Bar dataKey="Tercapai" fill="#10b981" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="Total Indikator" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Top 5 Risks & Attention Needs */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* 5 Risiko Terbesar */}
                <div className="card bg-white border border-slate-200/60 shadow-xs p-6 rounded-3xl">
                    <h3 className="font-bold text-slate-800 text-sm mb-4 flex items-center gap-2">
                        <AlertTriangle size={16} className="text-rose-500" /> 5 Risiko Prioritas Utama
                    </h3>
                    <div className="space-y-3">
                        {topRisks.length === 0 ? (
                            <p className="text-xs text-slate-400 font-medium py-6 text-center">Belum ada data risiko terdaftar.</p>
                        ) : (
                            topRisks.map((risk, index) => (
                                <div key={risk.id} className="flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100/50 rounded-2xl border border-slate-100 transition-colors gap-3">
                                    <div className="flex items-center gap-3">
                                        <span className="w-6 h-6 rounded-full bg-rose-100 text-rose-700 text-xs font-bold flex items-center justify-center shrink-0">
                                            {index + 1}
                                        </span>
                                        <div>
                                            <p className="text-xs font-bold text-slate-800 break-words leading-snug">{risk.identifikasi_risiko}</p>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{risk.unit_kerja?.nama_unit || '-'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-bold bg-white text-slate-400 border border-slate-200 px-2 py-0.5 rounded-md uppercase tracking-wider">
                                            {risk.status}
                                        </span>
                                        <span className={`text-xs font-black px-2.5 py-1 rounded-lg shrink-0 ${risk.skor_risiko >= 15 ? 'bg-rose-100 text-rose-700' :
                                            risk.skor_risiko >= 10 ? 'bg-orange-100 text-orange-700' :
                                                risk.skor_risiko >= 5 ? 'bg-yellow-100 text-yellow-800' : 'bg-emerald-100 text-emerald-700'
                                            }`}>
                                            Skor: {risk.skor_risiko}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* KPI Perlu Perhatian */}
                <div className="card bg-white border border-slate-200/60 shadow-xs p-6 rounded-3xl">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                            <TrendingUp size={16} className="text-amber-500" /> KPI Perlu Atensi (Realisasi &lt; Target)
                        </h3>
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-full">
                            5 Terendah
                        </span>
                    </div>
                    {kpiFailures.length === 0 ? (
                        <p className="text-xs text-slate-400 font-medium py-6 text-center">Seluruh target KPI telah terpenuhi dengan baik!</p>
                    ) : (
                        <div className="w-full">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="border-b border-slate-200/80 bg-slate-50/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                        <th className="py-2 px-1 text-center w-7">No</th>
                                        <th className="py-2 px-2">Indikator KPI</th>
                                        <th className="py-2 px-1.5 text-center w-28">Unit Kerja</th>
                                        <th className="py-2 px-1 text-center w-16">Target</th>
                                        <th className="py-2 px-1 text-center w-16">Realisasi</th>
                                        <th className="py-2 px-1 text-center w-28">Capaian</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {kpiFailures.map((kpiData, index) => {
                                        const realVal = kpiData.displayRealisasi || getDisplayRealisasi(kpiData.realisasi);
                                        const evalRes = kpiData.evalRes || evaluateKpi(kpiData.target, kpiData.realisasi, kpiData.crit);
                                        const devPct = Math.round(evalRes?.pct ?? 0);
                                        const clampedPct = Math.min(Math.max(devPct, 0), 120);
                                        const needleAngle = -90 + (clampedPct / 120) * 180;
                                        return (
                                            <tr key={kpiData.id || index} className="hover:bg-slate-50/80 transition-colors">
                                                <td className="py-2 px-1 text-center font-bold text-slate-400 text-[11px]">{index + 1}</td>
                                                <td className="py-2 px-2">
                                                    <span className="font-semibold text-slate-800 break-words leading-tight block text-[11px]">{kpiData.kpi}</span>
                                                </td>
                                                <td className="py-2 px-1.5 text-center text-slate-600 font-medium text-[10px] break-words">
                                                    {kpiData.unit_kerja?.nama_unit || '-'}
                                                </td>
                                                <td className="py-2 px-1 text-center">
                                                    <span className="bg-slate-100 text-slate-700 px-1 py-0.5 rounded text-[10px] font-mono">{kpiData.target ?? '-'}</span>
                                                </td>
                                                <td className="py-2 px-1 text-center">
                                                    <span className="bg-amber-50 text-amber-900 border border-amber-200/60 px-1 py-0.5 rounded text-[10px] font-mono font-semibold">{realVal}</span>
                                                </td>
                                                <td className="py-2 px-1 text-center">
                                                    <div className="flex items-center justify-center gap-1.5 py-0.5 select-none">
                                                        <div className="w-8 h-4 shrink-0 flex items-center justify-center">
                                                            <svg className="w-full h-full" viewBox="0 0 60 32" preserveAspectRatio="xMidYMid meet">
                                                                <path d="M 5 28 A 23 23 0 0 1 55 28" fill="none" stroke="#f1f5f9" strokeWidth="5.5" strokeLinecap="round" />
                                                                <path d="M 5 28 A 23 23 0 0 1 17.5 15.5" fill="none" stroke="#ef4444" strokeWidth="5.5" />
                                                                <path d="M 17.5 15.5 A 23 23 0 0 1 24 10.5" fill="none" stroke="#f59e0b" strokeWidth="5.5" />
                                                                <path d="M 24 10.5 A 23 23 0 0 1 42.5 10.5" fill="none" stroke="#3b82f6" strokeWidth="5.5" />
                                                                <path d="M 42.5 10.5 A 23 23 0 0 1 55 28" fill="none" stroke="#10b981" strokeWidth="5.5" strokeLinecap="round" />
                                                                <g transform={`rotate(${needleAngle} 30 28)`} className="transition-transform duration-500 ease-out">
                                                                    <line x1="30" y1="28" x2="30" y2="9" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" />
                                                                </g>
                                                                <circle cx="30" cy="28" r="3.5" fill="#1e293b" />
                                                                <circle cx="30" cy="28" r="1.2" fill="#ffffff" />
                                                            </svg>
                                                        </div>
                                                        <div className="flex flex-col items-start leading-none gap-0.5">
                                                            <span className={`text-[9px] font-black px-1 py-0.5 rounded border ${evalRes.statusClass}`}>
                                                                {devPct}%
                                                            </span>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Quick Access Modules */}
            <div>
                <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                    <div className="w-2 h-6 bg-[#137fec] rounded-full mr-3"></div>
                    Akses Cepat Modul
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <QuickModule
                        href="/risiko/identifikasi"
                        icon={<AlertTriangle size={32} className="text-rose-500" />}
                        title="Identifikasi Risiko"
                        desc="Kelola daftar risiko unit kerja"
                        color="bg-rose-50"
                    />
                    <QuickModule
                        href="/risiko/analisis"
                        icon={<BarChart2 size={32} className="text-amber-500" />}
                        title="Analisis Risiko"
                        desc="Heatmap probabilitas & dampak"
                        color="bg-amber-50"
                    />
                    <QuickModule
                        href="/strategi/monitoring"
                        icon={<TrendingUp size={32} className="text-[#137fec]" />}
                        title="Monitoring KPI"
                        desc="Pantau realisasi sasaran strategis"
                        color="bg-blue-50"
                    />
                </div>
            </div>
        </div>
    );
}

function QuickModule({ href, icon, title, desc, color }: {
    href: string; icon: React.ReactNode; title: string; desc: string; color: string;
}) {
    return (
        <a href={href} className="card flex items-center space-x-5 p-5 hover:-translate-y-2 hover:shadow-xl transition-all duration-300 cursor-pointer bg-white border border-slate-205/60 relative group overflow-hidden rounded-3xl">
            <div className="absolute right-0 bottom-0 w-24 h-24 bg-slate-50 rounded-full translate-y-12 translate-x-12 group-hover:scale-150 transition-transform duration-500 opacity-50"></div>
            <div className={`w-16 h-16 rounded-2xl ${color} flex items-center justify-center shrink-0 shadow-inner group-hover:rotate-6 transition-transform relative z-10`}>
                {icon}
            </div>
            <div className="relative z-10">
                <h3 className="text-sm font-black text-slate-800 group-hover:text-[#137fec] transition-colors">{title}</h3>
                <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tight">{desc}</p>
            </div>
        </a>
    );
}

function DashboardCardDetailModal({
    type,
    rawRisiko,
    rawStrategi,
    onClose
}: {
    type: 'targetKpi' | 'totalRisiko' | 'risikoTinggi' | 'risikoBerjalan' | 'risikoAppetite';
    rawRisiko: any[];
    rawStrategi: any[];
    onClose: () => void;
}) {
    const [search, setSearch] = useState('');

    const config = React.useMemo(() => {
        if (type === 'targetKpi') {
            const list = rawStrategi;
            const tercapai = list.filter(s => s.isAchieved);
            const pct = list.length > 0 ? Math.round((tercapai.length / list.length) * 100) : 0;
            return {
                title: 'Detail Total KPI & Sasaran Strategis',
                subtitle: 'Evaluasi pencapaian Indikator Kinerja Utama (IKT) per Sasaran Strategis',
                headerGradient: 'from-blue-600 to-indigo-700',
                icon: <Target size={24} className="text-white" />,
                statCards: [
                    { label: 'Total Indikator KPI', val: list.length, color: 'text-blue-600' },
                    { label: 'Target Tercapai', val: `${tercapai.length} KPI (${pct}%)`, color: 'text-emerald-600' },
                    { label: 'Belum Tercapai', val: list.length - tercapai.length, color: 'text-amber-600' },
                ],
                isKPI: true,
                list
            };
        } else if (type === 'totalRisiko') {
            const list = rawRisiko;
            const closed = list.filter(r => r.status === 'Closed');
            const pct = list.length > 0 ? Math.round((closed.length / list.length) * 100) : 0;
            return {
                title: 'Detail Seluruh Daftar Risiko Terdaftar',
                subtitle: 'Inventarisasi lengkap seluruh data risiko teridentifikasi dalam sistem',
                headerGradient: 'from-rose-600 to-pink-700',
                icon: <ShieldAlert size={24} className="text-white" />,
                statCards: [
                    { label: 'Total Seluruh Risiko', val: list.length, color: 'text-rose-600' },
                    { label: 'Status Closed / Selesai', val: `${closed.length} (${pct}%)`, color: 'text-emerald-600' },
                    { label: 'Risiko Aktif', val: list.length - closed.length, color: 'text-indigo-600' },
                ],
                isKPI: false,
                list
            };
        } else if (type === 'risikoTinggi') {
            const list = rawRisiko.filter(r => r.skor_risiko >= 15);
            return {
                title: 'Detail Risiko Prioritas Sangat Tinggi (Ekstrem)',
                subtitle: 'Risiko dengan Skor Inherent (P × D) ≥ 15 yang memerlukan respon eskalasi segera',
                headerGradient: 'from-amber-500 to-orange-600',
                icon: <AlertTriangle size={24} className="text-white" />,
                statCards: [
                    { label: 'Jumlah Risiko Sangat Tinggi', val: list.length, color: 'text-rose-600' },
                    { label: 'Rasio Terhadap Total Risiko', val: `${rawRisiko.length > 0 ? Math.round((list.length / rawRisiko.length) * 100) : 0}%`, color: 'text-amber-600' },
                ],
                isKPI: false,
                list
            };
        } else if (type === 'risikoAppetite') {
            const list = rawRisiko.filter(r => (r.skor_risiko ?? 0) <= (r.selera_risiko ?? 6));
            return {
                title: 'Detail Risiko Inherent Sesuai Appetite Target',
                subtitle: 'Risiko dengan Skor Inherent (P × D) ≤ Selera Risiko Target (Batas Toleransi)',
                headerGradient: 'from-teal-600 to-emerald-700',
                icon: <ShieldCheck size={24} className="text-white" />,
                statCards: [
                    { label: 'Risiko Sesuai Appetite', val: list.length, color: 'text-teal-600' },
                    { label: 'Rasio Terhadap Total Risiko', val: `${rawRisiko.length > 0 ? Math.round((list.length / rawRisiko.length) * 100) : 0}%`, color: 'text-emerald-600' },
                    { label: 'Melebihi Appetite', val: `${rawRisiko.length - list.length} Risiko`, color: 'text-rose-600' },
                ],
                isKPI: false,
                list
            };
        } else {
            const list = rawRisiko.filter(r => r.status !== 'Closed');
            return {
                title: 'Detail Risiko Aktif Berjalan',
                subtitle: 'Risiko yang sedang menjalani proses pemantauan & tindakan mitigasi rutin',
                headerGradient: 'from-emerald-600 to-teal-700',
                icon: <Activity size={24} className="text-white" />,
                statCards: [
                    { label: 'Total Risiko Aktif Berjalan', val: list.length, color: 'text-emerald-600' },
                    { label: 'Risiko Butuh Mitigasi Tinggi', val: `${list.filter(r => r.skor_risiko >= 10).length} Risiko`, color: 'text-orange-600' },
                ],
                isKPI: false,
                list
            };
        }
    }, [type, rawRisiko, rawStrategi]);

    const filteredList = config.list.filter(item => {
        const q = search.toLowerCase();
        if (config.isKPI) {
            return (
                (item.sasaran_strategis || '').toLowerCase().includes(q) ||
                (item.indikator_kinerja || '').toLowerCase().includes(q) ||
                (item.unit_kerja?.nama_unit || '').toLowerCase().includes(q) ||
                (item.kode_ikt || '').toLowerCase().includes(q)
            );
        } else {
            return (
                (item.identifikasi_risiko || '').toLowerCase().includes(q) ||
                (item.kode_risiko || '').toLowerCase().includes(q) ||
                (item.unit_kerja?.nama_unit || '').toLowerCase().includes(q)
            );
        }
    });

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-100">
                {/* Modal Header */}
                <div className={`p-6 text-white bg-gradient-to-r ${config.headerGradient} flex items-center justify-between`}>
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md shrink-0">
                            {config.icon}
                        </div>
                        <div>
                            <h2 className="text-lg font-bold tracking-tight">{config.title}</h2>
                            <p className="text-xs text-white/80 mt-0.5">{config.subtitle}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
                        title="Tutup"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
                    {/* Metric Cards Row */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {config.statCards.map((sc, i) => (
                            <div key={i} className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-2xl text-center shadow-xs">
                                <p className="text-[11px] font-semibold text-slate-400 uppercase">{sc.label}</p>
                                <p className={`text-xl font-black mt-1 ${sc.color}`}>{sc.val}</p>
                            </div>
                        ))}
                    </div>

                    {/* Table Control */}
                    <div className="space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                Rincian Data ({filteredList.length} dari {config.list.length} Records)
                            </h3>
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Cari data..."
                                className="px-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                            />
                        </div>

                        {/* Table List */}
                        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
                            <div className="max-h-80 overflow-y-auto">
                                <table className="w-full text-left text-xs text-slate-600 border-collapse">
                                    <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 border-b border-slate-200 z-10">
                                        {config.isKPI ? (
                                            <tr>
                                                <th className="px-4 py-3 text-center w-12">No</th>
                                                <th className="px-4 py-3">Unit Kerja</th>
                                                <th className="px-4 py-3">Sasaran Strategis & Indikator</th>
                                                <th className="px-4 py-3 text-center">Target</th>
                                                <th className="px-4 py-3 text-center">Realisasi</th>
                                                <th className="px-4 py-3 text-center">Status</th>
                                            </tr>
                                        ) : (
                                            <tr>
                                                <th className="px-4 py-3 text-center w-12">No</th>
                                                <th className="px-4 py-3">Unit Kerja</th>
                                                <th className="px-4 py-3">Pernyataan Risiko</th>
                                                <th className="px-4 py-3 text-center">Prob</th>
                                                <th className="px-4 py-3 text-center">Dampak</th>
                                                <th className="px-4 py-3 text-center">Skor Inherent</th>
                                                <th className="px-4 py-3 text-center">Status</th>
                                            </tr>
                                        )}
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredList.length === 0 ? (
                                            <tr>
                                                <td colSpan={config.isKPI ? 6 : 7} className="px-4 py-8 text-center text-slate-400 text-xs">
                                                    Tidak ada data yang sesuai.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredList.map((item, idx) => {
                                                if (config.isKPI) {
                                                    const isAchieved = item.isAchieved ?? false;
                                                    const displayRealisasi = item.displayRealisasi || getDisplayRealisasi(item.realisasi);
                                                    return (
                                                        <tr key={item.id || idx} className="hover:bg-slate-50/80 transition-colors">
                                                            <td className="px-4 py-3 text-center font-semibold text-slate-400">{idx + 1}</td>
                                                            <td className="px-4 py-3 font-semibold text-slate-800">{item.unit_kerja?.nama_unit || '-'}</td>
                                                            <td className="px-4 py-3 max-w-xs">
                                                                {item.kode_ikt && <span className="text-[10px] font-mono text-slate-400 block">{item.kode_ikt}</span>}
                                                                <span className="font-semibold text-slate-700 block">{item.sasaran_strategis}</span>
                                                                <span className="text-slate-500 line-clamp-1">{item.indikator_kinerja}</span>
                                                            </td>
                                                            <td className="px-4 py-3 text-center font-bold">{item.target ?? '-'} {item.satuan || ''}</td>
                                                            <td className="px-4 py-3 text-center font-bold">{displayRealisasi} {item.satuan || ''}</td>
                                                            <td className="px-4 py-3 text-center">
                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${isAchieved ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                                                    {isAchieved ? 'Tercapai' : 'Belum Tercapai'}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                } else {
                                                    return (
                                                        <tr key={item.id || idx} className="hover:bg-slate-50/80 transition-colors">
                                                            <td className="px-4 py-3 text-center font-semibold text-slate-400">{idx + 1}</td>
                                                            <td className="px-4 py-3 font-semibold text-slate-800">{item.unit_kerja?.nama_unit || '-'}</td>
                                                            <td className="px-4 py-3 max-w-xs">
                                                                {item.kode_risiko && <span className="text-[10px] font-mono text-slate-400 block">{item.kode_risiko}</span>}
                                                                <span className="line-clamp-2">{item.identifikasi_risiko}</span>
                                                            </td>
                                                            <td className="px-4 py-3 text-center font-bold">{item.probabilitas}</td>
                                                            <td className="px-4 py-3 text-center font-bold">{item.dampak}</td>
                                                            <td className="px-4 py-3 text-center font-bold">
                                                                <span className={`px-2 py-0.5 rounded text-[11px] ${item.skor_risiko >= 15 ? 'bg-rose-100 text-rose-700' :
                                                                    item.skor_risiko >= 10 ? 'bg-orange-100 text-orange-700' :
                                                                        item.skor_risiko >= 5 ? 'bg-yellow-100 text-yellow-800' : 'bg-emerald-100 text-emerald-700'
                                                                    }`}>
                                                                    {item.skor_risiko}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 text-center">
                                                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 uppercase">
                                                                    {item.status || 'Open'}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                }
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-200/80 flex justify-between items-center text-xs text-slate-500">
                    <span>Menampilkan {filteredList.length} data</span>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold transition-colors shadow-xs cursor-pointer"
                    >
                        Tutup
                    </button>
                </div>
            </div>
        </div>
    );
}
