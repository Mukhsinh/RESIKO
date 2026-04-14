'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { type ManajemenRisiko } from '@/lib/supabase';
import { PageHeader, ScoreCard, FilterBar, TopActionBar } from '@/components/SharedUI';
import DataTable, { type Column } from '@/components/DataTable';
import FormInputAI from '@/components/FormInputAI';
import { Plus, ClipboardList, CheckCircle2, Clock, AlertTriangle, Save, X, Loader2, Download } from 'lucide-react';

const CURRENT_YEAR = new Date().getFullYear();

interface Penanganan {
    id: string;
    manajemen_risiko_id: string;
    unit_kerja_id: string;
    tahun: number;
    jenis_penanganan: string;
    rencana_aksi: string;
    penanggung_jawab: string;
    target_selesai: string;
    status: string;
    progres: number;
    created_at: string;
    risiko?: { identifikasi_risiko: string; skor_risiko: number };
    manajemen_risiko?: { identifikasi_risiko: string; skor_risiko: number };
    unit_kerja?: { nama_unit: string };
}

interface Form {
    manajemen_risiko_id: string; unit_kerja_id: string; tahun: number;
    jenis_penanganan: string; rencana_aksi: string; penanggung_jawab: string;
    target_selesai: string; status: string; progres: number;
}

const defaultForm: Form = {
    manajemen_risiko_id: '', unit_kerja_id: '', tahun: CURRENT_YEAR,
    jenis_penanganan: 'Mitigasi', rencana_aksi: '', penanggung_jawab: '',
    target_selesai: '', status: 'Belum Mulai', progres: 0,
};

const STATUS_COLORS: Record<string, string> = {
    'Selesai': 'badge-green', 'Berjalan': 'badge-blue',
    'Terlambat': 'badge-red', 'Belum Mulai': 'badge-gray',
};

