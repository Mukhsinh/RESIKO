'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard, Target, ShieldAlert, FileBarChart2, Database,
    Settings, BookOpen, ChevronDown, ChevronRight,
    Crosshair, Map, BarChart2, Activity, ClipboardList, CheckCircle2,
    AlertTriangle, PieChart, Menu, X, Brain,
    FolderOpen, Calendar, Layers, TrendingUp, Users, LogOut
} from 'lucide-react';

interface NavItem {
    label: string;
    href?: string;
    icon: React.ReactNode;
    children?: NavItem[];
}

const navItems: NavItem[] = [
    {
        label: 'Dashboard',
        href: '/dashboard',
        icon: <LayoutDashboard size={18} />,
    },
    {
        label: 'Manajemen Strategi',
        icon: <Target size={18} />,
        children: [
            { label: 'Visi & Misi', href: '/strategi/visi-misi', icon: <Crosshair size={16} /> },
            { label: 'Renstra (5 Tahunan)', href: '/strategi/renstra', icon: <Map size={16} /> },
            { label: 'RKT (Tahunan)', href: '/strategi/rkt', icon: <Calendar size={16} /> },
            { label: 'IKT (Indikator Kinerja)', href: '/strategi/ikt', icon: <Target size={16} /> },
            { label: 'Evaluasi IKT', href: '/strategi/evaluasi-ikt', icon: <CheckCircle2 size={16} /> },
            { label: 'Analisis SWOT', href: '/strategi/swot', icon: <Layers size={16} /> },
            { label: 'Diagram Kartesius', href: '/strategi/kartesius', icon: <PieChart size={16} /> },
            { label: 'Matriks TOWS', href: '/strategi/tows', icon: <FolderOpen size={16} /> },
            { label: 'Cascading KPI', href: '/strategi/cascading', icon: <TrendingUp size={16} /> },
            { label: 'Monitoring KPI', href: '/strategi/monitoring', icon: <BarChart2 size={16} /> },
            { label: 'Strategic Map', href: '/strategi/strategic-map', icon: <Map size={16} /> },
        ],
    },
    {
        label: 'Manajemen Risiko',
        icon: <ShieldAlert size={18} />,
        children: [
            { label: 'Identifikasi Risiko', href: '/risiko/identifikasi', icon: <AlertTriangle size={16} /> },
            {
                label: 'Analisis Risiko',
                icon: <PieChart size={16} />,
                children: [
                    { label: 'Risk Profile', href: '/risiko/analisis/risk-profile', icon: <FileBarChart2 size={16} /> },
                    { label: 'Residual Risk', href: '/risiko/analisis/residual-risk', icon: <PieChart size={16} /> },
                    { label: 'Key Risk Indicator', href: '/risiko/analisis/key-risk-indicator', icon: <Activity size={16} /> },
                    { label: 'Loss Event', href: '/risiko/analisis/loss-event', icon: <AlertTriangle size={16} /> },
                    { label: 'Early Warning System', href: '/risiko/analisis/early-warning', icon: <AlertTriangle size={16} /> },
                    { label: 'Risk Register', href: '/risiko/analisis/risk-register', icon: <ClipboardList size={16} /> },
                ]
            },
            { label: 'Evaluasi Risiko', href: '/risiko/evaluasi', icon: <Activity size={16} /> },
            { label: 'Penanganan Risiko', href: '/risiko/penanganan', icon: <ClipboardList size={16} /> },
            { label: 'Monitoring Risiko', href: '/risiko/monitoring', icon: <CheckCircle2 size={16} /> },
        ],
    },
    {
        label: 'Laporan',
        icon: <FileBarChart2 size={18} />,
        children: [
            { label: 'Laporan Strategi', href: '/laporan/strategi', icon: <BarChart2 size={16} /> },
            { label: 'Laporan Risiko', href: '/laporan/risiko', icon: <ShieldAlert size={16} /> },
            { label: 'Laporan Eksekutif', href: '/laporan/eksekutif', icon: <TrendingUp size={16} /> },
        ],
    },
    {
        label: 'Master Data',
        icon: <Database size={18} />,
        children: [
            { label: 'Unit Kerja', href: '/master/unit-kerja', icon: <Users size={16} /> },
            { label: 'Pengguna', href: '/master/pengguna', icon: <Users size={16} /> },
            { label: 'Tahun Anggaran', href: '/master/tahun', icon: <Calendar size={16} /> },
        ],
    },
    {
        label: 'Pengaturan',
        icon: <Settings size={18} />,
        children: [
            { label: 'Pengaturan Aplikasi', href: '/pengaturan/aplikasi', icon: <Settings size={16} /> },
            { label: 'Pengaturan AI', href: '/pengaturan/ai', icon: <Brain size={16} /> },
        ],
    },
    {
        label: 'Buku Pedoman',
        href: '/pedoman',
        icon: <BookOpen size={18} />,
    },
];

