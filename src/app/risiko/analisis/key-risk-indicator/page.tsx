'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader, ScoreCard, FilterBar, TopActionBar } from '@/components/SharedUI';
import DataTable, { type Column } from '@/components/DataTable';
import {
    Plus, FileText, AlertTriangle, ShieldAlert, CheckCircle2,
    Eye, Edit, Trash2, X, Save, Loader2, TrendingDown, TrendingUp
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';

/* ─── Types ─────────────────────────────────────────────────────── */
interface KRIRow {
    id: string;
    unit_kerja_id?: string;
    risk_input_id?: string;
    kode_risiko?: string;
    nama_kri: string;
    indikator?: string;
    tahun: number;
    batas_bawah?: number;
    batas_atas?: number;
    nilai_aktual?: number;
    satuan?: string;
    frekuensi?: string;
    status: string;
    created_at: string;
    unit_kerja?: { id: string; nama_unit: string };
    risk_inputs?: { id: string; kode_risiko?: string; nama_risiko?: string };
}

interface WorkUnit { id: string; name: string; }
interface RiskInputOption { id: string; kode_risiko?: string; nama_risiko?: string; }

/* ─── Helpers ─────────────────────────────────────────────────── */
function getStatusColor(row: KRIRow) {
    const aktual = row.nilai_aktual ?? 0;
    const atas = row.batas_atas ?? Infinity;
    const bawah = row.batas_bawah ?? 0;
    if (aktual > atas) return 'badge-red';
    if (aktual > atas * 0.8) return 'badge-amber';
    if (aktual < bawah) return 'badge-amber';
    return 'badge-green';
}
function getStatusLabel(row: KRIRow) {
    const aktual = row.nilai_aktual ?? 0;
    const atas = row.batas_atas ?? Infinity;
    const bawah = row.batas_bawah ?? 0;
    if (aktual > atas) return 'Over Limit';
    if (aktual > atas * 0.8) return 'Mendekati Batas';
    if (aktual < bawah) return 'Di Bawah Batas';
    return 'Normal';
}

/* ─── Empty Form ─────────────────────────────────────────────────── */
const EMPTY_FORM = {
    unit_kerja_id: '',
    risk_input_id: '',
    kode_risiko: '',
    nama_kri: '',
    indikator: '',
    tahun: String(new Date().getFullYear()),
    batas_bawah: 0,
    batas_atas: 20,
    nilai_aktual: 0,
    satuan: '',
    frekuensi: 'Bulanan',
    status: 'Normal',
};

/* ─── KRI Modal ─────────────────────────────────────────────────── */
function KRIModal({ row, onClose, onSave, units, riskInputs, saving }: {
    row: Partial<typeof EMPTY_FORM> & { _id?: string } | null;
    onClose: () => void;
    onSave: (data: typeof EMPTY_FORM) => void;
    units: WorkUnit[];
    riskInputs: RiskInputOption[];
    saving: boolean;
}) {
    const [form, setForm] = useState({ ...EMPTY_FORM, ...(row ?? {}) });
    const f = (k: keyof typeof form, v: string | number) => setForm(prev => ({ ...prev, [k]: v }));

    const handleRiskSelect = (id: string) => {
        f('risk_input_id', id);
        const risk = riskInputs.find(r => r.id === id);
        if (risk) { f('kode_risiko', risk.kode_risiko || ''); f('nama_kri', risk.nama_risiko || ''); }
    };

    const aktual = Number(form.nilai_aktual);
    const atas = Number(form.batas_atas);
    const melebihi = atas > 0 && aktual > atas;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">
                <div className="flex justify-between items-center p-6 border-b border-slate-100">
                    <div>
                        <h2 className="font-bold text-slate-800 text-lg">{row?._id ? 'Edit KRI' : 'Tambah Key Risk Indicator'}</h2>
                        <p className="text-xs text-slate-500 mt-0.5">Indikator pemantauan untuk risiko utama</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"><X size={18} /></button>
                </div>

                <div className="p-6 space-y-5 text-sm">
                    {/* Unit & Tahun */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="form-label">Unit Kerja *</label>
                            <select className="form-input w-full" value={form.unit_kerja_id} onChange={e => f('unit_kerja_id', e.target.value)}>
                                <option value="">-- Pilih Unit --</option>
                                {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="form-label">Tahun *</label>
                            <select className="form-input w-full" value={form.tahun} onChange={e => f('tahun', e.target.value)}>
                                {[2024, 2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Pilih Risiko */}
                    <div>
                        <label className="form-label">Risiko Terkait (dari Identifikasi Risiko)</label>
                        <select className="form-input w-full" value={form.risk_input_id} onChange={e => handleRiskSelect(e.target.value)}>
                            <option value="">-- Pilih Risiko --</option>
                            {riskInputs.map(r => (
                                <option key={r.id} value={r.id}>
                                    {r.kode_risiko ? `[${r.kode_risiko}] ` : ''}{r.nama_risiko || 'Tanpa Nama'}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Kode & Nama KRI */}
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="form-label">Kode Risiko</label>
                            <input type="text" className="form-input w-full bg-slate-50" value={form.kode_risiko} readOnly placeholder="Auto" />
                        </div>
                        <div className="col-span-2">
                            <label className="form-label">Nama KRI *</label>
                            <input type="text" className="form-input w-full" value={form.nama_kri} onChange={e => f('nama_kri', e.target.value)} placeholder="e.g. Tingkat Kejadian Insiden" required />
                        </div>
                    </div>

                    {/* Indikator */}
                    <div>
                        <label className="form-label">Deskripsi Indikator</label>
                        <textarea className="form-input w-full h-16 resize-none" placeholder="Penjelasan metode pengukuran indikator ini..." value={form.indikator} onChange={e => f('indikator', e.target.value)} />
                    </div>

                    {/* Batas & Nilai */}
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                        <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-3">Parameter KRI</p>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-slate-500 mb-1.5">Batas Bawah (Min Toleransi)</label>
                                <input type="number" className="form-input w-full" value={form.batas_bawah} onChange={e => f('batas_bawah', Number(e.target.value))} />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-500 mb-1.5">Batas Atas (Max Toleransi)</label>
                                <input type="number" className="form-input w-full" value={form.batas_atas} onChange={e => f('batas_atas', Number(e.target.value))} />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-500 mb-1.5">Nilai Aktual</label>
                                <input type="number" className="form-input w-full" value={form.nilai_aktual} onChange={e => f('nilai_aktual', Number(e.target.value))} />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-500 mb-1.5">Satuan</label>
                                <input type="text" className="form-input w-full" value={form.satuan} onChange={e => f('satuan', e.target.value)} placeholder="e.g. kasus, %, event" />
                            </div>
                        </div>
                        <div className={`mt-3 rounded-lg px-3 py-2 text-xs font-semibold flex items-center gap-2 ${melebihi ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {melebihi ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                            {melebihi ? `Nilai aktual (${aktual}) MELEBIHI batas atas (${atas})!` : `Nilai aktual (${aktual}) dalam batas toleransi.`}
                        </div>
                    </div>

                    {/* Frekuensi & Status */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="form-label">Frekuensi Pemantauan</label>
                            <select className="form-input w-full" value={form.frekuensi} onChange={e => f('frekuensi', e.target.value)}>
                                <option>Harian</option>
                                <option>Mingguan</option>
                                <option>Bulanan</option>
                                <option>Triwulan</option>
                                <option>Semester</option>
                                <option>Tahunan</option>
                            </select>
                        </div>
                        <div>
                            <label className="form-label">Status</label>
                            <select className="form-input w-full" value={form.status} onChange={e => f('status', e.target.value)}>
                                <option>Normal</option>
                                <option>Mendekati Batas</option>
                                <option>Over Limit</option>
                                <option>Di Bawah Batas</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3 px-6 pb-6">
                    <button onClick={onClose} className="btn-secondary">Batal</button>
                    <button onClick={() => onSave(form)} className="btn-primary flex items-center gap-2" disabled={saving}>
                        {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                        Simpan KRI
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─── View Modal ─────────────────────────────────────────────────── */
function ViewModal({ row, onClose }: { row: KRIRow; onClose: () => void }) {
    const aktual = row.nilai_aktual ?? 0;
    const atas = row.batas_atas ?? 0;
    const bawah = row.batas_bawah ?? 0;
    const pct = atas > 0 ? Math.min(100, Math.round((aktual / atas) * 100)) : 0;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">
                <div className="flex justify-between items-center p-6 border-b border-slate-100">
                    <h2 className="font-bold text-slate-800 text-lg">Detail KRI</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"><X size={18} /></button>
                </div>
                <div className="p-6 space-y-5 text-sm">
                    <div className="grid grid-cols-2 gap-4">
                        <div><span className="text-xs text-slate-400">Unit Kerja</span><p className="font-semibold mt-0.5">{row.unit_kerja?.nama_unit ?? '-'}</p></div>
                        <div><span className="text-xs text-slate-400">Tahun</span><p className="font-semibold mt-0.5">{row.tahun}</p></div>
                        {row.kode_risiko && <div><span className="text-xs text-slate-400">Kode Risiko</span><p className="font-semibold mt-0.5">{row.kode_risiko}</p></div>}
                        <div className="col-span-2"><span className="text-xs text-slate-400">Nama KRI</span><p className="font-semibold mt-0.5 text-base">{row.nama_kri}</p></div>
                        {row.indikator && <div className="col-span-2"><span className="text-xs text-slate-400">Deskripsi Indikator</span><p className="mt-0.5 text-slate-600">{row.indikator}</p></div>}
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                            <div className="text-xs text-slate-500">Batas Bawah</div>
                            <div className="text-2xl font-bold text-slate-600 mt-1">{bawah}<span className="text-xs font-normal ml-1">{row.satuan}</span></div>
                        </div>
                        <div className={`border rounded-xl p-3 ${aktual > atas ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
                            <div className="text-xs text-slate-500">Nilai Aktual</div>
                            <div className={`text-2xl font-extrabold mt-1 ${aktual > atas ? 'text-rose-600' : 'text-emerald-600'}`}>{aktual}<span className="text-xs font-normal ml-1">{row.satuan}</span></div>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${aktual > atas ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>{getStatusLabel(row)}</span>
                        </div>
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                            <div className="text-xs text-slate-500">Batas Atas</div>
                            <div className="text-2xl font-bold text-slate-600 mt-1">{atas}<span className="text-xs font-normal ml-1">{row.satuan}</span></div>
                        </div>
                    </div>

                    {atas > 0 && (
                        <div>
                            <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                                <span>Utilisasi terhadap Batas Atas</span>
                                <span className="font-semibold">{pct}%</span>
                            </div>
                            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${aktual > atas ? 'bg-rose-500' : aktual > atas * 0.8 ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 text-xs">
                        <div><span className="text-slate-400">Frekuensi Pemantauan:</span> <span className="font-medium">{row.frekuensi ?? '-'}</span></div>
                        <div><span className="text-slate-400">Status:</span> <span className={`font-medium ${aktual > atas ? 'text-rose-600' : 'text-emerald-600'}`}>{getStatusLabel(row)}</span></div>
                    </div>
                </div>
                <div className="flex justify-end px-6 pb-6">
                    <button onClick={onClose} className="btn-secondary">Tutup</button>
                </div>
            </div>
        </div>
    );
}

/* ─── Main Page ──────────────────────────────────────────────────── */
export default function KeyRiskIndicatorPage() {
    const [search, setSearch] = useState('');
    const [year, setYear] = useState(String(new Date().getFullYear()));
    const [unitFilter, setUnitFilter] = useState('');
    const [rows, setRows] = useState<KRIRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [units, setUnits] = useState<WorkUnit[]>([]);
    const [riskInputs, setRiskInputs] = useState<RiskInputOption[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [viewRow, setViewRow] = useState<KRIRow | null>(null);
    const [editRow, setEditRow] = useState<Partial<typeof EMPTY_FORM> & { _id?: string } | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            let q = supabase
                .from('key_risk_indicators')
                .select('*, unit_kerja(id, nama_unit), risk_inputs(id, kode_risiko, nama_risiko)')
                .order('created_at', { ascending: false });
            if (year) q = q.eq('tahun', Number(year));
            const { data, error } = await q;
            if (error) { console.error('Error fetching KRI:', error); setRows([]); }
            else setRows((data as KRIRow[]) ?? []);
        } catch (e) { console.error(e); setRows([]); }
        finally { setLoading(false); }
    }, [year]);

    useEffect(() => { fetchData(); }, [fetchData]);

    useEffect(() => {
        supabase.from('unit_kerja').select('id, nama_unit').then(({ data }) =>
            setUnits((data ?? []).map((u: any) => ({ id: u.id, name: u.nama_unit }))));
        supabase.from('risk_inputs').select('id, kode_risiko, nama_risiko').then(({ data }) =>
            setRiskInputs((data ?? []) as RiskInputOption[]));
    }, []);

    const filtered = rows.filter(d => {
        const matchSearch = (d.nama_kri || '').toLowerCase().includes(search.toLowerCase()) ||
            (d.kode_risiko || '').toLowerCase().includes(search.toLowerCase());
        const matchUnit = unitFilter ? d.unit_kerja_id === unitFilter : true;
        return matchSearch && matchUnit;
    });

    const stats = {
        total: filtered.length,
        overLimit: filtered.filter(r => (r.nilai_aktual ?? 0) > (r.batas_atas ?? Infinity)).length,
        mendekati: filtered.filter(r => {
            const a = r.nilai_aktual ?? 0; const b = r.batas_atas ?? Infinity;
            return a <= b && a > b * 0.8;
        }).length,
        normal: filtered.filter(r => (r.nilai_aktual ?? 0) <= (r.batas_atas ?? Infinity) * 0.8).length,
    };

    // Trend chart shows avg aktual per unit
    const trendData = units.map(u => {
        const unitRows = filtered.filter(r => r.unit_kerja_id === u.id);
        const avg = unitRows.length ? unitRows.reduce((s, r) => s + (r.nilai_aktual ?? 0), 0) / unitRows.length : 0;
        const avgBatas = unitRows.length ? unitRows.reduce((s, r) => s + (r.batas_atas ?? 0), 0) / unitRows.length : 0;
        return { name: u.name.substring(0, 12), 'Nilai Aktual': +avg.toFixed(1), 'Batas Atas': +avgBatas.toFixed(1) };
    }).filter(u => u['Nilai Aktual'] > 0 || u['Batas Atas'] > 0);

    const handleSave = async (form: typeof EMPTY_FORM) => {
        setSaving(true);
        try {
            const payload = {
                unit_kerja_id: form.unit_kerja_id || null,
                risk_input_id: form.risk_input_id || null,
                kode_risiko: form.kode_risiko || null,
                nama_kri: form.nama_kri,
                indikator: form.indikator || null,
                tahun: Number(form.tahun),
                batas_bawah: Number(form.batas_bawah),
                batas_atas: Number(form.batas_atas),
                nilai_aktual: Number(form.nilai_aktual),
                satuan: form.satuan || null,
                frekuensi: form.frekuensi,
                status: form.status,
            };
            let error;
            if (editRow?._id) {
                ({ error } = await supabase.from('key_risk_indicators').update(payload).eq('id', editRow._id));
            } else {
                ({ error } = await supabase.from('key_risk_indicators').insert(payload));
            }
            if (error) { console.error(error); alert('Gagal menyimpan: ' + error.message); }
            else { setShowModal(false); setEditRow(null); fetchData(); }
        } catch (e) { console.error(e); }
        finally { setSaving(false); }
    };

    const handleDelete = async (row: KRIRow) => {
        if (!confirm(`Hapus KRI "${row.nama_kri}"?`)) return;
        const { error } = await supabase.from('key_risk_indicators').delete().eq('id', row.id);
        if (error) alert('Gagal menghapus: ' + error.message);
        else fetchData();
    };

    const columns: Column<KRIRow>[] = [
        { key: 'unit_kerja_id', label: 'Unit Kerja', render: r => (r as any).unit_kerja?.nama_unit ?? '-' },
        {
            key: 'nama_kri', label: 'Nama KRI', render: r => (
                <div>
                    {r.kode_risiko && <span className="text-xs font-mono text-slate-400">{r.kode_risiko} · </span>}
                    <span className="font-medium">{r.nama_kri}</span>
                </div>
            )
        },
        { key: 'batas_bawah', label: 'Batas Bawah', className: 'text-center text-emerald-600 font-medium', render: r => `${r.batas_bawah ?? '-'} ${r.satuan ?? ''}` },
        { key: 'batas_atas', label: 'Batas Atas', className: 'text-center text-rose-600 font-medium', render: r => `${r.batas_atas ?? '-'} ${r.satuan ?? ''}` },
        {
            key: 'nilai_aktual', label: 'Nilai Aktual', className: 'text-center font-bold',
            render: r => {
                const aktual = r.nilai_aktual ?? 0;
                const atas = r.batas_atas ?? Infinity;
                return <span className={aktual > atas ? 'text-rose-600' : 'text-emerald-600'}>{aktual} {r.satuan ?? ''}</span>;
            }
        },
        { key: 'frekuensi', label: 'Frekuensi', className: 'text-center text-xs', render: r => r.frekuensi ?? 'Bulanan' },
        { key: 'status', label: 'Pemenuhan', render: r => <span className={getStatusColor(r)}>{getStatusLabel(r)}</span> },
        {
            key: 'actions', label: 'Aksi', render: r => (
                <div className="flex gap-1 justify-center">
                    <button title="Lihat detail" className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded" onClick={() => setViewRow(r)}><Eye size={15} /></button>
                    <button title="Edit" className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded" onClick={() => {
                        setEditRow({ ...EMPTY_FORM, ...r, tahun: String(r.tahun), _id: r.id });
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
                <KRIModal
                    row={editRow}
                    onClose={() => { setShowModal(false); setEditRow(null); }}
                    onSave={handleSave}
                    units={units}
                    riskInputs={riskInputs}
                    saving={saving}
                />
            )}
            {viewRow && <ViewModal row={viewRow} onClose={() => setViewRow(null)} />}

            <PageHeader title="Key Risk Indicator (KRI)" subtitle="Pemantauan indikator risiko utama berdasarkan ambang batas." />

            {/* Score Cards */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
                <ScoreCard icon={<ShieldAlert size={22} className="text-slate-500" />} title="Total KRI Aktif" value={stats.total} colorClass="bg-slate-50 border-slate-100" />
                <ScoreCard icon={<AlertTriangle size={22} className="text-rose-500" />} title="Over Limit" value={stats.overLimit} subtitle="Melewati batas atas" colorClass="bg-rose-50 border-rose-100" />
                <ScoreCard icon={<AlertTriangle size={22} className="text-amber-500" />} title="Mendekati Batas" value={stats.mendekati} subtitle="80–100% batas atas" colorClass="bg-amber-50 border-amber-100" />
                <ScoreCard icon={<CheckCircle2 size={22} className="text-emerald-500" />} title="Normal" value={stats.normal} colorClass="bg-emerald-50 border-emerald-100" />
            </div>

            {/* Trend Chart */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-8">
                <h3 className="text-sm font-semibold text-slate-800 mb-6 flex items-center">
                    <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mr-3">📈</span>
                    Perbandingan Nilai Aktual vs Batas Atas per Unit Kerja
                </h3>
                <div className="h-72 w-full">
                    {trendData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={trendData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                                <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0/0.1)' }} />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                <Line type="monotone" dataKey="Nilai Aktual" stroke="#4F46E5" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                <Line type="monotone" dataKey="Batas Atas" stroke="#EF4444" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-full text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl">
                            Belum ada data KRI — tambahkan data terlebih dahulu
                        </div>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-8">
                <TopActionBar
                    filters={
                        <div className="flex flex-wrap gap-3 items-center">
                            <FilterBar
                                searchValue={search} onSearchChange={setSearch} searchPlaceholder="Cari KRI..."
                                yearValue={year} onYearChange={setYear}
                            />
                            <select className="form-input text-sm h-9" value={unitFilter} onChange={e => setUnitFilter(e.target.value)}>
                                <option value="">Semua Unit</option>
                                {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </select>
                        </div>
                    }
                    actions={
                        <>
                            <button className="btn-secondary flex items-center gap-1.5"><FileText size={15} /><span className="hidden sm:inline">Laporan</span></button>
                            <button className="btn-primary flex items-center gap-1.5" onClick={() => { setEditRow(null); setShowModal(true); }}>
                                <Plus size={15} /><span>Tambah KRI</span>
                            </button>
                        </>
                    }
                />
                <DataTable columns={columns} data={filtered} isLoading={loading} />
                <div className="px-6 py-3 border-t border-slate-50 text-xs text-slate-400">
                    Menampilkan {filtered.length} dari {rows.length} KRI
                </div>
            </div>
        </div>
    );
}
