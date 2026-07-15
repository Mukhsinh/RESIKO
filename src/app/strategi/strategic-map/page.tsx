'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Download, Filter, Activity, Users, TrendingUp, BrainCircuit, Loader2, Building2, RotateCw } from 'lucide-react';
import html2canvas from 'html2canvas';
import { supabase } from '@/lib/supabase';

interface StrategicObjective {
    id: string;
    title: string;
    perspective: string;
    source: 'tows' | 'cascading';
}

const mapPerspective = (p: string | null | undefined): string => {
    if (!p) return 'financial';
    const val = p.toLowerCase().trim();
    if (val.includes('pelanggan') || val === 'customer') return 'customer';
    if (val.includes('proses') || val === 'internal') return 'internal';
    if (val.includes('pembelajaran') || val.includes('pertumbuhan') || val === 'learning') return 'learning';
    return 'financial';
};

const PERSPECTIVE_META = {
    financial: { label: 'Perspektif Keuangan', icon: TrendingUp, gradient: 'from-emerald-500 to-emerald-600', border: 'border-emerald-300', bg: 'bg-emerald-50/50', cardBg: 'bg-gradient-to-br from-emerald-50 to-emerald-100', cardBorder: 'border-emerald-200', cardText: 'text-emerald-800', shadow: 'shadow-emerald-200/40' },
    customer: { label: 'Perspektif Pelanggan', icon: Users, gradient: 'from-blue-500 to-blue-600', border: 'border-blue-300', bg: 'bg-blue-50/50', cardBg: 'bg-gradient-to-br from-blue-50 to-blue-100', cardBorder: 'border-blue-200', cardText: 'text-blue-800', shadow: 'shadow-blue-200/40' },
    internal: { label: 'Perspektif Proses Bisnis Internal', icon: Activity, gradient: 'from-amber-500 to-amber-600', border: 'border-amber-300', bg: 'bg-amber-50/50', cardBg: 'bg-gradient-to-br from-amber-50 to-amber-100', cardBorder: 'border-amber-200', cardText: 'text-amber-800', shadow: 'shadow-amber-200/40' },
    learning: { label: 'Perspektif Pembelajaran & Pertumbuhan', icon: BrainCircuit, gradient: 'from-purple-500 to-purple-600', border: 'border-purple-300', bg: 'bg-purple-50/50', cardBg: 'bg-gradient-to-br from-purple-50 to-purple-100', cardBorder: 'border-purple-200', cardText: 'text-purple-800', shadow: 'shadow-purple-200/40' },
};