export default function PenangananRisikoPage() {
    const [data, setData] = useState<Penanganan[]>([]);
    const [risikoList, setRisikoList] = useState<ManajemenRisiko[]>([]);
    const [units, setUnits] = useState<{ id: string; nama_unit: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [year, setYear] = useState(String(CURRENT_YEAR));
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState<Form>(defaultForm);
    const [saving, setSaving] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        let query = supabase.from('penanganan_risiko').select('*, unit_kerja(nama_unit), manajemen_risiko(identifikasi_risiko, skor_risiko)');
        if (year) query = query.eq('tahun', Number(year));

        const { data: res } = await query;
        if (res) {
            setData((res as unknown as Penanganan[]).map(d => ({ ...d, risiko: d.manajemen_risiko })) || []);
        }
        setLoading(false);
    }, [year]);

    useEffect(() => {
        fetchData();
        supabase.from('unit_kerja').select('id, nama_unit').then(({ data }) => setUnits(data || []));
        supabase.from('manajemen_risiko').select('*').then(({ data }) => setRisikoList(data || []));
    }, [fetchData]);

    const filtered = data.filter(d =>
        d.rencana_aksi.toLowerCase().includes(search.toLowerCase()) ||
        d.penanggung_jawab.toLowerCase().includes(search.toLowerCase())
    );

    const selesai = data.filter(d => d.status === 'Selesai').length;
    const berjalan = data.filter(d => d.status === 'Berjalan').length;
    const terlambat = data.filter(d => d.status === 'Terlambat').length;

    const openAdd = () => { setEditId(null); setForm(defaultForm); setShowModal(true); };
    const openEdit = (row: Penanganan) => {
        setEditId(row.id);
        setForm({ manajemen_risiko_id: row.manajemen_risiko_id, unit_kerja_id: row.unit_kerja_id, tahun: row.tahun, jenis_penanganan: row.jenis_penanganan, rencana_aksi: row.rencana_aksi, penanggung_jawab: row.penanggung_jawab, target_selesai: row.target_selesai ?? '', status: row.status, progres: row.progres });
        setShowModal(true);
    };
    const handleDelete = async (row: Penanganan) => {
        if (!confirm('Hapus rencana penanganan ini?')) return;
        await supabase.from('penanganan_risiko').delete().eq('id', row.id);
        fetchData();
    };
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault(); setSaving(true);
        const { ...payload } = form;
        if (editId) { await supabase.from('penanganan_risiko').update(payload).eq('id', editId); }
        else { await supabase.from('penanganan_risiko').insert(payload); }
        setSaving(false); setShowModal(false); fetchData();
    };

    const columns: Column<Penanganan>[] = [
        { key: 'risiko', label: 'Risiko', render: r => <span className="line-clamp-2 text-xs">{r.risiko?.identifikasi_risiko ?? '-'}</span> },
        { key: 'unit_kerja_id', label: 'Unit', render: r => r.unit_kerja?.nama_unit ?? '-' },
        { key: 'jenis_penanganan', label: 'Jenis', className: 'text-center' },
        { key: 'rencana_aksi', label: 'Rencana Aksi', render: r => <span className="line-clamp-2">{r.rencana_aksi}</span> },
        { key: 'penanggung_jawab', label: 'PJ' },
        { key: 'target_selesai', label: 'Target', render: r => r.target_selesai ? new Date(r.target_selesai).toLocaleDateString('id-ID') : '-' },
        {
            key: 'progres', label: 'Progres', render: r => (
                <div className="flex items-center gap-2">
                    <div className="flex-1 bg-slate-100 rounded-full h-1.5 min-w-[60px]">
                        <div className="bg-[#137fec] h-1.5 rounded-full" style={{ width: `${r.progres}%` }} />
                    </div>
                    <span className="text-xs text-slate-500 shrink-0">{r.progres}%</span>
                </div>
            )
        },
        { key: 'status', label: 'Status', render: r => <span className={STATUS_COLORS[r.status] ?? 'badge-gray'}>{r.status}</span> },
    ];

    return (
        <div>
            <PageHeader title="Penanganan Risiko" subtitle="Rencana aksi dan mitigasi untuk setiap risiko yang teridentifikasi." />

            <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
                <ScoreCard icon={<ClipboardList size={22} className="text-[#137fec]" />} title="Total Rencana" value={data.length} colorClass="bg-blue-50 border-blue-100" />
                <ScoreCard icon={<CheckCircle2 size={22} className="text-emerald-500" />} title="Selesai" value={selesai} colorClass="bg-emerald-50 border-emerald-100" />
                <ScoreCard icon={<Clock size={22} className="text-amber-500" />} title="Berjalan" value={berjalan} colorClass="bg-amber-50 border-amber-100" />
                <ScoreCard icon={<AlertTriangle size={22} className="text-rose-500" />} title="Terlambat" value={terlambat} colorClass="bg-rose-50 border-rose-100" />
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <TopActionBar
                    filters={<FilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Cari rencana aksi / PJ..." yearValue={year} onYearChange={setYear} />}
                    actions={<>
                        <button className="btn-secondary"><Download size={15} /><span className="hidden sm:inline">Export</span></button>
                        <button className="btn-primary" onClick={openAdd}><Plus size={15} /><span>Tambah</span></button>
                    </>}
                />
                <DataTable columns={columns} data={filtered} onEdit={openEdit} onDelete={handleDelete} onView={openEdit} isLoading={loading} />
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <h3 className="text-base font-bold text-slate-800">{editId ? 'Edit' : 'Tambah'} Penanganan Risiko</h3>
                            <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="form-label">Risiko Terkait</label>
                                    <select className="form-input" value={form.manajemen_risiko_id} onChange={e => setForm(f => ({ ...f, manajemen_risiko_id: e.target.value }))} required>
                                        <option value="">-- Pilih Risiko --</option>
                                        {risikoList.map(r => <option key={r.id} value={r.id}>{r.identifikasi_risiko.slice(0, 60)}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="form-label">Unit Kerja</label>
                                    <select className="form-input" value={form.unit_kerja_id} onChange={e => setForm(f => ({ ...f, unit_kerja_id: e.target.value }))} required>
                                        <option value="">-- Pilih Unit --</option>
                                        {units.map(u => <option key={u.id} value={u.id}>{u.nama_unit}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="form-label">Tahun</label>
                                    <input type="number" className="form-input" value={form.tahun} onChange={e => setForm(f => ({ ...f, tahun: Number(e.target.value) }))} required />
                                </div>
                                <div>
                                    <label className="form-label">Jenis</label>
                                    <select className="form-input" value={form.jenis_penanganan} onChange={e => setForm(f => ({ ...f, jenis_penanganan: e.target.value }))}>
                                        <option>Mitigasi</option><option>Transfer</option><option>Toleransi</option><option>Eliminasi</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="form-label">Target Selesai</label>
                                    <input type="date" className="form-input" value={form.target_selesai} onChange={e => setForm(f => ({ ...f, target_selesai: e.target.value }))} />
                                </div>
                            </div>
                            <FormInputAI label="Rencana Aksi / Tindakan" placeholder="Langkah-langkah penanganan risiko secara konkret..." value={form.rencana_aksi} onChange={v => setForm(f => ({ ...f, rencana_aksi: v }))} />
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="form-label">Penanggung Jawab</label>
                                    <input type="text" className="form-input" value={form.penanggung_jawab} onChange={e => setForm(f => ({ ...f, penanggung_jawab: e.target.value }))} />
                                </div>
                                <div>
                                    <label className="form-label">Status</label>
                                    <select className="form-input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                                        <option>Belum Mulai</option><option>Berjalan</option><option>Selesai</option><option>Terlambat</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="form-label">Progres (%)</label>
                                    <input type="number" min="0" max="100" className="form-input" value={form.progres} onChange={e => setForm(f => ({ ...f, progres: Number(e.target.value) }))} />
                                </div>
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
