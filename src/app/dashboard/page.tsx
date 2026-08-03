'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ScoreCard } from '@/components/SharedUI';
import {
    ShieldAlert, Target, TrendingUp, AlertTriangle,
    CheckCircle2, Clock, BarChart2, Activity, ShieldCheck, ArrowRight
} from 'lucide-react';
import { useAppSettings } from '@/hooks/useAppSettings';
import { useUserProfile } from '@/hooks/useUserProfile';
import RiskHeatmap from '@/components/RiskHeatmap';
import {
    PieChart, Pie, Cell, ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';

export default function DashboardPage() {
    const { settings } = useAppSettings();
    const { profile } = useUserProfile();

    const [stats, setStats] = useState({
        totalRisiko: 0,
        risikoTinggi: 0,
        risikoBerjalan: 0,
        totalStrategi: 0,
        strategiTercapai: 0,
        risikoClosed: 0,
        avgRiskScore: 0,
        risikoSedang: 0,
        risikoRendah: 0,
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

    // Fetch lists for filters
    useEffect(() => {
        const fetchFilters = async () => {
            const { data: unitsData } = await supabase.from('unit_kerja').select('id, nama_unit').order('nama_unit');
            if (unitsData) setUnits(unitsData);

            const { data: yearsData } = await supabase.from('tahun_anggaran').select('tahun').order('tahun', { ascending: false });
            if (yearsData && yearsData.length > 0) {
                setYears(yearsData.map((y: any) => y.tahun));
            } else {
                setYears([2024, 2025, 2026, 2027]);
            }
        };
        fetchFilters();
    }, []);

    // Fetch dashboard stats
    useEffect(() => {
        const fetchStats = async () => {
            setLoadingStats(true);
            try {
                let queryRisiko = supabase.from('manajemen_risiko').select('*, unit_kerja(nama_unit)');
                let queryStrategi = supabase.from('manajemen_strategi').select('*, unit_kerja(nama_unit)');

                if (selectedYear) {
                    queryRisiko = queryRisiko.eq('tahun', Number(selectedYear));
                    queryStrategi = queryStrategi.eq('tahun', Number(selectedYear));
                }

                // If user is a user_unit manager, ignore selection and lock to their own unit_kerja_id
                const unitToFilter = profile?.role === 'user_unit' ? profile.unit_kerja_id : (selectedUnit === 'all' ? null : selectedUnit);
                if (unitToFilter) {
                    queryRisiko = queryRisiko.eq('unit_kerja_id', unitToFilter);
                    queryStrategi = queryStrategi.eq('unit_kerja_id', unitToFilter);
                }

                const [{ data: risikoData, error: rErr }, { data: strategiData, error: sErr }] = await Promise.all([
                    queryRisiko,
                    queryStrategi,
                ]);

                if (rErr) console.error('Risiko fetch error:', rErr);
                if (sErr) console.error('Strategi fetch error:', sErr);

                const rList = (risikoData as any[]) ?? [];
                const sList = (strategiData as any[]) ?? [];

                const totalRisiko = rList.length;
                const risikoTinggi = rList.filter(r => r.skor_risiko >= 15).length;
                const risikoSedang = rList.filter(r => r.skor_risiko >= 5 && r.skor_risiko < 15).length;
                const risikoRendah = rList.filter(r => r.skor_risiko < 5).length;
                const totalStrategi = sList.length;

                const strategiTercapai = sList.filter(s => {
                    const t = parseFloat(s.target), r = parseFloat(s.realisasi);
                    return !isNaN(t) && !isNaN(r) && r >= t;
                }).length;

                const closedRisks = rList.filter(r => r.status === 'Closed').length;
                const totalRiskScore = rList.reduce((sum, r) => sum + (r.skor_risiko || 0), 0);
                const avgRiskScore = totalRisiko > 0 ? Math.round((totalRiskScore / totalRisiko) * 10) / 10 : 0;

                setStats({
                    totalRisiko,
                    risikoTinggi,
                    risikoBerjalan: totalRisiko - closedRisks,
                    totalStrategi,
                    strategiTercapai,
                    risikoClosed: closedRisks,
                    avgRiskScore,
                    risikoSedang,
                    risikoRendah,
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
    const riskDonutData = [
        { name: 'Sangat Tinggi', value: stats.risikoTinggi, color: '#ef4444' },
        { name: 'Tinggi', value: rawRisiko.filter(r => r.skor_risiko >= 10 && r.skor_risiko < 15).length, color: '#f97316' },
        { name: 'Sedang', value: stats.risikoSedang, color: '#eab308' },
        { name: 'Rendah', value: stats.risikoRendah, color: '#10b981' },
    ].filter(item => item.value > 0);

    // Grouping KPI Achievement by Unit Kerja
    const getKpiPerUnitData = () => {
        const groups: { [key: string]: { total: number; tercapai: number } } = {};
        rawStrategi.forEach(s => {
            const unitName = (s.unit_kerja as any)?.nama_unit || 'Lainnya';
            if (!groups[unitName]) {
                groups[unitName] = { total: 0, tercapai: 0 };
            }
            groups[unitName].total += 1;
            const t = parseFloat(s.target), r = parseFloat(s.realisasi);
            if (!isNaN(t) && !isNaN(r) && r >= t) {
                groups[unitName].tercapai += 1;
            }
        });
        return Object.keys(groups).map(name => ({
            name,
            'Total Indikator': groups[name].total,
            'Tercapai': groups[name].tercapai,
        })).slice(0, 8); // Top 8 units
    };

    const kpiPerUnitData = getKpiPerUnitData();

    // Map raw risks to Heatmap points
    const heatmapPoints = rawRisiko.map(r => ({
        id: r.id,
        x: r.dampak || 1,
        y: r.probabilitas || 1,
        label: r.identifikasi_risiko,
        type: r.skor_risiko >= 15 ? 'inherent' as const : r.status === 'Closed' ? 'residual' as const : 'appetite' as const
    }));

    // Top 5 risks
    const topRisks = [...rawRisiko].sort((a, b) => b.skor_risiko - a.skor_risiko).slice(0, 5);

    // KPI Failures
    const kpiFailures = [...rawStrategi]
        .filter(s => {
            const t = parseFloat(s.target), r = parseFloat(s.realisasi);
            return !isNaN(t) && !isNaN(r) && r < t;
        })
        .sort((a, b) => {
            const pctA = parseFloat(a.realisasi) / parseFloat(a.target);
            const pctB = parseFloat(b.realisasi) / parseFloat(b.target);
            return pctA - pctB;
        })
        .slice(0, 5);

    const kpiPct = stats.totalStrategi ? Math.round(stats.strategiTercapai * 100 / stats.totalStrategi) : 0;
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
                    <div className="bg-rose-600 rounded-2xl p-4 text-center shadow-sm hover:shadow-md transition-shadow">
                        <p className="text-2xl font-black text-white">{stats.risikoTinggi}</p>
                        <p className="text-[10px] text-rose-100 font-bold uppercase mt-1 font-sans">Risiko Sangat Tinggi</p>
                    </div>
                    <div className="bg-amber-500 rounded-2xl p-4 text-center shadow-sm hover:shadow-md transition-shadow">
                        <p className="text-2xl font-black text-white">{stats.avgRiskScore}</p>
                        <p className="text-[10px] text-amber-50 font-bold uppercase mt-1 font-sans">Rerata Skor Risiko</p>
                    </div>
                </div>
            </div>

            {/* Modern Score Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
                <ScoreCard
                    icon={<Target size={22} className="text-[#137fec]" />}
                    title="Target KPI Utama"
                    value={stats.totalStrategi}
                    subtitle={`Tercapai: ${stats.strategiTercapai} KPI (${kpiPct}%)`}
                    colorClass="bg-white border-slate-200/80 shadow-xs hover:border-blue-300"
                />
                <ScoreCard
                    icon={<ShieldAlert size={22} className="text-rose-500" />}
                    title="Total Daftar Risiko"
                    value={stats.totalRisiko}
                    subtitle={`Status Closed: ${stats.risikoClosed} (${closedPct}%)`}
                    colorClass="bg-white border-slate-200/80 shadow-xs hover:border-rose-300"
                />
                <ScoreCard
                    icon={<AlertTriangle size={22} className="text-amber-500" />}
                    title="Risiko Sangat Tinggi"
                    value={stats.risikoTinggi}
                    subtitle="Memerlukan respon eskalasi segera"
                    colorClass="bg-white border-slate-200/80 shadow-xs hover:border-amber-300"
                />
                <ScoreCard
                    icon={<Activity size={22} className="text-emerald-500" />}
                    title="Risiko Aktif Berjalan"
                    value={stats.risikoBerjalan}
                    subtitle="Menjalani proses pemantauan mitigasi"
                    colorClass="bg-white border-slate-200/80 shadow-xs hover:border-emerald-300"
                />
            </div>

            {/* Charts Visual section */}
            {isMounted && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Donut Chart Sebaran Tingkat Risiko */}
                    <div className="lg:col-span-4 card bg-white border border-slate-200/60 shadow-xs p-6 rounded-3xl flex flex-col justify-between">
                        <div>
                            <h3 className="font-bold text-slate-800 text-sm mb-1 flex items-center gap-2">
                                <Activity size={16} className="text-[#137fec]" /> Sebaran Tingkat Risiko
                            </h3>
                            <p className="text-xs text-slate-400 font-medium">Berdasarkan proporsi kuantitas risiko aktif</p>
                        </div>
                        <div className="h-64 my-4 flex items-center justify-center relative">
                            {riskDonutData.length === 0 ? (
                                <span className="text-xs text-slate-400 font-medium">Tidak ada data risiko untuk ditampilkan</span>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={riskDonutData}
                                            innerRadius={60}
                                            outerRadius={85}
                                            paddingAngle={3}
                                            dataKey="value"
                                        >
                                            {riskDonutData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value) => [`${value} Risiko`, 'Jumlah']} />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-3xl font-black text-slate-800">{stats.totalRisiko}</span>
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Risiko</span>
                            </div>
                        </div>
                        <div className="flex border-t border-slate-100 pt-4 flex-wrap justify-between gap-y-2">
                            {riskDonutData.map(item => (
                                <div key={item.name} className="flex items-center gap-1.5 text-xs font-semibold text-slate-650">
                                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }}></span>
                                    <span>{item.name} ({item.value})</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Risk Heatmap Real-data Visual */}
                    <div className="lg:col-span-8 card bg-white border border-slate-200/60 shadow-xs p-6 rounded-3xl">
                        <h3 className="font-bold text-slate-800 text-sm mb-1 flex items-center gap-2">
                            <ShieldCheck size={16} className="text-rose-500" /> Peta Sebaran Risiko (Heatmap)
                        </h3>
                        <p className="text-xs text-slate-400 font-medium mb-6">Penempatan titik risiko inheren (I) dan sisa residual (R) pada matriks 5x5</p>
                        <div className="flex justify-center">
                            <div className="w-full max-w-2xl">
                                <RiskHeatmap data={heatmapPoints} />
                            </div>
                        </div>
                    </div>

                    {/* KPI Achievement Bar Chart per Unit */}
                    {kpiPerUnitData.length > 0 && (
                        <div className="lg:col-span-12 card bg-white border border-slate-200/60 shadow-xs p-6 rounded-3xl">
                            <h3 className="font-bold text-slate-800 text-sm mb-1 flex items-center gap-2">
                                <Target size={16} className="text-[#137fec]" /> Tren Pencapaian KPI per Unit Kerja
                            </h3>
                            <p className="text-xs text-slate-400 font-medium mb-6">Membandingkan target sasaran strategis dengan capaian realisasi</p>
                            <div className="h-72 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={kpiPerUnitData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} fontWeight="600" />
                                        <YAxis stroke="#94a3b8" fontSize={10} fontWeight="400" />
                                        <Tooltip />
                                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                                        <Bar dataKey="Total Indikator" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="Tercapai" fill="#137fec" radius={[4, 4, 0, 0]} />
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
                                            <p className="text-xs font-bold text-slate-800 line-clamp-1">{risk.identifikasi_risiko}</p>
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
                    <h3 className="font-bold text-slate-800 text-sm mb-4 flex items-center gap-2">
                        <TrendingUp size={16} className="text-amber-500" /> KPI Perlu Atensi (Realisasi &lt; Target)
                    </h3>
                    <div className="space-y-3">
                        {kpiFailures.length === 0 ? (
                            <p className="text-xs text-slate-400 font-medium py-6 text-center">Seluruh target KPI telah terpenuhi dengan baik!</p>
                        ) : (
                            kpiFailures.map((kpiData, index) => {
                                const tVal = parseFloat(kpiData.target);
                                const rVal = parseFloat(kpiData.realisasi) || 0;
                                const devPct = tVal > 0 ? Math.round(rVal * 100 / tVal) : 0;
                                return (
                                    <div key={kpiData.id} className="flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100/50 rounded-2xl border border-slate-100 transition-colors gap-3">
                                        <div className="flex items-center gap-3">
                                            <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 text-xs font-bold flex items-center justify-center shrink-0">
                                                {index + 1}
                                            </span>
                                            <div>
                                                <p className="text-xs font-bold text-slate-800 line-clamp-1">{kpiData.kpi}</p>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{kpiData.unit_kerja?.nama_unit || '-'}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 text-right shrink-0">
                                            <div className="text-xs font-semibold">
                                                <span className="text-slate-400 text-[10px]">Tgt: {kpiData.target}</span>
                                                <span className="text-slate-300 mx-1">|</span>
                                                <span className="text-slate-650">Real: {kpiData.realisasi || '0'}</span>
                                            </div>
                                            <span className="text-xs font-black text-rose-500 bg-rose-50 px-2 py-1 rounded-lg">
                                                {devPct}%
                                            </span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
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
