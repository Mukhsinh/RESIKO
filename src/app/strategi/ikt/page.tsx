'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader, ScoreCard, FilterBar, TopActionBar } from '@/components/SharedUI';
import DataTable, { type Column } from '@/components/DataTable';
import FormInputAI from '@/components/FormInputAI';
import { Plus, Download, Upload, FileText, Target, TrendingUp, AlertCircle, CheckCircle2, Save, X, Loader2 } from 'lucide-react';
import { useUserProfile } from '@/hooks/useUserProfile';

const CURRENT_YEAR = new Date().getFullYear();

interface IKT {
    id: string;
    rencana_strategis_id: string;
    sasaran_strategi_id?: string;
    indikator: string;
    baseline_tahun?: number;
    baseline_nilai?: number;
    target_tahun?: number;
    target_nilai?: number;
    satuan?: string;
    initiatif_strategi?: string;
    pic?: string;
    created_at: string;
    unit_kerja_id?: string;
    unit_kerja?: { nama_unit: string };
}

interface Form {
    rencana_strategis_id: string;
    sasaran_strategi_id: string;
    indikator: string;
    baseline_tahun: number;
    baseline_nilai: string;
    target_tahun: number;
    target_nilai: string;
    satuan: string;
    initiatif_strategi: string;
    pic: string;
    unit_kerja_id: string;
}

const defaultForm: Form = {
    rencana_strategis_id: '',
    sasaran_strategi_id: '',
    indikator: '',
    baseline_tahun: CURRENT_YEAR - 1,
    baseline_nilai: '',
    target_tahun: CURRENT_YEAR,
    target_nilai: '',
    satuan: '',
    initiatif_strategi: '',
    pic: '',
    unit_kerja_id: '',
};

