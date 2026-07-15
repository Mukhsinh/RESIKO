'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader, ScoreCard, FilterBar, TopActionBar } from '@/components/SharedUI';
import DataTable, { type Column } from '@/components/DataTable';
import { Plus, TrendingUp, Target, BarChart2, Layers, Save, X, Loader2, Download, FileText, Trash2 } from 'lucide-react';
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
    realisasi: string; // deskripsi/rumus perhitungan
    nilai: number;
    range_nilai: string;
    kriteria_nilai: string; // JSON array of {skor, label}
    created_at: string;
    unit_kerja?: { nama_unit: string };
}

interface KriteriaItem { skor: string; label: string; }

interface Form {
    unit_kerja_id: string; tahun: number; perspektif: string;
    sasaran_strategis: string; kpi: string; bobot: number;
    target: string; realisasi: string; kriteria: KriteriaItem[];
}

const defaultForm: Form = {
    unit_kerja_id: '', tahun: CURRENT_YEAR, perspektif: 'Keuangan',
    sasaran_strategis: '', kpi: '', bobot: 0,
    target: '', realisasi: '', kriteria: [{ skor: '1', label: 'Kurang' }, { skor: '2', label: 'Cukup' }, { skor: '3', label: 'Baik' }, { skor: '4', label: 'Sangat Baik' }]
};

const PERSPEKTIF_COLORS: Record<string, string> = {
    'Keuangan': 'badge-green', 'Pelanggan': 'badge-blue',
    'Proses Internal': 'badge-amber', 'Proses Bisnis Internal': 'badge-amber',
    'Pembelajaran & Pertumbuhan': 'badge-gray', 'Pembelajaran dan Pertumbuhan': 'badge-gray',
};

