'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader, ScoreCard, FilterBar, TopActionBar } from '@/components/SharedUI';
import DataTable, { type Column } from '@/components/DataTable';
import FormInputAI from '@/components/FormInputAI';
import { useUserProfile } from '@/hooks/useUserProfile';
import {
    Plus, Download, Upload, FileText,
    AlertTriangle, ShieldAlert, CheckCircle2, X, Save, Loader2
} from 'lucide-react';

const CURRENT_YEAR = new Date().getFullYear();

interface RiskInput {
    id: string;
    no?: number;
    kode_risiko?: string;
    nama_risiko?: string;
    status_risiko?: string;
    jenis_risiko?: string;
    kategori_risiko_id?: string;
    nama_unit_kerja_id?: string;
    sasaran?: string;
    tanggal_registrasi?: string;
    penyebab_risiko?: string;
    dampak_risiko?: string;
    identifikasi_tanggal?: string;
    identifikasi_deskripsi?: string;
    identifikasi_akar_penyebab?: string;
    identifikasi_indikator?: string;
    identifikasi_faktor_positif?: string;
    identifikasi_deskripsi_dampak?: string;
    created_at: string;
    master_work_units?: { name: string };
    master_risk_categories?: { name: string };
}

interface FormData {
    kode_risiko: string;
    nama_risiko: string;
    nama_unit_kerja_id: string;
    kategori_risiko_id: string;
    sasaran: string;
    identifikasi_tanggal: string;
    identifikasi_deskripsi: string;
    identifikasi_akar_penyebab: string;
    identifikasi_indikator: string;
    identifikasi_faktor_positif: string;
    identifikasi_deskripsi_dampak: string;
    penyebab_risiko: string;
    dampak_risiko: string;
    status_risiko: string;
    jenis_risiko: string;
}

const defaultForm: FormData = {
    kode_risiko: '',
    nama_risiko: '',
    nama_unit_kerja_id: '',
    kategori_risiko_id: '',
    sasaran: '',
    identifikasi_tanggal: new Date().toISOString().split('T')[0],
    identifikasi_deskripsi: '',
    identifikasi_akar_penyebab: '',
    identifikasi_indikator: '',
    identifikasi_faktor_positif: '',
    identifikasi_deskripsi_dampak: '',
    penyebab_risiko: '',
    dampak_risiko: '',
    status_risiko: 'Active',
    jenis_risiko: 'Threat',
};

