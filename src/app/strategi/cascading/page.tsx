'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader, ScoreCard, FilterBar, TopActionBar } from '@/components/SharedUI';
import DataTable, { type Column } from '@/components/DataTable';
import { Plus, TrendingUp, Target, BarChart2, Layers, Save, X, Loader2, Download, FileText } from 'lucide-react';
import { useUserProfile } from '@/hooks/useUserProfile';

const CURRENT_YEAR = new Date().getFullYear();

interface CascadingKPI {
    id: string;
    unit_kerja_id: string;
    tahun: number;
    perspektif: string;
    sasaran_strategis: string;
    kpi: string;
    bobot: number;
    target: string;
    // New fields
    nilai: number;
    range_nilai: string;
    kriteria_nilai: string;
    created_at: string;
    unit_kerja?: { nama_unit: string };
}

interface Form {
    unit_kerja_id: string; tahun: number; perspektif: string;
    sasaran_strategis: string; kpi: string; bobot: number;
    nilai: number; range_nilai: string; kriteria_nilai: string;
}

const defaultForm: Form = {
    unit_kerja_id: '', tahun: CURRENT_YEAR, perspektif: 'Keuangan',
    sasaran_strategis: '', kpi: '', bobot: 10, nilai: 0, range_nilai: '', kriteria_nilai: ''
};

const PERSPEKTIF = ['Keuangan', 'Pelanggan', 'Proses Internal', 'Pembelajaran & Pertumbuhan'];
const PERSPEKTIF_COLORS: Record<string, string> = {
    'Keuangan': 'badge-green', 'Pelanggan': 'badge-blue',
    'Proses Internal': 'badge-amber', 'Pembelajaran & Pertumbuhan': 'badge-gray',
};

