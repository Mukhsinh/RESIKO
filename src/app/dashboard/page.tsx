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
        };
        fetchStats();
    }, []);

    const currentYear = new Date().getFullYear();

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Info Strip (Welcome) */}
            <div className="card flex items-center space-x-5 p-6 bg-gradient-to-r from-blue-50 to-indigo-50/50 border-l-4 border-[#137fec] relative overflow-hidden group">
                <div className="absolute right-0 top-0 w-32 h-32 bg-[#137fec]/5 rounded-full -translate-y-16 translate-x-16 blur-2xl group-hover:bg-[#137fec]/10 transition-colors"></div>
                <div className="w-16 h-16 rounded-2xl bg-white shadow-md flex items-center justify-center shrink-0 relative z-10 transition-transform group-hover:scale-105">
                    <Clock size={32} className="text-[#137fec]" />
                </div>
                <div className="relative z-10">
                    <p className="text-2xl font-black text-slate-800 tracking-tight">
                        Selamat Datang, {profile?.full_name?.split(' ')[0]} 👋
                    </p>
                    <div className="flex items-center space-x-2 mt-1 px-2.5 py-1 bg-white/60 rounded-lg w-fit border border-blue-100/50 backdrop-blur-sm">
                        <span className="text-[10px] font-black text-[#137fec] uppercase tracking-tighter bg-blue-50 px-1.5 py-0.5 rounded">
                            {profile?.role}
                        </span>
                        <span className="text-slate-400 font-bold text-xs">•</span>
                        <p className="text-xs text-slate-500 font-bold tracking-tight">
                            {profile?.unit_kerja_name} — <span className="text-[#137fec]">{settings?.nama_rs}</span>
                        </p>
                    </div>
                </div>
            </div>

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Dashboard Utama</h1>
                    <p className="text-sm font-medium text-slate-500 mt-1 flex items-center">
                        <TrendingUp size={16} className="text-blue-500 mr-2" />
                        Ringkasan Manajemen Strategi & Risiko Tahun <span className="font-bold text-slate-700 ml-1">{currentYear}</span>
                    </p>
                </div>
                <div className="hidden lg:flex items-center space-x-2 bg-slate-100/50 p-1 rounded-xl border border-slate-200">
                    <button className="px-4 py-2 bg-white rounded-lg shadow-sm text-xs font-bold text-slate-800 border border-slate-200">Tahun Ini</button>
                    <button className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors">Arsip</button>
                </div>
            </div>

            {/* Score Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
                <ScoreCard
                    icon={<Target size={28} className="text-[#137fec]" />}
                    title="Total Sasaran Strategis"
                    value={stats.totalStrategi}
                    subtitle={`Tahun ${currentYear}`}
                    colorClass="bg-white border-slate-100 hover:border-blue-200"
                />
                <ScoreCard
                    icon={<ShieldAlert size={28} className="text-rose-500" />}
                    title="Total Risiko Teridentifikasi"
                    value={stats.totalRisiko}
                    subtitle={`Tahun ${currentYear}`}
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
                    subtitle="Status: Controlled"
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
