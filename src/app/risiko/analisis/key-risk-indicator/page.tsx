'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAppSettings } from '@/hooks/useAppSettings';
import { useUserProfile } from '@/hooks/useUserProfile';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PageHeader, ScoreCard, FilterBar, TopActionBar } from '@/components/SharedUI';
import DataTable, { type Column } from '@/components/DataTable';
import {
    Plus, FileText, AlertTriangle, ShieldAlert, CheckCircle2,
    Eye, Edit, Trash2, X, Save, Loader2, TrendingDown, TrendingUp
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';

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
interface RiskInputOption {
    id: string;
    kode_risiko?: string;
    nama_risiko?: string;
    identifikasi_deskripsi?: string;
    identifikasi_indikator?: string;
    nama_unit_kerja_id?: string;
    master_work_units?: { name: string };
}

/* ─── Helpers ─────────────────────────────────────────────────── */
function getKRIStatus(row: KRIRow): 'Over Limit' | 'Mendekati Batas' | 'Di Bawah Batas' | 'Normal' {
    const aktual = Number(row.nilai_aktual ?? 0);
    const atas = Number(row.batas_atas ?? 0);
    const bawah = Number(row.batas_bawah ?? 0);

    if (atas > 0 && aktual > atas) return 'Over Limit';
    if (atas > 0 && aktual > atas * 0.8) return 'Mendekati Batas';
    if (bawah > 0 && aktual < bawah) return 'Di Bawah Batas';
    return 'Normal';
}

function getStatusColor(statusOrRow: string | KRIRow) {
    const status = typeof statusOrRow === 'string' ? statusOrRow : getKRIStatus(statusOrRow);
    switch (status) {
        case 'Over Limit': return 'badge-red';
        case 'Mendekati Batas': return 'badge-amber';
        case 'Di Bawah Batas': return 'badge-amber';
        case 'Normal': default: return 'badge-green';
    }
}

function getStatusLabel(row: KRIRow) {
    return getKRIStatus(row);
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
function KRIModal({ row, onClose, onSave, units, riskInputs, existingRows, saving }: {
    row: Partial<typeof EMPTY_FORM> & { _id?: string } | null;
    onClose: () => void;
    onSave: (data: typeof EMPTY_FORM) => void;
    units: WorkUnit[];
    riskInputs: RiskInputOption[];
    existingRows: KRIRow[];
    saving: boolean;
}) {
    const [form, setForm] = useState({ ...EMPTY_FORM, ...(row ?? {}) });
    const f = (k: keyof typeof form, v: string | number) => setForm(prev => ({ ...prev, [k]: v }));

    const handleRiskSelect = (id: string) => {
        f('risk_input_id', id);
        const risk = riskInputs.find(r => r.id === id);
        if (risk && risk.kode_risiko) {
            const prefix = `${risk.kode_risiko}/`;
            let maxSeq = 0;
            (existingRows || []).forEach(r => {
                if (r.kode_risiko && r.kode_risiko.startsWith(prefix)) {
                    const seqStr = r.kode_risiko.substring(prefix.length);
                    const seqNum = parseInt(seqStr, 10);
                    if (!isNaN(seqNum) && seqNum > maxSeq) {
                        maxSeq = seqNum;
                    }
                }
            });
            const nextSeq = String(maxSeq + 1).padStart(3, '0');
            f('kode_risiko', `${risk.kode_risiko}/${nextSeq}`);
        } else if (!id) {
            f('kode_risiko', '');
        }
    };

    const filteredRiskInputs = (form.unit_kerja_id
        ? riskInputs.filter(r => {
            if (!r.nama_unit_kerja_id) return true;
            if (r.nama_unit_kerja_id === form.unit_kerja_id) return true;
            const selectedUnit = units.find(u => u.id === form.unit_kerja_id);
            if (selectedUnit?.name && r.master_work_units?.name) {
                const uName = selectedUnit.name.toLowerCase().replace(/^(instalasi|unit|ruang|pelayanan)\s+/i, '').trim();
                const rName = r.master_work_units.name.toLowerCase().replace(/^(instalasi|unit|ruang|pelayanan)\s+/i, '').trim();
                if (uName && rName && (uName.includes(rName) || rName.includes(uName))) return true;
            }
            return false;
        })
        : riskInputs
    ).sort((a, b) => {
        const codeA = a.kode_risiko || '';
        const codeB = b.kode_risiko || '';
        if (codeA && codeB) {
            return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
        }
        if (codeA) return -1;
        if (codeB) return 1;
        const nameA = a.nama_risiko || a.identifikasi_deskripsi || '';
        const nameB = b.nama_risiko || b.identifikasi_deskripsi || '';
        return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
    });

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
                            <select
                                className="form-input w-full"
                                value={form.unit_kerja_id}
                                onChange={e => {
                                    const newUnit = e.target.value;
                                    setForm(prev => ({
                                        ...prev,
                                        unit_kerja_id: newUnit,
                                        risk_input_id: '',
                                        kode_risiko: '',
                                    }));
                                }}
                            >
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
                            {filteredRiskInputs.map(r => (
                                <option key={r.id} value={r.id}>
                                    {r.kode_risiko ? `[${r.kode_risiko}] ` : ''}{r.nama_risiko || 'Tanpa Nama'}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Kode KRI & Nama KRI */}
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="form-label">Kode KRI</label>
                            <input type="text" className="form-input w-full" value={form.kode_risiko} onChange={e => f('kode_risiko', e.target.value)} placeholder="e.g. Keu-Risk-001/001" />
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
    const st = getKRIStatus(row);

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
                        {row.kode_risiko && <div><span className="text-xs text-slate-400">Kode KRI</span><p className="font-semibold mt-0.5">{row.kode_risiko}</p></div>}
                        <div className="col-span-2"><span className="text-xs text-slate-400">Nama KRI</span><p className="font-semibold mt-0.5 text-base">{row.nama_kri}</p></div>
                        {row.indikator && <div className="col-span-2"><span className="text-xs text-slate-400">Deskripsi Indikator</span><p className="mt-0.5 text-slate-600">{row.indikator}</p></div>}
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                            <div className="text-xs text-slate-500">Batas Bawah</div>
                            <div className="text-2xl font-bold text-slate-600 mt-1">{bawah}<span className="text-xs font-normal ml-1">{row.satuan}</span></div>
                        </div>
                        <div className={`border rounded-xl p-3 ${st === 'Over Limit' ? 'bg-red-50 border-red-200' : st === 'Mendekati Batas' || st === 'Di Bawah Batas' ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
                            <div className="text-xs text-slate-500">Nilai Aktual</div>
                            <div className={`text-2xl font-extrabold mt-1 ${st === 'Over Limit' ? 'text-rose-600' : st === 'Mendekati Batas' || st === 'Di Bawah Batas' ? 'text-amber-600' : 'text-emerald-600'}`}>{aktual}<span className="text-xs font-normal ml-1">{row.satuan}</span></div>
                            <span className={getStatusColor(st)}>{st}</span>
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
                                <div className={`h-full rounded-full transition-all ${st === 'Over Limit' ? 'bg-rose-500' : st === 'Mendekati Batas' || st === 'Di Bawah Batas' ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 text-xs">
                        <div><span className="text-slate-400">Frekuensi Pemantauan:</span> <span className="font-medium">{row.frekuensi ?? '-'}</span></div>
                        <div><span className="text-slate-400">Status:</span> <span className={`font-medium ${st === 'Over Limit' ? 'text-rose-600' : st === 'Mendekati Batas' ? 'text-amber-600' : 'text-emerald-600'}`}>{st}</span></div>
                    </div>
                </div>
                <div className="flex justify-end px-6 pb-6">
                    <button onClick={onClose} className="btn-secondary">Tutup</button>
                </div>
            </div>
        </div>
    );
}

/* ─── Card Detail Modal ───────────────────────────────────────────── */
function KRICardDetailModal({
    title,
    subtitle,
    badgeColor,
    rows,
    onClose,
    onViewDetail
}: {
    title: string;
    subtitle: string;
    badgeColor: string;
    rows: KRIRow[];
    onClose: () => void;
    onViewDetail: (row: KRIRow) => void;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm overflow-y-auto p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col my-auto">
                <div className="flex justify-between items-center p-6 border-b border-slate-100 shrink-0">
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="font-bold text-slate-800 text-lg">{title}</h2>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${badgeColor}`}>
                                {rows.length} Data KRI
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    {rows.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 text-sm">
                            Tidak ada data KRI dalam kategori ini.
                        </div>
                    ) : (
                        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                                    <tr>
                                        <th className="py-3 px-4">No</th>
                                        <th className="py-3 px-4">Unit Kerja</th>
                                        <th className="py-3 px-4">Kode & Nama KRI</th>
                                        <th className="py-3 px-4 text-center">Batas (Bawah – Atas)</th>
                                        <th className="py-3 px-4 text-center">Nilai Aktual</th>
                                        <th className="py-3 px-4 text-center">Status</th>
                                        <th className="py-3 px-4 text-center">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {rows.map((r, idx) => {
                                        const st = getKRIStatus(r);
                                        return (
                                            <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                                                <td className="py-3 px-4 text-slate-400 font-medium">{idx + 1}</td>
                                                <td className="py-3 px-4 font-medium text-slate-700">{r.unit_kerja?.nama_unit ?? '-'}</td>
                                                <td className="py-3 px-4">
                                                    {r.kode_risiko && <span className="font-mono text-[11px] text-slate-400 block">{r.kode_risiko}</span>}
                                                    <span className="font-semibold text-slate-800">{r.nama_kri}</span>
                                                </td>
                                                <td className="py-3 px-4 text-center text-slate-600 font-mono">
                                                    {r.batas_bawah ?? 0} – {r.batas_atas ?? 0} {r.satuan ?? ''}
                                                </td>
                                                <td className="py-3 px-4 text-center font-bold">
                                                    <span className={st === 'Over Limit' ? 'text-rose-600' : st === 'Mendekati Batas' || st === 'Di Bawah Batas' ? 'text-amber-600' : 'text-emerald-600'}>
                                                        {r.nilai_aktual ?? 0} {r.satuan ?? ''}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <span className={getStatusColor(st)}>{st}</span>
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <button
                                                        onClick={() => {
                                                            onClose();
                                                            onViewDetail(r);
                                                        }}
                                                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg font-medium text-xs flex items-center gap-1 mx-auto"
                                                        title="Lihat Detail KRI"
                                                    >
                                                        <Eye size={14} /> Detail
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="flex justify-end px-6 py-4 border-t border-slate-100 shrink-0">
                    <button onClick={onClose} className="btn-secondary">Tutup</button>
                </div>
            </div>
        </div>
    );
}

/* ─── Main Page ──────────────────────────────────────────────────── */
export default function KeyRiskIndicatorPage() {
    const { settings } = useAppSettings();
    const { profile, isManager, isAuditor, isMatchUnit } = useUserProfile();
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
    const [cardDetailModal, setCardDetailModal] = useState<{
        title: string;
        subtitle: string;
        badgeColor: string;
        rows: KRIRow[];
    } | null>(null);

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
                .from('key_risk_indicators')
                .select('*, unit_kerja(id, nama_unit), risk_inputs(id, kode_risiko, nama_risiko)')
                .order('created_at', { ascending: false });

            if (year) q = q.eq('tahun', Number(year));

            // For non-managers, if a specific unit is selected from dropdown, apply SQL filter
            if (!isManager && unitFilter) {
                q = q.eq('unit_kerja_id', unitFilter);
            }

            const { data, error } = await q;

            if (error) {
                console.error('Error fetching fallback KRI:', error);
                const { data: fallbackData } = await supabase
                    .from('key_risk_indicators')
                    .select('*, unit_kerja(id, nama_unit), risk_inputs(id, kode_risiko, nama_risiko)')
                    .order('created_at', { ascending: false });

                setRows((fallbackData as KRIRow[]) ?? []);
            } else {
                setRows((data as KRIRow[]) ?? []);
            }
        } catch (e) {
            console.error(e);
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [year, isManager, unitFilter]);

    useEffect(() => { fetchData(); }, [fetchData]);

    useEffect(() => {
        supabase.from('unit_kerja').select('id, nama_unit').order('nama_unit', { ascending: true }).then(({ data }: { data: any }) =>
            setUnits((data ?? []).map((u: any) => ({ id: u.id, name: u.nama_unit }))));
        supabase.from('risk_inputs').select('id, kode_risiko, nama_risiko, identifikasi_deskripsi, identifikasi_indikator, nama_unit_kerja_id, master_work_units(name)').then(({ data }: { data: any }) =>
            setRiskInputs((data ?? []) as RiskInputOption[]));
    }, []);

    const filtered = rows.filter(d => {
        const matchSearch = (d.nama_kri || '').toLowerCase().includes(search.toLowerCase()) ||
            (d.kode_risiko || '').toLowerCase().includes(search.toLowerCase());
        const matchUnit = isManager ? isMatchUnit(d.unit_kerja_id, d.unit_kerja) : (unitFilter ? d.unit_kerja_id === unitFilter || (d.unit_kerja as any)?.id === unitFilter : true);
        return matchSearch && matchUnit;
    });

    const overLimitRows = filtered.filter(r => getKRIStatus(r) === 'Over Limit');
    const mendekatiRows = filtered.filter(r => getKRIStatus(r) === 'Mendekati Batas' || getKRIStatus(r) === 'Di Bawah Batas');
    const normalRows = filtered.filter(r => getKRIStatus(r) === 'Normal');

    const stats = {
        total: filtered.length,
        overLimit: overLimitRows.length,
        mendekati: mendekatiRows.length,
        normal: normalRows.length,
    };

    // Trend chart shows avg aktual, batas atas, and batas bawah per unit
    const trendData = units.map(u => {
        const unitRows = filtered.filter(r => r.unit_kerja_id === u.id);
        const avgAktual = unitRows.length ? unitRows.reduce((s, r) => s + (r.nilai_aktual ?? 0), 0) / unitRows.length : 0;
        const avgBatasAtas = unitRows.length ? unitRows.reduce((s, r) => s + (r.batas_atas ?? 0), 0) / unitRows.length : 0;
        const avgBatasBawah = unitRows.length ? unitRows.reduce((s, r) => s + (r.batas_bawah ?? 0), 0) / unitRows.length : 0;
        return {
            id: u.id,
            name: u.name,
            'Nilai Aktual': +avgAktual.toFixed(1),
            'Batas Atas': +avgBatasAtas.toFixed(1),
            'Batas Bawah': +avgBatasBawah.toFixed(1),
            count: unitRows.length
        };
    }).filter(u => u.count > 0 || u['Nilai Aktual'] > 0 || u['Batas Atas'] > 0 || u['Batas Bawah'] > 0);

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

    const handleExportPDF = () => {
        const doc = new jsPDF('p', 'pt', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const hexToRgb = (hex: string): [number, number, number] => { const def: [number, number, number] = [19, 127, 236]; if (!hex) return def; const h = hex.replace('#', ''); if (h.length !== 6) return def; const num = parseInt(h, 16); return [(num >> 16) & 255, (num >> 8) & 255, num & 255]; };
        const primaryColor = settings?.warna_primer || '#137fec';
        const rgbColor = hexToRgb(primaryColor);
        const addHeader = (d: jsPDF, title: string) => { d.setDrawColor(226, 232, 240); d.setLineWidth(1); d.line(40, 55, pageWidth - 40, 55); d.setTextColor(71, 85, 105); d.setFontSize(8); d.setFont('helvetica', 'bold'); d.text((settings?.nama_rs || 'RUMAH SAKIT').toUpperCase(), 40, 45); d.setTextColor(148, 163, 184); d.setFont('helvetica', 'normal'); d.text(title, pageWidth - 40, 45, { align: 'right' }); };
        const addFooter = (d: jsPDF) => { const tp = d.getNumberOfPages(); for (let i = 1; i <= tp; i++) { d.setPage(i); if (i === 1) continue; d.setTextColor(148, 163, 184); d.setFontSize(8); d.setFont('helvetica', 'normal'); d.text(settings?.footer || 'Laporan Internal Rumah Sakit', 40, pageHeight - 30); d.text(`Halaman ${i - 1} dari ${tp - 1}`, pageWidth - 40, pageHeight - 30, { align: 'right' }); d.setDrawColor(226, 232, 240); d.setLineWidth(0.75); d.line(40, pageHeight - 40, pageWidth - 40, pageHeight - 40); } };
        const drawKopSurat = (d: jsPDF) => { d.setDrawColor(30, 41, 59); d.setLineWidth(1.5); d.line(40, 110, pageWidth - 40, 110); d.setLineWidth(0.5); d.line(40, 114, pageWidth - 40, 114); d.setTextColor(30, 41, 59); d.setFont('helvetica', 'bold'); d.setFontSize(14); d.text((settings?.nama_rs || 'RUMAH SAKIT').toUpperCase(), 40, 50); d.setFont('helvetica', 'normal'); d.setFontSize(9); d.setTextColor(71, 85, 105); d.text(settings?.alamat || '', 40, 68); d.text(`Kota: ${settings?.kota || '-'} | Telp: ${settings?.telepon || '-'} | Email: ${settings?.email || '-'} | Web: ${settings?.website || '-'}`, 40, 84); if (settings?.tagline) { d.setFont('helvetica', 'italic'); d.setFontSize(8); d.text(`"${settings.tagline}"`, 40, 98); } };

        // Cover
        doc.setFillColor(rgbColor[0], rgbColor[1], rgbColor[2]); doc.rect(0, 0, pageWidth, pageHeight, 'F'); doc.setTextColor(255, 255, 255);
        doc.setFontSize(22); doc.setFont('helvetica', 'bold'); doc.text('LAPORAN KEY RISK INDICATOR (KRI)', pageWidth / 2, pageHeight / 2 - 60, { align: 'center' });
        doc.setFontSize(16); doc.setFont('helvetica', 'normal'); doc.text(`Tahun: ${year || 'Semua'}`, pageWidth / 2, pageHeight / 2, { align: 'center' });
        doc.setFontSize(12); doc.text((settings?.nama_rs || 'RUMAH SAKIT').toUpperCase(), pageWidth / 2, pageHeight / 2 + 50, { align: 'center' });

        doc.addPage(); let tocPageNum = doc.getCurrentPageInfo().pageNumber; doc.addPage();
        let contentPageStart = doc.getCurrentPageInfo().pageNumber;
        drawKopSurat(doc);
        doc.setTextColor(30, 41, 59); doc.setFontSize(13); doc.setFont('helvetica', 'bold');
        doc.text('A. Daftar Key Risk Indicator (KRI)', 40, 140);
        let finalY = 160;

        let rowIdx = 1;
        const tableData = filtered.map(item => [
            rowIdx++,
            item.unit_kerja?.nama_unit || '-',
            (item.kode_risiko ? `[${item.kode_risiko}] ` : '') + (item.nama_kri || '-'),
            `${item.batas_bawah ?? '-'} – ${item.batas_atas ?? '-'} ${item.satuan || ''}`,
            `${item.nilai_aktual ?? '-'} ${item.satuan || ''}`,
            item.frekuensi || '-',
            getStatusLabel(item)
        ]);

        autoTable(doc, {
            startY: finalY,
            head: [['No', 'Unit Kerja', 'Nama KRI', 'Batas (Min – Max)', 'Nilai Aktual', 'Frekuensi', 'Status']],
            body: tableData, theme: 'grid',
            headStyles: { fillColor: rgbColor, fontSize: 8, fontStyle: 'bold' },
            styles: { fontSize: 8, cellPadding: 4 },
            columnStyles: { 0: { cellWidth: 25, halign: 'center' }, 1: { cellWidth: 80 }, 2: { cellWidth: 130 }, 3: { cellWidth: 80, halign: 'center' }, 4: { cellWidth: 70, halign: 'center' }, 5: { cellWidth: 55, halign: 'center' }, 6: { cellWidth: 60, halign: 'center' } },
            margin: { left: 40, right: 40 },
            didDrawPage: () => { const cp = doc.getCurrentPageInfo().pageNumber; if (cp > contentPageStart) addHeader(doc, 'Laporan KRI'); }
        });
        finalY = (doc as any).lastAutoTable.finalY + 20;

        // TOC
        doc.setPage(tocPageNum); addHeader(doc, 'Daftar Isi');
        doc.setTextColor(30, 41, 59); doc.setFontSize(15); doc.setFont('helvetica', 'bold'); doc.text('DAFTAR ISI LAPORAN', 40, 100);
        doc.setDrawColor(226, 232, 240); doc.setLineWidth(1); doc.line(40, 112, pageWidth - 40, 112);
        doc.setFontSize(10.5); doc.setFont('helvetica', 'normal');
        doc.text('1. Daftar Key Risk Indicator (KRI)', 40, 140); doc.text(`${contentPageStart - 1}`, pageWidth - 40, 140, { align: 'right' });
        doc.text('2. Lembar Tanda Tangan Pengesahan', 40, 160); const lastPage = doc.getNumberOfPages(); doc.text(`${lastPage - 1}`, pageWidth - 40, 160, { align: 'right' });

        // Signature
        doc.setPage(lastPage); if (finalY > pageHeight - 150) { doc.addPage(); finalY = 70; } else { finalY += 15; }
        doc.setFontSize(9.5); doc.setTextColor(51, 65, 85); doc.setFont('helvetica', 'normal');
        doc.text('Disiapkan oleh,', 60, finalY); doc.text(settings?.jabatan_penandatangan_kiri || 'Penanggungjawab Unit', 60, finalY + 14);
        doc.line(60, finalY + 65, 200, finalY + 65); doc.text(settings?.nama_penandatangan_kiri || 'Penanggungjawab Unit Kerja', 60, finalY + 78);
        doc.text('Disetujui oleh,', pageWidth - 200, finalY); doc.setFont('helvetica', 'bold'); doc.text(settings?.kepala_rs || 'Kepala / Direktur RS', pageWidth - 200, finalY + 14);
        doc.line(pageWidth - 200, finalY + 65, pageWidth - 60, finalY + 65); doc.setFont('helvetica', 'normal'); doc.text(`NIP: ${settings?.nip_kepala || '-'}`, pageWidth - 200, finalY + 78);

        addFooter(doc); doc.save(`Laporan_KRI_${year || 'Semua'}.pdf`);
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
                const st = getKRIStatus(r);
                return <span className={st === 'Over Limit' ? 'text-rose-600' : st === 'Mendekati Batas' || st === 'Di Bawah Batas' ? 'text-amber-600' : 'text-emerald-600'}>{r.nilai_aktual ?? 0} {r.satuan ?? ''}</span>;
            }
        },
        { key: 'frekuensi', label: 'Frekuensi', className: 'text-center text-xs', render: r => r.frekuensi ?? 'Bulanan' },
        { key: 'status', label: 'Pemenuhan', render: r => <span className={getStatusColor(r)}>{getStatusLabel(r)}</span> },
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
                <KRIModal
                    row={editRow}
                    onClose={() => { setShowModal(false); setEditRow(null); }}
                    onSave={handleSave}
                    units={units}
                    riskInputs={riskInputs}
                    existingRows={rows}
                    saving={saving}
                />
            )}
            {viewRow && <ViewModal row={viewRow} onClose={() => setViewRow(null)} />}
            {cardDetailModal && (
                <KRICardDetailModal
                    title={cardDetailModal.title}
                    subtitle={cardDetailModal.subtitle}
                    badgeColor={cardDetailModal.badgeColor}
                    rows={cardDetailModal.rows}
                    onClose={() => setCardDetailModal(null)}
                    onViewDetail={(r) => setViewRow(r)}
                />
            )}

            <PageHeader title="Key Risk Indicator (KRI)" subtitle="Pemantauan indikator risiko utama berdasarkan ambang batas." />

            {/* Score Cards */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
                <ScoreCard
                    icon={<ShieldAlert size={22} className="text-slate-500" />}
                    title="Total KRI Aktif"
                    value={stats.total}
                    colorClass="bg-slate-50 border-slate-100"
                    action={
                        <button
                            onClick={() => setCardDetailModal({
                                title: 'Detail Total KRI Aktif',
                                subtitle: 'Seluruh indikator Key Risk Indicator yang sedang dipantau',
                                badgeColor: 'bg-slate-100 text-slate-700',
                                rows: filtered
                            })}
                            className="p-1.5 hover:bg-slate-200/60 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"
                            title="Lihat Detail Total KRI"
                        >
                            <Eye size={16} />
                        </button>
                    }
                />
                <ScoreCard
                    icon={<AlertTriangle size={22} className="text-rose-500" />}
                    title="Over Limit"
                    value={stats.overLimit}
                    subtitle="Melewati batas atas toleransi"
                    colorClass="bg-rose-50 border-rose-100"
                    action={
                        <button
                            onClick={() => setCardDetailModal({
                                title: 'Detail KRI - Over Limit',
                                subtitle: 'Indikator KRI yang nilai aktualnya melebihi batas atas toleransi',
                                badgeColor: 'bg-rose-100 text-rose-700',
                                rows: overLimitRows
                            })}
                            className="p-1.5 hover:bg-rose-200/60 rounded-lg text-rose-500 hover:text-rose-700 transition-colors"
                            title="Lihat Detail Over Limit"
                        >
                            <Eye size={16} />
                        </button>
                    }
                />
                <ScoreCard
                    icon={<AlertTriangle size={22} className="text-amber-500" />}
                    title="Mendekati Batas"
                    value={stats.mendekati}
                    subtitle="80–100% batas atas / di bawah batas bawah"
                    colorClass="bg-amber-50 border-amber-100"
                    action={
                        <button
                            onClick={() => setCardDetailModal({
                                title: 'Detail KRI - Mendekati Batas',
                                subtitle: 'Indikator KRI yang mendekati batas atas atau di bawah batas bawah',
                                badgeColor: 'bg-amber-100 text-amber-700',
                                rows: mendekatiRows
                            })}
                            className="p-1.5 hover:bg-amber-200/60 rounded-lg text-amber-500 hover:text-amber-700 transition-colors"
                            title="Lihat Detail Mendekati Batas"
                        >
                            <Eye size={16} />
                        </button>
                    }
                />
                <ScoreCard
                    icon={<CheckCircle2 size={22} className="text-emerald-500" />}
                    title="Normal"
                    value={stats.normal}
                    colorClass="bg-emerald-50 border-emerald-100"
                    action={
                        <button
                            onClick={() => setCardDetailModal({
                                title: 'Detail KRI - Normal',
                                subtitle: 'Indikator KRI yang berada dalam kisaran aman dan normal',
                                badgeColor: 'bg-emerald-100 text-emerald-700',
                                rows: normalRows
                            })}
                            className="p-1.5 hover:bg-emerald-200/60 rounded-lg text-emerald-500 hover:text-emerald-700 transition-colors"
                            title="Lihat Detail Normal"
                        >
                            <Eye size={16} />
                        </button>
                    }
                />
            </div>

            {/* Trend Chart */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-8">
                <h3 className="text-sm font-semibold text-slate-800 mb-6 flex items-center justify-between">
                    <div className="flex items-center">
                        <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mr-3">📈</span>
                        Perbandingan Nilai Aktual vs Batas (Batas Bawah & Batas Atas) per Unit Kerja
                    </div>
                    <span className="text-xs text-slate-400 font-normal">
                        Rata-rata per unit kerja
                    </span>
                </h3>
                <div className="h-[340px] w-full">
                    {trendData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                            <LineChart data={trendData} margin={{ top: 20, right: 30, left: 10, bottom: 85 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 11, fill: '#475569' }}
                                    angle={-25}
                                    textAnchor="end"
                                    interval={0}
                                    height={75}
                                />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                                <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0/0.1)' }} />
                                <Legend wrapperStyle={{ paddingTop: '10px' }} />
                                <Line type="monotone" dataKey="Nilai Aktual" stroke="#4F46E5" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                <Line type="monotone" dataKey="Batas Atas" stroke="#EF4444" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
                                <Line type="monotone" dataKey="Batas Bawah" stroke="#10B981" strokeWidth={2} strokeDasharray="3 3" dot={{ r: 3 }} />
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
                            {isManager ? (
                                <div className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold border border-slate-200">
                                    {units.find(u => u.id === unitFilter)?.name || profile?.unit_kerja_name || 'Unit Anda'}
                                </div>
                            ) : (
                                <select className="form-input text-sm h-9" value={unitFilter} onChange={e => setUnitFilter(e.target.value)}>
                                    <option value="">Semua Unit</option>
                                    {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                </select>
                            )}
                        </div>
                    }
                    actions={
                        <>
                            <button className="btn-secondary border-primary/20 text-primary hover:bg-primary/5 flex items-center gap-1.5" onClick={handleExportPDF}><FileText size={15} /><span className="hidden sm:inline">Laporan</span></button>
                            {!isAuditor && (
                                <button className="btn-primary flex items-center gap-1.5" onClick={() => { setEditRow(unitFilter ? { ...EMPTY_FORM, unit_kerja_id: unitFilter } : null); setShowModal(true); }}>
                                    <Plus size={15} /><span>Tambah KRI</span>
                                </button>
                            )}
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
