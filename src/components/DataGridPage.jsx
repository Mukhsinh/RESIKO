import React, { useState } from 'react';
import {
    Plus, Download, Upload, FileText,
    Search, Filter, Eye, Edit, Trash2,
    TrendingUp, AlertOctagon, CheckCircle2,
    ChevronDown
} from 'lucide-react';

export default function StandardDataGridPage() {
    const [search, setSearch] = useState('');

    return (
        <div className="flex-1 bg-slate-50 min-h-screen p-8 text-slate-800">
            {/* Header & Breadcrumbs */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Manajemen Risiko</h1>
                <p className="text-sm text-slate-500 mt-1">Identifikasi dan monitoring profil risiko tahun berjalan.</p>
            </div>

            {/* Kartu Skor / Scorecards (Elegan, Professional) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <ScoreCard
                    icon={<AlertOctagon size={24} className="text-rose-500" />}
                    title="Risiko Sangat Tinggi"
                    value="12"
                    trend="+2 dari bulan lalu"
                    colorClass="bg-rose-50 border-rose-100"
                />
                <ScoreCard
                    icon={<TrendingUp size={24} className="text-amber-500" />}
                    title="Risiko Menengah"
                    value="45"
                    trend="-5 dari bulan lalu"
                    colorClass="bg-amber-50 border-amber-100"
                />
                <ScoreCard
                    icon={<CheckCircle2 size={24} className="text-emerald-500" />}
                    title="Risiko Termitigasi"
                    value="89%"
                    trend="Target IKU 90%"
                    colorClass="bg-emerald-50 border-emerald-100"
                />
            </div>

            {/* Main Container */}
            <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100 overflow-hidden">

                {/* Top Action & Filter Bar */}
                <div className="p-6 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-4">

                    {/* Filters & Search */}
                    <div className="flex items-center space-x-3">
                        {/* Search */}
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                                <Search size={16} className="text-slate-400" />
                            </span>
                            <input
                                type="text"
                                placeholder="Cari risiko..."
                                className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0891B2]/50 focus:border-transparent w-64 transition-all"
                            />
                        </div>

                        {/* Filter Dropdown (Tahun) */}
                        <button className="flex items-center space-x-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50 transition-colors">
                            <Filter size={16} />
                            <span>Tahun 2026</span>
                            <ChevronDown size={14} className="text-slate-400" />
                        </button>
                    </div>

                    {/* Core Action Buttons (Cerha, Solid, Menarik) */}
                    <div className="flex items-center space-x-2">
                        <ActionButton
                            icon={<Download size={16} />}
                            label="Unduh Template"
                            color="bg-slate-100 text-slate-700 hover:bg-slate-200"
                        />
                        <ActionButton
                            icon={<Upload size={16} />}
                            label="Import Data"
                            color="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-100"
                        />
                        <ActionButton
                            icon={<FileText size={16} />}
                            label="Unduh Laporan"
                            color="bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-100"
                        />
                        {/* Primary Action Button */}
                        <button className="flex items-center space-x-2 px-4 py-2 bg-[#0891B2] hover:bg-cyan-700 text-white rounded-lg text-sm font-medium transition-all shadow-md shadow-cyan-500/20">
                            <Plus size={16} />
                            <span>Tambah Data</span>
                        </button>
                    </div>
                </div>

                {/* Tabel Data (DataGrid) */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-xs text-slate-500 uppercase tracking-wider">
                                <th className="px-6 py-4 font-medium">Tahun</th>
                                <th className="px-6 py-4 font-medium">No. Urut</th>
                                <th className="px-6 py-4 font-medium w-1/3">Identifikasi Risiko</th>
                                <th className="px-6 py-4 font-medium text-center">Score</th>
                                <th className="px-6 py-4 font-medium text-center">Status</th>
                                <th className="px-6 py-4 font-medium text-center w-32">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {/* Row 1 */}
                            <tr className="hover:bg-slate-50/50 transition-colors group">
                                <td className="px-6 py-4 text-sm text-slate-600">2026</td>
                                <td className="px-6 py-4 text-sm font-medium text-slate-800">RI-001</td>
                                <td className="px-6 py-4 text-sm text-slate-600">
                                    <span className="line-clamp-2">Kegagalan sinkronisasi data rekam medis dengan sistem rujukan eksternal.</span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-rose-100 text-rose-700 font-bold text-xs ring-2 ring-rose-50">
                                        25
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                                        Monitoring
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-center border-l border-slate-50/0 group-hover:border-slate-200 transition-colors">
                                    <div className="flex items-center justify-center space-x-1 opacity-100">
                                        <RowActionButton icon={<Eye size={15} />} color="text-sky-600 bg-sky-50 hover:bg-sky-500 hover:text-white" title="View" />
                                        <RowActionButton icon={<Edit size={15} />} color="text-amber-600 bg-amber-50 hover:bg-amber-500 hover:text-white" title="Edit" />
                                        <RowActionButton icon={<Trash2 size={15} />} color="text-rose-600 bg-rose-50 hover:bg-rose-500 hover:text-white" title="Hapus" />
                                    </div>
                                </td>
                            </tr>
                            {/* Row 2 */}
                            <tr className="hover:bg-slate-50/50 transition-colors group">
                                <td className="px-6 py-4 text-sm text-slate-600">2026</td>
                                <td className="px-6 py-4 text-sm font-medium text-slate-800">RI-002</td>
                                <td className="px-6 py-4 text-sm text-slate-600">
                                    <span className="line-clamp-2">Keterlambatan kalibrasi berkala pada alat life support di ICU.</span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 text-amber-700 font-bold text-xs ring-2 ring-amber-50">
                                        12
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                                        Mitigasi Selesai
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-center border-l border-slate-50/0 group-hover:border-slate-200 transition-colors">
                                    <div className="flex items-center justify-center space-x-1 opacity-100">
                                        <RowActionButton icon={<Eye size={15} />} color="text-sky-600 bg-sky-50 hover:bg-sky-500 hover:text-white" title="View" />
                                        <RowActionButton icon={<Edit size={15} />} color="text-amber-600 bg-amber-50 hover:bg-amber-500 hover:text-white" title="Edit" />
                                        <RowActionButton icon={<Trash2 size={15} />} color="text-rose-600 bg-rose-50 hover:bg-rose-500 hover:text-white" title="Hapus" />
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Pagination Skeleton */}
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-sm text-slate-500">
                    <span>Menampilkan 1 hingga 2 dari total 45 data</span>
                    <div className="flex space-x-2">
                        <button className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 text-slate-400 cursor-not-allowed">Halaman Sebelumnya</button>
                        <button className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 text-slate-700">Halaman Selanjutnya</button>
                    </div>
                </div>

            </div>
        </div>
    );
}

// Komponen Reusable untuk Kartu Skor
function ScoreCard({ icon, title, value, trend, colorClass }) {
    return (
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_4px_15px_rgb(0,0,0,0.02)] flex items-center space-x-4 transition-transform hover:-translate-y-1 hover:shadow-lg duration-300">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center border ${colorClass}`}>
                {icon}
            </div>
            <div>
                <p className="text-sm font-semibold text-slate-500">{title}</p>
                <h3 className="text-2xl font-bold text-slate-800 my-0.5">{value}</h3>
                <p className="text-xs text-slate-400 font-medium">{trend}</p>
            </div>
        </div>
    );
}

// Komponen Reusable untuk Action Button Top (Download, Upload, etc)
function ActionButton({ icon, label, color }) {
    return (
        <button className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${color}`}>
            {icon}
            <span className="hidden sm:inline-block">{label}</span>
        </button>
    );
}

// Komponen Reusable untuk Baris Aksi Tabel (View, Edit, Trash)
function RowActionButton({ icon, color, title }) {
    return (
        <button
            title={title}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all shadow-sm ${color}`}
        >
            {icon}
        </button>
    );
}
