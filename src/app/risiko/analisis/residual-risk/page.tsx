'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAppSettings } from '@/hooks/useAppSettings';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PageHeader, ScoreCard, FilterBar, TopActionBar } from '@/components/SharedUI';
import DataTable, { type Column } from '@/components/DataTable';
import RiskHeatmap, { type HeatmapPoint } from '@/components/RiskHeatmap';
import {
    Plus, FileText, AlertTriangle, ShieldAlert,
    CheckCircle2, Eye, Edit, Trash2, X, Save, Loader2, TrendingDown
} from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────────────── */
interface RiskRow {
    id: string;
    unit_kerja_id: string;
    tahun: number;
    kode_risiko?: string;
    identifikasi_risiko: string;
    akar_penyebab?: string;
    probabilitas: number;
    dampak: number;
    skor_risiko: number;
    mitigasi?: string;
    rencana_penanganan?: string;
    anggaran?: number;
    selera_risiko?: number;
    p_residual?: number;
    d_residual?: number;
    status: string;
    created_at: string;
    unit_kerja?: { id: string; nama_unit: string };
    master_work_units?: { id: string; name: string };
}

interface WorkUnit { id: string; name: string; }
interface RiskInputOption {
    id: string;
    kode_risiko?: string;
    nama_risiko?: string;
    identifikasi_deskripsi?: string;
    identifikasi_akar_penyebab?: string;
    penyebab_risiko?: string;
    nama_unit_kerja_id?: string;
    master_work_units?: { id: string; name: string };
}

