'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAppSettings } from '@/hooks/useAppSettings';
import { useUserProfile } from '@/hooks/useUserProfile';
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

function RiskModal({ row, onClose, onSave, units, riskInputs, saving, isManager, validUnitIds }: {
    row: Partial<typeof EMPTY_FORM> | null;
    onClose: () => void;
    onSave: (data: typeof EMPTY_FORM) => void;
    units: WorkUnit[];
    riskInputs: RiskInputOption[];
    saving: boolean;
    isManager: boolean;
    validUnitIds: string[];
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

            // Bridge cross-table IDs using isMatchUnit helper logic
            if (r.nama_unit_kerja_id === form.unit_kerja_id) return true;

            // If the manager logged in has their unit pre-filled, check if this risk aligns with their broader ID pool
            if (isManager && validUnitIds.includes(r.nama_unit_kerja_id)) return true;

            const selectedUnit = units.find(u => u.id === form.unit_kerja_id);
            if (selectedUnit?.name && r.master_work_units?.name) {
                // Ignore prefix for a robust comparison
                const uName = selectedUnit.name.toLowerCase().replace(/^(instalasi|unit|ruang|pelayanan)\s+/i, '').trim();
                const rName = r.master_work_units.name.toLowerCase().replace(/^(instalasi|unit|ruang|pelayanan)\s+/i, '').trim();
                if (uName && rName && (uName.includes(rName) || rName.includes(uName))) return true;
            }
            return false;
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
                    <button onClick={onClose} className="btn-secondary btn-sm">Batal</button>
                    <button onClick={() => onSave(form)} disabled={saving} className="btn-primary btn-sm flex items-center gap-2">
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Simpan Data
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
                    <button onClick={onClose} className="btn-secondary btn-sm">Tutup</button>
                </div>
            </div>
        </div>
    );
}

