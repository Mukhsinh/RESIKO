'use client';
import React, { useState, useRef, useEffect } from 'react';
import { Download, Filter, Activity, Users, TrendingUp, BrainCircuit, Loader2, Building2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import { supabase } from '@/lib/supabase';

interface StrategicObjective {
    id: string;
    title: string;
    perspective: string;
}

export default function StrategicMapPage() {
    const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
    const [selectedUnit, setSelectedUnit] = useState('ALL');
    const [units, setUnits] = useState<{ id: string; nama_unit: string }[]>([]);

    const chartRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(true);
    const [objectives, setObjectives] = useState<StrategicObjective[]>([]);

    useEffect(() => {
        // Fetch Unit Kerja untuk filter dropdown
        supabase.from('unit_kerja')
            .select('id, nama_unit')
            .order('nama_unit')
            .then(({ data }) => setUnits(data || []));
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Ambil data cascading berdasarkan tahun dan filter unit jika tidak ALL
                let query = supabase
                    .from('cascading_kpi')
                    .select('sasaran_strategis, perspektif')
                    .eq('tahun', selectedYear);

                if (selectedUnit !== 'ALL') {
                    query = query.eq('unit_kerja_id', selectedUnit);
                }

                const { data, error } = await query;

                if (error) {
                    console.error('Error fetching cascading kpi:', error);
                    setObjectives([]);
                    return;
                }

                if (data) {
                    // Filter unik berdasarkan judul sasaran dan perspektif
                    const uniqueMap = new Map<string, StrategicObjective>();

                    data.forEach(item => {
                        if (item.sasaran_strategis && item.perspektif) {
                            const key = `${item.perspektif}-${item.sasaran_strategis}`;
                            // Pemetaan nama perspektif indonesia ke inggris untuk css
                            let perspective = 'financial';
                            if (item.perspektif === 'Pelanggan') perspective = 'customer';
                            if (item.perspektif === 'Proses Internal') perspective = 'internal';
                            if (item.perspektif === 'Pembelajaran & Pertumbuhan') perspective = 'learning';

                            if (!uniqueMap.has(key)) {
                                uniqueMap.set(key, {
                                    id: `SS-${uniqueMap.size + 1}`,
                                    title: item.sasaran_strategis,
                                    perspective: perspective
                                });
                            }
                        }
                    });

                    setObjectives(Array.from(uniqueMap.values()));
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [selectedYear, selectedUnit]);

    const handleDownload = async () => {
        if (!chartRef.current) return;
        try {
            const canvas = await html2canvas(chartRef.current, { backgroundColor: '#f8fafc', scale: 2 });
            const image = canvas.toDataURL('image/png', 1.0);
            const link = document.createElement('a');
            link.download = `strategic-map-${selectedUnit === 'ALL' ? 'Semua-Unit' : selectedUnit}-${selectedYear}.png`;
            link.href = image;
            link.click();
        } catch (err) {
            console.error('Failed to download chart', err);
        }
    };

    const renderObjectives = (perspective: string, colorClass: string) => {
        const items = objectives.filter(obj => obj.perspective === perspective);
        if (items.length === 0) {
            return <div className="text-center text-sm opacity-50 py-4 font-medium italic">Belum ada sasaran strategis di perspektif ini</div>;
        }

        return (
            <div className="flex flex-wrap justify-center gap-6 z-10 relative">
                {items.map((item, idx) => (
                    <div
                        key={idx}
                        className={`px-4 py-3 rounded-lg shadow-sm border-2 font-semibold text-center w-64 min-h-[80px] flex items-center justify-center cursor-pointer transition-transform hover:scale-105 hover:shadow-md ${colorClass}`}
                    >
                        <div>
                            {item.title}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 mb-2">Strategic Map (Peta Strategi)</h1>
                    <p className="text-slate-500">Visualisasi hubungan sebab-akibat antar sasaran strategis rumah sakit berdasarkan input Cascading.</p>
                </div>

                <div className="flex space-x-3 mt-4 md:mt-0">
                    <button
                        onClick={handleDownload}
                        className="flex items-center space-x-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
                    >
                        <Download size={16} />
                        <span className="text-sm font-medium">Unduh Peta</span>
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-wrap gap-4 items-center">
                <div className="flex items-center space-x-2 text-slate-500">
                    <Filter size={18} />
                    <span className="font-medium text-sm">Filter:</span>
                </div>

                <div className="flex items-center space-x-2">
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(e.target.value)}
                        className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#137fec] focus:border-transparent text-slate-700 bg-slate-50"
                    >
                        <option value={new Date().getFullYear() - 1}>{new Date().getFullYear() - 1}</option>
                        <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
                        <option value={new Date().getFullYear() + 1}>{new Date().getFullYear() + 1}</option>
                        <option value={new Date().getFullYear() + 2}>{new Date().getFullYear() + 2}</option>
                    </select>
                </div>

                <div className="flex items-center space-x-2 border-l border-slate-200 pl-4">
                    <Building2 size={18} className="text-slate-400" />
                    <select
                        value={selectedUnit}
                        onChange={(e) => setSelectedUnit(e.target.value)}
                        className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#137fec] focus:border-transparent text-slate-700 bg-slate-50 min-w-[200px]"
                    >
                        <option value="ALL">Semua Unit Kerja (Keseluruhan)</option>
                        {units.map((u) => (
                            <option key={u.id} value={u.id}>{u.nama_unit}</option>
                        ))}
                    </select>
                </div>

                {loading && <div className="ml-auto flex items-center text-sm text-slate-500"><Loader2 size={16} className="text-[#137fec] animate-spin mr-2" /> Memuat Peta...</div>}
            </div>

            {/* Main Map Area */}
            <div className="bg-slate-50 p-6 md:p-10 rounded-xl shadow-inner border border-slate-200 relative overflow-hidden" ref={chartRef}>

                {/* Background visual connections lines (Simulated cause and effect) */}
                <div className="absolute inset-0 pointer-events-none opacity-20">
                    {/* Decorative dashed lines that look like a network map */}
                    <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                        <line x1="30%" y1="20%" x2="40%" y2="40%" stroke="currentColor" strokeWidth="2" strokeDasharray="5,5" />
                        <line x1="70%" y1="20%" x2="60%" y2="40%" stroke="currentColor" strokeWidth="2" strokeDasharray="5,5" />
                        <line x1="40%" y1="45%" x2="25%" y2="70%" stroke="currentColor" strokeWidth="2" strokeDasharray="5,5" />
                        <line x1="60%" y1="45%" x2="50%" y2="70%" stroke="currentColor" strokeWidth="2" strokeDasharray="5,5" />
                        <line x1="60%" y1="45%" x2="75%" y2="70%" stroke="currentColor" strokeWidth="2" strokeDasharray="5,5" />
                        <line x1="25%" y1="75%" x2="40%" y2="90%" stroke="currentColor" strokeWidth="2" strokeDasharray="5,5" />
                        <line x1="50%" y1="75%" x2="40%" y2="90%" stroke="currentColor" strokeWidth="2" strokeDasharray="5,5" />
                        <line x1="75%" y1="75%" x2="60%" y2="90%" stroke="currentColor" strokeWidth="2" strokeDasharray="5,5" />
                    </svg>
                </div>

                <div className="space-y-6 relative z-10">

                    {/* Financial Perspective */}
                    <div className="relative border-2 border-emerald-200 bg-white/60 backdrop-blur-sm rounded-xl p-8 pb-12 shadow-[0_4px_20px_-10px_rgba(16,185,129,0.3)] min-h-[160px]">
                        <div className="absolute top-0 left-0 bg-emerald-500 text-white px-4 py-1.5 rounded-br-lg rounded-tl-lg font-bold flex items-center shadow-sm">
                            <TrendingUp size={16} className="mr-2" />
                            Perspektif Keuangan
                        </div>
                        <div className="mt-4">
                            {renderObjectives('financial', 'bg-emerald-100 border-emerald-300 text-emerald-800')}
                        </div>
                    </div>

                    {/* Customer Perspective */}
                    <div className="relative border-2 border-blue-200 bg-white/60 backdrop-blur-sm rounded-xl p-8 pb-12 shadow-[0_4px_20px_-10px_rgba(59,130,246,0.3)] min-h-[160px]">
                        <div className="absolute top-0 left-0 bg-blue-500 text-white px-4 py-1.5 rounded-br-lg rounded-tl-lg font-bold flex items-center shadow-sm">
                            <Users size={16} className="mr-2" />
                            Perspektif Pelanggan
                        </div>
                        <div className="mt-4">
                            {renderObjectives('customer', 'bg-blue-100 border-blue-300 text-blue-800')}
                        </div>
                    </div>

                    {/* Internal Process Perspective */}
                    <div className="relative border-2 border-amber-200 bg-white/60 backdrop-blur-sm rounded-xl p-8 pb-12 shadow-[0_4px_20px_-10px_rgba(245,158,11,0.3)] min-h-[160px]">
                        <div className="absolute top-0 left-0 bg-amber-500 text-white px-4 py-1.5 rounded-br-lg rounded-tl-lg font-bold flex items-center shadow-sm">
                            <Activity size={16} className="mr-2" />
                            Perspektif Proses Bisnis Internal
                        </div>
                        <div className="mt-4">
                            {renderObjectives('internal', 'bg-amber-100 border-amber-300 text-amber-800')}
                        </div>
                    </div>

                    {/* Learning & Growth Perspective */}
                    <div className="relative border-2 border-purple-200 bg-white/60 backdrop-blur-sm rounded-xl p-8 pb-12 shadow-[0_4px_20px_-10px_rgba(168,85,247,0.3)] min-h-[160px]">
                        <div className="absolute top-0 left-0 bg-purple-500 text-white px-4 py-1.5 rounded-br-lg rounded-tl-lg font-bold flex items-center shadow-sm">
                            <BrainCircuit size={16} className="mr-2" />
                            Perspektif Pembelajaran & Pertumbuhan
                        </div>
                        <div className="mt-4">
                            {renderObjectives('learning', 'bg-purple-100 border-purple-300 text-purple-800')}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
