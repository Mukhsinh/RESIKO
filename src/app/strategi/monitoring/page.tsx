'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { supabase, type ManajemenStrategi, type UnitKerja } from '@/lib/supabase';
import { PageHeader, ScoreCard, FilterBar, TopActionBar } from '@/components/SharedUI';
import DataTable, { type Column } from '@/components/DataTable';
import FormInputAI from '@/components/FormInputAI';
import { Plus, Download, Upload, FileText, TrendingUp, Target, CheckCircle2, Clock, Save, X, Loader2 } from 'lucide-react';

const CURRENT_YEAR = new Date().getFullYear();

function AchievementBadge({ target, realisasi }: { target: string; realisasi: string }) {
    const t = parseFloat(target), r = parseFloat(realisasi);
    if (isNaN(t) || isNaN(r)) return <span className="badge-gray">{realisasi || '-'}</span>;
    const pct = (r / t) * 100;
    if (pct >= 100) return <span className="badge-green">✓ {realisasi} (Tercapai)</span>;
    if (pct >= 80) return <span className="badge-amber">{realisasi} ({pct.toFixed(0)}%)</span>;
    return <span className="badge-red">{realisasi} ({pct.toFixed(0)}%)</span>;
}

interface FormData { tahun: number; unit_kerja_id: string; sasaran_strategis: string; kpi: string; target: string; realisasi: string; cascading_id?: string; }
const defaultForm: FormData = { tahun: CURRENT_YEAR, unit_kerja_id: '', sasaran_strategis: '', kpi: '', target: '', realisasi: '' };

