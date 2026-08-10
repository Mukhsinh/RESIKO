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
    Plus, Download, Upload, FileText, AlertTriangle, ShieldAlert,
    CheckCircle2, Eye, Edit, Trash2, X, Save, TrendingDown, Loader2
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Legend } from 'recharts';

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
    master_work_units?: { id: string; name: string };
    unit_kerja?: { id: string; nama_unit: string };
    risk_inputs?: { id: string; kode_risiko?: string; nama_risiko?: string };
}

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

interface WorkUnit {
    id: string;
    name: string;
}

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

function RiskModal({ row, onClose, onSave, units, riskInputs, saving }: {
    row: Partial<typeof EMPTY_FORM> | null;
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

    // Direct unit name matching between unit_kerja and master_work_units
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
                <div className="flex justify-between items-center p-6 border-b border-slate-100">
                    <div>
                        <h2 className="font-bold text-slate-800 text-lg">{row && 'identifikasi_risiko' in (row || {}) && row.identifikasi_risiko ? 'Edit Data Risiko' : 'Tambah Data Risiko Baru'}</h2>
                        <p className="text-xs text-slate-500 mt-0.5">Isi seluruh field sesuai standar manajemen risiko RS</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"><X size={18} /></button>
                </div>

                <div className="p-6 space-y-5 text-sm">
                    {/* Unit Kerja & Tahun */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Unit Kerja *</label>
                            <select className="form-input w-full" value={form.unit_kerja_id} onChange={e => { f('unit_kerja_id', e.target.value); f('risk_input_id', ''); f('kode_risiko', ''); f('identifikasi_risiko', ''); }}>
                                <option value="">-- Pilih Unit --</option>
                                {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Tahun *</label>
                            <select className="form-input w-full" value={form.tahun} onChange={e => f('tahun', e.target.value)}>
                                {[2024, 2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Pilih Risiko dari Identifikasi */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Pilih Risiko (dari Identifikasi Risiko)</label>
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
                            <p className="text-xs text-amber-600 mt-1">Belum ada data identifikasi risiko untuk unit kerja ini di menu Identifikasi Risiko.</p>
                        )}
                    </div>

                    {/* Kode & Pernyataan Risiko */}
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Kode Risiko</label>
                            <input type="text" className="form-input w-full bg-slate-50" value={form.kode_risiko} readOnly placeholder="Otomatis terisi" />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Pernyataan / Identifikasi Risiko *</label>
                            <input type="text" className="form-input w-full" placeholder="Deskripsi risiko..." value={form.identifikasi_risiko} onChange={e => f('identifikasi_risiko', e.target.value)} />
                        </div>
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

                    {/* Mitigasi */}
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

                    {/* Anggaran & Selera */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Anggaran Mitigasi (Rp)</label>
                            <input type="number" className="form-input w-full" placeholder="e.g. 25000000" value={form.anggaran} onChange={e => f('anggaran', Number(e.target.value))} />
                            <p className="text-xs text-slate-400 mt-1">{form.anggaran > 0 ? `Rp ${(form.anggaran / 1_000_000).toFixed(1)} juta` : 'Masukkan nominal anggaran'}</p>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Selera Risiko / Risk Appetite (Skor maks)</label>
                            <input type="number" min={1} max={25} className="form-input w-full" value={form.selera_risiko} onChange={e => f('selera_risiko', Number(e.target.value))} />
                            <p className={`text-xs mt-1 font-medium ${skor > form.selera_risiko ? 'text-rose-500' : 'text-emerald-500'}`}>
                                {skor > form.selera_risiko ? '⚠ Inherent melebihi selera risiko' : '✓ Dalam batas selera risiko'}
                            </p>
                        </div>
                    </div>

                    {/* Status */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Status Risiko</label>
                        <select className="form-input w-full" value={form.status} onChange={e => f('status', e.target.value)}>
                            <option>Open</option>
                            <option>Mitigasi Berjalan</option>
                            <option>Monitoring</option>
                            <option>Closed</option>
                        </select>
                    </div>
                </div>

                <div className="flex justify-end gap-3 px-6 pb-6">
                    <button onClick={onClose} className="btn-secondary">Batal</button>
                    <button onClick={() => onSave(form)} disabled={saving} className="btn-primary flex items-center gap-2">
                        {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Simpan Data
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─── View Modal ─────────────────────────────────────────────────── */
function ViewModal({ row, onClose }: { row: RiskRow; onClose: () => void }) {
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
                        <div><span className="text-xs text-slate-400">Unit Kerja</span><p className="font-semibold mt-0.5">{(row as any).unit_kerja?.nama_unit ?? row.master_work_units?.name ?? '-'}</p></div>
                        <div><span className="text-xs text-slate-400">Tahun</span><p className="font-semibold mt-0.5">{row.tahun}</p></div>
                        {row.kode_risiko && <div><span className="text-xs text-slate-400">Kode Risiko</span><p className="font-semibold mt-0.5">{row.kode_risiko}</p></div>}
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
            if (error) { console.error('Error fetching risk profile:', error); setRows([]); }
            else setRows((data as RiskRow[]) ?? []);
        } catch (e) { console.error(e); setRows([]); }
        finally { setLoading(false); }
    }, [year]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

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
        const matchSearch = (d.identifikasi_risiko || '').toLowerCase().includes(search.toLowerCase()) || (d.kode_risiko || '').toLowerCase().includes(search.toLowerCase());
        const matchUnit = unitFilter ? d.unit_kerja_id === unitFilter : true;
        return matchSearch && matchUnit;
    });

    const stats = {
        total: filtered.length,
        tinggi: filtered.filter(d => d.skor_risiko >= 15).length,
        sedang: filtered.filter(d => d.skor_risiko >= 5 && d.skor_risiko < 15).length,
        rendah: filtered.filter(d => d.skor_risiko < 5).length,
    };

    const unitScoreData = units.map(unit => {
        const ur = rows.filter(r => r.unit_kerja_id === unit.id);
        return {
            name: unit.name.length > 12 ? unit.name.substring(0, 12) + '…' : unit.name,
            'Total Risiko': ur.length,
            'Rata-rata Skor': ur.length ? +(ur.reduce((s, r) => s + r.skor_risiko, 0) / ur.length).toFixed(1) : 0,
        };
    }).filter(u => u['Total Risiko'] > 0);

    const heatmapData: HeatmapPoint[] = filtered.flatMap(r => [
        { id: r.id + '_inh', x: r.dampak, y: r.probabilitas, label: r.identifikasi_risiko, type: 'inherent' as const },
        { id: r.id + '_res', x: r.d_residual ?? Math.ceil(r.dampak * 0.8), y: r.p_residual ?? Math.ceil(r.probabilitas * 0.5), label: r.identifikasi_risiko, type: 'residual' as const },
    ]);

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
        if (!confirm(`Hapus risiko "${row.identifikasi_risiko}"?`)) return;
        await supabase.from('manajemen_risiko').delete().eq('id', row.id);
        fetchData();
    };

    const handleExportPDF = () => {
        const doc = new jsPDF('p', 'pt', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        const hexToRgb = (hex: string): [number, number, number] => {
            const def: [number, number, number] = [19, 127, 236]; // Blue primary
            if (!hex) return def;
            const h = hex.replace('#', '');
            if (h.length !== 6) return def;
            const num = parseInt(h, 16);
            return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
        };

        const primaryColor = settings?.warna_primer || '#137fec';
        const rgbColor = hexToRgb(primaryColor);

        const addHeader = (d: jsPDF, title: string) => {
            d.setDrawColor(226, 232, 240);
            d.setLineWidth(1);
            d.line(40, 55, pageWidth - 40, 55);

            d.setTextColor(71, 85, 105);
            d.setFontSize(8);
            d.setFont('helvetica', 'bold');
            d.text((settings?.nama_rs || 'RUMAH SAKIT').toUpperCase(), 40, 45);

            d.setTextColor(148, 163, 184);
            d.setFont('helvetica', 'normal');
            d.text(title, pageWidth - 40, 45, { align: 'right' });
        };

        const addFooter = (d: jsPDF) => {
            const totalPages = d.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                d.setPage(i);
                if (i === 1) continue; // skip cover
                d.setTextColor(148, 163, 184);
                d.setFontSize(8);
                d.setFont('helvetica', 'normal');
                d.text(settings?.footer || 'Laporan Internal Rumah Sakit', 40, pageHeight - 30);
                d.text(`Halaman ${i - 1} dari ${totalPages - 1}`, pageWidth - 40, pageHeight - 30, { align: 'right' });
                d.setDrawColor(226, 232, 240);
                d.setLineWidth(0.75);
                d.line(40, pageHeight - 40, pageWidth - 40, pageHeight - 40);
            }
        };

        const drawKopSurat = (d: jsPDF) => {
            d.setDrawColor(30, 41, 59);
            d.setLineWidth(1.5);
            d.line(40, 110, pageWidth - 40, 110);
            d.setDrawColor(30, 41, 59);
            d.setLineWidth(0.5);
            d.line(40, 114, pageWidth - 40, 114);

            d.setTextColor(30, 41, 59);
            d.setFont('helvetica', 'bold');
            d.setFontSize(14);
            d.text((settings?.nama_rs || 'RUMAH SAKIT').toUpperCase(), 40, 50);

            d.setFont('helvetica', 'normal');
            d.setFontSize(9);
            d.setTextColor(71, 85, 105);
            d.text(settings?.alamat || '', 40, 68);
            d.text(`Kota: ${settings?.kota || '-'} | Telp: ${settings?.telepon || '-'} | Email: ${settings?.email || '-'} | Web: ${settings?.website || '-'}`, 40, 84);

            if (settings?.tagline) {
                d.setFont('helvetica', 'oblique');
                d.setFontSize(8);
                d.text(`"${settings.tagline}"`, 40, 98);
            }
        };

        // Cover Page
        doc.setFillColor(rgbColor[0], rgbColor[1], rgbColor[2]);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');
        doc.setTextColor(255, 255, 255);

        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('LAPORAN PROFIL RISIKO', pageWidth / 2, pageHeight / 2 - 60, { align: 'center' });

        doc.setFontSize(16);
        doc.setFont('helvetica', 'normal');
        doc.text(`Tahun: ${year || 'Semua'}`, pageWidth / 2, pageHeight / 2, { align: 'center' });

        doc.setFontSize(12);
        doc.text((settings?.nama_rs || 'RUMAH SAKIT').toUpperCase(), pageWidth / 2, pageHeight / 2 + 50, { align: 'center' });

        doc.addPage();

        // TOC Page
        let tocPageNum = doc.getCurrentPageInfo().pageNumber;
        doc.addPage(); // skip for TOC

        let contentPageStart = doc.getCurrentPageInfo().pageNumber;

        // Draw KOP Surat on first content page
        drawKopSurat(doc);

        doc.setTextColor(30, 41, 59);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('A. Rekapitulasi Daftar Profil Risiko Internal', 40, 140);

        let finalY = 160;

        let rowIdx = 1;
        const tableData = filtered.map(item => {
            const skor_res = (item.p_residual ?? Math.ceil(item.probabilitas * 0.5)) * (item.d_residual ?? Math.ceil(item.dampak * 0.8));

            let inherentStr = `Skor: ${item.skor_risiko} (P:${item.probabilitas} D:${item.dampak})`;
            let residualStr = `Skor: ${skor_res} (P:${item.p_residual ?? '-'} D:${item.d_residual ?? '-'})`;

            return [
                rowIdx++,
                item.kode_risiko || '-',
                (item as any).unit_kerja?.nama_unit || item.master_work_units?.name || '-',
                item.identifikasi_risiko || '-',
                inherentStr,
                item.mitigasi || '-',
                residualStr,
                item.status || 'Open'
            ];
        });

        autoTable(doc, {
            startY: finalY,
            head: [['No', 'Kode', 'Unit Kerja', 'Pernyataan Risiko', 'Inherent Risk', 'Tindakan Mitigasi', 'Residual Risk', 'Status']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: rgbColor, fontSize: 8, fontStyle: 'bold' },
            styles: { fontSize: 8, cellPadding: 4 },
            columnStyles: {
                0: { cellWidth: 20, halign: 'center' },
                1: { cellWidth: 40 },
                2: { cellWidth: 75 },
                3: { cellWidth: 110 },
                4: { cellWidth: 75 },
                5: { cellWidth: 85 },
                6: { cellWidth: 75 },
                7: { cellWidth: 35, halign: 'center' }
            },
            margin: { left: 40, right: 40 },
            didDrawPage: (data) => {
                const currentPage = doc.getCurrentPageInfo().pageNumber;
                if (currentPage > contentPageStart) {
                    addHeader(doc, 'Laporan Profil Risiko');
                }
            }
        });
        finalY = (doc as any).lastAutoTable.finalY + 20;

        // Add TOC Content
        doc.setPage(tocPageNum);
        addHeader(doc, 'Daftar Isi');
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(15);
        doc.setFont('helvetica', 'bold');
        doc.text('DAFTAR ISI LAPORAN', 40, 100);

        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(1);
        doc.line(40, 112, pageWidth - 40, 112);

        doc.setFontSize(10.5);
        doc.setFont('helvetica', 'normal');

        doc.text('1. Rekapitulasi Daftar Profil Risiko Unit Kerja', 40, 140);
        doc.text(`${contentPageStart - 1}`, pageWidth - 40, 140, { align: 'right' });

        doc.text('2. Lembar Tanda Tangan Pengesahan Laporan', 40, 160);
        const lastPage = doc.getNumberOfPages();
        doc.text(`${lastPage - 1}`, pageWidth - 40, 160, { align: 'right' });

        // Go to last page for signature block
        doc.setPage(lastPage);
        if (finalY > pageHeight - 150) {
            doc.addPage();
            finalY = 70;
        } else {
            finalY += 15;
        }

        doc.setFontSize(9.5);
        doc.setTextColor(51, 65, 85);
        doc.setFont('helvetica', 'normal');
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
        doc.save(`Laporan_Risk_Profile_${year || 'Semua'}.pdf`);
    };

    const columns: Column<RiskRow>[] = [
        { key: 'kode_risiko', label: 'Kode', className: 'w-24', render: r => <span className="font-mono text-xs">{r.kode_risiko || '-'}</span> },
        { key: 'tahun', label: 'Tahun', className: 'w-16 text-center' },
        { key: 'unit_kerja_id', label: 'Unit Kerja', render: r => (r as any).unit_kerja?.nama_unit ?? r.master_work_units?.name ?? '-' },
        { key: 'identifikasi_risiko', label: 'Identifikasi Risiko', className: 'max-w-xs', render: r => <span className="line-clamp-2">{r.identifikasi_risiko}</span> },
        { key: 'probabilitas', label: 'Prob', className: 'text-center w-14' },
        { key: 'dampak', label: 'Dampak', className: 'text-center w-16' },
        { key: 'skor_risiko', label: 'Skor', className: 'text-center', render: r => <RiskScoreBadge score={r.skor_risiko} /> },
        { key: 'status', label: 'Status', render: r => <StatusBadge status={r.status} /> },
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
                <RiskModal
                    row={editRow}
                    onClose={() => { setShowModal(false); setEditRow(null); }}
                    onSave={handleSave}
                    units={units}
                    riskInputs={riskInputs}
                    saving={saving}
                />
            )}
            {viewRow && <ViewModal row={viewRow} onClose={() => setViewRow(null)} />}

            <PageHeader title="Risk Profile" subtitle="Distribusi dan profil sebaran risiko di setiap unit kerja." />

            {/* Score Cards */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
                <ScoreCard icon={<ShieldAlert size={22} className="text-slate-500" />} title="Total Risiko" value={stats.total} colorClass="bg-slate-50 border-slate-100" />
                <ScoreCard icon={<AlertTriangle size={22} className="text-rose-500" />} title="Sangat Tinggi" value={stats.tinggi} subtitle="Skor ≥ 15" colorClass="bg-rose-50 border-rose-100" />
                <ScoreCard icon={<AlertTriangle size={22} className="text-amber-500" />} title="Sedang" value={stats.sedang} subtitle="Skor 5–14" colorClass="bg-amber-50 border-amber-100" />
                <ScoreCard icon={<CheckCircle2 size={22} className="text-emerald-500" />} title="Rendah / Closed" value={stats.rendah} subtitle="Skor < 5" colorClass="bg-emerald-50 border-emerald-100" />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                    <h3 className="text-sm font-semibold text-slate-800 mb-6 flex items-center">
                        <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mr-3">📊</span>
                        Profil Risiko per Unit Kerja
                    </h3>
                    <div className="h-64 w-full">
                        {unitScoreData.length > 0 ? (
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
                        ) : (
                            <div className="flex items-center justify-center h-full text-slate-400 text-sm">Belum ada data risiko</div>
                        )}
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                    <h3 className="text-sm font-semibold text-slate-800 mb-6 flex items-center">
                        <span className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center mr-3">🗺</span>
                        Heatmap Risiko (Inherent &amp; Residual)
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
                            <select className="form-input text-sm h-9" value={unitFilter} onChange={e => setUnitFilter(e.target.value)}>
                                <option value="">Semua Unit</option>
                                {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </select>
                        </div>
                    }
                    actions={
                        <>
                            <button className="btn-secondary"><Download size={15} /><span className="hidden sm:inline">Template</span></button>
                            <button className="btn-secondary"><Upload size={15} /><span className="hidden sm:inline">Import</span></button>
                            <button className="btn-secondary border-primary/20 text-primary hover:bg-primary/5" onClick={handleExportPDF}><FileText size={15} /><span className="hidden sm:inline">Laporan</span></button>
                            <button className="btn-primary" onClick={() => { setEditRow(null); setShowModal(true); }}>
                                {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                                <span>Tambah Data</span>
                            </button>
                        </>
                    }
                />
                <DataTable columns={columns} data={filtered} isLoading={loading} />
                <div className="px-6 py-3 border-t border-slate-50 text-xs text-slate-400">
                    Menampilkan {filtered.length} dari {rows.length} data risiko
                </div>
            </div>
        </div>
    );
}
