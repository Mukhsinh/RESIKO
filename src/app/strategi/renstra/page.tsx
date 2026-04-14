'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader, ScoreCard, FilterBar, TopActionBar } from '@/components/SharedUI';
import DataTable, { type Column } from '@/components/DataTable';
import FormInputAI from '@/components/FormInputAI';
import { Plus, Download, FileText, Map, Target, Calendar, BookOpen, Save, X, Loader2, Upload, ListChecks } from 'lucide-react';

const CURRENT_YEAR = new Date().getFullYear();

interface MisiOption {
    id: string;
    nomor: number;
    isi_misi: string;
    visi_misi_id: string;
    tahun?: number;
}

interface Renstra {
    id: string;
    kode: string;
    nama_rencana: string;
    deskripsi?: string;
    periode_mulai?: string;
    periode_selesai?: string;
    target?: string;
    indikator_kinerja?: string;
    status?: string;
    misi_id?: string;
    created_at: string;
    misi_items?: MisiOption;
}

interface Form {
    kode: string;
    nama_rencana: string;
    deskripsi: string;
    periode_mulai: string;
    periode_selesai: string;
    target: string;
    indikator_kinerja: string;
    status: string;
    misi_id: string;
}

const defaultForm: Form = {
    kode: '',
    nama_rencana: '',
    deskripsi: '',
    periode_mulai: `${CURRENT_YEAR}-01-01`,
    periode_selesai: `${CURRENT_YEAR + 4}-12-31`,
    target: '',
    indikator_kinerja: '',
    status: 'Draft',
    misi_id: '',
};

