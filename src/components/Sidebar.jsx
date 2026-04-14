import React, { useState } from 'react';
import {
    Target, AlertTriangle, FileText, Database, Settings, Book,
    ChevronDown, ChevronRight, Activity, PieChart, ShieldAlert,
    BarChart2, Map, Crosshair, ClipboardList, CheckCircle, Lightbulb, User
} from 'lucide-react';

export default function Sidebar({ activeModule }) {
    // State untuk mengontrol dropdown
    const [openMenus, setOpenMenus] = useState({
        'identifikasi-risiko': true,
        'analisis-risiko': false,
    });

    const toggleMenu = (menuKey) => {
        setOpenMenus(prev => ({
            ...prev,
            [menuKey]: !prev[menuKey]
        }));
    };

    return (
        <aside className="w-72 bg-[#0F172A] text-slate-300 min-h-screen flex flex-col transition-all duration-300 shadow-2xl z-50">
            {/* Header Sidebar */}
            <div className="h-20 flex items-center px-6 bg-[#0B1221] border-b border-slate-800">
                <div className="w-10 h-10 bg-gradient-to-tr from-[#0891B2] to-sky-400 rounded-lg flex items-center justify-center mr-4 shadow-lg shadow-sky-500/20">
                    <span className="text-white font-bold text-lg">RS</span>
                </div>
                <div>
                    <h1 className="text-white font-bold tracking-wide">SIM Manajemen</h1>
                    <p className="text-xs text-slate-400">Strategi & Risiko Terpadu</p>
                </div>
            </div>

            {/* User Info (Singkat) */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center space-x-3">
                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                    <User size={16} className="text-slate-300" />
                </div>
                <div>
                    <p className="text-sm font-semibold text-white">Admin Unit ICU</p>
                    <span className="text-[10px] uppercase tracking-wider text-teal-400 bg-teal-400/10 px-2 py-0.5 rounded-full">User Unit</span>
                </div>
            </div>

            {/* Navigasi Utama */}
            <div className="flex-1 overflow-y-auto py-4 custom-scrollbar">
                <nav className="space-y-1 px-3">

                    {/* BAGIAN: MANAJEMEN STRATEGI */}
                    <div className="mb-6">
                        <h3 className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Modul Strategis</h3>

                        <NavItem icon={<Target size={18} />} label="Visi dan Misi" />
                        <NavItem icon={<BarChart2 size={18} />} label="Rencana Strategis" />
                        <NavItem icon={<PieChart size={18} />} label="Analisis SWOT" />
                        <NavItem icon={<Crosshair size={18} />} label="Diagram Kartesius" />
                        <NavItem icon={<Database size={18} />} label="Matriks TOWS" />
                        <NavItem icon={<Target size={18} />} label="Sasaran Strategis" />
                        <NavItem icon={<Map size={18} />} label="Strategic Map" />
                        <NavItem icon={<Activity size={18} />} label="Indikator Kinerja Utama" />
                        <NavItem icon={<CheckCircle size={18} />} label="Evaluasi IKU" />
                    </div>

                    {/* BAGIAN: MANAJEMEN RISIKO */}
                    <div className="mb-6">
                        <h3 className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Modul Risiko</h3>

                        {/* Dropdown: Identifikasi Risiko */}
                        <div className="mb-1">
                            <button
                                onClick={() => toggleMenu('identifikasi-risiko')}
                                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-800 hover:text-white transition-colors"
                                style={{ backgroundColor: openMenus['identifikasi-risiko'] ? 'rgba(15, 23, 42, 0.5)' : 'transparent' }}
                            >
                                <div className="flex items-center space-x-3">
                                    <ShieldAlert size={18} className={openMenus['identifikasi-risiko'] ? "text-[#0891B2]" : "text-slate-400"} />
                                    <span className={openMenus['identifikasi-risiko'] ? "text-white" : ""}>Identifikasi Risiko</span>
                                </div>
                                {openMenus['identifikasi-risiko'] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </button>

                            {/* Sub-menu Identifikasi Risiko */}
                            {openMenus['identifikasi-risiko'] && (
                                <div className="pl-11 pr-2 py-2 space-y-1 border-l mx-5 border-slate-700/50 mt-1">
                                    <SubNavItem label="Input Data Risiko" icon={<ClipboardList size={14} />} />
                                    <SubNavItem label="Monitoring & Evaluasi" icon={<CheckCircle size={14} />} />
                                    <SubNavItem label="Peluang" icon={<Lightbulb size={14} />} />
                                </div>
                            )}
                        </div>

                        {/* Dropdown: Analisis Risiko */}
                        <div className="mb-1">
                            <button
                                onClick={() => toggleMenu('analisis-risiko')}
                                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-800 hover:text-white transition-colors"
                            >
                                <div className="flex items-center space-x-3">
                                    <AlertTriangle size={18} className={openMenus['analisis-risiko'] ? "text-rose-500" : "text-slate-400"} />
                                    <span className={openMenus['analisis-risiko'] ? "text-white" : ""}>Analisis Risiko</span>
                                </div>
                                {openMenus['analisis-risiko'] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </button>

                            {/* Sub-menu Analisis Risiko */}
                            {openMenus['analisis-risiko'] && (
                                <div className="pl-11 pr-2 py-2 space-y-1 border-l mx-5 border-slate-700/50 mt-1">
                                    <SubNavItem label="Risk Profile" icon={<FileText size={14} />} />
                                    <SubNavItem label="Residual Risk" icon={<PieChart size={14} />} />
                                    <SubNavItem label="Key Risk Indicator" icon={<Activity size={14} />} />
                                    <SubNavItem label="Loss Event" icon={<AlertTriangle size={14} />} />
                                    <SubNavItem label="Early Warning System" icon={<AlertTriangle size={14} />} />
                                    <SubNavItem label="Risk Register" icon={<ClipboardList size={14} />} />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* BAGIAN: SISTEM & PENGATURAN */}
                    <div className="mb-6">
                        <h3 className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Sistem</h3>
                        <NavItem icon={<FileText size={18} />} label="Laporan" />
                        <NavItem icon={<Database size={18} />} label="Master Data" />
                        <NavItem icon={<Settings size={18} />} label="Pengaturan Aplikasi" />
                        <NavItem icon={<Book size={18} />} label="Buku Pedoman" />
                    </div>

                </nav>
            </div>

            {/* Styling untuk navigasi state aktif, etc. dipisahkan untuk kemudahan (Bisa pakai Next Router) */}
            <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #334155;
          border-radius: 20px;
        }
      `}</style>
        </aside>
    );
}

// Reusable Component for Nav Item
function NavItem({ icon, label, active = false }) {
    return (
        <a
            href="#"
            className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${active
                    ? 'bg-[#0891B2] text-white shadow-md shadow-cyan-500/20'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
        >
            <span className={active ? 'text-white' : 'text-slate-400'}>{icon}</span>
            <span>{label}</span>
            {active && <div className="ml-auto w-1.5 h-1.5 bg-white rounded-full"></div>}
        </a>
    );
}

// Reusable Component for Sub Nav Item
function SubNavItem({ label, icon, active = false }) {
    return (
        <a
            href="#"
            className={`flex items-center space-x-3 px-3 py-2 rounded-md text-xs font-medium transition-all duration-200 ${active
                    ? 'bg-slate-800 text-teal-400'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
        >
            <span className="opacity-70">{icon}</span>
            <span>{label}</span>
        </a>
    );
}
