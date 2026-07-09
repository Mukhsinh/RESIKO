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
import { supabase } from '@/lib/supabase';
import { useAppSettings } from '@/hooks/useAppSettings';
import { useUserProfile } from '@/hooks/useUserProfile';

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
    const { settings } = useAppSettings();
    const { profile } = useUserProfile();
    const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
    const [mobileOpen, setMobileOpen] = useState(false);
    const navRef = React.useRef<HTMLDivElement>(null);

    // Persist openMenus to localStorage
    React.useEffect(() => {
        const saved = localStorage.getItem('sidebar_open_menus');
        if (saved) {
            try {
                setOpenMenus(JSON.parse(saved));
            } catch (e) {
                console.error('Failed to parse saved sidebar state', e);
            }
        }
    }, []);

    React.useEffect(() => {
        if (Object.keys(openMenus).length > 0) {
            localStorage.setItem('sidebar_open_menus', JSON.stringify(openMenus));
        }
    }, [openMenus]);

    // Restore scroll position
    React.useEffect(() => {
        const savedScrollPos = localStorage.getItem('sidebar_scroll_position');
        if (savedScrollPos && navRef.current) {
            const timer = setTimeout(() => {
                if (navRef.current) {
                    navRef.current.scrollTop = parseInt(savedScrollPos, 10);
                }
            }, 50);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleScroll = (e: React.UIEvent<HTMLElement>) => {
        localStorage.setItem('sidebar_scroll_position', String(e.currentTarget.scrollTop));
    };

    const toggle = (label: string) =>
        setOpenMenus(prev => ({ ...prev, [label]: !prev[label] }));

    const isDirectlyActive = (href?: string) => href && pathname === href;
    const isAnyChildActive = (item: NavItem): boolean => {
        if (!item.children) return false;
        return item.children.some(c => isDirectlyActive(c.href) || (c.children && isAnyChildActive(c)));
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.href = '/login';
    };

    const filteredNavItems = navItems.filter(item => {
        if (profile?.role === 'user_unit') {
            return !['Master Data', 'Pengaturan', 'Buku Pedoman'].includes(item.label);
        }
        return true;
    });

    const sidebarContent = (
        <div className="flex flex-col h-full z-10 relative">
            <div className="pt-3 px-3 pb-2">
                <div className="bg-[#137fec] rounded-2xl p-3.5 shadow-lg shadow-blue-500/20 relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 w-16 h-16 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
                    <div className="flex items-center space-x-3.5 relative z-10">
                        <div className="w-14 h-14 rounded-xl flex items-center justify-center p-1 shrink-0 overflow-hidden bg-white/10 backdrop-blur-md border border-white/20">
                            {settings?.logo_url ? (
                                <img src={settings.logo_url} alt="Logo" className="max-w-full max-h-full object-contain filter drop-shadow-md" />
                            ) : (
                                <ShieldAlert size={28} className="text-white/80" />
                            )}
                        </div>
                        <div className="overflow-hidden flex flex-col justify-center">
                            <h1 className="text-white font-black text-lg truncate leading-none tracking-wide mb-1">
                                {settings?.nama_aplikasi}
                            </h1>
                            <p className="text-blue-100 text-[10px] font-bold truncate uppercase tracking-tight opacity-90">
                                {settings?.nama_rs}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Nav */}
            <nav
                ref={navRef}
                onScroll={handleScroll}
                className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto"
            >
                {filteredNavItems.map((item) => (
                    <div key={item.label}>
                        {item.children ? (
                            <>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        toggle(item.label);
                                    }}
                                    className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-150
                    ${isDirectlyActive(item.href)
                                            ? 'text-white bg-[#137fec] shadow-lg shadow-blue-500/30'
                                            : isAnyChildActive(item)
                                                ? 'text-[#137fec] bg-blue-50 font-bold border border-blue-100/50'
                                                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
                                >
                                    <span className="flex items-center space-x-3">
                                        <div className={`p-1.5 rounded-lg transition-colors ${isDirectlyActive(item.href) ? 'bg-white/20 text-white' : isAnyChildActive(item) ? 'bg-[#137fec]/10 text-[#137fec]' : 'bg-slate-100 text-slate-500'}`}>
                                            {item.icon}
                                        </div>
                                        <span>{item.label}</span>
                                    </span>
                                    {openMenus[item.label]
                                        ? <ChevronDown size={14} className={isDirectlyActive(item.href) ? 'text-white' : isAnyChildActive(item) ? 'text-[#137fec]' : 'text-slate-400'} />
                                        : <ChevronRight size={14} className={isDirectlyActive(item.href) ? 'text-white' : isAnyChildActive(item) ? 'text-[#137fec]' : 'text-slate-400'} />}
                                </button>
                                {openMenus[item.label] && (
                                    <div className="ml-7 pl-4 border-l-2 border-slate-100/80 mt-1 space-y-1">
                                        {item.children.map((child) => (
                                            <div key={child.label || child.href}>
                                                {child.children ? (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                toggle(child.label);
                                                            }}
                                                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[12px] font-medium transition-all duration-150
                                                            ${isDirectlyActive(child.href)
                                                                    ? 'text-white bg-[#137fec] shadow-sm'
                                                                    : isAnyChildActive(child)
                                                                        ? 'text-[#137fec] bg-blue-50/50 font-bold'
                                                                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
                                                        >
                                                            <span className="flex items-center space-x-2.5">
                                                                <div className={`shrink-0 ${isDirectlyActive(child.href) ? 'text-white' : isAnyChildActive(child) ? 'text-[#137fec]' : 'text-slate-400'}`}>
                                                                    {child.icon}
                                                                </div>
                                                                <span>{child.label}</span>
                                                            </span>
                                                            {openMenus[child.label]
                                                                ? <ChevronDown size={14} className={isAnyChildActive(child) ? 'text-[#137fec]' : 'text-slate-400'} />
                                                                : <ChevronRight size={14} className={isAnyChildActive(child) ? 'text-[#137fec]' : 'text-slate-400'} />}
                                                        </button>
                                                        {openMenus[child.label] && (
                                                            <div className="ml-4 pl-3 border-l border-slate-100 mt-0.5 space-y-0.5">
                                                                {child.children.map(subChild => (
                                                                    <Link
                                                                        key={subChild.href}
                                                                        href={subChild.href!}
                                                                        className={`flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-[11px] font-bold transition-all duration-150
                                                                        ${isDirectlyActive(subChild.href)
                                                                                ? 'text-white bg-[#137fec] shadow-lg shadow-blue-500/20'
                                                                                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setMobileOpen(false);
                                                                        }}
                                                                    >
                                                                        <div className={`p-1.5 rounded-lg transition-colors ${isDirectlyActive(subChild.href) ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'}`}>
                                                                            {subChild.icon}
                                                                        </div>
                                                                        <span>{subChild.label}</span>
                                                                    </Link>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </>
                                                ) : (
                                                    <Link
                                                        href={child.href!}
                                                        className={`flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-[12px] font-semibold transition-all duration-150
                                                        ${isDirectlyActive(child.href)
                                                                ? 'text-white bg-[#137fec] shadow-lg shadow-blue-500/20'
                                                                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
                                                        onClick={() => setMobileOpen(false)}
                                                    >
                                                        <div className={`p-1.5 rounded-lg transition-colors ${isDirectlyActive(child.href) ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'}`}>
                                                            {child.icon}
                                                        </div>
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
                                className={`flex items-center space-x-3 px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-150
                  ${isDirectlyActive(item.href)
                                        ? 'text-white bg-[#137fec] shadow-lg shadow-blue-500/30'
                                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 group'}`}
                                onClick={() => setMobileOpen(false)}
                            >
                                <div className={`p-1.5 rounded-lg transition-colors ${isDirectlyActive(item.href) ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'}`}>
                                    {item.icon}
                                </div>
                                <span>{item.label}</span>
                            </Link>
                        )}
                    </div>
                ))}
            </nav>

            {/* User Info */}
            <div className="p-4 border-t border-slate-100">
                {profile && (
                    <div className="flex items-center space-x-3 px-2 py-2 rounded-xl hover:bg-slate-50 cursor-pointer transition-all border border-transparent hover:border-slate-100 group">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#137fec] to-blue-400 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm transition-transform group-hover:scale-110">
                            {profile.full_name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-slate-800 text-xs font-bold truncate capitalize group-hover:text-[#137fec] transition-colors">{profile.full_name}</p>
                            <p className="text-slate-400 text-[10px] font-medium truncate capitalize">{profile.role}</p>
                        </div>
                    </div>
                )}
                <button
                    onClick={handleLogout}
                    className="w-full mt-3 flex items-center justify-center space-x-2 px-3 py-2.5 rounded-xl text-[11px] font-bold text-slate-500 bg-slate-50 hover:text-rose-600 hover:bg-rose-50 transition-all border border-slate-100"
                >
                    <LogOut size={15} />
                    <span>KELUAR SISTEM</span>
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
            <aside className="hidden md:flex w-64 bg-white border-r border-slate-100 flex-col h-screen sticky top-0 shrink-0 shadow-sm">
                {sidebarContent}
            </aside>

            {/* Mobile sidebar */}
            <aside className={`md:hidden fixed top-0 left-0 h-full w-64 bg-white border-r border-slate-100 z-40 transform transition-transform duration-300
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full shadow-2xl'}`}>
                {sidebarContent}
            </aside>
        </>
    );
}