export default function RenstraPage() {
    const [data, setData] = useState<Renstra[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState<Form>(defaultForm);
    const [saving, setSaving] = useState(false);
    const [misiOptions, setMisiOptions] = useState<MisiOption[]>([]);
    const [loadingMisi, setLoadingMisi] = useState(false);

    // Fetch available misi options from misi_items joined with visi_misi
    const fetchMisiOptions = useCallback(async () => {
        setLoadingMisi(true);
        try {
            const { data: rows, error } = await supabase
                .from('misi_items')
                .select('id, nomor, isi_misi, visi_misi_id, visi_misi(tahun)')
                .order('visi_misi_id', { ascending: true })
                .order('nomor', { ascending: true });

            if (!error && rows) {
                const mapped = rows.map((r: Record<string, unknown>) => ({
                    id: r.id as string,
                    nomor: r.nomor as number,
                    isi_misi: r.isi_misi as string,
                    visi_misi_id: r.visi_misi_id as string,
                    tahun: (r.visi_misi as Record<string, unknown> | null)?.tahun as number | undefined,
                }));
                setMisiOptions(mapped);
            } else {
                setMisiOptions([]);
            }
        } catch {
            setMisiOptions([]);
        } finally {
            setLoadingMisi(false);
        }
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const { data: rows, error } = await supabase
                .from('rencana_strategis')
                .select('*, misi_items(id, nomor, isi_misi)')
                .order('created_at', { ascending: false });
            if (error) {
                console.error('Error fetching renstra:', error);
                setData([]);
            } else {
                setData((rows as Renstra[]) ?? []);
            }
        } catch (err) {
            console.error('Error:', err);
            setData([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        fetchMisiOptions();
    }, [fetchData, fetchMisiOptions]);

    const filtered = data.filter(d =>
        (d.nama_rencana || '').toLowerCase().includes(search.toLowerCase()) ||
        (d.kode || '').toLowerCase().includes(search.toLowerCase()) ||
        (d.deskripsi || '').toLowerCase().includes(search.toLowerCase())
    );

    const openAdd = () => { setEditId(null); setForm(defaultForm); setShowModal(true); };
    const openEdit = (row: Renstra) => {
        setEditId(row.id);
        setForm({
            kode: row.kode,
            nama_rencana: row.nama_rencana,
            deskripsi: row.deskripsi || '',
            periode_mulai: row.periode_mulai || '',
            periode_selesai: row.periode_selesai || '',
            target: row.target || '',
            indikator_kinerja: row.indikator_kinerja || '',
            status: row.status || 'Draft',
            misi_id: row.misi_id || '',
        });
        setShowModal(true);
    };
    const handleDelete = async (row: Renstra) => {
        if (!confirm(`Hapus renstra "${row.nama_rencana.slice(0, 50)}"?`)) return;
        await supabase.from('rencana_strategis').delete().eq('id', row.id);
        fetchData();
    };
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = {
                kode: form.kode,
                nama_rencana: form.nama_rencana,
                deskripsi: form.deskripsi,
                periode_mulai: form.periode_mulai,
                periode_selesai: form.periode_selesai,
                target: form.target,
                indikator_kinerja: form.indikator_kinerja,
                status: form.status,
                misi_id: form.misi_id || null,
            };
            let result;
            if (editId) {
                result = await supabase.from('rencana_strategis').update(payload).eq('id', editId);
            } else {
                result = await supabase.from('rencana_strategis').insert(payload);
            }
            if (result.error) {
                console.error('Error saving renstra:', result.error);
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

    const getMisiLabel = (row: Renstra) => {
        if (row.misi_items) {
            return `Misi ${row.misi_items.nomor}: ${row.misi_items.isi_misi.slice(0, 50)}${row.misi_items.isi_misi.length > 50 ? '...' : ''}`;
        }
        if (row.misi_id) {
            const found = misiOptions.find(m => m.id === row.misi_id);
            if (found) return `Misi ${found.nomor}: ${found.isi_misi.slice(0, 50)}...`;
        }
        return null;
    };

    const columns: Column<Renstra>[] = [
        { key: 'kode', label: 'Kode', className: 'w-24' },
        {
            key: 'nama_rencana', label: 'Nama Rencana', render: r => (
                <div>
                    <span className="line-clamp-2 font-medium">{r.nama_rencana}</span>
                    {getMisiLabel(r) && (
                        <span className="mt-1 block text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full w-fit">
                            {getMisiLabel(r)}
                        </span>
                    )}
                </div>
            )
        },
        {
            key: 'periode_mulai', label: 'Periode', render: r => {
                if (!r.periode_mulai || !r.periode_selesai) return '-';
                const start = new Date(r.periode_mulai).getFullYear();
                const end = new Date(r.periode_selesai).getFullYear();
                return `${start}–${end}`;
            }
        },
        {
            key: 'status', label: 'Status', render: r => {
                const colors: Record<string, string> = {
                    'Draft': 'badge-gray',
                    'Aktif': 'badge-green',
                    'Selesai': 'badge-blue'
                };
                return <span className={colors[r.status || 'Draft'] || 'badge-gray'}>{r.status || 'Draft'}</span>;
            }
        },
        { key: 'created_at', label: 'Dibuat', render: r => new Date(r.created_at).toLocaleDateString('id-ID') },
    ];

    // Group misi options by year for the dropdown display
    const misiByYear = misiOptions.reduce<Record<number, MisiOption[]>>((acc, m) => {
        const yr = m.tahun ?? 0;
        if (!acc[yr]) acc[yr] = [];
        acc[yr].push(m);
        return acc;
    }, {});

    return (
        <div>
            <PageHeader title="Rencana Strategis (Renstra)" subtitle="Dokumen rencana strategis 5 tahunan unit kerja rumah sakit." />

            <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
                <ScoreCard icon={<Map size={22} className="text-[#137fec]" />} title="Total Renstra" value={data.length} colorClass="bg-blue-50 border-blue-100" />
                <ScoreCard icon={<Target size={22} className="text-emerald-500" />} title="Aktif" value={data.filter(d => d.status === 'Aktif').length} colorClass="bg-emerald-50 border-emerald-100" />
                <ScoreCard icon={<Calendar size={22} className="text-amber-500" />} title="Draft" value={data.filter(d => d.status === 'Draft').length} colorClass="bg-amber-50 border-amber-100" />
                <ScoreCard icon={<BookOpen size={22} className="text-violet-500" />} title="Selesai" value={data.filter(d => d.status === 'Selesai').length} colorClass="bg-violet-50 border-violet-100" />
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <TopActionBar
                    filters={<FilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Cari program / renstra..." />}
                    actions={<>
                        <button className="btn-secondary"><Download size={15} /><span className="hidden sm:inline">Template</span></button>
                        <button className="btn-secondary"><Upload size={15} /><span className="hidden sm:inline">Import</span></button>
                        <button className="btn-secondary"><FileText size={15} /><span className="hidden sm:inline">Export</span></button>
                        <button className="btn-primary" onClick={openAdd}><Plus size={15} /><span>Tambah</span></button>
                    </>}
                />
                <DataTable columns={columns} data={filtered} onEdit={openEdit} onDelete={handleDelete} onView={openEdit} isLoading={loading} />
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <h3 className="text-base font-bold text-slate-800">{editId ? 'Edit' : 'Tambah'} Rencana Strategis</h3>
                            <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">

                            {/* Misi Dropdown - paling atas */}
                            <div>
                                <label className="form-label flex items-center gap-1.5">
                                    <ListChecks size={14} className="text-emerald-500" />
                                    Pilih Misi Yang Dituju
                                </label>
                                {loadingMisi ? (
                                    <div className="form-input flex items-center gap-2 text-slate-400">
                                        <Loader2 size={14} className="animate-spin" />
                                        <span className="text-sm">Memuat misi...</span>
                                    </div>
                                ) : (
                                    <select
                                        className="form-input"
                                        value={form.misi_id}
                                        onChange={e => setForm(f => ({ ...f, misi_id: e.target.value }))}
                                    >
                                        <option value="">— Pilih misi (opsional) —</option>
                                        {Object.entries(misiByYear)
                                            .sort(([a], [b]) => Number(b) - Number(a))
                                            .map(([yr, items]) => (
                                                <optgroup key={yr} label={`Tahun ${yr === '0' ? 'Tidak diketahui' : yr}`}>
                                                    {items.map(m => (
                                                        <option key={m.id} value={m.id}>
                                                            Misi {m.nomor}: {m.isi_misi.length > 80 ? m.isi_misi.slice(0, 80) + '...' : m.isi_misi}
                                                        </option>
                                                    ))}
                                                </optgroup>
                                            ))
                                        }
                                    </select>
                                )}
                                {misiOptions.length === 0 && !loadingMisi && (
                                    <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                                        <span>⚠️</span> Belum ada misi. Tambahkan misi di halaman <strong>Visi &amp; Misi</strong> terlebih dahulu.
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="form-label">Kode Rencana</label>
                                <input type="text" className="form-input" value={form.kode} onChange={e => setForm(f => ({ ...f, kode: e.target.value }))} placeholder="Contoh: RENSTRA-2025" required />
                            </div>
                            <FormInputAI label="Nama Rencana Strategis" placeholder="Nama rencana strategis..." value={form.nama_rencana} onChange={v => setForm(f => ({ ...f, nama_rencana: v }))} />
                            <FormInputAI label="Deskripsi" placeholder="Deskripsi rencana strategis..." value={form.deskripsi} onChange={v => setForm(f => ({ ...f, deskripsi: v }))} />
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="form-label">Periode Mulai</label>
                                    <input type="date" className="form-input" value={form.periode_mulai} onChange={e => setForm(f => ({ ...f, periode_mulai: e.target.value }))} />
                                </div>
                                <div>
                                    <label className="form-label">Periode Selesai</label>
                                    <input type="date" className="form-input" value={form.periode_selesai} onChange={e => setForm(f => ({ ...f, periode_selesai: e.target.value }))} />
                                </div>
                            </div>
                            <FormInputAI label="Target" placeholder="Target yang ingin dicapai..." value={form.target} onChange={v => setForm(f => ({ ...f, target: v }))} />
                            <FormInputAI label="Indikator Kinerja" placeholder="Indikator kinerja untuk mengukur pencapaian..." value={form.indikator_kinerja} onChange={v => setForm(f => ({ ...f, indikator_kinerja: v }))} />
                            <div>
                                <label className="form-label">Status</label>
                                <select className="form-input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                                    <option value="Draft">Draft</option>
                                    <option value="Aktif">Aktif</option>
                                    <option value="Selesai">Selesai</option>
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
