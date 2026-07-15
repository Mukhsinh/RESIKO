'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader, ScoreCard, FilterBar, TopActionBar } from '@/components/SharedUI';
import DataTable, { type Column } from '@/components/DataTable';
import FormInputAI from '@/components/FormInputAI';
import { Download, Upload, FileText, Target, Activity, AlertCircle, CheckCircle2, Save, X, Loader2, BarChart2, Plus, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useUserProfile } from '@/hooks/useUserProfile';

const CURRENT_YEAR = new Date().getFullYear();

const MONTHS = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const PERIODE_OPTIONS = [
    { value: 'tahunan', label: 'Tahunan', details: ['Tahunan'] },
    { value: 'semesteran', label: 'Semesteran', details: ['Semester I', 'Semester II'] },
    { value: 'triwulanan', label: 'Triwulanan', details: ['Triwulan I', 'Triwulan II', 'Triwulan III', 'Triwulan IV'] },
    { value: 'bulanan', label: 'Bulanan', details: MONTHS },
];

interface IKTEvaluasi {
    id: string;
    rencana_strategis_id?: string;
    sasaran_strategi_id?: string;
    indikator: string;
    baseline_tahun?: number;
    baseline_nilai?: number | null;
    target_tahun?: number;
    target_nilai?: number | null;
    satuan?: string;
    initiatif_strategi?: string;
    pic?: string;
    realisasi_nilai?: number | null;
    kendala?: string | null;
    tindak_lanjut?: string | null;
    unit_kerja_id?: string;
    unit_kerja?: { nama_unit: string };
    sasaran_strategi?: { sasaran: string };
}

// Form untuk Edit Realisasi (existing record)
interface EditForm {
    realisasi_nilai: string;
    kendala: string;
    tindak_lanjut: string;
    periode_tipe: string;
    periode_detail: string;
    monthly_values: string[];
}

const defaultEditForm: EditForm = {
    realisasi_nilai: '',
    kendala: '',
    tindak_lanjut: '',
    periode_tipe: 'tahunan',
    periode_detail: 'Tahunan',
    monthly_values: Array(12).fill(''),
};

// Form untuk Tambah Evaluasi
interface EvalForm {
    unit_kerja_id: string;
    selectedIKTId: string;
    realisasi_nilai: string;
    kendala: string;
    tindak_lanjut: string;
    periode_tipe: string;
    periode_detail: string;
    monthly_values: string[];
}

const defaultEvalForm: EvalForm = {
    unit_kerja_id: '',
    selectedIKTId: '',
    realisasi_nilai: '',
    kendala: '',
    tindak_lanjut: '',
    periode_tipe: 'tahunan',
    periode_detail: 'Tahunan',
    monthly_values: Array(12).fill(''),
};

// Helper to calculate target achievement percentage
const calculateCapaian = (realisasi?: number | null, target?: number | null) => {
    if (realisasi == null || target == null || target === 0) return 0;
    return (realisasi / target) * 100;
};

// Helper: encode/decode period info into kendala field
const encodePeriode = (tipe: string, detail: string, monthly: string[], kendala: string) => {
    const monthlyStr = monthly.map(m => m.trim() === '' ? '' : m.trim()).join(',');
    const prefix = `[PeriodType: ${tipe}][PeriodDetail: ${detail}][Monthly: ${monthlyStr}]`;
    return kendala ? `${prefix} ${kendala}` : prefix;
};

const decodePeriode = (kendala: string | null | undefined) => {
    if (!kendala) return { tipe: 'tahunan', detail: 'Tahunan', monthly: Array(12).fill(''), text: '' };

    // Check if it matches our new format
    const match = kendala.match(/^\[PeriodType:\s*(.*?)\]\[PeriodDetail:\s*(.*?)\]\[Monthly:\s*(.*?)\]\s*([\s\S]*)$/);
    if (match) {
        const tipe = match[1].toLowerCase();
        const detail = match[2];
        const monthly = match[3].split(',');
        const text = match[4];
        // Ensure we always have exactly 12 items
        const paddedMonthly = Array(12).fill('').map((_, i) => monthly[i] || '');
        return { tipe, detail, monthly: paddedMonthly, text };
    }

    // Legacy fallback
    const legacyMatch = kendala.match(/^\[Periode:\s*(.*?)\s*-\s*(.*?)\]\s*([\s\S]*)$/);
    if (legacyMatch) {
        return { tipe: legacyMatch[1].toLowerCase(), detail: legacyMatch[2], monthly: Array(12).fill(''), text: legacyMatch[3] };
    }

    return { tipe: 'tahunan', detail: 'Tahunan', monthly: Array(12).fill(''), text: kendala };
};

