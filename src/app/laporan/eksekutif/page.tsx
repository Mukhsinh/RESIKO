'use client';

import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { supabase, type ManajemenRisiko, type ManajemenStrategi } from '@/lib/supabase';
import { PageHeader, ScoreCard } from '@/components/SharedUI';
import { TrendingUp, ShieldAlert, Target, CheckCircle2, AlertTriangle, FileText, ChevronDown, Filter, PieChart, Map as MapIcon } from 'lucide-react';
import { useAppSettings } from '@/hooks/useAppSettings';
import { useUserProfile } from '@/hooks/useUserProfile';
import {
    exportExecutivePDF,
    exportExecutiveExcel,
    type KRIRow,
    type LossEventRow,
    type StrategicObjItem,
    type KartesiusRow,
    type ExportDataParams
} from './executiveExportUtils';

const CURRENT_YEAR = new Date().getFullYear();

interface WorkUnit {
    id: string;
    nama_unit: string;
}

export default function LaporanEksekutifPage() {
    const { settings } = useAppSettings();
    const { profile, isManager, validUnitIds, isMatchUnit } = useUserProfile();

    const [risiko, setRisiko] = useState<ManajemenRisiko[]>([]);
    const [strategi, setStrategi] = useState<ManajemenStrategi[]>([]);
    const [kris, setKris] = useState<KRIRow[]>([]);
    const [lossEvents, setLossEvents] = useState<LossEventRow[]>([]);
    const [swotData, setSwotData] = useState<any[]>([]);
    const [towsData, setTowsData] = useState<any[]>([]);
    const [cascadingData, setCascadingData] = useState<any[]>([]);
    const [units, setUnits] = useState<WorkUnit[]>([]);

    const [year, setYear] = useState(String(CURRENT_YEAR));
    const [unitFilter, setUnitFilter] = useState('');
    const [loading, setLoading] = useState(true);
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Auto filter unit if user role is user_unit or manager
    useEffect(() => {
        if ((profile?.role === 'user_unit' || isManager) && profile?.unit_kerja_id) {
            setUnitFilter(profile.unit_kerja_id);
        }
    }, [profile, isManager]);

    // Fetch unit list
    useEffect(() => {
        supabase.from('unit_kerja').select('id, nama_unit').order('nama_unit').then(({ data }) => {
            if (data) setUnits(data as WorkUnit[]);
        });
    }, []);

    // Fetch all executive report datasets
    useEffect(() => {
        setLoading(true);
        Promise.all([
            supabase.from('manajemen_risiko').select('*, unit_kerja(id, nama_unit)').eq('tahun', Number(year)),
            supabase.from('manajemen_strategi').select('*, unit_kerja(id, nama_unit)').eq('tahun', Number(year)),
            supabase.from('key_risk_indicators').select('*, unit_kerja(id, nama_unit)').eq('tahun', Number(year)),
            supabase.from('loss_events').select('*, unit_kerja(id, nama_unit)').eq('tahun', Number(year)),
            supabase.from('swot_inventarisasi').select('*, unit_kerja(id, nama_unit)').eq('tahun', Number(year)),
            supabase.from('swot_tows_strategi').select('*, unit_kerja(id, nama_unit)').eq('tahun', Number(year)),
            supabase.from('cascading_kpi').select('*, unit_kerja(id, nama_unit)').eq('tahun', Number(year)),
        ]).then(([
            { data: r }, { data: s }, { data: k }, { data: l }, { data: sw }, { data: tw }, { data: cs }
        ]) => {
            setRisiko((r as ManajemenRisiko[]) ?? []);
            setStrategi((s as ManajemenStrategi[]) ?? []);
            setKris((k as KRIRow[]) ?? []);
            setLossEvents((l as LossEventRow[]) ?? []);
            setSwotData(sw ?? []);
            setTowsData(tw ?? []);
            setCascadingData(cs ?? []);
            setLoading(false);
        }).catch(err => {
            console.error('Error fetching executive datasets:', err);
            setRisiko([]); setStrategi([]); setKris([]); setLossEvents([]);
            setSwotData([]); setTowsData([]); setCascadingData([]);
            setLoading(false);
        });
    }, [year]);

    // Dropdown outside click handler
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const checkMatch = useCallback((uId?: string, uObj?: any) => {
        if (isManager) return isMatchUnit(uId, uObj);
        if (!unitFilter) return true;
        return uId === unitFilter || uObj?.id === unitFilter;
    }, [unitFilter, isManager, isMatchUnit]);

    // Filter datasets by unitFilter
    const filteredRisiko = useMemo(() => risiko.filter(r => checkMatch(r.unit_kerja_id, r.unit_kerja)), [risiko, checkMatch]);
    const filteredStrategi = useMemo(() => strategi.filter(s => checkMatch(s.unit_kerja_id, s.unit_kerja)), [strategi, checkMatch]);
    const filteredKris = useMemo(() => kris.filter(k => checkMatch(k.unit_kerja_id, k.unit_kerja)), [kris, checkMatch]);
    const filteredLossEvents = useMemo(() => lossEvents.filter(l => checkMatch(l.unit_kerja_id, l.unit_kerja)), [lossEvents, checkMatch]);
    const filteredSwot = useMemo(() => swotData.filter(sw => checkMatch(sw.unit_kerja_id, sw.unit_kerja)), [swotData, checkMatch]);
    const filteredTows = useMemo(() => towsData.filter(tw => checkMatch(tw.unit_kerja_id, tw.unit_kerja)), [towsData, checkMatch]);
    const filteredCascading = useMemo(() => cascadingData.filter(cs => checkMatch(cs.unit_kerja_id, cs.unit_kerja)), [cascadingData, checkMatch]);

    // Strategy metrics calculations
    const kpiAchieved = useMemo(() => filteredStrategi.filter(d => {
        const t = parseFloat(d.target), r = parseFloat(d.realisasi);
        return !isNaN(t) && !isNaN(r) && r >= t;
    }).length, [filteredStrategi]);

    const kpiPct = useMemo(() => filteredStrategi.length ? Math.round(kpiAchieved * 100 / filteredStrategi.length) : 0, [filteredStrategi, kpiAchieved]);

    const topKpiFail = useMemo(() => [...filteredStrategi].filter(d => {
        const t = parseFloat(d.target), r = parseFloat(d.realisasi);
        return !isNaN(t) && !isNaN(r) && r < t;
    }).sort((a, b) => (parseFloat(a.realisasi) / parseFloat(a.target)) - (parseFloat(b.realisasi) / parseFloat(b.target))).slice(0, 5), [filteredStrategi]);

    // Risk metrics calculations
    const highRisk = useMemo(() => filteredRisiko.filter(r => r.skor_risiko >= 15).length, [filteredRisiko]);
    const closedRisk = useMemo(() => filteredRisiko.filter(r => r.status === 'Closed').length, [filteredRisiko]);
    const riskClosePct = useMemo(() => filteredRisiko.length ? Math.round(closedRisk * 100 / filteredRisiko.length) : 0, [filteredRisiko, closedRisk]);
    const topRisks = useMemo(() => [...filteredRisiko].sort((a, b) => b.skor_risiko - a.skor_risiko).slice(0, 5), [filteredRisiko]);

    const riskByLevel = useMemo(() => ({
        sangatTinggi: filteredRisiko.filter(r => r.skor_risiko >= 15).length,
        tinggi: filteredRisiko.filter(r => r.skor_risiko >= 10 && r.skor_risiko < 15).length,
        sedang: filteredRisiko.filter(r => r.skor_risiko >= 5 && r.skor_risiko < 10).length,
        rendah: filteredRisiko.filter(r => r.skor_risiko < 5).length,
    }), [filteredRisiko]);

    const totalLossValuation = useMemo(() => filteredLossEvents.reduce((s, l) => s + (l.dampak_finansial || 0), 0), [filteredLossEvents]);
    const kriOverLimit = useMemo(() => filteredKris.filter(k => (k.nilai_aktual ?? 0) > (k.batas_atas ?? Infinity)).length, [filteredKris]);

    // Kartesius calculation per unit
    const kartesiusRows = useMemo<KartesiusRow[]>(() => {
        const kartesiusUnits = Object.entries(
            filteredSwot.reduce((acc: Record<string, { name: string; swots: any[] }>, s: any) => {
                const uId = s.unit_kerja_id || (s.unit_kerja as any)?.id || 'unknown';
                const uName = (s.unit_kerja as any)?.nama_unit || 'Lainnya';
                if (!acc[uId]) acc[uId] = { name: uName, swots: [] };
                acc[uId].swots.push(s);
                return acc;
            }, {} as Record<string, { name: string; swots: any[] }>)
        );

        return kartesiusUnits.map(([uId, item], idx) => {
            const sumSkor = (kat: string) => item.swots
                .filter((s: any) => s.kategori === kat)
                .reduce((sum: number, curr: any) => sum + (Number(curr.skor) || ((Number(curr.bobot) || 0) * (Number(curr.ranking) || 1))), 0);
            const totalK = sumSkor('Kekuatan');
            const totalW = sumSkor('Kelemahan');
            const totalP = sumSkor('Peluang');
            const totalT = sumSkor('Tantangan');
            const x = Number((totalK - totalW).toFixed(2));
            const y = Number((totalP - totalT).toFixed(2));
            let kuadran = "Kuadran I";
            let rekom = "Agresif / Pertumbuhan";
            if (x >= 0 && y >= 0) { kuadran = "Kuadran I"; rekom = "Agresif / Pertumbuhan"; }
            else if (x < 0 && y >= 0) { kuadran = "Kuadran II"; rekom = "Diversifikasi"; }
            else if (x < 0 && y < 0) { kuadran = "Kuadran III"; rekom = "Defensif / Bertahan"; }
            else { kuadran = "Kuadran IV"; rekom = "Turnaround / Pembenahan"; }
            return { no: idx + 1, unit: item.name, totalK, totalW, x, totalP, totalT, y, kuadran, rekom };
        });
    }, [filteredSwot]);

    // Strategic Objectives BSC Map calculation
    const strategicObjectives = useMemo<StrategicObjItem[]>(() => {
        const mapPerspective = (p: string | null | undefined): 'financial' | 'customer' | 'internal' | 'learning' => {
            if (!p) return 'financial';
            const val = p.toLowerCase().trim();
            if (val.includes('pelanggan') || val === 'customer') return 'customer';
            if (val.includes('proses') || val === 'internal') return 'internal';
            if (val.includes('pembelajaran') || val.includes('pertumbuhan') || val === 'learning') return 'learning';
            return 'financial';
        };

        const uniqueMap = new Map<string, any>();
        filteredTows.forEach(t => {
            if (t.sasaran_strategi && t.implementasi) {
                const p = mapPerspective(t.implementasi);
                const k = `${p}-${t.sasaran_strategi}`;
                if (!uniqueMap.has(k)) {
                    uniqueMap.set(k, {
                        id: `T-${uniqueMap.size + 1}`,
                        title: t.sasaran_strategi,
                        perspective: p,
                        unit: (t.unit_kerja as any)?.nama_unit || 'Lainnya'
                    });
                }
            }
        });
        filteredCascading.forEach(c => {
            if (c.sasaran_strategis && c.perspektif) {
                const p = mapPerspective(c.perspektif);
                const k = `${p}-${c.sasaran_strategis}`;
                if (!uniqueMap.has(k)) {
                    uniqueMap.set(k, {
                        id: `C-${uniqueMap.size + 1}`,
                        title: c.sasaran_strategis,
                        perspective: p,
                        unit: (c.unit_kerja as any)?.nama_unit || 'Lainnya'
                    });
                }
            }
        });
        return Array.from(uniqueMap.values());
    }, [filteredTows, filteredCascading]);

    // Prepare export params object
    const selectedUnitObj = units.find(u => u.id === unitFilter);
    const unitLabel = selectedUnitObj ? selectedUnitObj.nama_unit : 'Semua Unit Kerja';

    const getExportParams = (): ExportDataParams => ({
        year, unitLabel, filteredRisiko, filteredStrategi, filteredKris,
        filteredLossEvents, topKpiFail, topRisks, riskByLevel, kartesiusRows,
        strategicObjectives, kpiAchieved, kpiPct, highRisk, closedRisk,
        riskClosePct, totalLossValuation, kriOverLimit, settings
    });

    const handlePDFDownload = () => {
        exportExecutivePDF(getExportParams());
        setShowDropdown(false);
    };

    const handleExcelDownload = () => {
        exportExecutiveExcel(getExportParams());
        setShowDropdown(false);
    };

    return (
        <div>
            <PageHeader
                title="Laporan Eksekutif"
                subtitle="Dashboard ringkas gabungan kinerja manajemen strategi & risiko rumah sakit."
                actions={
                    <div className="flex gap-2 flex-wrap items-center">
                        {/* Unit Kerja Filter Dropdown */}
                        <div className="relative flex items-center">
                            <Filter size={15} className="absolute left-3 text-slate-400 pointer-events-none" />
                            <select
                                className="form-input pl-9 pr-8 w-48 text-xs font-semibold bg-white border-slate-200"
                                value={unitFilter}
                                onChange={e => setUnitFilter(e.target.value)}
                                disabled={profile?.role === 'user_unit' || isManager}
                            >
                                <option value="">Semua Unit Kerja</option>
                                {units.map(u => (
                                    <option key={u.id} value={u.id}>{u.nama_unit}</option>
                                ))}
                            </select>
                        </div>

                        {/* Year Selector */}
                        <select className="form-input w-28 text-xs font-semibold bg-white border-slate-200" value={year} onChange={e => setYear(e.target.value)}>
                            {[CURRENT_YEAR + 1, CURRENT_YEAR, CURRENT_YEAR - 1].map(y => <option key={y}>{y}</option>)}
                        </select>

                        {/* Unified Laporan Dropdown */}
                        <div className="relative" ref={dropdownRef}>
                            <button
                                className="btn-secondary border-primary/20 text-primary hover:bg-primary/5 flex items-center gap-1.5 py-2 px-3.5 text-sm font-medium shadow-sm transition-all"
                                onClick={() => setShowDropdown(v => !v)}
                            >
                                <FileText size={16} />
                                <span>Laporan</span>
                                <ChevronDown size={14} className={`transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`} />
                            </button>
                            {showDropdown && (
                                <div className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-1.5 animate-in fade-in slide-in-from-top-1">
                                    <button
                                        onClick={handlePDFDownload}
                                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 transition-colors"
                                    >
                                        <FileText size={15} className="text-rose-500" />
                                        <span>Unduh PDF (Gabungan)</span>
                                    </button>
                                    <button
                                        onClick={handleExcelDownload}
                                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 transition-colors"
                                    >
                                        <FileText size={15} className="text-emerald-500" />
                                        <span>Unduh Excel (Gabungan)</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                }
            />

            {loading ? (
                <div className="card flex items-center justify-center py-16 text-slate-400">
                    <div className="animate-spin w-5 h-5 border-2 border-slate-200 border-t-[#137fec] rounded-full mr-2" />
                    <span className="text-sm">Menyiapkan dashboard & laporan eksekutif terpadu...</span>
                </div>
            ) : (
                <>
                    {/* Executive KPIs */}
                    <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
                        <ScoreCard icon={<Target size={22} className="text-[#137fec]" />} title="Total KPI Strategi" value={filteredStrategi.length} colorClass="bg-blue-50 border-blue-100" />
                        <ScoreCard icon={<CheckCircle2 size={22} className="text-emerald-500" />} title="KPI Tercapai" value={`${kpiAchieved} (${kpiPct}%)`} subtitle="dari total KPI" colorClass="bg-emerald-50 border-emerald-100" />
                        <ScoreCard icon={<ShieldAlert size={22} className="text-slate-500" />} title="Total Risiko" value={filteredRisiko.length} colorClass="bg-slate-50 border-slate-100" />
                        <ScoreCard icon={<AlertTriangle size={22} className="text-rose-500" />} title="Risiko Sangat Tinggi" value={`${highRisk} risiko`} colorClass="bg-rose-50 border-rose-100" />
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
                        {/* Strategy summary card */}
                        <div className="card">
                            <div className="flex items-center gap-2 mb-5">
                                <TrendingUp size={18} className="text-[#137fec]" />
                                <h3 className="font-bold text-slate-700">Status Strategi {year}</h3>
                            </div>
                            <div className="flex items-center gap-4 mb-5">
                                <div className="relative w-20 h-20 shrink-0">
                                    <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
                                        <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#f1f5f9" strokeWidth="3.5" />
                                        <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#137fec" strokeWidth="3.5"
                                            strokeDasharray={`${kpiPct} ${100 - kpiPct}`} strokeLinecap="round" />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="text-sm font-bold text-slate-700">{kpiPct}%</span>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-slate-700">Tingkat Capaian KPI</p>
                                    <p className="text-xs text-slate-500 mt-1">{kpiAchieved} dari {filteredStrategi.length} indikator tercapai</p>
                                    <p className="text-xs text-slate-400 mt-0.5">{filteredStrategi.length - kpiAchieved} indikator belum tercapai</p>
                                </div>
                            </div>
                            {topKpiFail.length > 0 && (
                                <>
                                    <p className="text-xs font-semibold text-rose-600 mb-2">⚠ KPI Perlu Perhatian</p>
                                    <div className="space-y-2">
                                        {topKpiFail.map(d => {
                                            const pct = Math.round((parseFloat(d.realisasi) / parseFloat(d.target)) * 100);
                                            return (
                                                <div key={d.id} className="flex items-center gap-3 text-xs">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="truncate text-slate-700">{d.kpi}</p>
                                                        <p className="text-slate-400">{(d.unit_kerja as { nama_unit: string })?.nama_unit ?? ''}</p>
                                                    </div>
                                                    <span className="text-rose-600 font-bold shrink-0">{pct}%</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Risk summary card */}
                        <div className="card">
                            <div className="flex items-center gap-2 mb-5">
                                <ShieldAlert size={18} className="text-rose-500" />
                                <h3 className="font-bold text-slate-700">Status Risiko {year}</h3>
                            </div>
                            <div className="flex items-center gap-4 mb-5">
                                <div className="relative w-20 h-20 shrink-0">
                                    <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
                                        <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#f1f5f9" strokeWidth="3.5" />
                                        <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#10b981" strokeWidth="3.5"
                                            strokeDasharray={`${riskClosePct} ${100 - riskClosePct}`} strokeLinecap="round" />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="text-sm font-bold text-slate-700">{riskClosePct}%</span>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-slate-700">Risiko Terselesaikan</p>
                                    <p className="text-xs text-slate-500 mt-1">{closedRisk} dari {filteredRisiko.length} risiko ditutup</p>
                                    <p className="text-xs text-slate-400 mt-0.5">{highRisk} risiko sangat tinggi aktif</p>
                                </div>
                            </div>
                            {topRisks.length > 0 && (
                                <>
                                    <p className="text-xs font-semibold text-rose-600 mb-2">🔴 5 Risiko Prioritas Tertinggi</p>
                                    <div className="space-y-2">
                                        {topRisks.map((r, i) => (
                                            <div key={r.id} className="flex items-center gap-3 text-xs">
                                                <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="truncate text-slate-700">{r.identifikasi_risiko}</p>
                                                    <p className="text-slate-400">{(r.unit_kerja as { nama_unit: string })?.nama_unit ?? ''}</p>
                                                </div>
                                                <span className={`font-bold shrink-0 ${r.skor_risiko >= 15 ? 'text-rose-600' : 'text-amber-500'}`}>{r.skor_risiko}</span>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Additional Metrics Cards */}
                        <div className="card">
                            <div className="flex items-center gap-2 mb-3">
                                <PieChart size={18} className="text-purple-500" />
                                <h3 className="font-bold text-slate-700">Diagram Kartesius SWOT</h3>
                            </div>
                            <p className="text-2xl font-bold text-slate-800">{kartesiusRows.length} <span className="text-xs text-slate-500 font-normal">unit kerja terpetakan</span></p>
                            <p className="text-xs text-slate-400 mt-1">Kuadran I / Pertumbuhan: {kartesiusRows.filter(k => k.kuadran === 'Kuadran I').length} unit</p>
                        </div>

                        <div className="card">
                            <div className="flex items-center gap-2 mb-3">
                                <MapIcon size={18} className="text-[#137fec]" />
                                <h3 className="font-bold text-slate-700">Strategic Map BSC</h3>
                            </div>
                            <p className="text-2xl font-bold text-slate-800">{strategicObjectives.length} <span className="text-xs text-slate-500 font-normal">sasaran terpetakan</span></p>
                            <p className="text-xs text-slate-400 mt-1">Di 4 perspektif utama BSC</p>
                        </div>
                    </div>

                    {/* Overall Summary Card */}
                    <div className="card bg-gradient-to-br from-slate-800 to-slate-900 text-white border-0 shadow-lg">
                        <h3 className="font-bold text-white mb-4">Kesimpulan Eksekutif Terpadu ({year})</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                                { label: 'Capaian KPI', value: `${kpiPct}%`, color: kpiPct >= 80 ? 'text-emerald-400' : kpiPct >= 60 ? 'text-amber-400' : 'text-rose-400' },
                                { label: 'Risiko Selesai', value: `${riskClosePct}%`, color: riskClosePct >= 50 ? 'text-emerald-400' : 'text-amber-400' },
                                { label: 'Risiko Sangat Tinggi', value: highRisk, color: highRisk === 0 ? 'text-emerald-400' : 'text-rose-400' },
                                { label: 'Kerugian Incident', value: `Rp ${(totalLossValuation / 1_000_000).toFixed(1)}Jt`, color: 'text-amber-400' },
                            ].map(item => (
                                <div key={item.label} className="text-center p-4 rounded-xl bg-white/5">
                                    <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                                    <p className="text-slate-400 text-xs mt-1">{item.label}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