/* ─── Helpers ────────────────────────────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
    const map: Record<string, string> = {
        Open: 'badge-red', Monitoring: 'badge-amber', 'Mitigasi Berjalan': 'badge-blue', Closed: 'badge-green',
    };
    return <span className={map[status] ?? 'badge-gray'}>{status}</span>;
}

function ScoreBadge({ score, className }: { score: number; className?: string }) {
    const color = score >= 15 ? 'text-rose-600' : score >= 10 ? 'text-orange-500' : score >= 5 ? 'text-yellow-600' : 'text-emerald-600';
    return <span className={`font-bold ${color} ${className ?? ''}`}>{score}</span>;
}

/* ─── Empty Form ─────────────────────────────────────────────────── */
const EMPTY_FORM = {
    unit_kerja_id: '',
    tahun: String(new Date().getFullYear()),
    risk_input_id: '',
    kode_risiko: '',
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

/* ─── Modal Form ─────────────────────────────────────────────────── */
function ResidualModal({ row, onClose, onSave, units, riskInputs, saving }: {
    row: Partial<typeof EMPTY_FORM> & { _id?: string } | null;
    onClose: () => void;
    onSave: (data: typeof EMPTY_FORM) => void;
    units: WorkUnit[];
    riskInputs: RiskInputOption[];
    saving: boolean;
}) {
    const [form, setForm] = useState({ ...EMPTY_FORM, ...(row ?? {}) });
    const f = (k: keyof typeof form, v: string | number) => setForm(prev => ({ ...prev, [k]: v }));

    const skor = form.probabilitas * form.dampak;
    const skor_res = form.p_residual * form.d_residual;
    const persen_turun = Math.max(0, Math.round((1 - skor_res / Math.max(skor, 1)) * 100));

    const selectedUnit = units.find(u => u.id === form.unit_kerja_id);
    const selectedUnitName = selectedUnit?.name;

    const filteredRisks = form.unit_kerja_id
        ? riskInputs.filter(r => {
            if (!r.nama_unit_kerja_id) return true;
            const rUnitName = r.master_work_units?.name;
            if (rUnitName && selectedUnitName) {
                return rUnitName.trim().toLowerCase() === selectedUnitName.trim().toLowerCase();
            }
            return r.nama_unit_kerja_id === form.unit_kerja_id;
        })
        : riskInputs;

    const handleRiskSelect = (riskId: string) => {
        f('risk_input_id', riskId);
        const risk = riskInputs.find(r => r.id === riskId);
        if (risk) {
            const title = risk.nama_risiko || risk.identifikasi_deskripsi || '';
            f('kode_risiko', risk.kode_risiko || '');
            f('identifikasi_risiko', title);
            const akar = risk.identifikasi_akar_penyebab || risk.penyebab_risiko || '';
            if (akar) {
                f('akar_penyebab', akar);
            }
            if (!form.unit_kerja_id && risk.master_work_units?.name) {
                const matchingUnit = units.find(u => u.name.trim().toLowerCase() === risk.master_work_units?.name?.trim().toLowerCase());
                if (matchingUnit) {
                    f('unit_kerja_id', matchingUnit.id);
                }
            }
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-slate-100">
                    <div>
                        <h2 className="font-bold text-slate-800 text-lg">{row?._id ? 'Edit Data Residual Risiko' : 'Tambah Data Residual Risiko'}</h2>
                        <p className="text-xs text-slate-500 mt-0.5">Input penilaian residual setelah tindakan mitigasi</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"><X size={18} /></button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-5 text-sm">
                    {/* Unit Kerja & Tahun */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="form-label">Unit Kerja *</label>
                            <select className="form-input w-full" value={form.unit_kerja_id} onChange={e => {
                                f('unit_kerja_id', e.target.value);
                                f('risk_input_id', '');
                                f('kode_risiko', '');
                                f('identifikasi_risiko', '');
                            }} required>
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
                        <label className="form-label">Pilih Risiko (dari Identifikasi Risiko)</label>
                        <select className="form-input w-full" value={form.risk_input_id} onChange={e => handleRiskSelect(e.target.value)}>
                            <option value="">-- Pilih Risiko --</option>
                            {filteredRisks.map(r => {
                                const title = r.nama_risiko || r.identifikasi_deskripsi || 'Tanpa Nama';
                                const codeText = r.kode_risiko ? `[${r.kode_risiko}] ` : '';
                                const unitTag = !form.unit_kerja_id && r.master_work_units?.name ? ` (${r.master_work_units.name})` : '';
                                return (
                                    <option key={r.id} value={r.id}>
                                        {codeText}{title}{unitTag}
                                    </option>
                                );
                            })}
                        </select>
                        {form.unit_kerja_id && filteredRisks.length === 0 && (
                            <p className="text-xs text-amber-600 mt-1">Belum ada data identifikasi risiko untuk unit kerja ini.</p>
                        )}
                    </div>

                    {/* Kode & Pernyataan */}
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="form-label">Kode Risiko</label>
                            <input type="text" className="form-input w-full bg-slate-50" value={form.kode_risiko} readOnly placeholder="Otomatis terisi" />
                        </div>
                        <div className="col-span-2">
                            <label className="form-label">Pernyataan Risiko *</label>
                            <input type="text" className="form-input w-full" value={form.identifikasi_risiko} onChange={e => f('identifikasi_risiko', e.target.value)} placeholder="Deskripsi risiko..." required />
                        </div>
                    </div>

                    {/* Inherent Risk */}
                    <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                        <p className="text-xs font-bold text-red-700 uppercase tracking-wide mb-3">Inherent Risk (Sebelum Mitigasi)</p>
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
                            <div className="text-center bg-white border border-red-200 rounded-xl p-3">
                                <div className="text-xs text-slate-500">Skor Inherent</div>
                                <div className={`text-2xl font-extrabold mt-1 ${skor >= 15 ? 'text-rose-600' : skor >= 10 ? 'text-orange-500' : skor >= 5 ? 'text-yellow-500' : 'text-emerald-500'}`}>{skor}</div>
                            </div>
                        </div>
                    </div>

                    {/* Tindakan Mitigasi */}
                    <div>
                        <label className="form-label">Tindakan Mitigasi yang Diterapkan</label>
                        <textarea className="form-input w-full h-16 resize-none" placeholder="Langkah mitigasi yang sudah/akan dilakukan…" value={form.mitigasi} onChange={e => f('mitigasi', e.target.value)} />
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
                                    <TrendingDown size={12} /> Turun {persen_turun}%
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Rencana & Anggaran */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="form-label">Rencana Penanganan Lanjutan</label>
                            <textarea className="form-input w-full h-20 resize-none" placeholder="Program kerja penanganan…" value={form.rencana_penanganan} onChange={e => f('rencana_penanganan', e.target.value)} />
                        </div>
                        <div>
                            <label className="form-label">Anggaran Mitigasi (Rp)</label>
                            <input type="number" className="form-input w-full" placeholder="e.g. 25000000" value={form.anggaran} onChange={e => f('anggaran', Number(e.target.value))} />
                            <p className="text-xs text-slate-400 mt-1">{form.anggaran > 0 ? `Rp ${(form.anggaran / 1_000_000).toFixed(1)} juta` : 'Masukkan nominal anggaran'}</p>
                            <label className="form-label mt-3">Selera Risiko (Skor maks)</label>
                            <input type="number" min={1} max={25} className="form-input w-full" value={form.selera_risiko} onChange={e => f('selera_risiko', Number(e.target.value))} />
                        </div>
                    </div>

                    {/* Status */}
                    <div>
                        <label className="form-label">Status Risiko</label>
                        <select className="form-input w-full" value={form.status} onChange={e => f('status', e.target.value)}>
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
                    <button onClick={() => onSave(form)} className="btn-primary flex items-center gap-2" disabled={saving}>
                        {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                        Simpan Data
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─── View Modal ─────────────────────────────────────────────────── */
function ViewModal({ row, onClose }: { row: RiskRow; onClose: () => void }) {
    const skor = row.skor_risiko;
    const p_res = row.p_residual ?? Math.ceil(row.probabilitas * 0.5);
    const d_res = row.d_residual ?? Math.ceil(row.dampak * 0.8);
    const skor_res = p_res * d_res;

    const heatmapData: HeatmapPoint[] = [
        { id: 'inh', x: row.dampak, y: row.probabilitas, label: 'Inherent', type: 'inherent' },
        { id: 'res', x: d_res, y: p_res, label: 'Residual', type: 'residual' },
        { id: 'app', x: Math.ceil((row.selera_risiko ?? 6) / 5), y: Math.ceil((row.selera_risiko ?? 6) / 5), label: 'Appetite', type: 'appetite' },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-8">
                <div className="flex justify-between items-center p-6 border-b border-slate-100">
                    <h2 className="font-bold text-slate-800 text-lg">Detail Residual Risiko</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"><X size={18} /></button>
                </div>
                <div className="p-6 space-y-6 text-sm">
                    <div className="grid grid-cols-2 gap-4">
                        <div><span className="text-xs text-slate-400">Unit Kerja</span><p className="font-semibold mt-0.5">{row.unit_kerja?.nama_unit ?? '-'}</p></div>
                        <div><span className="text-xs text-slate-400">Tahun</span><p className="font-semibold mt-0.5">{row.tahun}</p></div>
                        {row.kode_risiko && <div><span className="text-xs text-slate-400">Kode Risiko</span><p className="font-semibold mt-0.5">{row.kode_risiko}</p></div>}
                        <div className="col-span-2"><span className="text-xs text-slate-400">Pernyataan Risiko</span><p className="font-semibold mt-0.5 leading-relaxed">{row.identifikasi_risiko}</p></div>
                        {row.akar_penyebab && <div className="col-span-2"><span className="text-xs text-slate-400">Akar Penyebab</span><p className="mt-0.5 text-slate-600 leading-relaxed">{row.akar_penyebab}</p></div>}
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
                            <div className="text-xs text-slate-500 mt-0.5">Batas toleransi</div>
                        </div>
                        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                            <div className="text-xs text-slate-500">Residual Risk</div>
                            <div className="text-3xl font-extrabold mt-1 text-emerald-600">{skor_res}</div>
                            <div className="text-xs text-slate-500 mt-0.5">P:{p_res} × D:{d_res}</div>
                        </div>
                    </div>

                    <div>
                        <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-4">Posisi Risiko pada Heatmap 5×5</p>
                        <RiskHeatmap data={heatmapData} />
                    </div>

                    {row.mitigasi && <div><span className="text-xs text-slate-400">Tindakan Mitigasi</span><p className="mt-0.5 text-slate-700 leading-relaxed">{row.mitigasi}</p></div>}
                    {row.rencana_penanganan && <div><span className="text-xs text-slate-400">Rencana Penanganan</span><p className="mt-0.5 text-slate-700 leading-relaxed">{row.rencana_penanganan}</p></div>}
                    {row.anggaran != null && row.anggaran > 0 && <div><span className="text-xs text-slate-400">Anggaran Mitigasi</span><p className="mt-0.5 font-semibold">Rp {row.anggaran.toLocaleString('id-ID')}</p></div>}
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
export default function ResidualRiskPage() {
    const { settings } = useAppSettings();
    const [search, setSearch] = useState('');
    const [year, setYear] = useState(String(new Date().getFullYear()));
    const [unitFilter, setUnitFilter] = useState('');
    const [rows, setRows] = useState<RiskRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [units, setUnits] = useState<WorkUnit[]>([]);
    const [riskInputs, setRiskInputs] = useState<RiskInputOption[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [viewRow, setViewRow] = useState<RiskRow | null>(null);
    const [editRow, setEditRow] = useState<Partial<typeof EMPTY_FORM> & { _id?: string } | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            let q = supabase
                .from('manajemen_risiko')
                .select('*, unit_kerja(id, nama_unit)')
                .order('created_at', { ascending: false });
            if (year) q = q.eq('tahun', Number(year));
            const { data, error } = await q;
            if (error) { console.error('Error fetching:', error); setRows([]); }
            else setRows((data as RiskRow[]) ?? []);
        } catch (e) { console.error(e); setRows([]); }
        finally { setLoading(false); }
    }, [year]);

    useEffect(() => { fetchData(); }, [fetchData]);

    useEffect(() => {
        supabase
            .from('unit_kerja')
            .select('id, nama_unit')
            .order('nama_unit', { ascending: true })
            .then(({ data }: { data: any }) => setUnits((data ?? []).map((u: any) => ({ id: u.id, name: u.nama_unit }))));

        supabase
            .from('risk_inputs')
            .select('id, kode_risiko, nama_risiko, identifikasi_deskripsi, identifikasi_akar_penyebab, penyebab_risiko, nama_unit_kerja_id, master_work_units(id, name)')
            .order('created_at', { ascending: false })
            .then(({ data }: { data: any }) => setRiskInputs((data ?? []) as RiskInputOption[]));
    }, []);

    const filtered = rows.filter(d => {
        const matchSearch = (d.identifikasi_risiko || '').toLowerCase().includes(search.toLowerCase()) ||
            (d.kode_risiko || '').toLowerCase().includes(search.toLowerCase());
        const matchUnit = unitFilter ? d.unit_kerja_id === unitFilter : true;
        return matchSearch && matchUnit;
    });

    // Stats computed from real data
    const stats = {
        total: filtered.length,
        inheritTinggi: filtered.filter(d => d.skor_risiko >= 15).length,
        residualAman: filtered.filter(d => {
            const res = (d.p_residual ?? Math.ceil(d.probabilitas * 0.5)) * (d.d_residual ?? Math.ceil(d.dampak * 0.8));
            return res < 5;
        }).length,
        mitigasiAktif: filtered.filter(d => d.status === 'Mitigasi Berjalan' || d.status === 'Monitoring').length,
    };

    // Heatmap data from DB
    const chartData: HeatmapPoint[] = filtered.flatMap(r => {
        const p_res = (r.p_residual != null ? r.p_residual : Math.ceil(r.probabilitas * 0.5)) || 1;
        const d_res = (r.d_residual != null ? r.d_residual : Math.ceil(r.dampak * 0.8)) || 1;
        return [
            { id: r.id + '_inh', x: r.dampak, y: r.probabilitas, label: r.identifikasi_risiko, type: 'inherent' as const },
            { id: r.id + '_res', x: d_res, y: p_res, label: r.identifikasi_risiko, type: 'residual' as const },
        ];
    });

    const handleSave = async (form: typeof EMPTY_FORM) => {
        if (!form.identifikasi_risiko || !form.identifikasi_risiko.trim()) {
            alert('Pernyataan / Identifikasi Risiko wajib diisi!');
            return;
        }
        setSaving(true);
        try {
            const payload = {
                unit_kerja_id: form.unit_kerja_id || null,
                tahun: Number(form.tahun),
                kode_risiko: form.kode_risiko || null,
                identifikasi_risiko: form.identifikasi_risiko.trim(),
                akar_penyebab: form.akar_penyebab || null,
                probabilitas: Number(form.probabilitas),
                dampak: Number(form.dampak),
                mitigasi: form.mitigasi || null,
                rencana_penanganan: form.rencana_penanganan || null,
                anggaran: form.anggaran ? Number(form.anggaran) : null,
                selera_risiko: Number(form.selera_risiko),
                p_residual: Number(form.p_residual),
                d_residual: Number(form.d_residual),
                status: form.status,
            };

            let error;
            if (editRow?._id) {
                ({ error } = await supabase.from('manajemen_risiko').update(payload).eq('id', editRow._id));
            } else {
                ({ error } = await supabase.from('manajemen_risiko').insert(payload));
            }

            if (error) {
                console.error('Error saving:', error);
                alert('Gagal menyimpan: ' + error.message);
            } else {
                setShowModal(false);
                setEditRow(null);
                fetchData();
            }
        } catch (e: any) {
            console.error(e);
            alert('Terjadi kesalahan saat menyimpan data');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (row: RiskRow) => {
        if (!confirm(`Hapus data residual risiko "${row.identifikasi_risiko}"?`)) return;
        await supabase.from('manajemen_risiko').delete().eq('id', row.id);
        fetchData();
    };

    const handleExportPDF = () => {
        const doc = new jsPDF('p', 'pt', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        const hexToRgb = (hex: string): [number, number, number] => {
            const def: [number, number, number] = [19, 127, 236];
            if (!hex) return def;
            const h = hex.replace('#', '');
            if (h.length !== 6) return def;
            const num = parseInt(h, 16);
            return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
        };

        const primaryColor = settings?.warna_primer || '#137fec';
        const rgbColor = hexToRgb(primaryColor);

        const addHeader = (d: jsPDF, title: string) => {
            d.setDrawColor(226, 232, 240); d.setLineWidth(1); d.line(40, 55, pageWidth - 40, 55);
            d.setTextColor(71, 85, 105); d.setFontSize(8); d.setFont('helvetica', 'bold');
            d.text((settings?.nama_rs || 'RUMAH SAKIT').toUpperCase(), 40, 45);
            d.setTextColor(148, 163, 184); d.setFont('helvetica', 'normal');
            d.text(title, pageWidth - 40, 45, { align: 'right' });
        };

        const addFooter = (d: jsPDF) => {
            const totalPages = d.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                d.setPage(i); if (i === 1) continue;
                d.setTextColor(148, 163, 184); d.setFontSize(8); d.setFont('helvetica', 'normal');
                d.text(settings?.footer || 'Laporan Internal Rumah Sakit', 40, pageHeight - 30);
                d.text(`Halaman ${i - 1} dari ${totalPages - 1}`, pageWidth - 40, pageHeight - 30, { align: 'right' });
                d.setDrawColor(226, 232, 240); d.setLineWidth(0.75); d.line(40, pageHeight - 40, pageWidth - 40, pageHeight - 40);
            }
        };

        const drawKopSurat = (d: jsPDF) => {
            d.setDrawColor(30, 41, 59); d.setLineWidth(1.5); d.line(40, 110, pageWidth - 40, 110);
            d.setLineWidth(0.5); d.line(40, 114, pageWidth - 40, 114);
            d.setTextColor(30, 41, 59); d.setFont('helvetica', 'bold'); d.setFontSize(14);
            d.text((settings?.nama_rs || 'RUMAH SAKIT').toUpperCase(), 40, 50);
            d.setFont('helvetica', 'normal'); d.setFontSize(9); d.setTextColor(71, 85, 105);
            d.text(settings?.alamat || '', 40, 68);
            d.text(`Kota: ${settings?.kota || '-'} | Telp: ${settings?.telepon || '-'} | Email: ${settings?.email || '-'} | Web: ${settings?.website || '-'}`, 40, 84);
            if (settings?.tagline) { d.setFont('helvetica', 'oblique'); d.setFontSize(8); d.text(`"${settings.tagline}"`, 40, 98); }
        };

        // Cover Page
        doc.setFillColor(rgbColor[0], rgbColor[1], rgbColor[2]);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22); doc.setFont('helvetica', 'bold');
        doc.text('LAPORAN RESIDUAL RISK', pageWidth / 2, pageHeight / 2 - 60, { align: 'center' });
        doc.setFontSize(16); doc.setFont('helvetica', 'normal');
        doc.text(`Tahun: ${year || 'Semua'}`, pageWidth / 2, pageHeight / 2, { align: 'center' });
        doc.setFontSize(12);
        doc.text((settings?.nama_rs || 'RUMAH SAKIT').toUpperCase(), pageWidth / 2, pageHeight / 2 + 50, { align: 'center' });

        doc.addPage();
        let tocPageNum = doc.getCurrentPageInfo().pageNumber;
        doc.addPage();
        let contentPageStart = doc.getCurrentPageInfo().pageNumber;
        drawKopSurat(doc);

        doc.setTextColor(30, 41, 59); doc.setFontSize(13); doc.setFont('helvetica', 'bold');
        doc.text('A. Rekapitulasi Analisis Residual Risk', 40, 140);
        let finalY = 160;

        let rowIdx = 1;
        const tableData = filtered.map(item => {
            const p_res = item.p_residual ?? Math.ceil(item.probabilitas * 0.5);
            const d_res = item.d_residual ?? Math.ceil(item.dampak * 0.8);
            const skor_res = p_res * d_res;
            return [
                rowIdx++,
                (item as any).unit_kerja?.nama_unit || '-',
                item.kode_risiko || '-',
                item.identifikasi_risiko || '-',
                `${item.skor_risiko} (P:${item.probabilitas} D:${item.dampak})`,
                item.mitigasi || '-',
                `${skor_res} (P:${p_res} D:${d_res})`,
                item.status || 'Open'
            ];
        });

        autoTable(doc, {
            startY: finalY,
            head: [['No', 'Unit Kerja', 'Kode', 'Pernyataan Risiko', 'Inherent', 'Mitigasi', 'Residual', 'Status']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: rgbColor, fontSize: 8, fontStyle: 'bold' },
            styles: { fontSize: 8, cellPadding: 4 },
            columnStyles: {
                0: { cellWidth: 20, halign: 'center' },
                1: { cellWidth: 75 },
                2: { cellWidth: 40 },
                3: { cellWidth: 110 },
                4: { cellWidth: 75 },
                5: { cellWidth: 85 },
                6: { cellWidth: 75 },
                7: { cellWidth: 35, halign: 'center' }
            },
            margin: { left: 40, right: 40 },
            didDrawPage: () => { const cp = doc.getCurrentPageInfo().pageNumber; if (cp > contentPageStart) addHeader(doc, 'Laporan Residual Risk'); }
        });
        finalY = (doc as any).lastAutoTable.finalY + 20;

        // TOC
        doc.setPage(tocPageNum); addHeader(doc, 'Daftar Isi');
        doc.setTextColor(30, 41, 59); doc.setFontSize(15); doc.setFont('helvetica', 'bold');
        doc.text('DAFTAR ISI LAPORAN', 40, 100);
        doc.setDrawColor(226, 232, 240); doc.setLineWidth(1); doc.line(40, 112, pageWidth - 40, 112);
        doc.setFontSize(10.5); doc.setFont('helvetica', 'normal');
        doc.text('1. Rekapitulasi Analisis Residual Risk', 40, 140);
        doc.text(`${contentPageStart - 1}`, pageWidth - 40, 140, { align: 'right' });
        doc.text('2. Lembar Tanda Tangan Pengesahan Laporan', 40, 160);
        const lastPage = doc.getNumberOfPages();
        doc.text(`${lastPage - 1}`, pageWidth - 40, 160, { align: 'right' });

        // Signature
        doc.setPage(lastPage);
        if (finalY > pageHeight - 150) { doc.addPage(); finalY = 70; } else { finalY += 15; }
        doc.setFontSize(9.5); doc.setTextColor(51, 65, 85); doc.setFont('helvetica', 'normal');
        doc.text('Disiapkan oleh,', 60, finalY);
        doc.text('Staf Komite Mutu & Manajemen Risiko', 60, finalY + 14);
        doc.line(60, finalY + 65, 200, finalY + 65);
        doc.text('Pengelola Manajemen Risiko', 60, finalY + 78);
        doc.text('Disetujui oleh,', pageWidth - 200, finalY);
        doc.setFont('helvetica', 'bold');
        doc.text(settings?.kepala_rs || 'Pimpinan Rumah Sakit', pageWidth - 200, finalY + 14);
        doc.line(pageWidth - 200, finalY + 65, pageWidth - 60, finalY + 65);
        doc.setFont('helvetica', 'normal');
        doc.text(`NIP: ${settings?.nip_kepala || '-'}`, pageWidth - 200, finalY + 78);

        addFooter(doc);
        doc.save(`Laporan_Residual_Risk_${year || 'Semua'}.pdf`);
    };

    const columns: Column<RiskRow>[] = [
        { key: 'tahun', label: 'Tahun', className: 'w-20 text-center' },
        { key: 'unit_kerja_id', label: 'Unit Kerja', render: r => (r as any).unit_kerja?.nama_unit ?? '-' },
        {
            key: 'identifikasi_risiko', label: 'Pernyataan Risiko', className: 'max-w-xs',
            render: r => (
                <div>
                    {r.kode_risiko && <span className="text-xs font-mono text-slate-400 block">{r.kode_risiko}</span>}
                    <span className="line-clamp-2">{r.identifikasi_risiko}</span>
                </div>
            )
        },
        {
            key: 'skor_risiko', label: 'Inherent', className: 'text-center',
            render: r => <ScoreBadge score={r.skor_risiko} />
        },
        {
            key: 'p_residual', label: 'Res Prob', className: 'text-center',
            render: r => r.p_residual ?? Math.ceil(r.probabilitas * 0.5)
        },
        {
            key: 'd_residual', label: 'Res Dampak', className: 'text-center',
            render: r => r.d_residual ?? Math.ceil(r.dampak * 0.8)
        },
        {
            key: 'mitigasi', label: 'Residual', className: 'text-center',
            render: r => {
                const res = (r.p_residual ?? Math.ceil(r.probabilitas * 0.5)) * (r.d_residual ?? Math.ceil(r.dampak * 0.8));
                return <ScoreBadge score={res} className="text-emerald-600" />;
            }
        },
        { key: 'status', label: 'Status', render: r => <StatusBadge status={r.status} /> },
        {
            key: 'actions', label: 'Aksi', render: r => (
                <div className="flex gap-1 justify-center">
                    <button className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Lihat detail" onClick={() => setViewRow(r)}><Eye size={15} /></button>
                    <button className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded" title="Edit" onClick={() => {
                        setEditRow({ ...EMPTY_FORM, ...r, tahun: String(r.tahun), _id: r.id });
                        setShowModal(true);
                    }}><Edit size={15} /></button>
                    <button className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded" title="Hapus" onClick={() => handleDelete(r)}><Trash2 size={15} /></button>
                </div>
            )
        },
    ];

    return (
        <div>
            {showModal && (
                <ResidualModal
                    row={editRow}
                    onClose={() => { setShowModal(false); setEditRow(null); }}
                    onSave={handleSave}
                    units={units}
                    riskInputs={riskInputs}
                    saving={saving}
                />
            )}
            {viewRow && <ViewModal row={viewRow} onClose={() => setViewRow(null)} />}

            <PageHeader title="Residual Risk" subtitle="Analisis Risiko Inherent vs Residual setelah mitigasi." />

            {/* Score Cards */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
                <ScoreCard icon={<ShieldAlert size={22} className="text-slate-500" />} title="Total Evaluasi" value={stats.total} colorClass="bg-slate-50 border-slate-100" />
                <ScoreCard icon={<AlertTriangle size={22} className="text-rose-500" />} title="Inherent ≥ 15" value={stats.inheritTinggi} colorClass="bg-rose-50 border-rose-100" />
                <ScoreCard icon={<CheckCircle2 size={22} className="text-emerald-500" />} title="Residual Aman" value={stats.residualAman} subtitle="Skor residual < 5" colorClass="bg-emerald-50 border-emerald-100" />
                <ScoreCard icon={<FileText size={22} className="text-blue-500" />} title="Mitigasi Aktif" value={stats.mitigasiAktif} colorClass="bg-blue-50 border-blue-100" />
            </div>

            {/* Heatmap */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-8">
                <h3 className="text-sm font-semibold text-slate-800 mb-6 flex items-center">
                    <span className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center mr-3">📉</span>
                    Diagram Heatmap Inherent vs Residual
                </h3>
                <div className="w-full">
                    {chartData.length > 0 ? (
                        <RiskHeatmap data={chartData} />
                    ) : (
                        <div className="flex items-center justify-center h-48 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl">
                            Belum ada data residual risiko yang tersedia
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
                                searchValue={search} onSearchChange={setSearch} searchPlaceholder="Cari risiko..."
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
                            <button className="btn-secondary border-primary/20 text-primary hover:bg-primary/5 flex items-center gap-2" onClick={handleExportPDF}>
                                <FileText size={15} /><span>Laporan</span>
                            </button>
                            <button className="btn-primary flex items-center gap-2" onClick={() => { setEditRow(null); setShowModal(true); }}>
                                {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                                <span>Tambah Data</span>
                            </button>
                        </>
                    }
                />
                <DataTable columns={columns} data={filtered} isLoading={loading} />
                <div className="px-6 py-3 border-t border-slate-50 text-xs text-slate-400">
                    Menampilkan {filtered.length} dari {rows.length} data residual risiko
                </div>
            </div>
        </div>
    );
}