export default function CascadingKPIPage() {
    const { profile } = useUserProfile();
    const [data, setData] = useState<CascadingKPI[]>([]);
    const [units, setUnits] = useState<{ id: string; nama_unit: string }[]>([]);
    const [towsSasarans, setTowsSasarans] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [year, setYear] = useState(String(CURRENT_YEAR));
    const [filterUnit, setFilterUnit] = useState<string>('all');
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState<Form>(defaultForm);
    const [saving, setSaving] = useState(false);

    // Sync unit for managers
    useEffect(() => {
        if (profile?.role === 'user_unit' && profile.unit_kerja_id) {
            setFilterUnit(profile.unit_kerja_id);
        }
    }, [profile]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            let q = supabase.from('cascading_kpi').select('*, unit_kerja(nama_unit)').order('created_at', { ascending: false });
            if (year) q = q.eq('tahun', Number(year));
            const unitToFilter = profile?.role === 'user_unit' ? profile.unit_kerja_id : (filterUnit === 'all' ? null : filterUnit);
            if (unitToFilter) {
                q = q.eq('unit_kerja_id', unitToFilter);
            }
            const { data: rows, error } = await q;
            if (error) throw error;
            setData((rows as any) ?? []);
        } catch (err) {
            console.error('Error fetching cascading data:', err);
            setData([]);
        } finally {
            setLoading(false);
        }
    }, [year, filterUnit, profile]);

    useEffect(() => {
        fetchData();
        supabase.from('unit_kerja').select('id, nama_unit').order('nama_unit').then(({ data: u }: { data: any }) => setUnits(u ?? []));
    }, [fetchData]);

    // Fetch sasaran strategis dari TOWS ketika unit_kerja atau tahun berubah di form
    useEffect(() => {
        if (!form.unit_kerja_id || !form.tahun) return;
        supabase.from('swot_tows_strategi')
            .select('sasaran_strategi')
            .eq('unit_kerja_id', form.unit_kerja_id)
            .eq('tahun', form.tahun)
            .then(({ data: towsData }: { data: any }) => {
                const sasarans = towsData?.map((t: any) => t.sasaran_strategi).filter((s: any) => s && s.trim() !== '') || [];
                setTowsSasarans(Array.from(new Set(sasarans))); // remove duplicates
            });
    }, [form.unit_kerja_id, form.tahun]);

    const filtered = data.filter(d =>
        d.sasaran_strategis?.toLowerCase().includes(search.toLowerCase()) ||
        d.kpi?.toLowerCase().includes(search.toLowerCase())
    );

    const totalBobot = data.reduce((s, d) => s + (d.bobot || 0), 0);

    const openAdd = () => {
        setEditId(null);
        const newForm = { ...defaultForm };
        if (profile?.role === 'user_unit' && profile.unit_kerja_id) {
            newForm.unit_kerja_id = profile.unit_kerja_id;
        }
        setForm(newForm);
        setShowModal(true);
    };
    const openEdit = (row: CascadingKPI) => {
        setEditId(row.id);
        setForm({
            unit_kerja_id: row.unit_kerja_id, tahun: row.tahun, perspektif: row.perspektif,
            sasaran_strategis: row.sasaran_strategis, kpi: row.kpi, bobot: row.bobot,
            nilai: row.nilai || 0, range_nilai: row.range_nilai || '', kriteria_nilai: row.kriteria_nilai || ''
        });
        setShowModal(true);
    };
    const handleDelete = async (row: CascadingKPI) => {
        if (!confirm(`Hapus KPI "${row.kpi}"?`)) return;
        await supabase.from('cascading_kpi').delete().eq('id', row.id);
        fetchData();
    };
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault(); setSaving(true);
        try {
            const payload = {
                ...form,
                target: String((form.bobot || 0) * (form.nilai || 0)) // auto hitung
            };
            if (editId) {
                await supabase.from('cascading_kpi').update(payload).eq('id', editId);
            } else {
                await supabase.from('cascading_kpi').insert(payload);
            }
            setShowModal(false);
            fetchData();
        } catch (err: any) {
            console.error(err);
            alert('Gagal: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const columns: Column<CascadingKPI>[] = [
        { key: 'perspektif', label: 'Perspektif', render: r => <span className={PERSPEKTIF_COLORS[r.perspektif] ?? 'badge-gray'}>{r.perspektif}</span> },
        { key: 'unit_kerja_id', label: 'Unit', render: r => r.unit_kerja?.nama_unit ?? '-' },
        { key: 'sasaran_strategis', label: 'Sasaran Strategis', render: r => <span className="line-clamp-2">{r.sasaran_strategis}</span> },
        { key: 'kpi', label: 'KPI' },
        { key: 'bobot', label: 'Bobot', className: 'text-center', render: r => <>{r.bobot}%</> },
        { key: 'nilai', label: 'Nilai', className: 'text-center' },
        { key: 'target', label: 'Target (BxN)', className: 'text-center font-bold text-slate-700' },
    ];

    const targetValue = (form.bobot || 0) * (form.nilai || 0);

    return (
        <div>
            <PageHeader title="Cascading KPI" subtitle="Breakdown sasaran strategis ke dalam Indikator Kinerja Utama (KPI)." />

            <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
                <ScoreCard icon={<TrendingUp size={22} className="text-[#137fec]" />} title="Total KPI" value={data.length} colorClass="bg-blue-50 border-blue-100" />
                <ScoreCard icon={<Target size={22} className="text-emerald-500" />} title="Total Sasaran" value={new Set(data.map(d => d.sasaran_strategis)).size} colorClass="bg-emerald-50 border-emerald-100" />
                <ScoreCard icon={<BarChart2 size={22} className="text-amber-500" />} title="Total Bobot" value={`${totalBobot.toFixed(1)}%`} colorClass="bg-amber-50 border-amber-100" />
                <ScoreCard icon={<Layers size={22} className="text-violet-500" />} title="Perspektif" value={new Set(data.map(d => d.perspektif)).size} colorClass="bg-violet-50 border-violet-100" />
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <TopActionBar
                    filters={
                        <div className="flex flex-wrap items-center gap-3">
                            <FilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Cari sasaran / KPI..." yearValue={year} onYearChange={setYear} />
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
                        <button className="btn-secondary"><FileText size={15} /><span className="hidden sm:inline">Export</span></button>
                        <button className="btn-primary" onClick={openAdd}><Plus size={15} /><span>Tambah KPI</span></button>
                    </>}
                />
                <DataTable columns={columns} data={filtered} onEdit={openEdit} onDelete={handleDelete} onView={openEdit} isLoading={loading} />
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <h3 className="text-base font-bold text-slate-800">{editId ? 'Edit' : 'Tambah'} Cascading KPI</h3>
                            <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="form-label">Unit Kerja</label>
                                    {profile?.role === 'user_unit' ? (
                                        <div className="form-input bg-slate-100 text-slate-600 cursor-not-allowed">
                                            {units.find(u => u.id === form.unit_kerja_id)?.nama_unit || 'Unit Kerja Anda'}
                                        </div>
                                    ) : (
                                        <select className="form-input" value={form.unit_kerja_id} onChange={e => setForm(f => ({ ...f, unit_kerja_id: e.target.value }))} required>
                                            <option value="">-- Pilih Unit --</option>
                                            {units.map(u => <option key={u.id} value={u.id}>{u.nama_unit}</option>)}
                                        </select>
                                    )}
                                </div>
                                <div>
                                    <label className="form-label">Tahun</label>
                                    <input type="number" className="form-input" value={form.tahun} onChange={e => setForm(f => ({ ...f, tahun: Number(e.target.value) }))} required />
                                </div>
                            </div>

                            <div>
                                <label className="form-label">Sasaran Strategis (Pilih dari TOWS)</label>
                                <select className="form-input" value={form.sasaran_strategis} onChange={e => setForm(f => ({ ...f, sasaran_strategis: e.target.value }))} required disabled={!form.unit_kerja_id}>
                                    <option value="">-- Pilih Sasaran Strategis --</option>
                                    {towsSasarans.map((s, idx) => <option key={idx} value={s}>{s}</option>)}
                                </select>
                                {!form.unit_kerja_id && <p className="text-xs text-rose-500 mt-1">Pilih Unit Kerja terlebih dahulu</p>}
                            </div>

                            <div>
                                <label className="form-label">Perspektif BSC</label>
                                <select className="form-input" value={form.perspektif} onChange={e => setForm(f => ({ ...f, perspektif: e.target.value }))}>
                                    {PERSPEKTIF.map(p => <option key={p}>{p}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="form-label">KPI / Indikator</label>
                                <input type="text" className="form-input" value={form.kpi} onChange={e => setForm(f => ({ ...f, kpi: e.target.value }))} placeholder="Nama indikator kinerja utama" required />
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                    <label className="form-label">Bobot (%)</label>
                                    <input type="number" min="0" max="100" step="0.5" className="form-input" value={form.bobot} onChange={e => setForm(f => ({ ...f, bobot: Number(e.target.value) }))} required />
                                </div>
                                <div>
                                    <label className="form-label">Nilai</label>
                                    <input type="number" step="0.01" className="form-input" value={form.nilai} onChange={e => setForm(f => ({ ...f, nilai: Number(e.target.value) }))} required />
                                </div>
                                <div className="col-span-2">
                                    <label className="form-label">Target (Level / Capaian)</label>
                                    <div className="form-input bg-slate-50 text-slate-700 font-bold border-slate-200">
                                        {targetValue.toFixed(2)}
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1">Hasil: Bobot × Nilai</p>
                                </div>
                            </div>

                            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Batal</button>
                                <button type="submit" className="btn-primary" disabled={saving}>
                                    {saving ? <><Loader2 size={15} className="animate-spin" /><span>Menyimpan...</span></> : <><Save size={15} /><span>Simpan</span></>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
