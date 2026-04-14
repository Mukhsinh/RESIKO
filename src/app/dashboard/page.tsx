'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ScoreCard } from '@/components/SharedUI';
import {
    ShieldAlert, Target, TrendingUp, AlertTriangle,
    CheckCircle2, Clock, BarChart2
} from 'lucide-react';

export default function DashboardPage() {
    const [stats, setStats] = useState({
        totalRisiko: 0, risikoTinggi: 0, risikoBerjalan: 0,
        totalStrategi: 0, strategiTercapai: 0,
    });

    const [welcomeData, setWelcomeData] = useState({
        userName: '',
        userRole: '',
        unitKerja: '',
        instansi: 'Sistem Manajemen Rumah Sakit',
    });

    useEffect(() => {
        const fetchStats = async () => {
            const [{ count: totalRisiko }, { count: risikoTinggi }, { count: totalStrategi }] = await Promise.all([
                supabase.from('manajemen_risiko').select('*', { count: 'exact', head: true }),
                supabase.from('manajemen_risiko').select('*', { count: 'exact', head: true }).gte('skor_risiko', 15),
                supabase.from('manajemen_strategi').select('*', { count: 'exact', head: true }),
            ]);
            setStats(s => ({
                ...s,
                totalRisiko: totalRisiko ?? 0,
                risikoTinggi: risikoTinggi ?? 0,
                totalStrategi: totalStrategi ?? 0,
            }));

            // Fetch Welcome details
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase.from('user_profiles').select('full_name, role, unit_kerja_id').eq('id', user.id).single();
                let unitName = 'Semua Unit';
                if (profile?.unit_kerja_id) {
                    const { data: unit } = await supabase.from('unit_kerja').select('nama_unit').eq('id', profile.unit_kerja_id).single();
                    if (unit) unitName = unit.nama_unit;
                }

                const { data: settings } = await supabase.from('app_settings').select('nama_rs').limit(1).single();

                setWelcomeData({
                    userName: profile?.full_name || user.email || 'User',
                    userRole: profile?.role || 'user',
                    unitKerja: unitName,
                    instansi: settings?.nama_rs || 'Rumah Sakit',
                });
            }
        };
        fetchStats();
    }, []);

    const currentYear = new Date().getFullYear();

    return (
        <div>
            {/* Info Strip (Welcome) */}
            <div className="card flex items-center space-x-4 mb-8 bg-gradient-to-r from-blue-50 to-indigo-50/50 border-l-4 border-[#137fec]">
                <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center shrink-0">
                    <Clock size={24} className="text-[#137fec]" />
                </div>
                <div>
                    <p className="text-lg font-bold text-slate-800">
                        Selamat Datang, {welcomeData.userName} 👋
                    </p>
                    <p className="text-sm text-slate-500 mt-0.5 font-medium">
                        {welcomeData.unitKerja} — {welcomeData.instansi}
                    </p>
                </div>
            </div>

            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Dashboard Utama</h1>
                    <p className="text-sm text-slate-500 mt-1">Ringkasan Manajemen Strategi & Risiko Tahun {currentYear}</p>
                </div>
            </div>

            {/* Score Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
                <ScoreCard
                    icon={<Target size={24} className="text-[#137fec]" />}
                    title="Total Sasaran Strategis"
                    value={stats.totalStrategi}
                    subtitle={`Tahun ${currentYear}`}
                    colorClass="bg-blue-50 border-blue-100"
                />
                <ScoreCard
                    icon={<ShieldAlert size={24} className="text-rose-500" />}
                    title="Total Risiko Teridentifikasi"
                    value={stats.totalRisiko}
                    subtitle={`Tahun ${currentYear}`}
                    colorClass="bg-rose-50 border-rose-100"
                />
                <ScoreCard
                    icon={<AlertTriangle size={24} className="text-amber-500" />}
                    title="Risiko Tinggi (Skor ≥ 15)"
                    value={stats.risikoTinggi}
                    subtitle="Perlu perhatian segera"
                    colorClass="bg-amber-50 border-amber-100"
                />
                <ScoreCard
                    icon={<CheckCircle2 size={24} className="text-emerald-500" />}
                    title="Risiko Termitigasi"
                    value={`${stats.totalRisiko > 0 ? Math.max(0, stats.totalRisiko - stats.risikoTinggi) : 0}`}
                    subtitle="Status: Controlled"
                    colorClass="bg-emerald-50 border-emerald-100"
                />
            </div>

            {/* Quick Access Modules */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
                <QuickModule
                    href="/risiko/identifikasi"
                    icon={<AlertTriangle size={28} className="text-rose-500" />}
                    title="Identifikasi Risiko"
                    desc="Input dan kelola daftar risiko unit kerja"
                    color="bg-rose-50"
                />
                <QuickModule
                    href="/risiko/analisis"
                    icon={<BarChart2 size={28} className="text-amber-500" />}
                    title="Analisis Risiko"
                    desc="Heatmap probabilitas & dampak risiko"
                    color="bg-amber-50"
                />
                <QuickModule
                    href="/strategi/monitoring"
                    icon={<TrendingUp size={28} className="text-[#137fec]" />}
                    title="Monitoring KPI"
                    desc="Pantau realisasi sasaran strategis"
                    color="bg-blue-50"
                />
            </div>
        </div>
    );
}

function QuickModule({ href, icon, title, desc, color }: {
    href: string; icon: React.ReactNode; title: string; desc: string; color: string;
}) {
    return (
        <a href={href} className="card flex items-center space-x-4 hover:-translate-y-1 hover:shadow-md transition-all duration-300 cursor-pointer">
            <div className={`w-14 h-14 rounded-xl ${color} flex items-center justify-center shrink-0`}>
                {icon}
            </div>
            <div>
                <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
            </div>
        </a>
    );
}
