'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ScoreCard } from '@/components/SharedUI';
import {
    ShieldAlert, Target, TrendingUp, AlertTriangle,
    CheckCircle2, Clock, BarChart2
} from 'lucide-react';
import { useAppSettings } from '@/hooks/useAppSettings';
import { useUserProfile } from '@/hooks/useUserProfile';

export default function DashboardPage() {
    const { settings } = useAppSettings();
    const { profile } = useUserProfile();

    const [stats, setStats] = useState({
        totalRisiko: 0, risikoTinggi: 0, risikoBerjalan: 0,
        totalStrategi: 0, strategiTercapai: 0,
    });
    const [selectedUnit, setSelectedUnit] = useState<string>('all');
    const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()));
    const [units, setUnits] = useState<{ id: string; nama_unit: string }[]>([]);
    const [years, setYears] = useState<number[]>([]);
    const [loadingStats, setLoadingStats] = useState(true);

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
                // Return fallback years if table is empty
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
                let queryRisiko = supabase.from('manajemen_risiko').select('*', { count: 'exact', head: true });
                let queryRisikoTinggi = supabase.from('manajemen_risiko').select('*', { count: 'exact', head: true }).gte('skor_risiko', 15);
                let queryStrategi = supabase.from('manajemen_strategi').select('*', { count: 'exact', head: true });

                if (selectedYear) {
                    queryRisiko = queryRisiko.eq('tahun', Number(selectedYear));
                    queryRisikoTinggi = queryRisikoTinggi.eq('tahun', Number(selectedYear));
                    queryStrategi = queryStrategi.eq('tahun', Number(selectedYear));
                }

                // If user is a user_unit manager, ignore selection and lock to their own unit_kerja_id
                const unitToFilter = profile?.role === 'user_unit' ? profile.unit_kerja_id : (selectedUnit === 'all' ? null : selectedUnit);
                if (unitToFilter) {
                    queryRisiko = queryRisiko.eq('unit_kerja_id', unitToFilter);
                    queryRisikoTinggi = queryRisikoTinggi.eq('unit_kerja_id', unitToFilter);
                    queryStrategi = queryStrategi.eq('unit_kerja_id', unitToFilter);
                }

                const [{ count: totalRisiko }, { count: risikoTinggi }, { count: totalStrategi }] = await Promise.all([
                    queryRisiko,
                    queryRisikoTinggi,
                    queryStrategi,
                ]);

                setStats({
                    totalRisiko: totalRisiko ?? 0,
                    risikoTinggi: risikoTinggi ?? 0,
                    risikoBerjalan: 0,
                    totalStrategi: totalStrategi ?? 0,
                    strategiTercapai: 0,
                });
            } catch (err) {
                console.error('Error fetching dashboard stats:', err);
            } finally {
                setLoadingStats(false);
            }
        };

        fetchStats();
    }, [selectedUnit, selectedYear, profile]);

    const currentYear = new Date().getFullYear();

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Dashboard Utama</h1>
                    <p className="text-sm font-medium text-slate-500 mt-1 flex items-center">
                        <TrendingUp size={16} className="text-blue-500 mr-2" />
                        Ringkasan Manajemen Strategi & Risiko Tahun <span className="font-bold text-slate-700 ml-1">{selectedYear}</span>
                        {loadingStats && <span className="text-xs text-amber-500 ml-3">⟳ Memuat data...</span>}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    {/* Unit Kerja Filter */}
                    <div className="flex flex-col">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Unit Kerja</label>
                        {profile?.role === 'user_unit' ? (
                            <div className="px-3.5 py-2.5 bg-slate-100/80 text-slate-600 rounded-xl border border-slate-200 text-xs font-bold min-w-[200px]">
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

            {/* Score Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
                <ScoreCard
                    icon={<Target size={28} className="text-[#137fec]" />}
                    title="Total Sasaran Strategis"
                    value={stats.totalStrategi}
                    subtitle={`Tahun ${selectedYear}`}
                    colorClass="bg-white border-slate-100 hover:border-blue-200"
                />
                <ScoreCard
                    icon={<ShieldAlert size={28} className="text-rose-500" />}
                    title="Total Risiko Teridentifikasi"
                    value={stats.totalRisiko}
                    subtitle={`Tahun ${selectedYear}`}
                    colorClass="bg-white border-slate-100 hover:border-rose-200"
                />
                <ScoreCard
                    icon={<AlertTriangle size={28} className="text-amber-500" />}
                    title="Risiko Tinggi (Skor ≥ 15)"
                    value={stats.risikoTinggi}
                    subtitle="Perlu perhatian segera"
                    colorClass="bg-white border-slate-100 hover:border-amber-200"
                />
                <ScoreCard
                    icon={<CheckCircle2 size={28} className="text-emerald-500" />}
                    title="Risiko Termitigasi"
                    value={`${stats.totalRisiko > 0 ? Math.max(0, stats.totalRisiko - stats.risikoTinggi) : 0}`}
                    subtitle={`Tahun ${selectedYear}`}
                    colorClass="bg-white border-slate-100 hover:border-emerald-200"
                />
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
                        desc="Input dan kelola daftar risiko unit kerja"
                        color="bg-rose-50"
                    />
                    <QuickModule
                        href="/risiko/analisis"
                        icon={<BarChart2 size={32} className="text-amber-500" />}
                        title="Analisis Risiko"
                        desc="Heatmap probabilitas & dampak risiko"
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
        <a href={href} className="card flex items-center space-x-5 p-5 hover:-translate-y-2 hover:shadow-xl transition-all duration-300 cursor-pointer bg-white border border-slate-100 relative group overflow-hidden">
            <div className="absolute right-0 bottom-0 w-24 h-24 bg-slate-50 rounded-full translate-y-12 translate-x-12 group-hover:scale-150 transition-transform duration-500 opacity-50"></div>
            <div className={`w-16 h-16 rounded-2xl ${color} flex items-center justify-center shrink-0 shadow-inner group-hover:rotate-6 transition-transform relative z-10`}>
                {icon}
            </div>
            <div className="relative z-10">
                <h3 className="text-base font-black text-slate-800 group-hover:text-[#137fec] transition-colors">{title}</h3>
                <p className="text-xs text-slate-400 font-medium mt-1 uppercase tracking-tight">{desc}</p>
            </div>
        </a>
    );
}
