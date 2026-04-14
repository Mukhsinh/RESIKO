'use client';

import React, { useState } from 'react';
import { PageHeader, ScoreCard, FilterBar, TopActionBar } from '@/components/SharedUI';
import DataTable, { type Column } from '@/components/DataTable';
import { mockManajemenRisiko, mockUnits } from '@/lib/dummy-data';
import RiskHeatmap, { type HeatmapPoint } from '@/components/RiskHeatmap';
import {
    Plus, Download, Upload, FileText, AlertTriangle, ShieldAlert,
    CheckCircle2, Eye, Edit, Trash2, X, Save, TrendingDown
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Legend } from 'recharts';

/* ─── Types ─────────────────────────────────────────────────────── */
type RiskRow = typeof mockManajemenRisiko[0] & {
    akar_penyebab?: string;
    rencana_penanganan?: string;
    anggaran?: number;
    selera_risiko?: number;
    p_residual?: number;
    d_residual?: number;
};

/* ─── Badge helpers ──────────────────────────────────────────────── */
function RiskScoreBadge({ score }: { score: number }) {
    if (score >= 15) return <span className="badge-red">Sangat Tinggi ({score})</span>;
    if (score >= 10) return <span className="badge-amber">Tinggi ({score})</span>;
    if (score >= 5) return <span className="badge-blue">Sedang ({score})</span>;
    return <span className="badge-green">Rendah ({score})</span>;
}
function StatusBadge({ status }: { status: string }) {
    const m: Record<string, string> = { Open: 'badge-red', Monitoring: 'badge-amber', 'Mitigasi Berjalan': 'badge-blue', Closed: 'badge-green' };
    return <span className={m[status] ?? 'badge-gray'}>{status}</span>;
}

/* ─── Modal Form ─────────────────────────────────────────────────── */
const EMPTY_FORM = {
    unit_kerja_id: '',
    tahun: String(new Date().getFullYear()),
    identifikasi_risiko: '',
    akar_penyebab: '',
    probabilitas: 3,
    dampak: 3,
    mitigasi: '',
    rencana_penanganan: '',
    anggaran: 0,
    selera_risiko: 6,
    p_residual: 2,
    d_residual: 2,
    status: 'Open',
};