/* ─── Main Page ──────────────────────────────────────────────────── */
export default function RiskProfilePage() {
    const { settings } = useAppSettings();
    const { profile, isManager, isAuditor, validUnitIds, isMatchUnit } = useUserProfile();
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

    // Auto-lock unit filter for unit managers
    useEffect(() => {
        if (isManager && profile?.unit_kerja_id) {
            setUnitFilter(profile.unit_kerja_id);
        }
    }, [isManager, profile]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            let q = supabase
                .from('manajemen_risiko')
                .select('*, unit_kerja(id, nama_unit)')
                .order('created_at', { ascending: false });

            if (year) q = q.eq('tahun', Number(year));

            // For non-managers, if a specific unit is selected from dropdown, apply SQL filter
            if (!isManager && unitFilter) {
                q = q.eq('unit_kerja_id', unitFilter);
            }

            const { data, error } = await q;

            if (error) {
                console.error('Error fetching risk profile:', error);

                // Fallback attempt without year filter in case of severe errors
                const { data: fallbackData } = await supabase
                    .from('manajemen_risiko')
                    .select('*, unit_kerja(id, nama_unit)')
                    .order('created_at', { ascending: false });

                setRows((fallbackData as RiskRow[]) ?? []);
            } else {
                setRows((data as RiskRow[]) ?? []);
            }
        } catch (e) {
            console.error(e);
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [year, isManager, unitFilter]);

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
        const matchUnit = isManager
            ? isMatchUnit(d.unit_kerja_id, d.unit_kerja)
            : (unitFilter ? d.unit_kerja_id === unitFilter || (d.unit_kerja as any)?.id === unitFilter : true);
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
            d.setDrawColor(226, 232, 240);
            d.setLineWidth(1);
            d.line(40, 50, pageWidth - 40, 50);

            d.setTextColor(71, 85, 105);
            d.setFontSize(8);
            d.setFont('helvetica', 'bold');
            d.text((settings?.nama_rs || 'RUMAH SAKIT').toUpperCase(), 40, 40);

            d.setTextColor(148, 163, 184);
            d.setFont('helvetica', 'normal');
            d.text(title, pageWidth - 40, 40, { align: 'right' });
        };

        const addFooter = (d: jsPDF) => {
            const totalPages = d.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                d.setPage(i);
                if (i === 1) continue;
                d.setTextColor(148, 163, 184);
                d.setFontSize(8);
                d.setFont('helvetica', 'normal');
                d.text(settings?.footer || 'Laporan Profil Risiko - Rahasia & Internal RS', 40, pageHeight - 25);
                d.text(`Halaman ${i - 1} dari ${totalPages - 1}`, pageWidth - 40, pageHeight - 25, { align: 'right' });
                d.setDrawColor(226, 232, 240);
                d.setLineWidth(0.75);
                d.line(40, pageHeight - 35, pageWidth - 40, pageHeight - 35);
            }
        };

        const drawKopSurat = (d: jsPDF) => {
            d.setDrawColor(30, 41, 59);
            d.setLineWidth(1.5);
            d.line(40, 105, pageWidth - 40, 105);
            d.setDrawColor(30, 41, 59);
            d.setLineWidth(0.5);
            d.line(40, 109, pageWidth - 40, 109);

            d.setTextColor(30, 41, 59);
            d.setFont('helvetica', 'bold');
            d.setFontSize(14);
            d.text((settings?.nama_rs || 'RUMAH SAKIT').toUpperCase(), 40, 45);

            d.setFont('helvetica', 'normal');
            d.setFontSize(8.5);
            d.setTextColor(71, 85, 105);
            d.text(settings?.alamat || '', 40, 62);
            d.text(`Kota: ${settings?.kota || '-'} | Telp: ${settings?.telepon || '-'} | Email: ${settings?.email || '-'} | Web: ${settings?.website || '-'}`, 40, 76);

            if (settings?.tagline) {
                d.setFont('helvetica', 'italic');
                d.setFontSize(8);
                d.text(`"${settings.tagline}"`, 40, 92);
            }
        };

        // Track page index for TOC
        let pSummary = 3;
        let pHeatmap = 4;
        let pChart = 5;
        let pTable = 6;

        // --- PAGE 1: COVER PAGE ---
        doc.setFillColor(rgbColor[0], rgbColor[1], rgbColor[2]);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');
        doc.setTextColor(255, 255, 255);

        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('LAPORAN PROFIL RISIKO', pageWidth / 2, pageHeight / 2 - 50, { align: 'center' });

        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text('Analisis Profil, Matriks Heatmap, dan Peta Sebaran Risiko Unit Kerja', pageWidth / 2, pageHeight / 2 - 25, { align: 'center' });

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(`Tahun Anggaran: ${year || 'Semua'}`, pageWidth / 2, pageHeight / 2 + 20, { align: 'center' });

        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.text((settings?.nama_rs || 'RUMAH SAKIT').toUpperCase(), pageWidth / 2, pageHeight / 2 + 60, { align: 'center' });

        doc.setFontSize(8.5);
        doc.text(`Dicetak Pada: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, pageWidth / 2, pageHeight - 50, { align: 'center' });

        // --- PAGE 2: TABLE OF CONTENTS ---
        doc.addPage();
        const tocPageNum = doc.getCurrentPageInfo().pageNumber;

        // --- PAGE 3: SECTION A - EXECUTIVE SUMMARY & EXPLANATIONS ---
        doc.addPage();
        pSummary = doc.getCurrentPageInfo().pageNumber;
        drawKopSurat(doc);

        doc.setTextColor(30, 41, 59);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('A. Ringkasan Eksekutif & Keterangan Penjelasan Profil Risiko', 40, 132);

        // Summary Metric Cards Box
        let boxY = 145;
        const boxW = (pageWidth - 110) / 4;
        const metrics = [
            { label: 'Total Risiko', val: stats.total, color: [241, 245, 249], textCol: [30, 41, 59] },
            { label: 'Sangat Tinggi (>=15)', val: stats.tinggi, color: [254, 226, 226], textCol: [190, 18, 60] },
            { label: 'Sedang (5-14)', val: stats.sedang, color: [254, 243, 199], textCol: [146, 64, 14] },
            { label: 'Rendah (<5)', val: stats.rendah, color: [209, 250, 229], textCol: [6, 95, 70] },
        ];

        metrics.forEach((m, idx) => {
            const bx = 40 + idx * (boxW + 10);
            doc.setFillColor(m.color[0], m.color[1], m.color[2]);
            doc.roundedRect(bx, boxY, boxW, 45, 6, 6, 'F');
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(bx, boxY, boxW, 45, 6, 6, 'S');

            doc.setFontSize(7.5);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(m.textCol[0], m.textCol[1], m.textCol[2]);
            doc.text(m.label, bx + boxW / 2, boxY + 16, { align: 'center' });

            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text(String(m.val), bx + boxW / 2, boxY + 36, { align: 'center' });
        });

        // Detailed Explanation Text Box
        let expY = 205;
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(40, expY, pageWidth - 80, 280, 8, 8, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(40, expY, pageWidth - 80, 280, 8, 8, 'S');

        doc.setTextColor(30, 41, 59);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Keterangan Penjelasan dan Metodologi Penilaian Risiko:', 52, expY + 20);

        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85);

        const expLines = [
            '1. Konsep Profil Risiko:',
            '   Profil Risiko memberikan gambaran menyeluruh terhadap risiko-risiko di unit kerja, mencakup Inherent Risk',
            '   (skor murni sebelum mitigasi) dan Residual Risk (skor tersisa setelah langkah mitigasi dilaksanakan).',
            '',
            '2. Metodologi Matriks 5x5 (Probabilitas x Dampak):',
            '   - Probabilitas (Frekuensi): Skala 1 (Sangat Jarang) sampai Skala 5 (Sangat Sering).',
            '   - Dampak (Konsekuensi): Skala 1 (Sangat Ringan) sampai Skala 5 (Sangat Berat / Bencana).',
            '   - Skor Risiko dihitung dari perkalian Probabilitas x Dampak (Rentang Nilai 1 s/d 25).',
            '',
            '3. Kategori Level Risiko:',
            '   - Sangat Tinggi / Ekstrem (Skor 15-25): Risiko kritis, membutuhkan pengawasan langsung pimpinan/direksi.',
            '   - Tinggi (Skor 10-14): Risiko signifikan, memerlukan tindakan korektif dan mitigasi terencana.',
            '   - Sedang (Skor 5-9): Risiko moderat, dikelola melalui SOP dan pengawasan rutin unit.',
            '   - Rendah (Skor 1-4): Risiko ringan, dapat diterima dan ditoleransi (within appetite).',
            '',
            '4. Batas Toleransi / Risk Appetite RS:',
            '   Selera risiko standar ditetapkan pada skor maksimal 6. Risiko dengan skor inherent di atas 6 wajib',
            '   dilakukan penanganan dan mitigasi terukur hingga mencapai target skor residual risk.'
        ];

        let lineY = expY + 36;
        expLines.forEach(txt => {
            if (txt.trim() === '') {
                lineY += 6;
            } else {
                const wrapped = doc.splitTextToSize(txt, pageWidth - 104);
                doc.text(wrapped, 52, lineY);
                lineY += wrapped.length * 11;
            }
        });

        // --- PAGE 4: SECTION B - HEATMAP MATRIX 5x5 ---
        doc.addPage();
        pHeatmap = doc.getCurrentPageInfo().pageNumber;
        addHeader(doc, 'Visualisasi Heatmap Risiko');

        doc.setTextColor(30, 41, 59);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('B. Visualisasi Matriks Heatmap Risiko 5x5 (Inherent vs Residual)', 40, 75);

        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text('Peta sebaran posisi risiko sebelum (I) dan sesudah (R) mitigasi pada matriks 5x5.', 40, 88);

        // Draw 5x5 Heatmap Matrix
        const gridStartX = 90;
        const gridStartY = 115;
        const cellW = 82;
        const cellH = 46;

        // Axis Titles
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(71, 85, 105);
        doc.text('P R O B A B I L I T A S', 30, gridStartY + (cellH * 2.5), { angle: 90, align: 'center' });
        doc.text('D A M P A K', gridStartX + (cellW * 2.5), gridStartY + (cellH * 5) + 32, { align: 'center' });

        const getMatrixCellColor = (p: number, d: number): [number, number, number] => {
            const sc = p * d;
            if (sc >= 15) return [254, 202, 202]; // Red
            if (sc >= 10) return [254, 215, 170]; // Amber
            if (sc >= 5) return [254, 243, 199];  // Yellow
            return [209, 250, 229];                  // Green
        };

        for (let p = 5; p >= 1; p--) {
            const rowIndex = 5 - p;
            const cy = gridStartY + rowIndex * cellH;

            // Y-axis label
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(71, 85, 105);
            doc.text(`P${p}`, gridStartX - 15, cy + cellH / 2 + 3);

            for (let d = 1; d <= 5; d++) {
                const colIndex = d - 1;
                const cx = gridStartX + colIndex * cellW;

                // X-axis label (only on bottom row)
                if (p === 1) {
                    doc.text(`D${d}`, cx + cellW / 2, gridStartY + 5 * cellH + 16, { align: 'center' });
                }

                // Cell fill
                const bg = getMatrixCellColor(p, d);
                doc.setFillColor(bg[0], bg[1], bg[2]);
                doc.rect(cx, cy, cellW, cellH, 'F');
                doc.setDrawColor(255, 255, 255);
                doc.setLineWidth(1.5);
                doc.rect(cx, cy, cellW, cellH, 'S');

                // Score text in cell top right
                doc.setFontSize(7);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(148, 163, 184);
                doc.text(`${p * d}`, cx + cellW - 5, cy + 10, { align: 'right' });

                // Count items in cell
                const inhCount = filtered.filter(r => r.probabilitas === p && r.dampak === d).length;
                const resCount = filtered.filter(r => {
                    const pr = r.p_residual ?? Math.ceil(r.probabilitas * 0.5);
                    const dr = r.d_residual ?? Math.ceil(r.dampak * 0.8);
                    return pr === p && dr === d;
                }).length;

                // Render Inherent Pill
                if (inhCount > 0) {
                    doc.setFillColor(225, 29, 72);
                    doc.roundedRect(cx + 6, cy + 16, cellW / 2 - 8, 18, 4, 4, 'F');
                    doc.setFontSize(7.5);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(255, 255, 255);
                    doc.text(`I: ${inhCount}`, cx + 6 + (cellW / 4 - 4), cy + 28, { align: 'center' });
                }

                // Render Residual Pill
                if (resCount > 0) {
                    doc.setFillColor(5, 150, 105);
                    doc.roundedRect(cx + cellW / 2 + 2, cy + 16, cellW / 2 - 8, 18, 4, 4, 'F');
                    doc.setFontSize(7.5);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(255, 255, 255);
                    doc.text(`R: ${resCount}`, cx + cellW / 2 + 2 + (cellW / 4 - 4), cy + 28, { align: 'center' });
                }
            }
        }

        // Legend for Heatmap
        let legY = gridStartY + 5 * cellH + 45;
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(40, legY, pageWidth - 80, 50, 6, 6, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(40, legY, pageWidth - 80, 50, 6, 6, 'S');

        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(51, 65, 85);
        doc.text('Keterangan Pin / Badge Heatmap:', 52, legY + 18);

        // Inherent Badge Legend
        doc.setFillColor(225, 29, 72);
        doc.roundedRect(52, legY + 26, 28, 14, 3, 3, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7.5);
        doc.text('I: n', 66, legY + 36, { align: 'center' });
        doc.setTextColor(51, 65, 85);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text('Inherent Risk (Kondisi Awal)', 86, legY + 36);

        // Residual Badge Legend
        doc.setFillColor(5, 150, 105);
        doc.roundedRect(210, legY + 26, 28, 14, 3, 3, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.text('R: n', 224, legY + 36, { align: 'center' });
        doc.setTextColor(51, 65, 85);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text('Residual Risk (Pasca Mitigasi)', 244, legY + 36);

        // --- PAGE 5: SECTION C - UNIT DISTRIBUTION CHART ---
        doc.addPage();
        pChart = doc.getCurrentPageInfo().pageNumber;
        addHeader(doc, 'Grafik Profil Risiko Unit Kerja');

        doc.setTextColor(30, 41, 59);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('C. Grafik Distribusi & Rata-rata Skor Risiko per Unit Kerja', 40, 75);

        // Draw Bar Chart Vector Graphics
        const chartX = 60;
        const chartY = 110;
        const chartW = pageWidth - 120;
        const chartH = 220;

        doc.setFillColor(255, 255, 255);
        doc.roundedRect(40, chartY - 15, pageWidth - 80, chartH + 75, 8, 8, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(40, chartY - 15, pageWidth - 80, chartH + 75, 8, 8, 'S');

        const uData = unitScoreData.slice(0, 10);
        const maxVal = Math.max(...uData.map(d => Math.max(d['Total Risiko'], d['Rata-rata Skor'])), 10);

        // Gridlines
        const gridSteps = 5;
        for (let i = 0; i <= gridSteps; i++) {
            const gy = chartY + chartH - (i * (chartH / gridSteps));
            const valLabel = Math.round((maxVal / gridSteps) * i);
            doc.setDrawColor(241, 245, 249);
            doc.line(chartX, gy, chartX + chartW, gy);

            doc.setFontSize(7.5);
            doc.setTextColor(148, 163, 184);
            doc.text(String(valLabel), chartX - 10, gy + 3, { align: 'right' });
        }

        // Bars
        const groupW = chartW / Math.max(uData.length, 1);
        const barW = Math.min(groupW * 0.35, 20);

        uData.forEach((item, idx) => {
            const gx = chartX + idx * groupW + groupW / 2;

            // Total Risiko Bar (Blue)
            const hTotal = (item['Total Risiko'] / maxVal) * chartH;
            const yTotal = chartY + chartH - hTotal;
            doc.setFillColor(59, 130, 246);
            doc.roundedRect(gx - barW - 2, yTotal, barW, hTotal, 2, 2, 'F');
            if (item['Total Risiko'] > 0) {
                doc.setFontSize(7);
                doc.setTextColor(59, 130, 246);
                doc.text(String(item['Total Risiko']), gx - barW / 2 - 2, yTotal - 4, { align: 'center' });
            }

            // Avg Score Bar (Amber)
            const hAvg = (item['Rata-rata Skor'] / maxVal) * chartH;
            const yAvg = chartY + chartH - hAvg;
            doc.setFillColor(245, 158, 11);
            doc.roundedRect(gx + 2, yAvg, barW, hAvg, 2, 2, 'F');
            if (item['Rata-rata Skor'] > 0) {
                doc.setFontSize(7);
                doc.setTextColor(245, 158, 11);
                doc.text(String(item['Rata-rata Skor']), gx + barW / 2 + 2, yAvg - 4, { align: 'center' });
            }

            // Unit Name
            doc.setFontSize(7.5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(71, 85, 105);
            const uName = item.name.length > 10 ? item.name.substring(0, 10) + '…' : item.name;
            doc.text(uName, gx, chartY + chartH + 16, { align: 'center' });
        });

        // Chart Legend
        const legBarY = chartY + chartH + 38;
        doc.setFillColor(59, 130, 246);
        doc.rect(pageWidth / 2 - 110, legBarY, 12, 12, 'F');
        doc.setFontSize(8);
        doc.setTextColor(51, 65, 85);
        doc.text('Total Risiko Unit', pageWidth / 2 - 92, legBarY + 9);

        doc.setFillColor(245, 158, 11);
        doc.rect(pageWidth / 2 + 20, legBarY, 12, 12, 'F');
        doc.text('Rata-rata Skor Inherent', pageWidth / 2 + 38, legBarY + 9);

        // --- PAGE 6+: SECTION D - REKAPITULASI TABEL & SIGNATURE ---
        doc.addPage();
        pTable = doc.getCurrentPageInfo().pageNumber;
        addHeader(doc, 'Daftar Tabel Profil Risiko');

        doc.setTextColor(30, 41, 59);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('D. Rekapitulasi Data Profil Risiko', 40, 75);

        let rowIdx = 1;
        const tableData = filtered.map(item => {
            const skor_res = (item.p_residual ?? Math.ceil(item.probabilitas * 0.5)) * (item.d_residual ?? Math.ceil(item.dampak * 0.8));
            return [
                rowIdx++,
                item.kode_risiko || '-',
                (item as any).unit_kerja?.nama_unit || item.master_work_units?.name || '-',
                item.identifikasi_risiko || '-',
                `Skor: ${item.skor_risiko}\n(P:${item.probabilitas} D:${item.dampak})`,
                item.mitigasi || item.rencana_penanganan || '-',
                `Skor: ${skor_res}\n(P:${item.p_residual ?? '-'} D:${item.d_residual ?? '-'})`,
                item.status || 'Open'
            ];
        });

        autoTable(doc, {
            startY: 90,
            head: [['No', 'Kode', 'Unit Kerja', 'Pernyataan Risiko', 'Inherent', 'Tindakan Mitigasi', 'Residual', 'Status']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: rgbColor, fontSize: 8, fontStyle: 'bold' },
            styles: { fontSize: 7.5, cellPadding: 4, valign: 'top' },
            columnStyles: {
                0: { cellWidth: 20, halign: 'center' },
                1: { cellWidth: 45 },
                2: { cellWidth: 70 },
                3: { cellWidth: 125 },
                4: { cellWidth: 60, halign: 'center' },
                5: { cellWidth: 110 },
                6: { cellWidth: 55, halign: 'center' },
                7: { cellWidth: 35, halign: 'center' }
            },
            margin: { left: 40, right: 40 },
            didDrawPage: () => {
                addHeader(doc, 'Laporan Profil Risiko');
            }
        });

        let finalY = (doc as any).lastAutoTable.finalY + 25;
        if (finalY > pageHeight - 140) {
            doc.addPage();
            finalY = 70;
        }

        // Section E: Signature Block
        doc.setFontSize(9);
        doc.setTextColor(51, 65, 85);
        doc.setFont('helvetica', 'normal');
        doc.text('Disiapkan oleh,', 60, finalY);
        doc.text(settings?.jabatan_penandatangan_kiri || 'Penanggungjawab Unit', 60, finalY + 14);
        doc.line(60, finalY + 60, 200, finalY + 60);
        doc.text(settings?.nama_penandatangan_kiri || 'Penanggungjawab Unit Kerja', 60, finalY + 74);

        doc.text('Disetujui oleh,', pageWidth - 200, finalY);
        doc.setFont('helvetica', 'bold');
        doc.text(settings?.kepala_rs || 'Kepala / Direktur RS', pageWidth - 200, finalY + 14);
        doc.line(pageWidth - 200, finalY + 60, pageWidth - 60, finalY + 60);
        doc.setFont('helvetica', 'normal');
        doc.text(`NIP: ${settings?.nip_kepala || '-'}`, pageWidth - 200, finalY + 74);

        // Fill TOC Content on Page 2
        doc.setPage(tocPageNum);
        addHeader(doc, 'Daftar Isi');

        doc.setTextColor(30, 41, 59);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('DAFTAR ISI LAPORAN PROFIL RISIKO', 40, 85);

        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(1);
        doc.line(40, 95, pageWidth - 40, 95);

        const tocItems = [
            { title: 'A. Ringkasan Eksekutif & Keterangan Penjelasan Profil Risiko', page: pSummary },
            { title: 'B. Visualisasi Matriks Heatmap Risiko 5x5 (Inherent vs Residual)', page: pHeatmap },
            { title: 'C. Grafik Distribusi & Rata-rata Skor Risiko per Unit Kerja', page: pChart },
            { title: 'D. Rekapitulasi Data Tabel Profil Risiko Unit Kerja', page: pTable },
            { title: 'E. Lembar Pengesahan Laporan', page: doc.getNumberOfPages() },
        ];

        let tocY = 120;
        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85);

        tocItems.forEach(item => {
            doc.text(item.title, 40, tocY);
            doc.setFont('helvetica', 'bold');
            doc.text(`Halaman ${item.page}`, pageWidth - 40, tocY, { align: 'right' });
            doc.setFont('helvetica', 'normal');
            doc.setDrawColor(226, 232, 240);
            doc.line(40, tocY + 8, pageWidth - 40, tocY + 8);
            tocY += 28;
        });

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
                    {!isAuditor && (
                        <>
                            <button title="Edit" className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded" onClick={() => {
                                setEditRow({ ...EMPTY_FORM, ...r, tahun: String(r.tahun), _id: r.id });
                                setShowModal(true);
                            }}><Edit size={15} /></button>
                            <button title="Hapus" className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded" onClick={() => handleDelete(r)}><Trash2 size={15} /></button>
                        </>
                    )}
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
                    isManager={isManager}
                    validUnitIds={validUnitIds}
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
                            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
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
                        <FilterBar
                            searchValue={search} onSearchChange={setSearch} searchPlaceholder="Cari identifikasi risiko..."
                            yearValue={year} onYearChange={setYear}
                            extraFilters={
                                isManager ? (
                                    <div className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold border border-slate-200">
                                        {units.find(u => u.id === unitFilter)?.name || profile?.unit_kerja_name || 'Unit Anda'}
                                    </div>
                                ) : (
                                    <select className="filter-select w-44" value={unitFilter} onChange={e => setUnitFilter(e.target.value)} title="Filter Unit Kerja">
                                        <option value="">Semua Unit Kerja</option>
                                        {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                    </select>
                                )
                            }
                        />
                    }
                    actions={
                        <>
                            {!isAuditor && <button className="btn-secondary btn-sm"><Download size={14} /><span className="hidden sm:inline">Template</span></button>}
                            {!isAuditor && <button className="btn-secondary btn-sm"><Upload size={14} /><span className="hidden sm:inline">Import</span></button>}
                            <button className="btn-secondary btn-sm border-primary/20 text-primary hover:bg-primary/5" onClick={handleExportPDF}><FileText size={14} /><span className="hidden sm:inline">Laporan</span></button>
                            {!isAuditor && (
                                <button className="btn-primary btn-sm" onClick={() => { setEditRow(null); setShowModal(true); }}>
                                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                                    <span>Tambah Data</span>
                                </button>
                            )}
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