export default function CascadingKPIPage() {
    const { profile } = useUserProfile();
    const [data, setData] = useState<CascadingKPI[]>([]);
    const [units, setUnits] = useState<{ id: string; nama_unit: string }[]>([]);
    const [towsSasarans, setTowsSasarans] = useState<string[]>([]);
    const [towsItems, setTowsItems] = useState<{ sasaran_strategy: string; implementasi: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [year, setYear] = useState(String(CURRENT_YEAR));
    const [filterUnit, setFilterUnit] = useState<string>('all');
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState<Form>(defaultForm);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (profile?.role === 'user_unit' && profile.unit_kerja_id) setFilterUnit(profile.unit_kerja_id);
    }, [profile]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            let q = supabase.from('cascading_kpi').select('*, unit_kerja(nama_unit)').order('created_at', { ascending: false });
            if (year) q = q.eq('tahun', Number(year));
            const unitToFilter = profile?.role === 'user_unit' ? profile.unit_kerja_id : (filterUnit === 'all' ? null : filterUnit);
            if (unitToFilter) q = q.eq('unit_kerja_id', unitToFilter);
            const { data: rows, error } = await q;
            if (error) throw error;
            setData((rows as any) ?? []);
        } catch (err) { console.error(err); setData([]); }
        finally { setLoading(false); }
    }, [year, filterUnit, profile]);

    useEffect(() => {
        fetchData();
        supabase.from('unit_kerja').select('id, nama_unit').order('nama_unit').then(({ data: u }: { data: any }) => setUnits(u ?? []));
    }, [fetchData]);

    useEffect(() => {
        if (!form.unit_kerja_id || !form.tahun) {
            setTowsSasarans([]);
            setTowsItems([]);
            return;
        }
        supabase.from('swot_tows_strategi').select('sasaran_strategy:sasaran_strategi, implementasi')
            .eq('unit_kerja_id', form.unit_kerja_id).eq('tahun', form.tahun)
            .then(({ data: towsData }: { data: any }) => {
                const items = towsData || [];
                setTowsItems(items);
                const sasarans = items.map((t: any) => t.sasaran_strategy).filter((s: any) => s && s.trim() !== '') || [];
                setTowsSasarans(Array.from(new Set(sasarans)));
            });
    }, [form.unit_kerja_id, form.tahun]);

    const handleSasaranChange = (val: string) => {
        const matched = towsItems.find(t => t.sasaran_strategy === val);
        const autoPerspektif = matched?.implementasi || 'Keuangan';
        setForm(f => ({ ...f, sasaran_strategis: val, perspektif: autoPerspektif }));
    };

    const filtered = data.filter(d =>
        d.sasaran_strategis?.toLowerCase().includes(search.toLowerCase()) ||
        d.kpi?.toLowerCase().includes(search.toLowerCase())
    );

    const parseKriteria = (val: string): KriteriaItem[] => {
        try { const arr = JSON.parse(val); if (Array.isArray(arr)) return arr; } catch { }
        return [];
    };

    const openAdd = () => {
        setEditId(null);
        const newForm = { ...defaultForm };
        if (profile?.role === 'user_unit' && profile.unit_kerja_id) newForm.unit_kerja_id = profile.unit_kerja_id;
        setForm(newForm);
        setShowModal(true);
    };

    const openEdit = (row: CascadingKPI) => {
        setEditId(row.id);
        setForm({
            unit_kerja_id: row.unit_kerja_id, tahun: row.tahun, perspektif: row.perspektif,
            sasaran_strategis: row.sasaran_strategis, kpi: row.kpi, bobot: row.bobot || 0,
            target: row.target || '', realisasi: row.realisasi || '',
            kriteria: parseKriteria(row.kriteria_nilai)
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
            // Find perspective if not set
            let finalPerspektif = form.perspektif;
            if (!finalPerspektif && form.sasaran_strategis) {
                const matched = towsItems.find(t => t.sasaran_strategy === form.sasaran_strategis);
                finalPerspektif = matched?.implementasi || 'Keuangan';
            }
            const payload = {
                unit_kerja_id: form.unit_kerja_id, tahun: form.tahun, perspektif: finalPerspektif,
                sasaran_strategis: form.sasaran_strategis, kpi: form.kpi, bobot: form.bobot,
                target: form.target, realisasi: form.realisasi,
                kriteria_nilai: JSON.stringify(form.kriteria.filter(k => k.skor.trim() || k.label.trim()))
            };
            if (editId) {
                await supabase.from('cascading_kpi').update(payload).eq('id', editId);
            } else {
                await supabase.from('cascading_kpi').insert(payload);
            }
            setShowModal(false); fetchData();
        } catch (err: any) { alert('Gagal: ' + err.message); }
        finally { setSaving(false); }
    };

    const addKriteria = () => setForm(f => ({ ...f, kriteria: [...f.kriteria, { skor: '', label: '' }] }));
    const removeKriteria = (i: number) => setForm(f => ({ ...f, kriteria: f.kriteria.filter((_, idx) => idx !== i) }));
    const updateKriteria = (i: number, field: 'skor' | 'label', val: string) => {
        setForm(f => {
            const k = [...f.kriteria]; k[i] = { ...k[i], [field]: val }; return { ...f, kriteria: k };
        });
    };

    const columns: Column<CascadingKPI>[] = [
        { key: 'perspektif', label: 'Perspektif', render: r => <span className={PERSPEKTIF_COLORS[r.perspektif] ?? 'badge-gray'}>{r.perspektif}</span> },
        { key: 'unit_kerja_id', label: 'Unit', render: r => r.unit_kerja?.nama_unit ?? '-' },
        { key: 'sasaran_strategis', label: 'Sasaran Strategis', render: r => <span className="line-clamp-2">{r.sasaran_strategis}</span> },
        { key: 'kpi', label: 'KPI / Indikator' },
        { key: 'target', label: 'Target', className: 'text-center font-bold text-slate-700' },
        {
            key: 'kriteria_nilai', label: 'Kriteria', render: r => {
                const arr = parseKriteria(r.kriteria_nilai);
                if (arr.length === 0) return <span className="text-slate-400 text-xs">-</span>;
                return (
                    <div className="flex flex-wrap gap-1.5 max-w-[280px]">
                        {arr.map((k, i) => {
                            const lbl = k.label?.trim();
                            const skr = k.skor?.trim();
                            if (!lbl && !skr) return null;
                            return (
                                <span key={i} className="inline-flex items-center px-2 py-0.5 bg-slate-50 border border-slate-200 text-slate-600 rounded text-[10px] whitespace-nowrap font-medium shadow-sm">
                                    {lbl ? `${lbl}: ` : ''}
                                    <span className="font-semibold text-slate-750 ml-0.5">{skr || '-'}</span>
                                </span>
                            );
                        })}
                    </div>
                );
            }
        },
    ];

    return (
        <div>
            <PageHeader title="Cascading KPI" subtitle="Breakdown sasaran strategis ke dalam Indikator Kinerja Utama (KPI)." />

            <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
                <ScoreCard icon={<TrendingUp size={22} className="text-[#137fec]" />} title="Total KPI" value={data.length} colorClass="bg-blue-50 border-blue-100" />
                <ScoreCard icon={<Target size={22} className="text-emerald-500" />} title="Total Sasaran" value={new Set(data.map(d => d.sasaran_strategis)).size} colorClass="bg-emerald-50 border-emerald-100" />
                <ScoreCard icon={<Layers size={22} className="text-violet-500" />} title="Perspektif" value={new Set(data.map(d => d.perspektif)).size} colorClass="bg-violet-50 border-violet-100" />
                <ScoreCard icon={<BarChart2 size={22} className="text-amber-500" />} title="Tahun Aktif" value={year} colorClass="bg-amber-50 border-amber-100" />
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
                                <select className="form-input" value={form.sasaran_strategis} onChange={e => handleSasaranChange(e.target.value)} required disabled={!form.unit_kerja_id}>
                                    <option value="">-- Pilih Sasaran Strategis --</option>
                                    {towsSasarans.map((s, idx) => <option key={idx} value={s}>{s}</option>)}
                                </select>
                                {!form.unit_kerja_id && <p className="text-xs text-rose-500 mt-1">Pilih Unit Kerja terlebih dahulu</p>}
                                {form.sasaran_strategis && (
                                    <p className="text-xs text-indigo-600 mt-1 font-semibold">
                                        Perspektif Terdeteksi (Otomatis dari TOWS): {towsItems.find(t => t.sasaran_strategy === form.sasaran_strategis)?.implementasi || 'Keuangan'}
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="form-label">KPI / Indikator</label>
                                <input type="text" className="form-input" value={form.kpi} onChange={e => setForm(f => ({ ...f, kpi: e.target.value }))} placeholder="Nama indikator kinerja utama" required />
                            </div>

                            {/* Deskripsi / Rumus Perhitungan */}
                            <div>
                                <label className="form-label">Deskripsi / Rumus Perhitungan</label>
                                <textarea rows={3} className="form-input text-sm resize-none" value={form.realisasi} onChange={e => setForm(f => ({ ...f, realisasi: e.target.value }))} placeholder="Jelaskan cara menghitung indikator ini, misalnya: (Jumlah pasien puas / Total pasien) x 100%" />
                            </div>

                            {/* Kriteria Penilaian */}
                            <div>
                                <label className="form-label mb-2">Kriteria Penilaian</label>
                                <div className="bg-slate-50/50 rounded-xl border border-slate-200 p-4">
                                    <div className="flex items-center gap-3 mb-2 text-xs font-bold text-slate-500">
                                        <div className="w-4 shrink-0"></div>
                                        <div className="flex-1">Keterangan / Kriteria</div>
                                        <div className="!w-40 shrink-0 text-center">Nilai / Skor Target</div>
                                        <div className="w-8 shrink-0"></div>
                                    </div>
                                    <div className="space-y-2">
                                        {form.kriteria.map((k, i) => (
                                            <div key={i} className="flex items-center gap-3">
                                                <span className="text-xs font-bold text-slate-400 w-4 shrink-0 text-center">#{i + 1}</span>
                                                <input
                                                    type="text"
                                                    className="form-input text-xs py-2 flex-grow min-w-0"
                                                    placeholder="Contoh: Sangat Baik, Cukup, Kurang"
                                                    value={k.label}
                                                    onChange={e => updateKriteria(i, 'label', e.target.value)}
                                                />
                                                <input
                                                    type="text"
                                                    className="form-input text-xs py-2 !w-40 text-center font-bold shrink-0"
                                                    placeholder="Contoh: 4, >90%"
                                                    value={k.skor}
                                                    onChange={e => updateKriteria(i, 'skor', e.target.value)}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => removeKriteria(i)}
                                                    className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg shrink-0 transition-colors"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    <button type="button" onClick={addKriteria} className="btn-secondary text-xs mt-3 py-1.5 px-3">
                                        <Plus size={12} className="mr-1" /> Tambah Kriteria
                                    </button>
                                </div>
                            </div>

                            {/* Target saja, tanpa bobot */}
                            <div>
                                <label className="form-label">Target</label>
                                <input type="text" className="form-input" value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))} placeholder="Contoh Target: 90% atau ≤ 5 Insiden" required />
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