export default function IdentifikasiRisikoPage() {
    const { profile } = useUserProfile();
    const [data, setData] = useState<RiskInput[]>([]);
    const [units, setUnits] = useState<{ id: string; nama_unit: string }[]>([]);
    const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [year, setYear] = useState(String(CURRENT_YEAR));
    const [filterUnit, setFilterUnit] = useState<string>('all');
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState<FormData>(defaultForm);
    const [saving, setSaving] = useState(false);
    const [sasaranOptions, setSasaranOptions] = useState<string[]>([]);

    // Auto-lock unit filter for unit managers
    useEffect(() => {
        if (profile?.role === 'user_unit' && profile.unit_kerja_id) {
            setFilterUnit(profile.unit_kerja_id);
        }
    }, [profile]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('risk_inputs')
                .select('*, master_work_units(name), master_risk_categories(name)')
                .order('created_at', { ascending: false });

            if (year) {
                const yearStart = `${year}-01-01`;
                const yearEnd = `${year}-12-31`;
                query = query.gte('identifikasi_tanggal', yearStart).lte('identifikasi_tanggal', yearEnd);
            }

            // Apply unit filter
            const unitToFilter = profile?.role === 'user_unit' ? profile.unit_kerja_id : (filterUnit === 'all' ? null : filterUnit);
            if (unitToFilter) {
                query = query.eq('nama_unit_kerja_id', unitToFilter);
            }

            const { data: rows, error } = await query;
            if (error) {
                console.error('Error fetching risk data:', error);
                setData([]);
            } else {
                setData((rows as RiskInput[]) ?? []);
            }
        } catch (err) {
            console.error('Error:', err);
            setData([]);
        } finally {
            setLoading(false);
        }
    }, [year, filterUnit, profile]);

    useEffect(() => {
        fetchData();
        supabase.from('master_work_units').select('id, name').then(({ data: u, error }: { data: any; error: any }) => {
            if (error) {
                console.error('Error fetching units:', error);
                return;
            }
            setUnits((u || []).map((item: any) => ({ id: item.id, nama_unit: item.name })));
        });
        supabase.from('master_risk_categories').select('id, name').then(({ data: c, error }: { data: any; error: any }) => {
            if (error) console.error('Error fetching categories:', error);
            setCategories(c ?? []);
        });
    }, [fetchData]);

    // Fetch sasaran strategi from TOWS based on selected unit and year
    // NOTE: risk_inputs uses master_work_units IDs, but swot_tows_strategi uses unit_kerja IDs.
    // We bridge them by matching unit names to find the correct unit_kerja ID.
    useEffect(() => {
        if (!form.nama_unit_kerja_id) {
            setSasaranOptions([]);
            return;
        }
        const fetchSasaran = async () => {
            const formYear = form.identifikasi_tanggal
                ? new Date(form.identifikasi_tanggal).getFullYear()
                : Number(year || CURRENT_YEAR);

            // Step 1: Find the unit name from master_work_units
            const selectedUnit = units.find(u => u.id === form.nama_unit_kerja_id);
            const unitName = selectedUnit?.nama_unit;

            if (!unitName) {
                setSasaranOptions([]);
                return;
            }

            // Step 2: Find the matching unit_kerja ID by name
            const { data: ukData } = await supabase
                .from('unit_kerja')
                .select('id')
                .eq('nama_unit', unitName)
                .limit(1);

            const towsUnitId = ukData && ukData.length > 0 ? ukData[0].id : null;

            if (!towsUnitId) {
                // Fallback: try direct query (in case both tables share same IDs)
                const { data: directData } = await supabase
                    .from('swot_tows_strategi')
                    .select('sasaran_strategi')
                    .eq('unit_kerja_id', form.nama_unit_kerja_id)
                    .eq('tahun', formYear)
                    .not('sasaran_strategi', 'is', null)
                    .neq('sasaran_strategi', '');

                if (directData && directData.length > 0) {
                    const uniqueSasaran = Array.from(
                        new Set((directData as any[]).map((d: any) => d.sasaran_strategi).filter((s: any) => s && s.trim() !== ''))
                    ) as string[];
                    setSasaranOptions(uniqueSasaran);
                } else {
                    setSasaranOptions([]);
                }
                return;
            }

            // Step 3: Query TOWS with the correct unit_kerja ID
            const { data, error } = await supabase
                .from('swot_tows_strategi')
                .select('sasaran_strategi')
                .eq('unit_kerja_id', towsUnitId)
                .eq('tahun', formYear)
                .not('sasaran_strategi', 'is', null)
                .neq('sasaran_strategi', '');

            if (!error && data) {
                const uniqueSasaran = Array.from(
                    new Set((data as any[]).map((d: any) => d.sasaran_strategi).filter((s: any) => s && s.trim() !== ''))
                ) as string[];
                setSasaranOptions(uniqueSasaran);
            } else {
                setSasaranOptions([]);
            }
        };
        fetchSasaran();
    }, [form.nama_unit_kerja_id, form.identifikasi_tanggal, year, units]);

    const filtered = data.filter(d =>
        (d.identifikasi_deskripsi || '').toLowerCase().includes(search.toLowerCase()) ||
        (d.penyebab_risiko || '').toLowerCase().includes(search.toLowerCase()) ||
        (d.kode_risiko || '').toLowerCase().includes(search.toLowerCase())
    );

    const stats = {
        total: data.length,
        active: data.filter(d => d.status_risiko === 'Active').length,
        threat: data.filter(d => d.jenis_risiko === 'Threat').length,
        opportunity: data.filter(d => d.jenis_risiko === 'Opportunity').length,
    };

    const openAdd = () => {
        setEditId(null);
        const newForm = { ...defaultForm };
        // Auto-set unit for unit managers
        if (profile?.role === 'user_unit' && profile.unit_kerja_id) {
            newForm.nama_unit_kerja_id = profile.unit_kerja_id;
        }
        setForm(newForm);
        setShowModal(true);
    };
    const openEdit = (row: RiskInput) => {
        setEditId(row.id);
        setForm({
            kode_risiko: row.kode_risiko || '',
            nama_risiko: row.nama_risiko || '',
            nama_unit_kerja_id: row.nama_unit_kerja_id || '',
            kategori_risiko_id: row.kategori_risiko_id || '',
            sasaran: row.sasaran || '',
            identifikasi_tanggal: row.identifikasi_tanggal || new Date().toISOString().split('T')[0],
            identifikasi_deskripsi: row.identifikasi_deskripsi || '',
            identifikasi_akar_penyebab: row.identifikasi_akar_penyebab || '',
            identifikasi_indikator: row.identifikasi_indikator || '',
            identifikasi_faktor_positif: row.identifikasi_faktor_positif || '',
            identifikasi_deskripsi_dampak: row.identifikasi_deskripsi_dampak || '',
            penyebab_risiko: row.penyebab_risiko || '',
            dampak_risiko: row.dampak_risiko || '',
            status_risiko: row.status_risiko || 'Active',
            jenis_risiko: row.jenis_risiko || 'Threat',
        });
        setShowModal(true);
    };
    const handleDelete = async (row: RiskInput) => {
        if (!confirm(`Hapus risiko "${(row.identifikasi_deskripsi || '').slice(0, 50)}"?`)) return;
        await supabase.from('risk_inputs').delete().eq('id', row.id);
        fetchData();
    };
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            let result;
            if (editId) {
                result = await supabase.from('risk_inputs').update(form).eq('id', editId);
            } else {
                result = await supabase.from('risk_inputs').insert(form);
            }
            if (result.error) {
                console.error('Error saving risk:', result.error);
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

    const columns: Column<RiskInput>[] = [
        { key: 'kode_risiko', label: 'Kode', className: 'w-24' },
        { key: 'nama_risiko', label: 'Nama Risiko', render: r => <span className="font-semibold">{r.nama_risiko || '-'}</span> },
        { key: 'identifikasi_tanggal', label: 'Tanggal', render: r => r.identifikasi_tanggal ? new Date(r.identifikasi_tanggal).toLocaleDateString('id-ID') : '-' },
        { key: 'nama_unit_kerja_id', label: 'Unit Kerja', render: r => r.master_work_units?.name ?? '-' },
        { key: 'sasaran', label: 'Sasaran Strategi', render: r => <span className="line-clamp-2 text-xs">{r.sasaran || '-'}</span> },
        { key: 'identifikasi_deskripsi', label: 'Deskripsi Risiko', render: r => <span className="line-clamp-2">{r.identifikasi_deskripsi || '-'}</span> },
        { key: 'kategori_risiko_id', label: 'Kategori', render: r => r.master_risk_categories?.name ?? '-' },
        { key: 'jenis_risiko', label: 'Jenis', render: r => <span className={r.jenis_risiko === 'Threat' ? 'badge-red' : 'badge-green'}>{r.jenis_risiko || 'Threat'}</span> },
        { key: 'status_risiko', label: 'Status', render: r => <span className={r.status_risiko === 'Active' ? 'badge-green' : 'badge-gray'}>{r.status_risiko || 'Active'}</span> },
    ];

    return (
        <div>
            <PageHeader title="Identifikasi Risiko" subtitle="Daftar risiko yang teridentifikasi per unit kerja dan tahun anggaran." />

            <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
                <ScoreCard icon={<ShieldAlert size={22} className="text-slate-500" />} title="Total Risiko" value={stats.total} colorClass="bg-slate-50 border-slate-100" />
                <ScoreCard icon={<AlertTriangle size={22} className="text-rose-500" />} title="Active" value={stats.active} colorClass="bg-rose-50 border-rose-100" />
                <ScoreCard icon={<AlertTriangle size={22} className="text-amber-500" />} title="Threat" value={stats.threat} colorClass="bg-amber-50 border-amber-100" />
                <ScoreCard icon={<CheckCircle2 size={22} className="text-emerald-500" />} title="Opportunity" value={stats.opportunity} colorClass="bg-emerald-50 border-emerald-100" />
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <TopActionBar
                    filters={
                        <div className="flex flex-wrap items-center gap-3">
                            <FilterBar
                                searchValue={search} onSearchChange={setSearch} searchPlaceholder="Cari risiko..."
                                yearValue={year} onYearChange={setYear}
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
                    actions={
                        <>
                            <button className="btn-secondary"><Download size={15} /><span className="hidden sm:inline">Template</span></button>
                            <button className="btn-secondary"><Upload size={15} /><span className="hidden sm:inline">Import</span></button>
                            <button className="btn-secondary"><FileText size={15} /><span className="hidden sm:inline">Laporan</span></button>
                            <button className="btn-primary" onClick={openAdd}><Plus size={15} /><span>Tambah</span></button>
                        </>
                    }
                />
                <DataTable columns={columns} data={filtered} onEdit={openEdit} onDelete={handleDelete} onView={openEdit} isLoading={loading} />
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <h3 className="text-base font-bold text-slate-800">{editId ? 'Edit' : 'Tambah'} Identifikasi Risiko</h3>
                            <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="form-label">Kode Risiko</label>
                                    <input type="text" className="form-input" placeholder="Misal: RSK-001" value={form.kode_risiko} onChange={e => setForm(f => ({ ...f, kode_risiko: e.target.value }))} required />
                                </div>
                                <div>
                                    <label className="form-label">Nama Risiko</label>
                                    <input type="text" className="form-input" placeholder="Nama risiko..." value={form.nama_risiko} onChange={e => setForm(f => ({ ...f, nama_risiko: e.target.value }))} required />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="form-label">Unit Kerja</label>
                                    {profile?.role === 'user_unit' ? (
                                        <div className="form-input bg-slate-100 text-slate-600 cursor-not-allowed">
                                            {units.find(u => u.id === form.nama_unit_kerja_id)?.nama_unit || 'Unit Kerja Anda'}
                                        </div>
                                    ) : (
                                        <select className="form-input" value={form.nama_unit_kerja_id} onChange={e => setForm(f => ({ ...f, nama_unit_kerja_id: e.target.value }))} required>
                                            <option value="">-- Pilih Unit --</option>
                                            {units.map(u => <option key={u.id} value={u.id}>{u.nama_unit}</option>)}
                                        </select>
                                    )}
                                </div>
                                <div>
                                    <label className="form-label">Kategori Risiko</label>
                                    <select className="form-input" value={form.kategori_risiko_id} onChange={e => setForm(f => ({ ...f, kategori_risiko_id: e.target.value }))}>
                                        <option value="">-- Pilih Kategori --</option>
                                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="form-label">Tanggal Identifikasi</label>
                                    <input type="date" className="form-input" value={form.identifikasi_tanggal} onChange={e => setForm(f => ({ ...f, identifikasi_tanggal: e.target.value }))} required />
                                </div>
                                <div>
                                    <label className="form-label">Jenis Risiko</label>
                                    <select className="form-input" value={form.jenis_risiko} onChange={e => setForm(f => ({ ...f, jenis_risiko: e.target.value }))}>
                                        <option value="Threat">Threat (Ancaman)</option>
                                        <option value="Opportunity">Opportunity (Peluang)</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="form-label">Sasaran Strategi <span className="text-xs text-slate-400 font-normal">(dari TOWS)</span></label>
                                <select
                                    className="form-input"
                                    value={form.sasaran}
                                    onChange={e => setForm(f => ({ ...f, sasaran: e.target.value }))}
                                    disabled={!form.nama_unit_kerja_id}
                                >
                                    <option value="">-- Pilih Sasaran Strategi --</option>
                                    {sasaranOptions.map((s, idx) => (
                                        <option key={idx} value={s}>{s}</option>
                                    ))}
                                </select>
                                {!form.nama_unit_kerja_id && <p className="text-xs text-rose-500 mt-1">Pilih Unit Kerja terlebih dahulu</p>}
                                {form.nama_unit_kerja_id && sasaranOptions.length === 0 && (
                                    <p className="text-xs text-amber-600 mt-1">Belum ada sasaran strategi di TOWS untuk unit & tahun ini</p>
                                )}
                            </div>
                            <FormInputAI label="Deskripsi Risiko" placeholder="Deskripsi risiko secara detail..." value={form.identifikasi_deskripsi} onChange={v => setForm(f => ({ ...f, identifikasi_deskripsi: v }))} />
                            <FormInputAI label="Akar Penyebab" placeholder="Akar penyebab risiko..." value={form.identifikasi_akar_penyebab} onChange={v => setForm(f => ({ ...f, identifikasi_akar_penyebab: v }))} />
                            <FormInputAI label="Penyebab Risiko" placeholder="Penyebab risiko..." value={form.penyebab_risiko} onChange={v => setForm(f => ({ ...f, penyebab_risiko: v }))} />
                            <FormInputAI label="Dampak Risiko" placeholder="Dampak yang mungkin terjadi..." value={form.dampak_risiko} onChange={v => setForm(f => ({ ...f, dampak_risiko: v }))} />
                            <div>
                                <label className="form-label">Status Risiko</label>
                                <select className="form-input" value={form.status_risiko} onChange={e => setForm(f => ({ ...f, status_risiko: e.target.value }))}>
                                    <option value="Active">Active</option>
                                    <option value="Closed">Closed</option>
                                </select>
                            </div>


                            <div className="flex justify-end space-x-2 pt-2">
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