export default function MonitoringKPIPage() {
    const [data, setData] = useState<ManajemenStrategi[]>([]);
    const [units, setUnits] = useState<UnitKerja[]>([]);
    const [cascadingData, setCascadingData] = useState<any[]>([]); // Data from Cascading KPI
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [year, setYear] = useState(String(CURRENT_YEAR));
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState<FormData>(defaultForm);
    const [saving, setSaving] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            let q = supabase.from('manajemen_strategi').select('*, unit_kerja(nama_unit)').order('created_at', { ascending: false });
            if (year) q = q.eq('tahun', Number(year));
            const { data: rows, error } = await q;
            if (error) {
                console.error('Error fetching monitoring data:', error);
                setData([]);
            } else {
                setData((rows as ManajemenStrategi[]) ?? []);
            }
        } catch (err) {
            console.error('Error:', err);
            setData([]);
        } finally {
            setLoading(false);
        }
    }, [year]);

    useEffect(() => {
        fetchData();
        supabase.from('unit_kerja').select('*').then(({ data: u, error }) => {
            if (error) console.error('Error fetching units:', error);
            setUnits(u ?? []);
        });
    }, [fetchData]);

    // Load Cascading KPI when unit and year are selected in form
    useEffect(() => {
        if (!form.unit_kerja_id || !form.tahun) {
            setCascadingData([]);
            return;
        }
        supabase.from('cascading_kpi')
            .select('id, kpi, sasaran_strategis, target')
            .eq('unit_kerja_id', form.unit_kerja_id)
            .eq('tahun', form.tahun)
            .then(({ data: cData }) => {
                setCascadingData(cData ?? []);
            });
    }, [form.unit_kerja_id, form.tahun]);

    // Update target and sasaran automatically when KPI is selected
    const handleSelectKpi = (selectedKpiName: string) => {
        const found = cascadingData.find(c => c.kpi === selectedKpiName);
        if (found) {
            setForm(f => ({ ...f, kpi: found.kpi, sasaran_strategis: found.sasaran_strategis || '', target: found.target || '' }));
        } else {
            setForm(f => ({ ...f, kpi: selectedKpiName }));
        }
    };

    const filtered = data.filter(d =>
        d.sasaran_strategis?.toLowerCase().includes(search.toLowerCase()) ||
        d.kpi?.toLowerCase().includes(search.toLowerCase())
    );

    const achieved = data.filter(d => {
        const t = parseFloat(d.target), r = parseFloat(d.realisasi);
        return !isNaN(t) && !isNaN(r) && r >= t;
    }).length;

    const openAdd = () => { setEditId(null); setForm(defaultForm); setShowModal(true); };
    const openEdit = (row: ManajemenStrategi) => {
        setEditId(row.id);
        setForm({ tahun: row.tahun, unit_kerja_id: row.unit_kerja_id, sasaran_strategis: row.sasaran_strategis, kpi: row.kpi, target: row.target, realisasi: row.realisasi });
        setShowModal(true);
    };
    const handleDelete = async (row: ManajemenStrategi) => {
        if (!confirm(`Hapus monitoring "${row.kpi.slice(0, 50)}"?`)) return;
        await supabase.from('manajemen_strategi').delete().eq('id', row.id);
        fetchData();
    };
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            let result;
            if (editId) {
                result = await supabase.from('manajemen_strategi').update(form).eq('id', editId);
            } else {
                // remove specific local field cascading_id if somehow added
                const { cascading_id, ...payload } = form;
                result = await supabase.from('manajemen_strategi').insert(payload);
            }
            if (result.error) {
                console.error('Error saving monitoring data:', result.error);
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

    const columns: Column<ManajemenStrategi>[] = [
        { key: 'tahun', label: 'Tahun', className: 'w-20' },
        { key: 'unit_kerja_id', label: 'Unit Kerja', render: r => r.unit_kerja?.nama_unit ?? '-' },
        { key: 'sasaran_strategis', label: 'Sasaran Strategis', render: r => <span className="line-clamp-2">{r.sasaran_strategis}</span> },
        { key: 'kpi', label: 'KPI / Indikator' },
        { key: 'target', label: 'Target' },
        { key: 'realisasi', label: 'Realisasi', render: r => <AchievementBadge target={r.target} realisasi={r.realisasi} /> },
    ];

    return (
        <div>
            <PageHeader title="Monitoring KPI" subtitle="Pantau realisasi sasaran strategis dan KPI unit kerja per tahun anggaran." />
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
                <ScoreCard icon={<Target size={22} className="text-[#137fec]" />} title="Total Data Monitoring" value={data.length} colorClass="bg-blue-50 border-blue-100" />
                <ScoreCard icon={<CheckCircle2 size={22} className="text-emerald-500" />} title="KPI Tercapai" value={achieved} colorClass="bg-emerald-50 border-emerald-100" />
                <ScoreCard icon={<Clock size={22} className="text-amber-500" />} title="Dalam Proses / Belum Tercapai" value={data.length - achieved} colorClass="bg-amber-50 border-amber-100" />
                <ScoreCard icon={<TrendingUp size={22} className="text-violet-500" />} title="Tingkat Capaian" value={data.length ? `${Math.round(achieved * 100 / data.length)}%` : '0%'} colorClass="bg-violet-50 border-violet-100" />
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <TopActionBar
                    filters={<FilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Cari sasaran / KPI..." yearValue={year} onYearChange={setYear} />}
                    actions={<>
                        <button className="btn-secondary"><Download size={15} /><span className="hidden sm:inline">Template</span></button>
                        <button className="btn-secondary"><Upload size={15} /><span className="hidden sm:inline">Import</span></button>
                        <button className="btn-secondary"><FileText size={15} /><span className="hidden sm:inline">Laporan</span></button>
                        <button className="btn-primary" onClick={openAdd}><Plus size={15} /><span>Input Realisasi</span></button>
                    </>}
                />
                <DataTable columns={columns} data={filtered} onEdit={openEdit} onDelete={handleDelete} onView={openEdit} isLoading={loading} />
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <h3 className="text-base font-bold text-slate-800">{editId ? 'Edit' : 'Tambah'} Capaian KPI</h3>
                            <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="form-label">Tahun</label>
                                    <input type="number" className="form-input" value={form.tahun} onChange={e => setForm(f => ({ ...f, tahun: Number(e.target.value) }))} required />
                                </div>
                                <div>
                                    <label className="form-label">Unit Kerja</label>
                                    <select className="form-input" value={form.unit_kerja_id} onChange={e => setForm(f => ({ ...f, unit_kerja_id: e.target.value }))} required>
                                        <option value="">-- Pilih Unit --</option>
                                        {units.map(u => <option key={u.id} value={u.id}>{u.nama_unit}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="form-label">KPI / Indikator Kinerja</label>
                                <select
                                    className="form-input"
                                    value={form.kpi}
                                    onChange={e => handleSelectKpi(e.target.value)}
                                    required
                                    disabled={!form.unit_kerja_id || !form.tahun}
                                >
                                    <option value="">-- Pilih KPI yang tersedia --</option>
                                    {cascadingData.map(c => <option key={c.id} value={c.kpi}>{c.kpi}</option>)}
                                </select>
                                {(!form.unit_kerja_id) && <p className="text-xs text-rose-500 mt-1">Pilih Unit Kerja terlebih dahulu agar KPI muncul.</p>}
                            </div>

                            {form.kpi && (
                                <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-3">
                                    <div>
                                        <label className="text-xs font-semibold text-slate-500 block mb-1">Sasaran Strategis</label>
                                        <div className="text-sm font-medium text-slate-800 bg-white p-2 border border-slate-200 rounded-md">
                                            {form.sasaran_strategis || '-'}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-slate-500 block mb-1">Target Berdasarkan Cascading</label>
                                        <div className="text-sm font-medium text-slate-800 bg-white p-2 border border-slate-200 rounded-md">
                                            {form.target || '-'}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="form-label">Input Realisasi Aktual</label>
                                <input type="text" className="form-input font-bold" value={form.realisasi} onChange={e => setForm(f => ({ ...f, realisasi: e.target.value }))} placeholder="Contoh: 85" required />
                            </div>

                            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Batal</button>
                                <button type="submit" className="btn-primary" disabled={saving}>
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