function RiskModal({ row, onClose, onSave }: {
    row: Partial<typeof EMPTY_FORM> | null;
    onClose: () => void;
    onSave: (data: typeof EMPTY_FORM) => void;
}) {
    const [form, setForm] = useState({ ...EMPTY_FORM, ...(row ?? {}) });
    const f = (k: keyof typeof form, v: string | number) => setForm(prev => ({ ...prev, [k]: v }));

    const skor = form.probabilitas * form.dampak;
    const skor_res = form.p_residual * form.d_residual;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-slate-100">
                    <div>
                        <h2 className="font-bold text-slate-800 text-lg">{row?.identifikasi_risiko ? 'Edit Data Risiko' : 'Tambah Data Risiko Baru'}</h2>
                        <p className="text-xs text-slate-500 mt-0.5">Isi seluruh field sesuai standar manajemen risiko RS</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"><X size={18} /></button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-5 text-sm">
                    {/* Row 1 */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Unit Kerja *</label>
                            <select className="form-select w-full" value={form.unit_kerja_id} onChange={e => f('unit_kerja_id', e.target.value)}>
                                <option value="">-- Pilih Unit --</option>
                                {mockUnits.map(u => <option key={u.id} value={u.id}>{u.nama_unit}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Tahun *</label>
                            <select className="form-select w-full" value={form.tahun} onChange={e => f('tahun', e.target.value)}>
                                {[2024, 2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Pernyataan Risiko */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Pernyataan / Identifikasi Risiko *</label>
                        <textarea className="form-input w-full h-20 resize-none" placeholder="Deskripsikan risiko secara jelas dan terukur…" value={form.identifikasi_risiko} onChange={e => f('identifikasi_risiko', e.target.value)} />
                    </div>

                    {/* Akar Penyebab */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Akar Penyebab (Root Cause)</label>
                        <textarea className="form-input w-full h-16 resize-none" placeholder="Faktor penyebab utama terjadinya risiko…" value={form.akar_penyebab} onChange={e => f('akar_penyebab', e.target.value)} />
                    </div>

                    {/* Inherent Risk */}
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                        <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-3">Inherent Risk (Sebelum Mitigasi)</p>
                        <div className="grid grid-cols-3 gap-4 items-end">
                            <div>
                                <label className="block text-xs text-slate-500 mb-1.5">Probabilitas (1-5)</label>
                                <input type="range" min={1} max={5} step={1} className="w-full" value={form.probabilitas} onChange={e => f('probabilitas', Number(e.target.value))} />
                                <div className="text-center text-lg font-bold text-rose-500 mt-1">{form.probabilitas}</div>
                            </div>
                            <div>
                                <label className="block text-xs text-slate-500 mb-1.5">Dampak (1-5)</label>
                                <input type="range" min={1} max={5} step={1} className="w-full" value={form.dampak} onChange={e => f('dampak', Number(e.target.value))} />
                                <div className="text-center text-lg font-bold text-rose-500 mt-1">{form.dampak}</div>
                            </div>
                            <div className="text-center bg-white border border-slate-200 rounded-xl p-3">
                                <div className="text-xs text-slate-500">Skor Inherent</div>
                                <div className={`text-2xl font-extrabold mt-1 ${skor >= 15 ? 'text-rose-600' : skor >= 10 ? 'text-orange-500' : skor >= 5 ? 'text-yellow-500' : 'text-emerald-500'}`}>{skor}</div>
                                <div className="text-xs mt-0.5 text-slate-500">{skor >= 15 ? 'Sangat Tinggi' : skor >= 10 ? 'Tinggi' : skor >= 5 ? 'Sedang' : 'Rendah'}</div>
                            </div>
                        </div>
                    </div>

                    {/* Mitigasi & Rencana */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Tindakan Mitigasi yang Diterapkan</label>
                        <textarea className="form-input w-full h-16 resize-none" placeholder="Langkah mitigasi yang sudah/akan dilakukan…" value={form.mitigasi} onChange={e => f('mitigasi', e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Rencana Penanganan Lanjutan</label>
                        <textarea className="form-input w-full h-16 resize-none" placeholder="Program kerja penanganan ke depannya…" value={form.rencana_penanganan} onChange={e => f('rencana_penanganan', e.target.value)} />
                    </div>

                    {/* Residual Risk */}
                    <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                        <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-3">Residual Risk (Setelah Mitigasi)</p>
                        <div className="grid grid-cols-3 gap-4 items-end">
                            <div>
                                <label className="block text-xs text-slate-500 mb-1.5">P. Residual (1-5)</label>
                                <input type="range" min={1} max={5} step={1} className="w-full accent-emerald-500" value={form.p_residual} onChange={e => f('p_residual', Number(e.target.value))} />
                                <div className="text-center text-lg font-bold text-emerald-600 mt-1">{form.p_residual}</div>
                            </div>
                            <div>
                                <label className="block text-xs text-slate-500 mb-1.5">D. Residual (1-5)</label>
                                <input type="range" min={1} max={5} step={1} className="w-full accent-emerald-500" value={form.d_residual} onChange={e => f('d_residual', Number(e.target.value))} />
                                <div className="text-center text-lg font-bold text-emerald-600 mt-1">{form.d_residual}</div>
                            </div>
                            <div className="text-center bg-white border border-emerald-200 rounded-xl p-3">
                                <div className="text-xs text-slate-500">Skor Residual</div>
                                <div className="text-2xl font-extrabold mt-1 text-emerald-600">{skor_res}</div>
                                <div className="text-xs mt-0.5 flex justify-center items-center gap-1 text-emerald-600">
                                    <TrendingDown size={12} /> Turun {Math.round((1 - skor_res / Math.max(skor, 1)) * 100)}%
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Anggaran & Selera Risiko */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Anggaran Mitigasi (Rp)</label>
                            <input type="number" className="form-input w-full" placeholder="e.g. 25000000" value={form.anggaran} onChange={e => f('anggaran', Number(e.target.value))} />
                            <p className="text-xs text-slate-400 mt-1">{form.anggaran > 0 ? `Rp ${(form.anggaran / 1_000_000).toFixed(1)} juta` : 'Masukkan nominal anggaran'}</p>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Selera Risiko / Risk Appetite (Skor maks)</label>
                            <input type="number" min={1} max={25} className="form-input w-full" placeholder="e.g. 8" value={form.selera_risiko} onChange={e => f('selera_risiko', Number(e.target.value))} />
                            <p className={`text-xs mt-1 font-medium ${skor > form.selera_risiko ? 'text-rose-500' : 'text-emerald-500'}`}>
                                {skor > form.selera_risiko ? '⚠ Inherent melebihi selera risiko' : '✓ Dalam batas selera risiko'}
                            </p>
                        </div>
                    </div>

                    {/* Status */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Status Risiko</label>
                        <select className="form-select w-full" value={form.status} onChange={e => f('status', e.target.value)}>
                            <option>Open</option>
                            <option>Mitigasi Berjalan</option>
                            <option>Monitoring</option>
                            <option>Closed</option>
                        </select>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 px-6 pb-6">
                    <button onClick={onClose} className="btn-secondary">Batal</button>
                    <button onClick={() => onSave(form)} className="btn-primary flex items-center gap-2"><Save size={15} /> Simpan Data</button>
                </div>
            </div>
        </div>
    );
}

/* ─── View Modal ─────────────────────────────────────────────────── */
function ViewModal({ row, onClose }: { row: RiskRow; onClose: () => void }) {
    const unit = mockUnits.find(u => u.id === row.unit_kerja_id);
    const skor = row.skor_risiko;
    const skor_res = (row.p_residual ?? Math.ceil(row.probabilitas * 0.5)) * (row.d_residual ?? Math.ceil(row.dampak * 0.8));

    const heatmapData: HeatmapPoint[] = [
        { id: 'inh', x: row.dampak, y: row.probabilitas, label: row.identifikasi_risiko, type: 'inherent' },
        { id: 'res', x: row.d_residual ?? Math.ceil(row.dampak * 0.8), y: row.p_residual ?? Math.ceil(row.probabilitas * 0.5), label: row.identifikasi_risiko, type: 'residual' },
        { id: 'app', x: Math.ceil((row.selera_risiko ?? 6) / 5), y: Math.ceil((row.selera_risiko ?? 6) / 5), label: 'Selera Risiko (Appetite)', type: 'appetite' },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-8">
                <div className="flex justify-between items-center p-6 border-b border-slate-100">
                    <h2 className="font-bold text-slate-800 text-lg">Detail Profil Risiko</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"><X size={18} /></button>
                </div>
                <div className="p-6 space-y-6 text-sm">
                    <div className="grid grid-cols-2 gap-4">
                        <div><span className="text-xs text-slate-400">Unit Kerja</span><p className="font-semibold mt-0.5">{unit?.nama_unit ?? row.unit_kerja?.nama_unit ?? '-'}</p></div>
                        <div><span className="text-xs text-slate-400">Tahun</span><p className="font-semibold mt-0.5">{row.tahun}</p></div>
                        <div className="col-span-2"><span className="text-xs text-slate-400">Identifikasi Risiko</span><p className="font-semibold mt-0.5 leading-relaxed">{row.identifikasi_risiko}</p></div>
                        {row.akar_penyebab && <div className="col-span-2"><span className="text-xs text-slate-400">Akar Penyebab</span><p className="mt-0.5 leading-relaxed text-slate-600">{row.akar_penyebab}</p></div>}
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                            <div className="text-xs text-slate-500">Inherent Risk</div>
                            <div className={`text-3xl font-extrabold mt-1 ${skor >= 15 ? 'text-rose-600' : skor >= 10 ? 'text-orange-500' : 'text-yellow-500'}`}>{skor}</div>
                            <div className="text-xs text-slate-500 mt-0.5">P:{row.probabilitas} × D:{row.dampak}</div>
                        </div>
                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                            <div className="text-xs text-slate-500">Risk Appetite</div>
                            <div className="text-3xl font-extrabold mt-1 text-blue-600">{row.selera_risiko ?? 6}</div>
                            <div className="text-xs text-slate-500 mt-0.5">Batas maksimum toleransi</div>
                        </div>
                        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                            <div className="text-xs text-slate-500">Residual Risk</div>
                            <div className="text-3xl font-extrabold mt-1 text-emerald-600">{skor_res}</div>
                            <div className="text-xs text-slate-500 mt-0.5">P:{row.p_residual ?? '-'} × D:{row.d_residual ?? '-'}</div>
                        </div>
                    </div>

                    <div>
                        <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-4">Posisi Risiko pada Heatmap 5×5</p>
                        <RiskHeatmap data={heatmapData} />
                    </div>

                    {row.mitigasi && <div><span className="text-xs text-slate-400">Tindakan Mitigasi</span><p className="mt-0.5 text-slate-700 leading-relaxed">{row.mitigasi}</p></div>}
                    {row.rencana_penanganan && <div><span className="text-xs text-slate-400">Rencana Penanganan Lanjutan</span><p className="mt-0.5 text-slate-700 leading-relaxed">{row.rencana_penanganan}</p></div>}
                    {row.anggaran != null && row.anggaran > 0 && <div><span className="text-xs text-slate-400">Anggaran Mitigasi</span><p className="mt-0.5 font-semibold text-slate-700">Rp {row.anggaran.toLocaleString('id-ID')}</p></div>}
                    <div><span className="text-xs text-slate-400">Status</span><div className="mt-1"><StatusBadge status={row.status} /></div></div>
                </div>
                <div className="flex justify-end px-6 pb-6">
                    <button onClick={onClose} className="btn-secondary">Tutup</button>
                </div>
            </div>
        </div>
    );
}

/* ─── Main Page ──────────────────────────────────────────────────── */
export default function RiskProfilePage() {
    const [search, setSearch] = useState('');
    const [year, setYear] = useState(String(new Date().getFullYear()));
    const [unitFilter, setUnitFilter] = useState('');
    const [rows, setRows] = useState<RiskRow[]>(mockManajemenRisiko as RiskRow[]);
    const [showModal, setShowModal] = useState(false);
    const [viewRow, setViewRow] = useState<RiskRow | null>(null);
    const [editRow, setEditRow] = useState<Partial<typeof EMPTY_FORM> | null>(null);

    const filtered = rows.filter(d => {
        const matchYear = year ? String(d.tahun) === year : true;
        const matchSearch = d.identifikasi_risiko.toLowerCase().includes(search.toLowerCase());
        const matchUnit = unitFilter ? d.unit_kerja_id === unitFilter : true;
        return matchYear && matchSearch && matchUnit;
    });

    const stats = {
        total: filtered.length,
        tinggi: filtered.filter(d => d.skor_risiko >= 15).length,
        sedang: filtered.filter(d => d.skor_risiko >= 5 && d.skor_risiko < 15).length,
        rendah: filtered.filter(d => d.skor_risiko < 5).length,
    };

    const unitScoreData = mockUnits.map(unit => {
        const ur = rows.filter(r => r.unit_kerja_id === unit.id);
        return {
            name: unit.nama_unit.replace('Unit ', ''),
            'Total Risiko': ur.length,
            'Rata-rata Skor': ur.length ? +(ur.reduce((s, r) => s + r.skor_risiko, 0) / ur.length).toFixed(1) : 0,
        };
    });

    const heatmapData: HeatmapPoint[] = filtered.flatMap(r => [
        { id: r.id + '_inh', x: r.dampak, y: r.probabilitas, label: r.identifikasi_risiko, type: 'inherent' as const },
        { id: r.id + '_res', x: r.d_residual ?? Math.ceil(r.dampak * 0.8), y: r.p_residual ?? Math.ceil(r.probabilitas * 0.5), label: r.identifikasi_risiko, type: 'residual' as const },
    ]);

    const handleSave = (form: typeof EMPTY_FORM) => {
        const unit = mockUnits.find(u => u.id === form.unit_kerja_id);
        const tahunNum = Number(form.tahun);
        if (editRow && 'identifikasi_risiko' in editRow && editRow.identifikasi_risiko) {
            setRows(prev => prev.map(r => r.identifikasi_risiko === editRow.identifikasi_risiko
                ? { ...r, ...form, tahun: tahunNum, skor_risiko: form.probabilitas * form.dampak, unit_kerja: unit } as unknown as RiskRow
                : r
            ));
        } else {
            const newRow = {
                id: 'r' + Date.now(),
                unit_kerja_id: form.unit_kerja_id,
                tahun: tahunNum,
                identifikasi_risiko: form.identifikasi_risiko,
                akar_penyebab: form.akar_penyebab,
                probabilitas: form.probabilitas,
                dampak: form.dampak,
                skor_risiko: form.probabilitas * form.dampak,
                mitigasi: form.mitigasi,
                rencana_penanganan: form.rencana_penanganan,
                anggaran: form.anggaran,
                selera_risiko: form.selera_risiko,
                p_residual: form.p_residual,
                d_residual: form.d_residual,
                status: form.status,
                created_at: new Date().toISOString(),
                unit_kerja: unit,
            } as RiskRow;
            setRows(prev => [newRow, ...prev]);
        }
        setShowModal(false); setEditRow(null);
    };

    const handleDelete = (row: RiskRow) => {
        if (!confirm(`Hapus risiko "${row.identifikasi_risiko}"?`)) return;
        setRows(prev => prev.filter(r => r.id !== row.id));
    };

    const columns: Column<RiskRow>[] = [
        { key: 'tahun', label: 'Tahun', className: 'w-16 text-center' },
        { key: 'unit_kerja', label: 'Unit Kerja', render: r => r.unit_kerja?.nama_unit ?? mockUnits.find(u => u.id === r.unit_kerja_id)?.nama_unit ?? '-' },
        { key: 'identifikasi_risiko', label: 'Identifikasi Risiko', className: 'max-w-xs', render: r => <span className="line-clamp-2">{r.identifikasi_risiko}</span> },
        { key: 'probabilitas', label: 'Prob', className: 'text-center w-14' },
        { key: 'dampak', label: 'Dampak', className: 'text-center w-16' },
        { key: 'skor_risiko', label: 'Skor', className: 'text-center', render: r => <RiskScoreBadge score={r.skor_risiko} /> },
        { key: 'status', label: 'Status', render: r => <StatusBadge status={r.status} /> },
        {
            key: 'actions', label: 'Aksi', render: r => (
                <div className="flex gap-1 justify-center">
                    <button title="Lihat detail" className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded" onClick={() => setViewRow(r)}><Eye size={15} /></button>
                    <button title="Edit" className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded" onClick={() => { setEditRow({ ...r, tahun: String(r.tahun), mitigasi: r.mitigasi ?? '' }); setShowModal(true); }}><Edit size={15} /></button>
                    <button title="Hapus" className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded" onClick={() => handleDelete(r)}><Trash2 size={15} /></button>
                </div>
            )
        },
    ];

    return (
        <div>
            {showModal && <RiskModal row={editRow} onClose={() => { setShowModal(false); setEditRow(null); }} onSave={handleSave} />}
            {viewRow && <ViewModal row={viewRow} onClose={() => setViewRow(null)} />}

            <PageHeader title="Risk Profile" subtitle="Distribusi dan profil sebaran risiko di setiap unit kerja." />

            {/* Score Cards */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
                <ScoreCard icon={<ShieldAlert size={22} className="text-slate-500" />} title="Total Risiko" value={stats.total} colorClass="bg-slate-50 border-slate-100" />
                <ScoreCard icon={<AlertTriangle size={22} className="text-rose-500" />} title="Sangat Tinggi" value={stats.tinggi} subtitle="Skor ≥ 15" colorClass="bg-rose-50 border-rose-100" />
                <ScoreCard icon={<AlertTriangle size={22} className="text-amber-500" />} title="Sedang" value={stats.sedang} subtitle="Skor 5–14" colorClass="bg-amber-50 border-amber-100" />
                <ScoreCard icon={<CheckCircle2 size={22} className="text-emerald-500" />} title="Rendah / Closed" value={stats.rendah} subtitle="Skor < 5" colorClass="bg-emerald-50 border-emerald-100" />
            </div>

            {/* Charts — Side by side */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                    <h3 className="text-sm font-semibold text-slate-800 mb-6 flex items-center">
                        <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mr-3">📊</span>
                        Profil Risiko per Unit Kerja
                    </h3>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={unitScoreData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} dy={8} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                                <RTooltip cursor={{ fill: '#F1F5F9' }} contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 12px rgb(0 0 0/0.1)' }} />
                                <Legend wrapperStyle={{ paddingTop: '12px', fontSize: 12 }} />
                                <Bar dataKey="Total Risiko" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                <Bar dataKey="Rata-rata Skor" fill="#F59E0B" radius={[4, 4, 0, 0]} maxBarSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                    <h3 className="text-sm font-semibold text-slate-800 mb-6 flex items-center">
                        <span className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center mr-3">🗺</span>
                        Heatmap Risiko (Inherent & Residual)
                    </h3>
                    <RiskHeatmap data={heatmapData} />
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-8">
                <TopActionBar
                    filters={
                        <div className="flex flex-wrap gap-3 items-center">
                            <FilterBar
                                searchValue={search} onSearchChange={setSearch} searchPlaceholder="Cari identifikasi risiko..."
                                yearValue={year} onYearChange={setYear}
                            />
                            <select className="form-select text-sm h-9" value={unitFilter} onChange={e => setUnitFilter(e.target.value)}>
                                <option value="">Semua Unit</option>
                                {mockUnits.map(u => <option key={u.id} value={u.id}>{u.nama_unit}</option>)}
                            </select>
                        </div>
                    }
                    actions={
                        <>
                            <button className="btn-secondary" onClick={() => alert('Mengunduh template Excel...')}><Download size={15} /><span className="hidden sm:inline">Template</span></button>
                            <button className="btn-secondary" onClick={() => alert('Fitur import data CSV/Excel')}><Upload size={15} /><span className="hidden sm:inline">Import</span></button>
                            <button className="btn-secondary" onClick={() => alert('Mengunduh laporan PDF...')}><FileText size={15} /><span className="hidden sm:inline">Laporan</span></button>
                            <button className="btn-primary" onClick={() => { setEditRow(null); setShowModal(true); }}><Plus size={15} /><span>Tambah Data</span></button>
                        </>
                    }
                />
                <DataTable columns={columns} data={filtered} />
                <div className="px-6 py-3 border-t border-slate-50 text-xs text-slate-400">
                    Menampilkan {filtered.length} dari {rows.length} data risiko
                </div>
            </div>
        </div>
    );
}