const calculateAverage = (monthly: string[]) => {
    const numbers = monthly
        .map(m => parseFloat(m))
        .filter(n => !isNaN(n));
    if (numbers.length === 0) return 0;
    const sum = numbers.reduce((a, b) => a + b, 0);
    return sum / numbers.length;
};

const PIE_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#6366f1'];

export default function EvaluasiIKTPage() {
    const { profile } = useUserProfile();
    const [data, setData] = useState<IKTEvaluasi[]>([]);
    const [iktForUnit, setIktForUnit] = useState<IKTEvaluasi[]>([]);
    const [units, setUnits] = useState<{ id: string; nama_unit: string }[]>([]);
    const [filterUnit, setFilterUnit] = useState<string>('all');
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [year, setYear] = useState(String(CURRENT_YEAR));

    // Modal edit realisasi
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<IKTEvaluasi | null>(null);
    const [editForm, setEditForm] = useState<EditForm>(defaultEditForm);

    // Modal tambah evaluasi
    const [showAddModal, setShowAddModal] = useState(false);
    const [evalForm, setEvalForm] = useState<EvalForm>(defaultEvalForm);

    const [saving, setSaving] = useState(false);
    const [hasUnitKerjaId, setHasUnitKerjaId] = useState<boolean | null>(null);

    // Sync unit filter for managers
    useEffect(() => {
        if (profile?.role === 'user_unit' && profile.unit_kerja_id) {
            setFilterUnit(profile.unit_kerja_id);
        }
    }, [profile]);

    // Probe if unit_kerja_id exists in indikator_kinerja_utama
    useEffect(() => {
        supabase.from('indikator_kinerja_utama').select('unit_kerja_id').limit(1)
            .then(({ error }: { error: any }) => {
                const exists = !error || (error.code !== '42703' && error.code !== 'PGRST100' && error.code !== '42883');
                setHasUnitKerjaId(exists);
            });
    }, []);

    // Fetch units list
    useEffect(() => {
        supabase.from('unit_kerja').select('id, nama_unit').order('nama_unit').then(({ data: u }: { data: any }) => {
            if (u) setUnits(u);
        });
    }, []);

    const fetchData = useCallback(async () => {
        if (hasUnitKerjaId === null) return;
        setLoading(true);
        try {
            const selectFields = hasUnitKerjaId
                ? '*, unit_kerja(nama_unit), sasaran_strategi(sasaran)'
                : '*, sasaran_strategi(sasaran)';
            let query = supabase.from('indikator_kinerja_utama').select(selectFields).order('created_at', { ascending: false });
            if (year) query = query.eq('target_tahun', Number(year));

            if (hasUnitKerjaId) {
                const unitToFilter = profile?.role === 'user_unit' ? profile.unit_kerja_id : (filterUnit === 'all' ? null : filterUnit);
                if (unitToFilter) {
                    query = query.eq('unit_kerja_id', unitToFilter);
                }
            }
            const { data: rows, error } = await query;
            if (error) {
                console.error('Error fetching evaluasi IKT:', error);
                setData([]);
            } else {
                setData((rows as IKTEvaluasi[]) ?? []);
            }
        } catch (err) {
            console.error('Error:', err);
            setData([]);
        } finally {
            setLoading(false);
        }
    }, [year, filterUnit, profile, hasUnitKerjaId]);

    useEffect(() => {
        if (hasUnitKerjaId !== null) fetchData();
    }, [fetchData, hasUnitKerjaId]);

    // Fetch IKT for selected unit in Add modal
    const fetchIktForUnit = useCallback(async (unitId: string) => {
        if (!unitId) { setIktForUnit([]); return; }
        try {
            let query = supabase
                .from('indikator_kinerja_utama')
                .select('id, indikator, target_tahun, target_nilai, satuan, pic, unit_kerja_id, baseline_tahun, baseline_nilai, realisasi_nilai, kendala, tindak_lanjut')
                .eq('unit_kerja_id', unitId)
                .order('target_tahun', { ascending: false });
            if (year) query = query.eq('target_tahun', Number(year));
            const { data: rows } = await query;
            setIktForUnit((rows as IKTEvaluasi[]) ?? []);
        } catch (err) {
            console.error('Error fetching IKT for unit:', err);
            setIktForUnit([]);
        }
    }, [year]);

    // When unit changes in Add modal
    useEffect(() => {
        if (evalForm.unit_kerja_id) {
            fetchIktForUnit(evalForm.unit_kerja_id);
        } else {
            setIktForUnit([]);
        }
    }, [evalForm.unit_kerja_id, fetchIktForUnit]);

    const filtered = data.filter(d =>
        (d.indikator || '').toLowerCase().includes(search.toLowerCase()) ||
        (d.satuan || '').toLowerCase().includes(search.toLowerCase()) ||
        (d.pic || '').toLowerCase().includes(search.toLowerCase())
    );

    const selectedIKTData = iktForUnit.find(d => d.id === evalForm.selectedIKTId);

    const openEditModal = (row: IKTEvaluasi) => {
        setSelectedItem(row);
        const seq = decodePeriode(row.kendala);
        setEditForm({
            realisasi_nilai: row.realisasi_nilai != null ? String(row.realisasi_nilai) : '',
            kendala: seq.text,
            tindak_lanjut: row.tindak_lanjut || '',
            periode_tipe: seq.tipe,
            periode_detail: seq.detail,
            monthly_values: seq.monthly,
        });
        setShowEditModal(true);
    };

    const openAddModal = () => {
        const newForm = { ...defaultEvalForm, monthly_values: Array(12).fill('') };
        if (profile?.role === 'user_unit' && profile.unit_kerja_id) {
            newForm.unit_kerja_id = profile.unit_kerja_id;
        }
        setEvalForm(newForm);
        setShowAddModal(true);
    };

    // When selecting target IKT in Add modal, prepopulate monthly logic if exists
    const handleIKTSelect = (iktId: string) => {
        if (!iktId) {
            setEvalForm(f => ({ ...f, selectedIKTId: '', realisasi_nilai: '', kendala: '', tindak_lanjut: '', monthly_values: Array(12).fill('') }));
            return;
        }
        const selected = iktForUnit.find(d => d.id === iktId);
        if (selected) {
            const seq = decodePeriode(selected.kendala);
            setEvalForm(f => ({
                ...f,
                selectedIKTId: iktId,
                realisasi_nilai: selected.realisasi_nilai != null ? String(selected.realisasi_nilai) : '',
                kendala: seq.text,
                tindak_lanjut: selected.tindak_lanjut || '',
                periode_tipe: seq.tipe || 'tahunan',
                periode_detail: seq.detail || 'Tahunan',
                monthly_values: seq.monthly,
            }));
        }
    };

    // Simpan realisasi (edit existing)
    const handleEditSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = {
                realisasi_nilai: editForm.realisasi_nilai ? Number(editForm.realisasi_nilai) : null,
                kendala: encodePeriode(editForm.periode_tipe, editForm.periode_detail, editForm.monthly_values, editForm.kendala),
                tindak_lanjut: editForm.tindak_lanjut || null,
            };
            if (selectedItem) {
                const result = await supabase.from('indikator_kinerja_utama').update(payload).eq('id', selectedItem.id);
                if (result.error) {
                    alert('Gagal menyimpan: ' + result.error.message);
                } else {
                    setShowEditModal(false);
                    fetchData();
                }
            }
        } catch (err) {
            console.error('Error:', err);
            alert('Terjadi kesalahan saat menyimpan data');
        } finally {
            setSaving(false);
        }
    };

    // Simpan dari modal Tambah
    const handleEvalSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!evalForm.selectedIKTId) {
            alert('Silakan pilih target IKT terlebih dahulu.');
            return;
        }
        setSaving(true);
        try {
            const payload = {
                realisasi_nilai: evalForm.realisasi_nilai ? Number(evalForm.realisasi_nilai) : null,
                kendala: encodePeriode(evalForm.periode_tipe, evalForm.periode_detail, evalForm.monthly_values, evalForm.kendala),
                tindak_lanjut: evalForm.tindak_lanjut || null,
            };
            const result = await supabase.from('indikator_kinerja_utama').update(payload).eq('id', evalForm.selectedIKTId);
            if (result.error) {
                alert('Gagal menyimpan realisasi: ' + result.error.message);
                return;
            }
            setShowAddModal(false);
            setEvalForm(defaultEvalForm);
            fetchData();
        } catch (err) {
            console.error('Error:', err);
            alert('Terjadi kesalahan saat menyimpan data');
        } finally {
            setSaving(false);
        }
    };

    const columns: Column<IKTEvaluasi>[] = [
        { key: 'target_tahun', label: 'Tahun', className: 'w-16 text-center' },
        { key: 'unit_kerja_id', label: 'Unit', render: r => (r as any).unit_kerja?.nama_unit ?? '-' },
        { key: 'indikator', label: 'Indikator Kinerja', render: r => <span className="line-clamp-2" title={r.indikator}>{r.indikator}</span> },
        { key: 'target_nilai', label: 'Target', className: 'text-center', render: r => r.target_nilai != null ? `${r.target_nilai} ${r.satuan ?? ''}`.trim() : '-' },
        {
            key: 'realisasi_nilai', label: 'Realisasi (Rata-rata)', className: 'text-center',
            render: r => r.realisasi_nilai != null
                ? <span className="font-semibold text-slate-800">{r.realisasi_nilai} {r.satuan ?? ''}</span>
                : <span className="text-slate-400 italic text-xs">Belum diisi</span>
        },
        {
            key: 'id', label: 'Capaian (%)', className: 'text-center',
            render: r => {
                if (r.realisasi_nilai == null || r.target_nilai == null) return <span className="text-slate-400">-</span>;
                const capaian = calculateCapaian(r.realisasi_nilai, r.target_nilai);
                const ok = capaian >= 100;
                return (
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${ok ? 'bg-emerald-100 text-emerald-700' : capaian >= 75 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                        {capaian.toFixed(1)}%
                    </span>
                );
            }
        },
        {
            key: 'kendala', label: 'Status & Periode',
            render: r => {
                const info = decodePeriode(r.kendala);
                const filledMonths = info.monthly.filter(m => m !== '').length;
                return (
                    <div className="flex flex-col items-start gap-1">
                        <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full font-medium">{info.detail}</span>
                        {filledMonths > 0 && <span className="text-[10px] text-slate-500 font-semibold">{filledMonths} bulan terisi</span>}
                    </div>
                );
            }
        },
        { key: 'pic', label: 'PIC', className: 'text-center', render: r => r.pic || '-' },
    ];

    // Stats
    const totalDenganTarget = data.filter(d => d.target_nilai != null).length;
    const totalDenganRealisasi = data.filter(d => d.realisasi_nilai != null).length;
    const tercapai = data.filter(d => d.realisasi_nilai != null && d.target_nilai != null && calculateCapaian(d.realisasi_nilai, d.target_nilai) >= 100).length;
    const belumTercapai = Math.max(0, totalDenganRealisasi - tercapai);
    const belumDiisi = totalDenganTarget - totalDenganRealisasi;
    const rataCapaian = totalDenganRealisasi > 0
        ? data.filter(d => d.realisasi_nilai != null && d.target_nilai != null).reduce((sum, d) => sum + calculateCapaian(d.realisasi_nilai, d.target_nilai), 0) / totalDenganRealisasi
        : 0;

    const chartData = data.filter(d => d.target_nilai != null).slice(0, 12).map(d => ({
        name: (d.indikator || '').substring(0, 20) + (d.indikator?.length > 20 ? '…' : ''),
        target: d.target_nilai ?? 0,
        realisasi: d.realisasi_nilai ?? 0,
    }));

    const pieData = [
        { name: 'Tercapai (≥100%)', value: tercapai },
        { name: 'Belum Tercapai', value: belumTercapai },
        { name: 'Belum Diisi', value: Math.max(0, belumDiisi) },
    ].filter(d => d.value > 0);

    const currentPeriodeOptions = PERIODE_OPTIONS.find(p => p.value === evalForm.periode_tipe)?.details || ['Tahunan'];
    const editPeriodeOptions = PERIODE_OPTIONS.find(p => p.value === editForm.periode_tipe)?.details || ['Tahunan'];

    return (
        <div>
            <PageHeader
                title="Evaluasi IKT"
                subtitle="Realisasi dan evaluasi Indikator Kinerja Tahunan yang telah ditetapkan."
            />

            {/* Score Cards */}
            <div className="grid grid-cols-2 xl:grid-cols-5 gap-5 mb-8">
                <ScoreCard icon={<Target size={22} className="text-[#137fec]" />} title="Total Target IKT" value={totalDenganTarget} colorClass="bg-blue-50 border-blue-100" />
                <ScoreCard icon={<Activity size={22} className="text-amber-500" />} title="Sudah Direalisasi" value={totalDenganRealisasi} colorClass="bg-amber-50 border-amber-100" />
                <ScoreCard icon={<CheckCircle2 size={22} className="text-emerald-500" />} title="Target Tercapai" value={tercapai} colorClass="bg-emerald-50 border-emerald-100" />
                <ScoreCard icon={<AlertCircle size={22} className="text-rose-500" />} title="Belum Tercapai" value={belumTercapai} colorClass="bg-rose-50 border-rose-100" />
                <ScoreCard icon={<BarChart2 size={22} className="text-indigo-500" />} title="Rata-rata Capaian" value={`${rataCapaian.toFixed(1)}%`} colorClass="bg-indigo-50 border-indigo-100" />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* Bar Chart - Target vs Realisasi */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden p-6">
                    <div className="flex items-center gap-2 mb-5">
                        <BarChart2 size={18} className="text-[#137fec]" />
                        <h3 className="font-bold text-slate-700">Grafik Capaian IKT — Target vs Realisasi</h3>
                    </div>
                    <div className="w-full h-[280px]">
                        {chartData.length === 0 ? (
                            <div className="flex items-center justify-center w-full h-full text-slate-400 text-sm">Tidak ada data untuk ditampilkan</div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 32 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" interval={0} />
                                    <YAxis tick={{ fontSize: 11 }} />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="target" name="Target" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="realisasi" name="Realisasi" fill="#137fec" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* Pie Chart - Distribusi Capaian */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden p-6">
                    <div className="flex items-center gap-2 mb-5">
                        <CheckCircle2 size={18} className="text-emerald-500" />
                        <h3 className="font-bold text-slate-700">Distribusi Capaian</h3>
                    </div>
                    <div className="w-full h-[240px]">
                        {pieData.length === 0 ? (
                            <div className="flex items-center justify-center w-full h-full text-slate-400 text-sm">Tidak ada data</div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                                        {pieData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                    {/* Legend */}
                    <div className="flex flex-wrap gap-3 mt-2 justify-center">
                        {pieData.map((d, i) => (
                            <div key={d.name} className="flex items-center gap-1.5 text-xs text-slate-600">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}></span>
                                {d.name} ({d.value})
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Tabel */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <TopActionBar
                    filters={
                        <div className="flex flex-wrap items-center gap-3">
                            <FilterBar
                                searchValue={search}
                                onSearchChange={setSearch}
                                searchPlaceholder="Cari indikator..."
                                yearValue={year}
                                onYearChange={setYear}
                            />
                            {profile?.role === 'user_unit' ? (
                                <div className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold border border-slate-200">
                                    {units.find(u => u.id === filterUnit)?.nama_unit || 'Unit Anda'}
                                </div>
                            ) : (
                                <select className="form-input text-xs py-2 w-48" value={filterUnit} onChange={e => setFilterUnit(e.target.value)}>
                                    <option value="all">Semua Unit Kerja</option>
                                    {units.map(u => <option key={u.id} value={u.id}>{u.nama_unit}</option>)}
                                </select>
                            )}
                        </div>
                    }
                    actions={<>
                        <button className="btn-secondary"><Download size={15} /><span className="hidden sm:inline">Template</span></button>
                        <button className="btn-secondary"><Upload size={15} /><span className="hidden sm:inline">Import</span></button>
                        <button className="btn-secondary border-primary/20 text-primary hover:bg-primary/5">
                            <FileText size={15} /><span className="hidden sm:inline">Laporan</span>
                        </button>
                        <button className="btn-primary" onClick={openAddModal}>
                            <Plus size={15} /><span>Input Realisasi</span>
                        </button>
                    </>}
                />
                <DataTable columns={columns} data={filtered} onEdit={openEditModal} isLoading={loading} />
            </div>

            {/* ====== MODAL EDIT REALISASI ====== */}
            {showEditModal && selectedItem && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <h3 className="text-base font-bold text-slate-800">Update Realisasi IKT</h3>
                            <button onClick={() => setShowEditModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
                        </div>
                        {/* Info IKT & Target */}
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-slate-100">
                            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-1">Indikator Kinerja</p>
                            <p className="text-sm font-semibold text-slate-800">{selectedItem.indikator}</p>
                            <div className="flex flex-wrap gap-4 mt-2">
                                <div className="bg-white/70 px-3 py-1.5 rounded-lg border border-slate-200">
                                    <p className="text-[10px] text-slate-400 uppercase">Target Kinerja (Tahunan)</p>
                                    <p className="text-lg font-bold text-[#137fec]">{selectedItem.target_nilai ?? '-'} {selectedItem.satuan ?? ''}</p>
                                </div>
                                <div className="bg-white/70 px-3 py-1.5 rounded-lg border border-slate-200">
                                    <p className="text-[10px] text-slate-400 uppercase">Tahun</p>
                                    <p className="text-sm font-bold text-slate-700">{selectedItem.target_tahun ?? '-'}</p>
                                </div>
                                <div className="bg-white/70 px-3 py-1.5 rounded-lg border border-slate-200">
                                    <p className="text-[10px] text-slate-400 uppercase">PIC</p>
                                    <p className="text-sm font-bold text-slate-700">{selectedItem.pic ?? '-'}</p>
                                </div>
                            </div>
                        </div>
                        <form onSubmit={handleEditSave} className="p-6 space-y-4">
                            {/* Periode */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="form-label flex items-center gap-1.5"><Calendar size={13} className="text-indigo-500" /> Tipe Periode</label>
                                    <select className="form-input" value={editForm.periode_tipe} onChange={e => {
                                        const tipe = e.target.value;
                                        const details = PERIODE_OPTIONS.find(p => p.value === tipe)?.details || ['Tahunan'];
                                        setEditForm(f => ({ ...f, periode_tipe: tipe, periode_detail: details[0] }));
                                    }}>
                                        {PERIODE_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="form-label">Detail Periode</label>
                                    <select className="form-input" value={editForm.periode_detail} onChange={e => setEditForm(f => ({ ...f, periode_detail: e.target.value }))}>
                                        {editPeriodeOptions.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Monthly Input Grid */}
                            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                                <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                                    ✍️ Pengisian Realisasi Bulanan (Target: {selectedItem.target_nilai ?? '-'} {selectedItem.satuan ?? ''})
                                </p>
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                                    {MONTHS.map((monthName, idx) => (
                                        <div key={monthName} className="space-y-1 bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                                            <label className="text-[10px] font-bold text-slate-500 block truncate">{monthName}</label>
                                            <input
                                                type="number"
                                                step="any"
                                                className="w-full text-center text-sm font-semibold border-0 p-0 focus:ring-0 focus:outline-none bg-transparent"
                                                placeholder="-"
                                                value={editForm.monthly_values[idx] || ''}
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    const newMonthly = [...editForm.monthly_values];
                                                    newMonthly[idx] = val;
                                                    const newAvg = calculateAverage(newMonthly);
                                                    setEditForm(f => ({
                                                        ...f,
                                                        monthly_values: newMonthly,
                                                        realisasi_nilai: newAvg > 0 ? String(newAvg) : ''
                                                    }));
                                                }}
                                            />
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-500">Rataan Capaian (Realisasi):</span>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-lg font-black text-indigo-600">
                                            {editForm.realisasi_nilai ? Number(editForm.realisasi_nilai).toFixed(2).replace(/\.00$/, '') : '0'}
                                        </span>
                                        <span className="text-xs text-slate-400 font-semibold">{selectedItem.satuan ?? ''}</span>
                                    </div>
                                </div>
                                {editForm.realisasi_nilai && selectedItem.target_nilai && (
                                    <div className="mt-1 text-center">
                                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${(Number(editForm.realisasi_nilai) / Number(selectedItem.target_nilai)) * 100 >= 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                            🎯 Rata-rata Capaian vs Target: {((Number(editForm.realisasi_nilai) / Number(selectedItem.target_nilai)) * 100).toFixed(1)}%
                                        </span>
                                    </div>
                                )}
                            </div>

                            <FormInputAI label="Kendala / Masalah" placeholder="Jelaskan kendala yang dihadapi..." value={editForm.kendala} onChange={v => setEditForm(f => ({ ...f, kendala: v }))} />
                            <FormInputAI label="Tindak Lanjut / Action Plan" placeholder="Rencana tindak lanjut..." value={editForm.tindak_lanjut} onChange={v => setEditForm(f => ({ ...f, tindak_lanjut: v }))} />
                            <div className="flex justify-end space-x-2 pt-2">
                                <button type="button" className="btn-secondary" onClick={() => setShowEditModal(false)}>Batal</button>
                                <button type="submit" className="btn-primary" disabled={saving}>
                                    {saving ? <><Loader2 size={15} className="animate-spin" /><span>Menyimpan...</span></> : <><Save size={15} /><span>Simpan Realisasi</span></>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ====== MODAL TAMBAH EVALUASI ====== */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <h3 className="text-base font-bold text-slate-800">Input Realisasi IKT</h3>
                            <button onClick={() => setShowAddModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleEvalSave} className="p-6 space-y-5">

                            {/* Step 1: Pilih Unit Kerja */}
                            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                                    <span className="w-5 h-5 rounded-full bg-[#137fec] text-white flex items-center justify-center text-[10px] font-bold">1</span>
                                    Pilih Unit Kerja
                                </p>
                                {profile?.role === 'user_unit' ? (
                                    <div className="px-3 py-2 bg-white text-slate-700 rounded-lg text-sm font-bold border border-slate-200">
                                        {units.find(u => u.id === evalForm.unit_kerja_id)?.nama_unit || 'Unit Anda'}
                                    </div>
                                ) : (
                                    <select
                                        className="form-input"
                                        value={evalForm.unit_kerja_id}
                                        onChange={e => setEvalForm(f => ({ ...f, unit_kerja_id: e.target.value, selectedIKTId: '' }))}
                                        required
                                    >
                                        <option value="">-- Pilih Unit Kerja --</option>
                                        {units.map(u => <option key={u.id} value={u.id}>{u.nama_unit}</option>)}
                                    </select>
                                )}
                            </div>

                            {/* Step 2: Pilih Target IKT */}
                            {evalForm.unit_kerja_id && (
                                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                                        <span className="w-5 h-5 rounded-full bg-[#137fec] text-white flex items-center justify-center text-[10px] font-bold">2</span>
                                        Pilih Target IKT ({iktForUnit.length} indikator ditemukan)
                                    </p>
                                    {iktForUnit.length === 0 ? (
                                        <p className="text-sm text-slate-400 italic">Tidak ada target IKT untuk unit kerja dan tahun yang dipilih.</p>
                                    ) : (
                                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1 overflow-x-hidden">
                                            {iktForUnit.map(ikt => {
                                                const isSelected = evalForm.selectedIKTId === ikt.id;
                                                const hasRealisasi = ikt.realisasi_nilai != null;
                                                return (
                                                    <button
                                                        key={ikt.id}
                                                        type="button"
                                                        onClick={() => handleIKTSelect(ikt.id)}
                                                        className={`w-full text-left p-3 rounded-lg border-2 transition-all ${isSelected
                                                            ? 'border-[#137fec] bg-blue-50 shadow-sm'
                                                            : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                                                            }`}
                                                    >
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="flex-1 min-w-0">
                                                                <p className={`text-sm font-medium ${isSelected ? 'text-[#137fec]' : 'text-slate-700'} line-clamp-2`}>{ikt.indikator}</p>
                                                                <div className="flex items-center gap-3 mt-1">
                                                                    <span className="text-xs text-slate-500">Target: <strong className="text-slate-700">{ikt.target_nilai ?? '-'} {ikt.satuan ?? ''}</strong></span>
                                                                    <span className="text-xs text-slate-400">PIC: {ikt.pic ?? '-'}</span>
                                                                </div>
                                                            </div>
                                                            <div className="flex flex-col items-end gap-1">
                                                                {hasRealisasi && (
                                                                    <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">Sudah diisi: {ikt.realisasi_nilai}</span>
                                                                )}
                                                                {isSelected && (
                                                                    <span className="text-[10px] px-2 py-0.5 bg-[#137fec] text-white rounded-full font-medium">✓ Dipilih</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Step 3: Input Realisasi */}
                            {evalForm.selectedIKTId && selectedIKTData && (
                                <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/20 p-4 space-y-4">
                                    <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide flex items-center gap-1.5">
                                        <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold">3</span>
                                        Input Realisasi & Evaluasi
                                    </p>

                                    {/* Target Info */}
                                    <div className="grid grid-cols-2 gap-3 mb-3 bg-white p-3 rounded-lg border border-slate-200">
                                        <div>
                                            <span className="text-[10px] text-slate-400 font-bold block uppercase">Target Kinerja (Tahunan)</span>
                                            <span className="text-base font-bold text-slate-700">{selectedIKTData.target_nilai ?? '-'} {selectedIKTData.satuan ?? ''}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-slate-400 font-bold block uppercase">Baseline ({selectedIKTData.baseline_tahun ?? '-'})</span>
                                            <span className="text-base font-bold text-slate-700">{selectedIKTData.baseline_nilai ?? '-'} {selectedIKTData.satuan ?? ''}</span>
                                        </div>
                                    </div>

                                    {/* Periode */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="form-label flex items-center gap-1.5"><Calendar size={13} className="text-indigo-500" /> Tipe Periode</label>
                                            <select className="form-input" value={evalForm.periode_tipe} onChange={e => {
                                                const tipe = e.target.value;
                                                const details = PERIODE_OPTIONS.find(p => p.value === tipe)?.details || ['Tahunan'];
                                                setEvalForm(f => ({ ...f, periode_tipe: tipe, periode_detail: details[0] }));
                                            }}>
                                                {PERIODE_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="form-label">Detail Periode</label>
                                            <select className="form-input" value={evalForm.periode_detail} onChange={e => setEvalForm(f => ({ ...f, periode_detail: e.target.value }))}>
                                                {currentPeriodeOptions.map(d => <option key={d} value={d}>{d}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Monthly Input Grid */}
                                    <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200">
                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                                            ✍️ Pengisian Realisasi Bulanan (Maks. 12 Bulan)
                                        </p>
                                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                                            {MONTHS.map((monthName, idx) => (
                                                <div key={monthName} className="space-y-1 bg-slate-50 p-2 rounded-lg border border-slate-200">
                                                    <label className="text-[10px] font-bold text-slate-500 block truncate">{monthName}</label>
                                                    <input
                                                        type="number"
                                                        step="any"
                                                        className="w-full text-center text-sm font-semibold border-0 p-0 focus:ring-0 focus:outline-none bg-transparent"
                                                        placeholder="-"
                                                        value={evalForm.monthly_values[idx] || ''}
                                                        onChange={e => {
                                                            const val = e.target.value;
                                                            const newMonthly = [...evalForm.monthly_values];
                                                            newMonthly[idx] = val;
                                                            const newAvg = calculateAverage(newMonthly);
                                                            setEvalForm(f => ({
                                                                ...f,
                                                                monthly_values: newMonthly,
                                                                realisasi_nilai: newAvg > 0 ? String(newAvg) : ''
                                                            }));
                                                        }}
                                                    />
                                                </div>
                                            ))}
                                        </div>

                                        <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
                                            <span className="text-xs font-bold text-slate-500">Rataan Capaian (Realisasi):</span>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-lg font-black text-indigo-600">
                                                    {evalForm.realisasi_nilai ? Number(evalForm.realisasi_nilai).toFixed(2).replace(/\.00$/, '') : '0'}
                                                </span>
                                                <span className="text-xs text-slate-400 font-semibold">{selectedIKTData.satuan ?? ''}</span>
                                            </div>
                                        </div>
                                        {evalForm.realisasi_nilai && selectedIKTData.target_nilai && (
                                            <div className="mt-1 text-center font-bold">
                                                <span className={`inline-block px-3 py-1 rounded-full text-xs ${(Number(evalForm.realisasi_nilai) / Number(selectedIKTData.target_nilai)) * 100 >= 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                    🎯 Rata-rata Capaian vs Target: {((Number(evalForm.realisasi_nilai) / Number(selectedIKTData.target_nilai)) * 100).toFixed(1)}%
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    <FormInputAI label="Kendala / Masalah" placeholder="Jelaskan kendala yang dihadapi (jika ada)..." value={evalForm.kendala} onChange={v => setEvalForm(f => ({ ...f, kendala: v }))} />
                                    <FormInputAI label="Tindak Lanjut / Action Plan" placeholder="Rencana tindak lanjut untuk perbaikan..." value={evalForm.tindak_lanjut} onChange={v => setEvalForm(f => ({ ...f, tindak_lanjut: v }))} />
                                </div>
                            )}

                            <div className="flex justify-end space-x-2 pt-1">
                                <button type="button" className="btn-secondary" onClick={() => setShowAddModal(false)}>Batal</button>
                                <button type="submit" className="btn-primary" disabled={saving || !evalForm.selectedIKTId}>
                                    {saving ? <><Loader2 size={15} className="animate-spin" /><span>Menyimpan...</span></> : <><Save size={15} /><span>Simpan Realisasi</span></>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