export default function Sidebar() {
    const pathname = usePathname();
    const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
        'Manajemen Strategi': true, 'Manajemen Risiko': true,
        'Analisis Risiko': false,
    });
    const [mobileOpen, setMobileOpen] = useState(false);

    const toggle = (label: string) =>
        setOpenMenus(prev => ({ ...prev, [label]: !prev[label] }));

    const isActive = (href?: string) => href && pathname === href;
    const isParentActive = (item: NavItem): boolean => {
        if (item.children) {
            return item.children.some(c => isActive(c.href) || (c.children && isParentActive(c)));
        }
        return false;
    };

    const SidebarContent = () => (
        <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="px-5 py-6 border-b border-slate-700/60">
                <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-lg bg-[#137fec] flex items-center justify-center shadow-lg shadow-blue-500/30">
                        <ShieldAlert size={20} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-white font-bold text-base leading-none">ManRisk RS</h1>
                        <p className="text-slate-500 text-[11px] mt-0.5">Strategi & Risiko</p>
                    </div>
                </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
                {navItems.map((item) => (
                    <div key={item.label}>
                        {item.children ? (
                            <>
                                <button
                                    onClick={() => toggle(item.label)}
                                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                    ${isParentActive(item) ? 'text-[#137fec] bg-[#137fec]/10' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                                >
                                    <span className="flex items-center space-x-3">
                                        {item.icon}
                                        <span>{item.label}</span>
                                    </span>
                                    {openMenus[item.label]
                                        ? <ChevronDown size={14} className="text-slate-500" />
                                        : <ChevronRight size={14} className="text-slate-500" />}
                                </button>
                                {openMenus[item.label] && (
                                    <div className="ml-4 pl-3 border-l border-slate-700/50 mt-0.5 space-y-0.5">
                                        {item.children.map((child) => (
                                            <div key={child.label || child.href}>
                                                {child.children ? (
                                                    <>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggle(child.label);
                                                            }}
                                                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200
                                                            ${isParentActive(child) ? 'text-[#137fec] bg-[#137fec]/10' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                                                        >
                                                            <span className="flex items-center space-x-2.5">
                                                                {child.icon}
                                                                <span>{child.label}</span>
                                                            </span>
                                                            {openMenus[child.label]
                                                                ? <ChevronDown size={14} className="text-slate-500" />
                                                                : <ChevronRight size={14} className="text-slate-500" />}
                                                        </button>
                                                        {openMenus[child.label] && (
                                                            <div className="ml-4 pl-2 border-l border-slate-700/50 mt-0.5 space-y-0.5">
                                                                {child.children.map(subChild => (
                                                                    <Link
                                                                        key={subChild.href}
                                                                        href={subChild.href!}
                                                                        className={`flex items-center space-x-2.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200
                                                                        ${isActive(subChild.href)
                                                                                ? 'text-[#137fec] bg-[#137fec]/10 font-semibold'
                                                                                : 'text-slate-500 hover:text-white hover:bg-slate-800'}`}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setMobileOpen(false);
                                                                        }}
                                                                    >
                                                                        {subChild.icon}
                                                                        <span>{subChild.label}</span>
                                                                    </Link>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </>
                                                ) : (
                                                    <Link
                                                        href={child.href!}
                                                        className={`flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200
                                                        ${isActive(child.href)
                                                                ? 'text-[#137fec] bg-[#137fec]/10 font-semibold'
                                                                : 'text-slate-500 hover:text-white hover:bg-slate-800'}`}
                                                        onClick={() => setMobileOpen(false)}
                                                    >
                                                        {child.icon}
                                                        <span>{child.label}</span>
                                                    </Link>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        ) : (
                            <Link
                                href={item.href!}
                                className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                  ${isActive(item.href)
                                        ? 'text-[#137fec] bg-[#137fec]/10 font-semibold'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                                onClick={() => setMobileOpen(false)}
                            >
                                {item.icon}
                                <span>{item.label}</span>
                            </Link>
                        )}
                    </div>
                ))}
            </nav>

            {/* User Info */}
            <div className="p-4 border-t border-slate-700/60">
                <div className="flex items-center space-x-3 px-2 py-2 rounded-lg hover:bg-slate-800 cursor-pointer transition-colors">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#137fec] to-indigo-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                        A
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-slate-300 text-xs font-semibold truncate">Admin</p>
                        <p className="text-slate-500 text-[10px] truncate">Superadmin</p>
                    </div>
                </div>
                <button
                    onClick={async () => {
                        const { createClient } = await import('@/lib/supabase/client');
                        const supabase = createClient();
                        await supabase.auth.signOut();
                        window.location.href = '/login';
                    }}
                    className="w-full mt-2 flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-all duration-200"
                >
                    <LogOut size={16} />
                    <span>Logout</span>
                </button>
            </div>
        </div>
    );

    return (
        <>
            {/* Mobile hamburger */}
            <button
                className="md:hidden fixed top-4 left-4 z-50 p-2 bg-slate-900 rounded-lg text-white shadow-lg"
                onClick={() => setMobileOpen(!mobileOpen)}
            >
                {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            {/* Mobile overlay */}
            {mobileOpen && (
                <div
                    className="md:hidden fixed inset-0 bg-black/50 z-30"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* Desktop sidebar */}
            <aside className="hidden md:flex w-64 bg-slate-900 flex-col min-h-screen shrink-0">
                <SidebarContent />
            </aside>

            {/* Mobile sidebar */}
            <aside className={`md:hidden fixed top-0 left-0 h-full w-64 bg-slate-900 z-40 transform transition-transform duration-300
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <SidebarContent />
            </aside>
        </>
    );
}