export default function IKTPage() {
    const { profile } = useUserProfile();
    const [data, setData] = useState<IKT[]>([]);
    const [renstraList, setRenstraList] = useState<{ id: string; nama_rencana: string }[]>([]);
    const [sasaranList, setSasaranList] = useState<{ id: string; sasaran: string }[]>([]);
    const [units, setUnits] = useState<{ id: string; nama_unit: string }[]>([]);
    const [filterUnit, setFilterUnit] = useState<string>('all');
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [year, setYear] = useState(String(CURRENT_YEAR));
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState<Form>(defaultForm);
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
            const selectFields = hasUnitKerjaId ? '*, unit_kerja(nama_unit)' : '*';
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
                console.error('Error fetching IKT:', error);
                setData([]);
            } else {
                setData((rows as IKT[]) ?? []);
            }
        } catch (err) {
            console.error('Error:', err);
            setData([]);
        } finally {
            setLoading(false);
        }
    }, [year, filterUnit, profile, hasUnitKerjaId]);

    useEffect(() => {
        if (hasUnitKerjaId === null) return;
        fetchData();
        supabase.from('rencana_strategis').select('id, nama_rencana').then(({ data: r, error }: { data: any; error: any }) => {
            if (error) console.error('Error fetching renstra:', error);
            setRenstraList(r ?? []);
        });
        supabase.from('sasaran_strategi').select('id, sasaran').then(({ data: s, error }: { data: any; error: any }) => {
            if (error) console.error('Error fetching sasaran:', error);
            setSasaranList(s ?? []);
        });
    }, [fetchData, hasUnitKerjaId]);

    const filtered = data.filter(d =>
        (d.indikator || '').toLowerCase().includes(search.toLowerCase()) ||
        (d.satuan || '').toLowerCase().includes(search.toLowerCase()) ||
        (d.pic || '').toLowerCase().includes(search.toLowerCase())
    );

    const openAdd = () => {
        setEditId(null);
        const newForm = { ...defaultForm };
        if (profile?.role === 'user_unit' && profile.unit_kerja_id) {
            newForm.unit_kerja_id = profile.unit_kerja_id;
        }
        setForm(newForm);
        setShowModal(true);
    };
    const openEdit = (row: IKT) => {
        setEditId(row.id);
        setForm({
            rencana_strategis_id: row.rencana_strategis_id,
            sasaran_strategi_id: row.sasaran_strategi_id || '',
            indikator: row.indikator,
            baseline_tahun: row.baseline_tahun || CURRENT_YEAR - 1,
            baseline_nilai: String(row.baseline_nilai || ''),
            target_tahun: row.target_tahun || CURRENT_YEAR,
            target_nilai: String(row.target_nilai || ''),
            satuan: row.satuan || '',
            initiatif_strategi: row.initiatif_strategi || '',
            pic: row.pic || '',
            unit_kerja_id: row.unit_kerja_id || '',
        });
        setShowModal(true);
    };
    const handleDelete = async (row: IKT) => {
        if (!confirm(`Hapus indikator "${row.indikator.slice(0, 50)}"?`)) return;
        await supabase.from('indikator_kinerja_utama').delete().eq('id', row.id);
        fetchData();
    };
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload: any = {
                ...form,
                baseline_nilai: form.baseline_nilai ? Number(form.baseline_nilai) : null,
                target_nilai: form.target_nilai ? Number(form.target_nilai) : null,
                sasaran_strategi_id: form.sasaran_strategi_id || null,
            };
            if (!hasUnitKerjaId) {
                delete payload.unit_kerja_id;
            }
            let result;
            if (editId) {
                result = await supabase.from('indikator_kinerja_utama').update(payload).eq('id', editId);
            } else {
                result = await supabase.from('indikator_kinerja_utama').insert(payload);
            }
            if (result.error) {
                console.error('Error saving IKT:', result.error);
                alert('Gagal menyimpan data: ' + result.error.message);
            } else {
                setShowModal(false);
                fetchData();
            }
        } catch (err) {
            console.error('Error:', err);
            alert('Terjadi kesalahan saat menyimpan data');
        } finally {
            setSaving(false);
        }
    };

    const columns: Column<IKT>[] = [
        { key: 'target_tahun', label: 'Tahun', className: 'w-16 text-center' },
        { key: 'unit_kerja_id', label: 'Unit', render: r => r.unit_kerja?.nama_unit ?? '-' },
        { key: 'indikator', label: 'Indikator Kinerja', render: r => <span className="line-clamp-2">{r.indikator}</span> },
        { key: 'baseline_nilai', label: 'Baseline', className: 'text-center', render: r => r.baseline_nilai ?? '-' },
        { key: 'target_nilai', label: 'Target', className: 'text-center', render: r => r.target_nilai ?? '-' },
        { key: 'satuan', label: 'Satuan', className: 'text-center' },
        { key: 'pic', label: 'PIC', className: 'text-center' },
    ];

    return (
        <div>
            <PageHeader
                title="Indikator Kinerja Tahunan (IKT)"
                subtitle="Indikator kinerja utama untuk mengukur pencapaian target tahunan unit kerja."
            />

            <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
                <ScoreCard
                    icon={<Target size={22} className="text-[#137fec]" />}
                    title="Total Indikator"
                    value={data.length}
                    colorClass="bg-blue-50 border-blue-100"
                />
                <ScoreCard
                    icon={<CheckCircle2 size={22} className="text-emerald-500" />}
                    title="Dengan Target"
                    value={data.filter(d => d.target_nilai).length}
                    colorClass="bg-emerald-50 border-emerald-100"
                />
                <ScoreCard
                    icon={<AlertCircle size={22} className="text-amber-500" />}
                    title="Dengan Baseline"
                    value={data.filter(d => d.baseline_nilai).length}
                    colorClass="bg-amber-50 border-amber-100"
                />
                <ScoreCard
                    icon={<TrendingUp size={22} className="text-emerald-500" />}
                    title="Tahun Target"
                    value={year || 'Semua'}
                    colorClass="bg-emerald-50 border-emerald-100"
                />
            </div>

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
                        <button className="btn-secondary">
                            <Download size={15} />
                            <span className="hidden sm:inline">Template</span>
                        </button>
                        <button className="btn-secondary">
                            <Upload size={15} />
                            <span className="hidden sm:inline">Import</span>
                        </button>
                        <button className="btn-secondary">
                            <FileText size={15} />
                            <span className="hidden sm:inline">Export</span>
                        </button>
                        <button className="btn-primary" onClick={openAdd}>
                            <Plus size={15} />
                            <span>Tambah</span>
                        </button>
                    </>}
                />
                <DataTable
                    columns={columns}
                    data={filtered}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                    onView={openEdit}
                    isLoading={loading}
                />
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <h3 className="text-base font-bold text-slate-800">
                                {editId ? 'Edit' : 'Tambah'} Indikator Kinerja
                            </h3>
                            <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div>
                                <label className="form-label flex gap-1">Unit Kerja <span className="text-red-500">*</span></label>
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
                                <label className="form-label">Rencana Strategis</label>
                                <select
                                    className="form-input"
                                    value={form.rencana_strategis_id}
                                    onChange={e => setForm(f => ({ ...f, rencana_strategis_id: e.target.value }))}
                                    required
                                >
                                    <option value="">-- Pilih Rencana Strategis --</option>
                                    {renstraList.map(r => <option key={r.id} value={r.id}>{r.nama_rencana}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="form-label">Sasaran Strategi (Opsional)</label>
                                <select
                                    className="form-input"
                                    value={form.sasaran_strategi_id}
                                    onChange={e => setForm(f => ({ ...f, sasaran_strategi_id: e.target.value }))}
                                >
                                    <option value="">-- Pilih Sasaran (Opsional) --</option>
                                    {sasaranList.map(s => <option key={s.id} value={s.id}>{s.sasaran}</option>)}
                                </select>
                            </div>
                            <FormInputAI
                                label="Indikator Kinerja"
                                placeholder="Nama indikator kinerja..."
                                value={form.indikator}
                                onChange={v => setForm(f => ({ ...f, indikator: v }))}
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="form-label">Tahun Baseline</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        value={form.baseline_tahun}
                                        onChange={e => setForm(f => ({ ...f, baseline_tahun: Number(e.target.value) }))}
                                    />
                                </div>
                                <div>
                                    <label className="form-label">Nilai Baseline</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={form.baseline_nilai}
                                        onChange={e => setForm(f => ({ ...f, baseline_nilai: e.target.value }))}
                                        placeholder="Contoh: 75"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="form-label">Tahun Target</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        value={form.target_tahun}
                                        onChange={e => setForm(f => ({ ...f, target_tahun: Number(e.target.value) }))}
                                    />
                                </div>
                                <div>
                                    <label className="form-label">Nilai Target</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={form.target_nilai}
                                        onChange={e => setForm(f => ({ ...f, target_nilai: e.target.value }))}
                                        placeholder="Contoh: 85"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="form-label">Satuan</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={form.satuan}
                                        onChange={e => setForm(f => ({ ...f, satuan: e.target.value }))}
                                        placeholder="Contoh: Persen, Orang, Hari"
                                    />
                                </div>
                                <div>
                                    <label className="form-label">PIC</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={form.pic}
                                        onChange={e => setForm(f => ({ ...f, pic: e.target.value }))}
                                        placeholder="Penanggung jawab"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="form-label">Inisiatif Strategi</label>
                                <textarea
                                    className="form-input"
                                    rows={3}
                                    value={form.initiatif_strategi}
                                    onChange={e => setForm(f => ({ ...f, initiatif_strategi: e.target.value }))}
                                    placeholder="Deskripsi inisiatif strategi..."
                                />
                            </div>
                            <div className="flex justify-end space-x-2 pt-2">
                                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                                    Batal
                                </button>
                                <button type="submit" className="btn-primary" disabled={saving}>
                                    {saving ? (
                                        <>
                                            <Loader2 size={15} className="animate-spin" />
                                            <span>Menyimpan...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Save size={15} />
                                            <span>Simpan</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
