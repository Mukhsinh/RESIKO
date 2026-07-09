'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader, ScoreCard, FilterBar, TopActionBar } from '@/components/SharedUI';
import DataTable, { type Column } from '@/components/DataTable';
import {
    Plus, Download, FileText, AlertTriangle, ShieldAlert, CheckCircle2,
    Eye, Edit, Trash2, X, Save, Loader2, DollarSign
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';

/* ─── Types ─── */
interface LossEvent {
    id: string;
    unit_kerja_id?: string;
    risk_input_id?: string;
    kri_id?: string;
    tahun: number;
    tanggal_kejadian: string;
    judul_kejadian: string;
    deskripsi_kejadian?: string;
    penyebab?: string;
    dampak_finansial?: number;
    skala_dampak?: number;
    kategori?: string;
    tindak_lanjut?: string;
    penanggung_jawab?: string;
    status?: string;
    dokumen_pendukung?: string;
    created_at: string;
    unit_kerja?: { id: string; nama_unit: string };
    risk_inputs?: { id: string; nama_risiko?: string; kode_risiko?: string };
    key_risk_indicators?: { id: string; nama_kri: string };
}

interface WorkUnit { id: string; nama_unit: string; }
interface RiskInput { id: string; nama_risiko?: string; kode_risiko?: string; }
interface KRIItem { id: string; nama_kri: string; }

/* ─── Empty Form ─── */
const EMPTY_FORM = {
    unit_kerja_id: '',
    risk_input_id: '',
    kri_id: '',
    tanggal_kejadian: new Date().toISOString().split('T')[0],
    judul_kejadian: '',
    deskripsi_kejadian: '',
    penyebab: '',
    dampak_finansial: 0,
    skala_dampak: 3,
    kategori: 'Operasional',
    tindak_lanjut: '',
    penanggung_jawab: '',
    status: 'Investigasi',
    dokumen_pendukung: '',
};

const KATEGORI_LIST = ['Operasional', 'Klinis', 'Finansial', 'Reputasi', 'Kepatuhan', 'SDM', 'Teknologi'];
const STATUS_LIST = ['Investigasi', 'Penanganan', 'Penelusuran', 'Terselesaikan', 'Closed'];

/* ─── Modal ─── */
function LossEventModal({ row, onClose, onSave, units, riskInputs, kriList, saving }: {
    row: Partial<typeof EMPTY_FORM> & { _id?: string } | null;
    onClose: () => void;
    onSave: (data: typeof EMPTY_FORM) => void;
    units: WorkUnit[];
    riskInputs: RiskInput[];
    kriList: KRIItem[];
    saving: boolean;
}) {
    const [form, setForm] = useState({ ...EMPTY_FORM, ...(row ?? {}) });
    const f = (k: keyof typeof form, v: string | number) => setForm(prev => ({ ...prev, [k]: v }));

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">
                <div className="flex justify-between items-center p-6 border-b border-slate-100">
                    <div>
                        <h2 className="font-bold text-slate-800 text-lg">{row?._id ? 'Edit Loss Event' : 'Catat Loss Event Baru'}</h2>
                        <p className="text-xs text-slate-500 mt-0.5">Pencatatan kejadian risiko yang benar-benar terjadi</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"><X size={18} /></button>
                </div>

                <div className="p-6 space-y-5 text-sm">
                    {/* Unit & Tanggal */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="form-label">Unit Kerja *</label>
                            <select className="form-input w-full" value={form.unit_kerja_id} onChange={e => f('unit_kerja_id', e.target.value)} required>
                                <option value="">-- Pilih Unit --</option>
                                {units.map(u => <option key={u.id} value={u.id}>{u.nama_unit}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="form-label">Tanggal Kejadian *</label>
                            <input type="date" className="form-input w-full" value={form.tanggal_kejadian} onChange={e => f('tanggal_kejadian', e.target.value)} required />
                        </div>
                    </div>

                    {/* Risiko & KRI */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="form-label">Risiko Terkait</label>
                            <select className="form-input w-full" value={form.risk_input_id} onChange={e => f('risk_input_id', e.target.value)}>
                                <option value="">-- Pilih Risiko --</option>
                                {riskInputs.map(r => (
                                    <option key={r.id} value={r.id}>
                                        {r.kode_risiko ? `[${r.kode_risiko}] ` : ''}{r.nama_risiko || 'Tanpa Nama'}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="form-label">KRI Terkait</label>
                            <select className="form-input w-full" value={form.kri_id} onChange={e => f('kri_id', e.target.value)}>
                                <option value="">-- Pilih KRI --</option>
                                {kriList.map(k => <option key={k.id} value={k.id}>{k.nama_kri}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Judul */}
                    <div>
                        <label className="form-label">Judul Kejadian *</label>
                        <input type="text" className="form-input w-full" value={form.judul_kejadian} onChange={e => f('judul_kejadian', e.target.value)} placeholder="Judul singkat deskripsi kejadian..." required />
                    </div>

                    {/* Deskripsi */}
                    <div>
                        <label className="form-label">Deskripsi Kejadian</label>
                        <textarea className="form-input w-full h-20 resize-none" value={form.deskripsi_kejadian} onChange={e => f('deskripsi_kejadian', e.target.value)} placeholder="Uraian lengkap kejadian yang dialami..." />
                    </div>

                    {/* Penyebab */}
                    <div>
                        <label className="form-label">Penyebab / Akar Masalah</label>
                        <textarea className="form-input w-full h-16 resize-none" value={form.penyebab} onChange={e => f('penyebab', e.target.value)} placeholder="Faktor-faktor yang menyebabkan kejadian ini..." />
                    </div>

                    {/* Dampak & Skala */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="form-label">Dampak Finansial (Rp)</label>
                            <input type="number" className="form-input w-full" value={form.dampak_finansial} onChange={e => f('dampak_finansial', Number(e.target.value))} placeholder="e.g. 5000000" />
                            <p className="text-xs text-slate-400 mt-1">{form.dampak_finansial > 0 ? `Rp ${(form.dampak_finansial / 1_000_000).toFixed(1)} Juta` : 'Masukkan nominal'}</p>
                        </div>
                        <div>
                            <label className="form-label">Skala Dampak (1–5)</label>
                            <select className="form-input w-full" value={form.skala_dampak} onChange={e => f('skala_dampak', Number(e.target.value))}>
                                {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} – {['Tidak Signifikan', 'Minor', 'Sedang', 'Mayor', 'Katastropik'][n - 1]}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Kategori & Status */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="form-label">Kategori Kejadian</label>
                            <select className="form-input w-full" value={form.kategori} onChange={e => f('kategori', e.target.value)}>
                                {KATEGORI_LIST.map(k => <option key={k}>{k}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="form-label">Status Tindak Lanjut</label>
                            <select className="form-input w-full" value={form.status} onChange={e => f('status', e.target.value)}>
                                {STATUS_LIST.map(s => <option key={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Tindak Lanjut & PJ */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="form-label">Tindak Lanjut</label>
                            <textarea className="form-input w-full h-16 resize-none" value={form.tindak_lanjut} onChange={e => f('tindak_lanjut', e.target.value)} placeholder="Langkah penanganan yang sudah/akan dilakukan..." />
                        </div>
                        <div>
                            <label className="form-label">Penanggung Jawab</label>
                            <input type="text" className="form-input w-full" value={form.penanggung_jawab} onChange={e => f('penanggung_jawab', e.target.value)} placeholder="Nama / jabatan PJ..." />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3 px-6 pb-6">
                    <button onClick={onClose} className="btn-secondary">Batal</button>
                    <button onClick={() => onSave(form)} className="btn-primary flex items-center gap-2" disabled={saving || !form.judul_kejadian || !form.tanggal_kejadian}>
                        {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                        Simpan Event
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─── View Modal ─── */
function ViewModal({ row, onClose }: { row: LossEvent; onClose: () => void }) {
    const STATUS_COLOR: Record<string, string> = {
        'Investigasi': 'bg-rose-100 text-rose-700',
        'Penanganan': 'bg-amber-100 text-amber-700',
        'Penelusuran': 'bg-blue-100 text-blue-700',
        'Terselesaikan': 'bg-emerald-100 text-emerald-700',
        'Closed': 'bg-slate-100 text-slate-600',
    };
    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">
                <div className="flex justify-between items-center p-6 border-b border-slate-100">
                    <h2 className="font-bold text-slate-800 text-lg">Detail Loss Event</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"><X size={18} /></button>
                </div>
                <div className="p-6 space-y-4 text-sm">
                    <div className="grid grid-cols-2 gap-4">
                        <div><span className="text-xs text-slate-400">Unit Kerja</span><p className="font-semibold mt-0.5">{row.unit_kerja?.nama_unit ?? '-'}</p></div>
                        <div><span className="text-xs text-slate-400">Tanggal</span><p className="font-semibold mt-0.5">{new Date(row.tanggal_kejadian).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</p></div>
                        <div><span className="text-xs text-slate-400">Kategori</span><p className="font-semibold mt-0.5">{row.kategori ?? '-'}</p></div>
                        <div><span className="text-xs text-slate-400">Skala Dampak</span><p className="font-bold text-rose-600 mt-0.5 text-lg">{row.skala_dampak ?? '-'}/5</p></div>
                    </div>
                    <div><span className="text-xs text-slate-400">Judul Kejadian</span><p className="font-semibold mt-0.5 text-base leading-snug">{row.judul_kejadian}</p></div>
                    {row.deskripsi_kejadian && <div><span className="text-xs text-slate-400">Deskripsi</span><p className="mt-0.5 text-slate-600 leading-relaxed">{row.deskripsi_kejadian}</p></div>}
                    {row.penyebab && <div><span className="text-xs text-slate-400">Penyebab</span><p className="mt-0.5 text-slate-600 leading-relaxed">{row.penyebab}</p></div>}
                    <div className="bg-rose-50 rounded-xl p-4 flex items-center gap-4">
                        <DollarSign size={24} className="text-rose-500" />
                        <div>
                            <p className="text-xs text-slate-500">Estimasi Dampak Finansial</p>
                            <p className="text-xl font-bold text-rose-600">Rp {((row.dampak_finansial ?? 0) / 1_000_000).toFixed(1)} Juta</p>
                        </div>
                    </div>
                    {row.tindak_lanjut && <div><span className="text-xs text-slate-400">Tindak Lanjut</span><p className="mt-0.5 text-slate-600">{row.tindak_lanjut}</p></div>}
                    {row.penanggung_jawab && <div><span className="text-xs text-slate-400">Penanggung Jawab</span><p className="font-medium mt-0.5">{row.penanggung_jawab}</p></div>}
                    <div>
                        <span className="text-xs text-slate-400">Status</span>
                        <span className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLOR[row.status ?? ''] ?? 'bg-slate-100 text-slate-600'}`}>{row.status}</span>
                    </div>
                </div>
                <div className="flex justify-end px-6 pb-6"><button onClick={onClose} className="btn-secondary">Tutup</button></div>
            </div>
        </div>
    );
}

/* ─── Main Page ─── */
export default function LossEventPage() {
    const [rows, setRows] = useState<LossEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState('');
    const [year, setYear] = useState(String(new Date().getFullYear()));
    const [unitFilter, setUnitFilter] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editRow, setEditRow] = useState<Partial<typeof EMPTY_FORM> & { _id?: string } | null>(null);
    const [viewRow, setViewRow] = useState<LossEvent | null>(null);
    const [units, setUnits] = useState<WorkUnit[]>([]);
    const [riskInputs, setRiskInputs] = useState<RiskInput[]>([]);
    const [kriList, setKriList] = useState<KRIItem[]>([]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            let q = supabase
                .from('loss_events')
                .select('*, unit_kerja(id, nama_unit), risk_inputs(id, nama_risiko, kode_risiko), key_risk_indicators(id, nama_kri)')
                .order('tanggal_kejadian', { ascending: false });
            if (year) q = q.eq('tahun', Number(year));
            const { data, error } = await q;
            if (error) { console.error('Error fetching loss events:', error); setRows([]); }
            else setRows((data as LossEvent[]) ?? []);
        } catch (e) { console.error(e); setRows([]); }
        finally { setLoading(false); }
    }, [year]);

    useEffect(() => { fetchData(); }, [fetchData]);

    useEffect(() => {
        supabase.from('unit_kerja').select('id, nama_unit').then(({ data }: { data: any }) => setUnits((data ?? []) as WorkUnit[]));
        supabase.from('risk_inputs').select('id, nama_risiko, kode_risiko').then(({ data }: { data: any }) => setRiskInputs((data ?? []) as RiskInput[]));
        supabase.from('key_risk_indicators').select('id, nama_kri').then(({ data }: { data: any }) => setKriList((data ?? []) as KRIItem[]));
    }, []);

    const filtered = rows.filter(d => {
        const matchSearch = (d.judul_kejadian || '').toLowerCase().includes(search.toLowerCase()) ||
            (d.deskripsi_kejadian || '').toLowerCase().includes(search.toLowerCase());
        const matchUnit = unitFilter ? d.unit_kerja_id === unitFilter : true;
        return matchSearch && matchUnit;
    });

    const stats = {
        total: filtered.length,
        tinggi: filtered.filter(d => (d.skala_dampak ?? 0) >= 4).length,
        sedang: filtered.filter(d => (d.skala_dampak ?? 0) === 3).length,
        rendah: filtered.filter(d => (d.skala_dampak ?? 0) < 3).length,
    };

    const chartData = units.map(unit => {
        const unitRows = filtered.filter(r => r.unit_kerja_id === unit.id);
        return {
            name: unit.nama_unit.replace('Unit ', ''),
            'Kejadian Tercatat': unitRows.length,
            'Potensi Kerugian (Juta)': unitRows.reduce((s, r) => s + (r.dampak_finansial ?? 0), 0) / 1_000_000,
        };
    });

    const handleSave = async (form: typeof EMPTY_FORM) => {
        setSaving(true);
        try {
            const tahun = new Date(form.tanggal_kejadian).getFullYear();
            const payload = {
                unit_kerja_id: form.unit_kerja_id || null,
                risk_input_id: form.risk_input_id || null,
                kri_id: form.kri_id || null,
                tahun,
                tanggal_kejadian: form.tanggal_kejadian,
                judul_kejadian: form.judul_kejadian,
                deskripsi_kejadian: form.deskripsi_kejadian || null,
                penyebab: form.penyebab || null,
                dampak_finansial: Number(form.dampak_finansial),
                skala_dampak: Number(form.skala_dampak),
                kategori: form.kategori,
                tindak_lanjut: form.tindak_lanjut || null,
                penanggung_jawab: form.penanggung_jawab || null,
                status: form.status,
                updated_at: new Date().toISOString(),
            };
            let error;
            if (editRow?._id) {
                ({ error } = await supabase.from('loss_events').update(payload).eq('id', editRow._id));
            } else {
                ({ error } = await supabase.from('loss_events').insert(payload));
            }
            if (error) { console.error(error); alert('Gagal menyimpan: ' + error.message); }
            else { setShowModal(false); setEditRow(null); fetchData(); }
        } catch (e) { console.error(e); }
        finally { setSaving(false); }
    };

    const handleDelete = async (row: LossEvent) => {
        if (!confirm(`Hapus event "${row.judul_kejadian}"?`)) return;
        const { error } = await supabase.from('loss_events').delete().eq('id', row.id);
        if (error) alert('Gagal menghapus: ' + error.message);
        else fetchData();
    };

    const STATUS_COLOR: Record<string, string> = {
        'Investigasi': 'badge-red', 'Penanganan': 'badge-amber',
        'Penelusuran': 'badge-blue', 'Terselesaikan': 'badge-green', 'Closed': 'badge-gray',
    };

    const columns: Column<LossEvent>[] = [
        { key: 'tahun', label: 'Tahun', className: 'w-20' },
        { key: 'unit_kerja_id', label: 'Unit Kerja', render: r => (r as any).unit_kerja?.nama_unit ?? '-' },
        {
            key: 'judul_kejadian', label: 'Kejadian (Event)', className: 'max-w-xs',
            render: r => <span className="line-clamp-2">{r.judul_kejadian}</span>
        },
        { key: 'skala_dampak', label: 'Skala Dampak', className: 'text-center', render: r => `${r.skala_dampak ?? '-'}/5` },
        {
            key: 'dampak_finansial', label: 'Valuasi (Estimasi)', className: 'text-right font-medium',
            render: r => `Rp ${((r.dampak_finansial ?? 0) / 1_000_000).toFixed(1)} Jt`
        },
        {
            key: 'status', label: 'Tindak Lanjut',
            render: r => <span className={STATUS_COLOR[r.status ?? ''] ?? 'badge-gray'}>{r.status ?? '-'}</span>
        },
        {
            key: 'actions', label: 'Aksi', render: r => (
                <div className="flex gap-1 justify-center">
                    <button title="Lihat" className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded" onClick={() => setViewRow(r)}><Eye size={15} /></button>
                    <button title="Edit" className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded" onClick={() => {
                        setEditRow({ ...EMPTY_FORM, ...r, tanggal_kejadian: r.tanggal_kejadian?.split('T')[0] ?? EMPTY_FORM.tanggal_kejadian, _id: r.id });
                        setShowModal(true);
                    }}><Edit size={15} /></button>
                    <button title="Hapus" className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded" onClick={() => handleDelete(r)}><Trash2 size={15} /></button>
                </div>
            )
        },
    ];

    return (
        <div>
            {showModal && (
                <LossEventModal
                    row={editRow}
                    onClose={() => { setShowModal(false); setEditRow(null); }}
                    onSave={handleSave}
                    units={units}
                    riskInputs={riskInputs}
                    kriList={kriList}
                    saving={saving}
                />
            )}
            {viewRow && <ViewModal row={viewRow} onClose={() => setViewRow(null)} />}

            <PageHeader title="Loss Event Database" subtitle="Pencatatan kejadian risiko yang benar-benar terjadi beserta dampaknya." />

            <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
                <ScoreCard icon={<ShieldAlert size={22} className="text-slate-500" />} title="Total Kejadian" value={stats.total} colorClass="bg-slate-50 border-slate-100" />
                <ScoreCard icon={<AlertTriangle size={22} className="text-rose-500" />} title="Dampak Ekstrem" value={stats.tinggi} colorClass="bg-rose-50 border-rose-100" />
                <ScoreCard icon={<AlertTriangle size={22} className="text-amber-500" />} title="Dampak Sedang" value={stats.sedang} colorClass="bg-amber-50 border-amber-100" />
                <ScoreCard icon={<CheckCircle2 size={22} className="text-emerald-500" />} title="Dampak Ringan" value={stats.rendah} colorClass="bg-emerald-50 border-emerald-100" />
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-8">
                <h3 className="text-sm font-semibold text-slate-800 mb-6 flex items-center">
                    <span className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center mr-3">💰</span>
                    Frekuensi dan Potensi Kerugian per Unit Kerja
                </h3>
                <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} dy={10} />
                            <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                            <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                            <RechartsTooltip cursor={{ fill: '#F1F5F9' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                            <Legend wrapperStyle={{ paddingTop: '20px' }} />
                            <Bar yAxisId="right" dataKey="Potensi Kerugian (Juta)" fill="#EF4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
                            <Bar yAxisId="left" dataKey="Kejadian Tercatat" fill="#64748B" radius={[4, 4, 0, 0]} maxBarSize={40} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-8">
                <TopActionBar
                    filters={
                        <div className="flex flex-wrap gap-3 items-center">
                            <FilterBar
                                searchValue={search} onSearchChange={setSearch} searchPlaceholder="Cari riwayat event..."
                                yearValue={year} onYearChange={setYear}
                            />
                            <select className="form-select text-sm h-9" value={unitFilter} onChange={e => setUnitFilter(e.target.value)}>
                                <option value="">Semua Unit</option>
                                {units.map(u => <option key={u.id} value={u.id}>{u.nama_unit}</option>)}
                            </select>
                        </div>
                    }
                    actions={
                        <>
                            <button className="btn-secondary" onClick={() => alert('Mengunduh laporan Loss Event...')}><Download size={15} /><span className="hidden sm:inline">Laporan</span></button>
                            <button className="btn-primary" onClick={() => { setEditRow(null); setShowModal(true); }}><Plus size={15} /><span>Catat Event</span></button>
                        </>
                    }
                />
                <DataTable columns={columns} data={filtered} isLoading={loading} />
                <div className="px-6 py-3 border-t border-slate-50 text-xs text-slate-400">
                    Menampilkan {filtered.length} dari {rows.length} loss event
                </div>
            </div>
        </div>
    );
}