export default function StrategicMapPage() {
    const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
    const [selectedUnit, setSelectedUnit] = useState('ALL');
    const [units, setUnits] = useState<{ id: string; nama_unit: string }[]>([]);
    const [availableYears, setAvailableYears] = useState<number[]>([]);
    const chartRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(true);
    const [objectives, setObjectives] = useState<StrategicObjective[]>([]);

    useEffect(() => {
        supabase.from('unit_kerja').select('id, nama_unit').order('nama_unit')
            .then(({ data }: { data: any }) => setUnits(data || []));
        // Fetch dynamic years from IKT
        supabase.from('indikator_kinerja_utama').select('target_tahun').order('target_tahun', { ascending: true })
            .then(({ data: rows }: { data: any }) => {
                if (rows && rows.length > 0) {
                    const yearSet = new Set<number>();
                    rows.forEach((r: any) => { if (r.target_tahun) yearSet.add(r.target_tahun); });
                    const sorted = Array.from(yearSet).sort((a, b) => a - b);
                    if (sorted.length > 0) setAvailableYears(sorted);
                }
            });
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch from TOWS (implementasi = BSC perspektif)
            let towsQ = supabase.from('swot_tows_strategi').select('sasaran_strategi, implementasi')
                .eq('tahun', Number(selectedYear));
            if (selectedUnit !== 'ALL') towsQ = towsQ.eq('unit_kerja_id', selectedUnit);

            // Fetch from Cascading KPI
            let cascQ = supabase.from('cascading_kpi').select('sasaran_strategis, perspektif')
                .eq('tahun', Number(selectedYear));
            if (selectedUnit !== 'ALL') cascQ = cascQ.eq('unit_kerja_id', selectedUnit);

            const [towsRes, cascRes] = await Promise.all([towsQ, cascQ]);
            const uniqueMap = new Map<string, StrategicObjective>();

            if (towsRes.data) {
                towsRes.data.forEach((item: any) => {
                    if (item.sasaran_strategi && item.implementasi) {
                        const perspective = mapPerspective(item.implementasi);
                        const key = `${perspective}-${item.sasaran_strategi}`;
                        if (!uniqueMap.has(key)) {
                            uniqueMap.set(key, { id: `T-${uniqueMap.size + 1}`, title: item.sasaran_strategi, perspective, source: 'tows' });
                        }
                    }
                });
            }

            if (cascRes.data) {
                cascRes.data.forEach((item: any) => {
                    if (item.sasaran_strategis && item.perspektif) {
                        const perspective = mapPerspective(item.perspektif);
                        const key = `${perspective}-${item.sasaran_strategis}`;
                        if (!uniqueMap.has(key)) {
                            uniqueMap.set(key, { id: `C-${uniqueMap.size + 1}`, title: item.sasaran_strategis, perspective, source: 'cascading' });
                        }
                    }
                });
            }

            setObjectives(Array.from(uniqueMap.values()));
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    }, [selectedYear, selectedUnit]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleDownload = async () => {
        if (!chartRef.current) return;
        try {
            const canvas = await html2canvas(chartRef.current, { backgroundColor: '#f8fafc', scale: 2 });
            const image = canvas.toDataURL('image/png', 1.0);
            const link = document.createElement('a');
            link.download = `strategic-map-${selectedUnit === 'ALL' ? 'Semua-Unit' : selectedUnit}-${selectedYear}.png`;
            link.href = image; link.click();
        } catch (err) { console.error('Failed to download chart', err); }
    };

    const CURRENT_YEAR = new Date().getFullYear();
    const yearsToRender = availableYears.length > 0 ? availableYears : [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1, CURRENT_YEAR + 2];

    const renderPerspective = (key: keyof typeof PERSPECTIVE_META) => {
        const meta = PERSPECTIVE_META[key];
        const Icon = meta.icon;
        const items = objectives.filter(obj => obj.perspective === key);

        return (
            <div key={key} className={`relative rounded-2xl overflow-hidden border-2 ${meta.border} ${meta.bg} backdrop-blur-sm min-h-[140px] transition-all duration-300`}>
                {/* Header Bar */}
                <div className={`bg-gradient-to-r ${meta.gradient} px-5 py-2.5 flex items-center gap-2.5 shadow-md`}>
                    <Icon size={18} className="text-white/90" />
                    <span className="text-white font-bold text-sm tracking-wide">{meta.label}</span>
                    <span className="ml-auto bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full">{items.length}</span>
                </div>

                {/* Content */}
                <div className="p-5">
                    {items.length === 0 ? (
                        <div className="text-center py-4 text-sm opacity-40 font-medium italic">Belum ada sasaran strategis di perspektif ini</div>
                    ) : (
                        <div className="flex flex-wrap justify-center gap-4">
                            {items.map((item, idx) => (
                                <div key={idx} className={`group relative px-5 py-4 rounded-xl border-2 ${meta.cardBorder} ${meta.cardBg} ${meta.cardText} shadow-lg ${meta.shadow} font-semibold text-center w-64 min-h-[80px] flex flex-col items-center justify-center cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl`}>
                                    <span className="text-sm leading-relaxed">{item.title}</span>
                                    <span className={`mt-2 text-[9px] font-bold uppercase tracking-wider opacity-50`}>
                                        {item.source === 'tows' ? 'TOWS' : 'Cascading'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-800 mb-1">
                        <span className="bg-gradient-to-r from-[#137fec] to-purple-600 bg-clip-text text-transparent">Strategic Map</span>
                        <span className="text-slate-600"> (Peta Strategi)</span>
                    </h1>
                    <p className="text-slate-500 text-sm">Visualisasi hubungan sebab-akibat antar sasaran strategis berdasarkan input TOWS & Cascading KPI.</p>
                </div>
                <div className="flex space-x-3 mt-4 md:mt-0">
                    <button onClick={handleDownload} className="flex items-center space-x-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors shadow-sm">
                        <Download size={16} /><span className="text-sm font-medium">Unduh Peta</span>
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-wrap gap-4 items-center">
                <div className="flex items-center space-x-2 text-slate-500">
                    <Filter size={18} /><span className="font-medium text-sm">Filter:</span>
                </div>
                <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#137fec] focus:border-transparent text-slate-700 bg-slate-50">
                    {yearsToRender.map(y => (<option key={y} value={y}>Tahun {y}</option>))}
                </select>
                <div className="flex items-center space-x-2 border-l border-slate-200 pl-4">
                    <Building2 size={18} className="text-slate-400" />
                    <select value={selectedUnit} onChange={(e) => setSelectedUnit(e.target.value)} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#137fec] focus:border-transparent text-slate-700 bg-slate-50 min-w-[200px]">
                        <option value="ALL">Semua Unit Kerja (Keseluruhan)</option>
                        {units.map((u) => (<option key={u.id} value={u.id}>{u.nama_unit}</option>))}
                    </select>
                </div>
                <button type="button" onClick={() => fetchData()} className="flex items-center space-x-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-sm text-slate-700 font-medium transition-colors shadow-sm ml-auto" disabled={loading} title="Refresh">
                    <RotateCw size={14} className={loading ? "animate-spin" : ""} /><span>Refresh</span>
                </button>
                {loading && <div className="flex items-center text-sm text-slate-500"><Loader2 size={16} className="text-[#137fec] animate-spin mr-2" /> Memuat Peta...</div>}
            </div>

            {/* Main Map Area */}
            <div className="bg-gradient-to-br from-slate-50 via-white to-slate-100 p-6 md:p-10 rounded-2xl shadow-inner border border-slate-200 relative overflow-hidden" ref={chartRef}>
                {/* Decorative background pattern */}
                <div className="absolute inset-0 pointer-events-none opacity-[0.03]">
                    <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle, #137fec 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
                </div>

                {/* Connection arrows between perspectives (decorative) */}
                <div className="absolute inset-0 pointer-events-none">
                    <svg className="w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto" fill="#137fec">
                                <polygon points="0 0, 10 3.5, 0 7" />
                            </marker>
                        </defs>
                        <line x1="50%" y1="18%" x2="50%" y2="28%" stroke="#137fec" strokeWidth="2" markerEnd="url(#arrowhead)" />
                        <line x1="50%" y1="42%" x2="50%" y2="52%" stroke="#137fec" strokeWidth="2" markerEnd="url(#arrowhead)" />
                        <line x1="50%" y1="66%" x2="50%" y2="76%" stroke="#137fec" strokeWidth="2" markerEnd="url(#arrowhead)" />
                    </svg>
                </div>

                <div className="space-y-6 relative z-10">
                    {renderPerspective('financial')}
                    {renderPerspective('customer')}
                    {renderPerspective('internal')}
                    {renderPerspective('learning')}
                </div>

                {/* Legend */}
                <div className="mt-6 flex items-center justify-center gap-6 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#137fec]" /> Sumber: TOWS</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Sumber: Cascading</span>
                </div>
            </div>
        </div>
    );
}
