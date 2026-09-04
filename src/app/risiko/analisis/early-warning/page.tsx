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
    FileText, AlertTriangle, ShieldAlert, CheckCircle2,
    Eye, Trash2, X, Save, Loader2, Settings, Bell, BellOff, Download,
    Activity, TrendingUp, Info
} from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────────────── */
export type EWSLevel = 'Critical' | 'Warning' | 'Notice' | 'Normal';

export interface EWSItem {
    id: string;
    unit_kerja_id?: string;
    risk_input_id?: string;
    kri_id?: string;
    kode_risiko?: string;
    nama_threshold: string;
    parameter: string;
    batas_bawah: number;
    batas_atas: number;
    nilai_aktual: number;
    satuan: string;
    tahun: number;
    level: EWSLevel;
    is_active: boolean;
    is_custom: boolean;
    created_at: string;
    unit_kerja?: { id: string; nama_unit: string };
    risk_inputs?: { id: string; kode_risiko?: string; nama_risiko?: string };
    key_risk_indicators?: { id: string; nama_kri: string; nilai_aktual?: number; batas_atas?: number; batas_bawah?: number; satuan?: string };
}

interface KRIItem {
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
    status?: string;
    created_at: string;
    unit_kerja?: { id: string; nama_unit: string };
    risk_inputs?: { id: string; kode_risiko?: string; nama_risiko?: string };
}

interface WorkUnit { id: string; nama_unit: string; }

/* ─── Helpers ─────────────────────────────────────────────────── */
export function computeEWSLevel(item: {
    nilai_aktual?: number;
    batas_atas?: number;
    batas_bawah?: number;
    nilai_batas?: number;
    level?: string;
}): EWSLevel {
    const aktual = Number(item.nilai_aktual ?? 0);
    const atas = Number(item.batas_atas ?? item.nilai_batas ?? 0);
    const bawah = Number(item.batas_bawah ?? 0);

    // 1. Critical: Melebihi batas atas toleransi (Over Limit)
    if (atas > 0 && aktual > atas) {
        return 'Critical';
    }
    // 2. Warning: Mendekati batas atas (80% - 100% dari batas atas)
    if (atas > 0 && aktual > atas * 0.8) {
        return 'Warning';
    }
    // 3. Notice: Di bawah batas bawah minimum ATAU perhatian awal (60% - 80% dari batas atas)
    if (bawah > 0 && aktual < bawah) {
        return 'Notice';
    }
    if (atas > 0 && aktual > atas * 0.6) {
        return 'Notice';
    }
    // 4. Normal: Dalam rentang aman
    return 'Normal';
}

export function getEWSLevelBadge(level: EWSLevel | string): string {
    switch (level) {
        case 'Critical': return 'badge-red';
        case 'Warning': return 'badge-amber';
        case 'Notice': return 'badge-blue';
        case 'Normal': default: return 'badge-green';
    }
}

/* ─── Form Standard ─────────────────────────────────────────────── */
const EMPTY_THRESHOLD = {
    unit_kerja_id: '',
    kri_id: '',
    nama_threshold: '',
    parameter: '',
    nilai_batas: 0,
    batas_bawah: 0,
    satuan: '',
    level: 'Warning' as EWSLevel,
    is_active: true,
};

/* ─── Threshold Modal ───────────────────────────────────────────── */
function ThresholdModal({ onClose, onSave, units, kriList, saving }: {
    onClose: () => void;
    onSave: (data: typeof EMPTY_THRESHOLD) => void;
    units: WorkUnit[];
    kriList: KRIItem[];
    saving: boolean;
}) {
    const [form, setForm] = useState({ ...EMPTY_THRESHOLD });
    const f = (k: keyof typeof form, v: any) => setForm(prev => ({ ...prev, [k]: v }));

    const handleKRISelect = (id: string) => {
        f('kri_id', id);
        const kri = kriList.find(k => k.id === id);
        if (kri) {
            f('nama_threshold', `Threshold: ${kri.nama_kri}`);
            f('parameter', kri.indikator || kri.nama_kri);
            f('nilai_batas', kri.batas_atas ?? 0);
            f('batas_bawah', kri.batas_bawah ?? 0);
            f('satuan', kri.satuan ?? '');
            if (!form.unit_kerja_id && kri.unit_kerja_id) f('unit_kerja_id', kri.unit_kerja_id);
            const computedLvl = computeEWSLevel({
                nilai_aktual: kri.nilai_aktual,
                batas_atas: kri.batas_atas,
                batas_bawah: kri.batas_bawah
            });
            f('level', computedLvl);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl my-8">
                <div className="flex justify-between items-center p-6 border-b border-slate-100">
                    <div>
                        <h2 className="font-bold text-slate-800 text-lg">Atur Ambang Batas (Custom Threshold)</h2>
                        <p className="text-xs text-slate-500 mt-0.5">Pengaturan aturan peringatan dini khusus untuk KRI</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"><X size={18} /></button>
                </div>

                <div className="p-6 space-y-5 text-sm">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="form-label">Unit Kerja</label>
                            <select className="form-input w-full" value={form.unit_kerja_id} onChange={e => f('unit_kerja_id', e.target.value)}>
                                <option value="">-- Semua Unit --</option>
                                {units.map(u => <option key={u.id} value={u.id}>{u.nama_unit}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="form-label">Target Level Peringatan</label>
                            <select className="form-input w-full" value={form.level} onChange={e => f('level', e.target.value)}>
                                <option value="Critical">Critical (Merah - Sangat Kritis)</option>
                                <option value="Warning">Warning (Kuning - Peringatan)</option>
                                <option value="Notice">Notice (Biru - Perhatian Awal)</option>
                                <option value="Normal">Normal (Hijau - Aman)</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="form-label">KRI Referensi (terintegrasi otomatis)</label>
                        <select className="form-input w-full" value={form.kri_id} onChange={e => handleKRISelect(e.target.value)}>
                            <option value="">-- Pilih KRI --</option>
                            {kriList.map(k => (
                                <option key={k.id} value={k.id}>
                                    [{k.unit_kerja?.nama_unit ?? 'All'}] {k.kode_risiko ? `[${k.kode_risiko}] ` : ''}{k.nama_kri} (Batas Max: {k.batas_atas ?? '-'} {k.satuan ?? ''})
                                </option>
                            ))}
                        </select>
                        {form.kri_id && kriList.find(k => k.id === form.kri_id) && (
                            <div className="mt-2 p-3 bg-blue-50/80 border border-blue-100 rounded-xl text-xs text-blue-800 space-y-1">
                                <p><strong>Detail KRI Terpilih:</strong></p>
                                <p>• Batas Bawah: <strong>{kriList.find(k => k.id === form.kri_id)?.batas_bawah ?? 0}</strong> | Batas Atas: <strong>{kriList.find(k => k.id === form.kri_id)?.batas_atas ?? 0}</strong></p>
                                <p>• Nilai Aktual: <strong>{kriList.find(k => k.id === form.kri_id)?.nilai_aktual ?? 0} {kriList.find(k => k.id === form.kri_id)?.satuan ?? ''}</strong></p>
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="form-label">Nama Threshold *</label>
                        <input type="text" className="form-input w-full" value={form.nama_threshold} onChange={e => f('nama_threshold', e.target.value)} placeholder="e.g. Batas Insiden Bulanan" required />
                    </div>

                    <div>
                        <label className="form-label">Parameter yang Dipantau *</label>
                        <input type="text" className="form-input w-full" value={form.parameter} onChange={e => f('parameter', e.target.value)} placeholder="e.g. Jumlah insiden per bulan" required />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="form-label">Batas Bawah (Min)</label>
                            <input type="number" className="form-input w-full" value={form.batas_bawah} onChange={e => f('batas_bawah', Number(e.target.value))} />
                        </div>
                        <div>
                            <label className="form-label">Batas Atas (Max)</label>
                            <input type="number" className="form-input w-full" value={form.nilai_batas} onChange={e => f('nilai_batas', Number(e.target.value))} />
                        </div>
                        <div>
                            <label className="form-label">Satuan</label>
                            <input type="text" className="form-input w-full" value={form.satuan} onChange={e => f('satuan', e.target.value)} placeholder="e.g. kasus, %, event" />
                        </div>
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                        <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => f('is_active', e.target.checked)} className="w-4 h-4 rounded text-[#137fec]" />
                        <label htmlFor="is_active" className="text-sm font-medium text-slate-700">Threshold aktif (monitoring berjalan)</label>
                    </div>
                </div>

                <div className="flex justify-end gap-3 px-6 pb-6">
                    <button onClick={onClose} className="btn-secondary">Batal</button>
                    <button
                        onClick={() => onSave(form)}
                        className="btn-primary flex items-center gap-2"
                        disabled={saving || !form.nama_threshold || !form.parameter}
                    >
                        {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                        Simpan Threshold
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─── View Modal ─────────────────────────────────────────────────── */
function ViewModal({ row, onClose }: { row: EWSItem; onClose: () => void }) {
    const lvl = row.level;
    const aktual = row.nilai_aktual;
    const atas = row.batas_atas;
    const bawah = row.batas_bawah;
    const pct = atas > 0 ? Math.min(100, Math.round((aktual / atas) * 100)) : 0;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl my-8">
                <div className="flex justify-between items-center p-6 border-b border-slate-100">
                    <div>
                        <h2 className="font-bold text-slate-800 text-lg">Detail Early Warning Indicator</h2>
                        <p className="text-xs text-slate-500 mt-0.5">Analisis posisi aktual terhadap batas ambang toleransi KRI</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"><X size={18} /></button>
                </div>

                <div className="p-6 space-y-5 text-sm">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <span className="text-xs text-slate-400 block">Unit Kerja</span>
                            <p className="font-semibold text-slate-800 mt-0.5">{row.unit_kerja?.nama_unit ?? 'Semua Unit'}</p>
                        </div>
                        <div>
                            <span className="text-xs text-slate-400 block">Tahun Anggaran</span>
                            <p className="font-semibold text-slate-800 mt-0.5">{row.tahun}</p>
                        </div>
                        {row.kode_risiko && (
                            <div>
                                <span className="text-xs text-slate-400 block">Kode KRI</span>
                                <p className="font-semibold text-slate-800 font-mono mt-0.5">{row.kode_risiko}</p>
                            </div>
                        )}
                        <div>
                            <span className="text-xs text-slate-400 block">Sumber Integrasi</span>
                            <p className="font-semibold text-slate-800 mt-0.5 flex items-center gap-1">
                                {row.is_custom ? (
                                    <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded text-xs">Custom Threshold</span>
                                ) : (
                                    <span className="text-[#137fec] bg-blue-50 px-2 py-0.5 rounded text-xs font-bold">Otomatis dari KRI</span>
                                )}
                            </p>
                        </div>
                        <div className="col-span-2">
                            <span className="text-xs text-slate-400 block">Nama Indikator / Threshold</span>
                            <p className="font-bold text-slate-800 text-base mt-0.5">{row.nama_threshold}</p>
                        </div>
                        {row.parameter && (
                            <div className="col-span-2">
                                <span className="text-xs text-slate-400 block">Deskripsi Parameter</span>
                                <p className="text-slate-600 mt-0.5">{row.parameter}</p>
                            </div>
                        )}
                    </div>

                    {/* Parameter Box */}
                    <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                            <p className="text-xs text-slate-500 font-medium">Batas Bawah</p>
                            <p className="text-xl font-bold text-slate-700 mt-1">{bawah} <span className="text-xs font-normal text-slate-400">{row.satuan}</span></p>
                        </div>
                        <div className={`border rounded-xl p-3 ${lvl === 'Critical' ? 'bg-rose-50 border-rose-200' : lvl === 'Warning' ? 'bg-amber-50 border-amber-200' : lvl === 'Notice' ? 'bg-blue-50 border-blue-200' : 'bg-emerald-50 border-emerald-200'}`}>
                            <p className="text-xs text-slate-500 font-medium">Nilai Aktual</p>
                            <p className={`text-xl font-extrabold mt-1 ${lvl === 'Critical' ? 'text-rose-600' : lvl === 'Warning' ? 'text-amber-600' : lvl === 'Notice' ? 'text-blue-600' : 'text-emerald-600'}`}>
                                {aktual} <span className="text-xs font-normal opacity-75">{row.satuan}</span>
                            </p>
                        </div>
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                            <p className="text-xs text-slate-500 font-medium">Batas Atas</p>
                            <p className="text-xl font-bold text-slate-700 mt-1">{atas} <span className="text-xs font-normal text-slate-400">{row.satuan}</span></p>
                        </div>
                    </div>

                    {/* Visual Threshold Bar */}
                    {atas > 0 && (
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                            <div className="flex justify-between text-xs text-slate-600 font-medium">
                                <span>Utilisasi Ambang Batas: <strong>{pct}%</strong></span>
                                <span className={`font-bold ${getEWSLevelBadge(lvl)}`}>Level: {lvl}</span>
                            </div>
                            <div className="h-3 bg-slate-200 rounded-full overflow-hidden relative">
                                <div
                                    className={`h-full transition-all duration-500 rounded-full ${lvl === 'Critical' ? 'bg-rose-500' : lvl === 'Warning' ? 'bg-amber-500' : lvl === 'Notice' ? 'bg-blue-500' : 'bg-emerald-500'}`}
                                    style={{ width: `${Math.min(pct, 100)}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                                <span>Min ({bawah})</span>
                                <span>60% (Notice)</span>
                                <span>80% (Warning)</span>
                                <span>Max ({atas})</span>
                            </div>
                        </div>
                    )}

                    {/* Status Alert Banner */}
                    <div className={`p-4 rounded-xl border flex items-start gap-3 text-xs font-medium ${lvl === 'Critical'
                        ? 'bg-rose-50 border-rose-200 text-rose-800'
                        : lvl === 'Warning'
                            ? 'bg-amber-50 border-amber-200 text-amber-800'
                            : lvl === 'Notice'
                                ? 'bg-blue-50 border-blue-200 text-blue-800'
                                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        }`}>
                        <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold text-sm mb-0.5">Status Peringatan Dini: Level {lvl.toUpperCase()}</p>
                            <p>
                                {lvl === 'Critical' && `Nilai aktual (${aktual}) melebihi batas atas toleransi (${atas} ${row.satuan}). Diperlukan tindakan penanganan darurat segera.`}
                                {lvl === 'Warning' && `Nilai aktual (${aktual}) telah mencapai rentang waspada (80% - 100% dari batas atas ${atas} ${row.satuan}). Lakukan pemantauan ketat.`}
                                {lvl === 'Notice' && `Nilai aktual (${aktual}) berada pada area perhatian awal atau di bawah ambang batas minimum. Perlu kecermatan unit kerja.`}
                                {lvl === 'Normal' && `Nilai aktual (${aktual}) berada dalam kondisi aman dan terkendali sesuai dengan toleransi yang ditetapkan.`}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end px-6 pb-6">
                    <button onClick={onClose} className="btn-secondary">Tutup</button>
                </div>
            </div>
        </div>
    );
}

/* ─── Main Early Warning Page Component ───────────────────────────── */
export default function EarlyWarningSystemPage() {
    const { settings } = useAppSettings();
    const { profile, isManager, isAuditor, isMatchUnit } = useUserProfile();
    const [rows, setRows] = useState<EWSItem[]>([]);
    const [kriList, setKriList] = useState<KRIItem[]>([]);
    const [units, setUnits] = useState<WorkUnit[]>([]);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState('');
    const [year, setYear] = useState(String(new Date().getFullYear()));
    const [unitFilter, setUnitFilter] = useState('');
    const [levelFilter, setLevelFilter] = useState('');
    const [showThresholdModal, setShowThresholdModal] = useState(false);
    const [viewRow, setViewRow] = useState<EWSItem | null>(null);

    // Auto-lock unit filter for unit managers
    useEffect(() => {
        if (isManager && profile?.unit_kerja_id) {
            setUnitFilter(profile.unit_kerja_id);
        }
    }, [isManager, profile]);

    // Combined Data Fetching (Automatic Synchronization from KRI + EWS Thresholds)
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // 1. Fetch Key Risk Indicators
            let kriQuery = supabase
                .from('key_risk_indicators')
                .select('*, unit_kerja(id, nama_unit), risk_inputs(id, kode_risiko, nama_risiko)')
                .order('created_at', { ascending: false });

            if (year) kriQuery = kriQuery.eq('tahun', Number(year));
            if (!isManager && unitFilter) kriQuery = kriQuery.eq('unit_kerja_id', unitFilter);

            const { data: kriData, error: kriErr } = await kriQuery;
            if (kriErr) console.error('Error fetching KRI for EWS:', kriErr);

            // 2. Fetch Custom EWS Thresholds
            let ewsQuery = supabase
                .from('ews_thresholds')
                .select('*, unit_kerja(id, nama_unit), key_risk_indicators(id, nama_kri, nilai_aktual, batas_atas, batas_bawah, satuan)')
                .order('created_at', { ascending: false });

            if (!isManager && unitFilter) ewsQuery = ewsQuery.eq('unit_kerja_id', unitFilter);

            const { data: customData, error: customErr } = await ewsQuery;
            if (customErr) console.error('Error fetching EWS thresholds:', customErr);

            const listKRI: KRIItem[] = (kriData as any) ?? [];
            setKriList(listKRI);

            const customEWSMap = new Map<string, any>();
            ((customData as any) ?? []).forEach((c: any) => {
                if (c.kri_id) customEWSMap.set(c.kri_id, c);
            });

            // 3. Map all KRI items into EWS items automatically
            const combined: EWSItem[] = listKRI.map((kri) => {
                const custom = customEWSMap.get(kri.id);
                const aktual = Number(kri.nilai_aktual ?? 0);
                const atas = Number(custom?.nilai_batas ?? kri.batas_atas ?? 0);
                const bawah = Number(kri.batas_bawah ?? 0);

                const computedLevel = computeEWSLevel({
                    nilai_aktual: aktual,
                    batas_atas: atas,
                    batas_bawah: bawah,
                });

                return {
                    id: custom?.id || `kri-auto-${kri.id}`,
                    unit_kerja_id: kri.unit_kerja_id,
                    risk_input_id: kri.risk_input_id,
                    kri_id: kri.id,
                    kode_risiko: kri.kode_risiko,
                    nama_threshold: custom?.nama_threshold || kri.nama_kri,
                    parameter: custom?.parameter || kri.indikator || kri.nama_kri,
                    batas_bawah: bawah,
                    batas_atas: atas,
                    nilai_aktual: aktual,
                    satuan: kri.satuan || custom?.satuan || '',
                    tahun: kri.tahun || Number(year),
                    level: computedLevel,
                    is_active: custom ? (custom.is_active ?? true) : true,
                    is_custom: !!custom,
                    created_at: custom?.created_at || kri.created_at,
                    unit_kerja: kri.unit_kerja,
                    risk_inputs: kri.risk_inputs,
                    key_risk_indicators: {
                        id: kri.id,
                        nama_kri: kri.nama_kri,
                        nilai_aktual: kri.nilai_aktual,
                        batas_atas: kri.batas_atas,
                        batas_bawah: kri.batas_bawah,
                        satuan: kri.satuan,
                    }
                };
            });

            // 4. Add non-KRI custom thresholds if any
            ((customData as any) ?? []).forEach((c: any) => {
                if (!c.kri_id) {
                    const aktual = Number(c.key_risk_indicators?.nilai_aktual ?? 0);
                    const atas = Number(c.nilai_batas ?? 0);

                    const computedLevel = computeEWSLevel({
                        nilai_aktual: aktual,
                        batas_atas: atas,
                        batas_bawah: 0
                    });

                    combined.push({
                        id: c.id,
                        unit_kerja_id: c.unit_kerja_id,
                        nama_threshold: c.nama_threshold,
                        parameter: c.parameter,
                        batas_bawah: 0,
                        batas_atas: atas,
                        nilai_aktual: aktual,
                        satuan: c.satuan || '',
                        tahun: Number(year),
                        level: computedLevel,
                        is_active: c.is_active ?? true,
                        is_custom: true,
                        created_at: c.created_at,
                        unit_kerja: c.unit_kerja,
                        key_risk_indicators: c.key_risk_indicators,
                    });
                }
            });

            setRows(combined);
        } catch (e) {
            console.error('Error loading Early Warning System:', e);
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [year, isManager, unitFilter]);

    useEffect(() => { fetchData(); }, [fetchData]);

    useEffect(() => {
        supabase.from('unit_kerja').select('id, nama_unit').order('nama_unit', { ascending: true })
            .then(({ data }: { data: any }) => setUnits((data ?? []) as WorkUnit[]));
    }, []);

    // Filter Logic
    const filtered = rows.filter(d => {
        const matchSearch = (d.nama_threshold || '').toLowerCase().includes(search.toLowerCase()) ||
            (d.parameter || '').toLowerCase().includes(search.toLowerCase()) ||
            (d.kode_risiko || '').toLowerCase().includes(search.toLowerCase());
        const matchUnit = isManager ? isMatchUnit(d.unit_kerja_id, d.unit_kerja) : (unitFilter ? d.unit_kerja_id === unitFilter || (d.unit_kerja as any)?.id === unitFilter : true);
        const matchLevel = levelFilter ? d.level === levelFilter : true;
        return matchSearch && matchUnit && matchLevel;
    });

    const stats = {
        total: filtered.length,
        critical: filtered.filter(d => d.level === 'Critical').length,
        warning: filtered.filter(d => d.level === 'Warning').length,
        notice: filtered.filter(d => d.level === 'Notice').length,
        normal: filtered.filter(d => d.level === 'Normal').length,
    };

    const handleSaveThreshold = async (form: typeof EMPTY_THRESHOLD) => {
        setSaving(true);
        try {
            const payload = {
                unit_kerja_id: form.unit_kerja_id || null,
                kri_id: form.kri_id || null,
                nama_threshold: form.nama_threshold,
                parameter: form.parameter,
                nilai_batas: Number(form.nilai_batas),
                satuan: form.satuan || null,
                level: form.level,
                is_active: form.is_active,
                updated_at: new Date().toISOString(),
            };
            const { error } = await supabase.from('ews_thresholds').insert(payload);
            if (error) { console.error(error); alert('Gagal menyimpan threshold: ' + error.message); }
            else { setShowThresholdModal(false); fetchData(); }
        } catch (e) { console.error(e); }
        finally { setSaving(false); }
    };

    const handleDelete = async (row: EWSItem) => {
        if (!row.is_custom) {
            alert('Indikator ini disinkronkan secara otomatis dari KRI. Silakan edit atau hapus KRI terkait.');
            return;
        }
        if (!confirm(`Hapus threshold khusus "${row.nama_threshold}"?`)) return;
        const { error } = await supabase.from('ews_thresholds').delete().eq('id', row.id);
        if (error) alert('Gagal menghapus: ' + error.message);
        else fetchData();
    };

    const handleExportPDF = async () => {
        setDownloading(true);
        try {
            const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();

            const hexToRgb = (hex: string): [number, number, number] => {
                const h = hex.replace('#', '');
                if (h.length !== 6) return [19, 127, 236];
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
                    if (i === 1) continue;
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
                    d.setFont('helvetica', 'italic');
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
            doc.text('LAPORAN EARLY WARNING SYSTEM', pageWidth / 2, pageHeight / 2 - 60, { align: 'center' });
            doc.setFontSize(16);
            doc.setFont('helvetica', 'normal');
            doc.text(`Tahun: ${year || 'Semua'}`, pageWidth / 2, pageHeight / 2, { align: 'center' });
            doc.setFontSize(12);
            doc.text((settings?.nama_rs || 'RUMAH SAKIT').toUpperCase(), pageWidth / 2, pageHeight / 2 + 50, { align: 'center' });

            doc.addPage();
            let tocPageNum = doc.getCurrentPageInfo().pageNumber;
            doc.addPage();
            let contentPageStart = doc.getCurrentPageInfo().pageNumber;

            drawKopSurat(doc);

            doc.setTextColor(30, 41, 59);
            doc.setFontSize(13);
            doc.setFont('helvetica', 'bold');
            doc.text('A. Daftar Sinyal & Indikator Early Warning System', 40, 140);

            let finalY = 160;
            let rowIdx = 1;

            const tableData = filtered.map(r => {
                const unit_name = r.unit_kerja?.nama_unit ?? 'Semua Unit';
                const kodeParam = (r.kode_risiko ? `[${r.kode_risiko}] ` : '') + r.nama_threshold;
                const toleransi = `${r.batas_bawah} – ${r.batas_atas} ${r.satuan}`;
                const aktual = `${r.nilai_aktual} ${r.satuan}`;

                return [
                    rowIdx++,
                    unit_name,
                    kodeParam,
                    toleransi,
                    aktual,
                    r.level.toUpperCase(),
                    r.is_custom ? 'Custom' : 'Auto (KRI)'
                ];
            });

            autoTable(doc, {
                startY: finalY,
                head: [['No', 'Unit Kerja', 'Kode & Parameter Threshold', 'Toleransi (Bawah - Atas)', 'Nilai Aktual', 'Level Peringatan', 'Sumber']],
                body: tableData,
                theme: 'grid',
                headStyles: { fillColor: rgbColor, fontSize: 8, fontStyle: 'bold' },
                styles: { fontSize: 8, cellPadding: 4 },
                columnStyles: {
                    0: { cellWidth: 20, halign: 'center' },
                    1: { cellWidth: 80 },
                    2: { cellWidth: 140 },
                    3: { cellWidth: 85, halign: 'center' },
                    4: { cellWidth: 65, halign: 'center' },
                    5: { cellWidth: 70, halign: 'center' },
                    6: { cellWidth: 55, halign: 'center' }
                },
                margin: { left: 40, right: 40 },
                didDrawPage: () => {
                    const currentPage = doc.getCurrentPageInfo().pageNumber;
                    if (currentPage > contentPageStart) {
                        addHeader(doc, 'Laporan Early Warning System');
                    }
                }
            });

            finalY = (doc as any).lastAutoTable.finalY + 20;

            // TOC
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
            doc.text('1. Threshold & Indikator Early Warning System', 40, 140);
            doc.text(`${contentPageStart - 1}`, pageWidth - 40, 140, { align: 'right' });

            doc.text('2. Lembar Tanda Tangan Pengesahan Laporan', 40, 160);
            const lastPage = doc.getNumberOfPages();
            doc.text(`${lastPage - 1}`, pageWidth - 40, 160, { align: 'right' });

            // Signature block on last page
            doc.setPage(lastPage);
            if (finalY > pageHeight - 150) {
                doc.addPage();
                finalY = 70;
            } else {
                finalY += 15;
            }

            const tgl = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
            const kota = settings?.kota || 'Kota';

            doc.setFontSize(9.5);
            doc.setTextColor(51, 65, 85);
            doc.setFont('helvetica', 'normal');
            doc.text('Disiapkan oleh,', 60, finalY);
            doc.text(settings?.jabatan_penandatangan_kiri || 'Penanggungjawab Unit', 60, finalY + 14);
            doc.line(60, finalY + 65, 200, finalY + 65);
            doc.setFont('helvetica', 'bold');
            doc.text(settings?.nama_penandatangan_kiri || 'Penanggungjawab Unit Kerja', 60, finalY + 78);
            doc.setFont('helvetica', 'normal');

            doc.text(`${kota}, ${tgl}`, pageWidth - 200, finalY);
            doc.text('Disetujui oleh,', pageWidth - 200, finalY + 14);
            doc.setFont('helvetica', 'bold');
            doc.text(settings?.kepala_rs || 'Kepala / Direktur RS', pageWidth - 200, finalY + 28);
            doc.line(pageWidth - 200, finalY + 65, pageWidth - 60, finalY + 65);
            doc.setFont('helvetica', 'normal');
            doc.text(`NIP: ${settings?.nip_kepala || '-'}`, pageWidth - 200, finalY + 78);

            addFooter(doc);
            doc.save(`Laporan_Early_Warning_${year || 'Semua'}.pdf`);
        } catch (e) {
            console.error(e);
            alert('Gagal mengunduh laporan PDF');
        } finally {
            setDownloading(false);
        }
    };

    const columns: Column<EWSItem>[] = [
        { key: 'unit_kerja_id', label: 'Unit Deteksi', render: r => (r as any).unit_kerja?.nama_unit ?? 'Semua Unit' },
        {
            key: 'nama_threshold', label: 'Parameter & Indikator KRI', className: 'max-w-md font-medium',
            render: r => (
                <div>
                    <div className="flex items-center gap-1.5">
                        {r.kode_risiko && <span className="font-mono text-xs text-slate-400">{r.kode_risiko} ·</span>}
                        <span className="font-bold text-slate-800">{r.nama_threshold}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{r.parameter}</p>
                </div>
            )
        },
        {
            key: 'batas_atas', label: 'Batas Toleransi (Min – Max)', className: 'text-center text-xs font-mono',
            render: r => <span className="text-slate-600 font-medium">{r.batas_bawah} – {r.batas_atas} {r.satuan}</span>
        },
        {
            key: 'nilai_aktual', label: 'Nilai Aktual', className: 'text-center font-bold text-sm',
            render: r => (
                <span className={r.level === 'Critical' ? 'text-rose-600' : r.level === 'Warning' ? 'text-amber-600' : r.level === 'Notice' ? 'text-blue-600' : 'text-emerald-600'}>
                    {r.nilai_aktual} <span className="text-xs font-normal opacity-75">{r.satuan}</span>
                </span>
            )
        },
        {
            key: 'level', label: 'Level Peringatan', className: 'text-center',
            render: r => (
                <span className={getEWSLevelBadge(r.level)}>
                    {r.level}
                </span>
            )
        },
        {
            key: 'is_custom', label: 'Sumber Integrasi', className: 'text-center',
            render: r => r.is_custom ? (
                <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded font-mono">Custom</span>
            ) : (
                <span className="text-[10px] bg-blue-50 text-[#137fec] border border-blue-200 px-2 py-0.5 rounded font-mono font-bold">Auto (KRI)</span>
            )
        },
        {
            key: 'actions', label: 'Aksi', render: r => (
                <div className="flex gap-1 items-center justify-center">
                    {r.level === 'Critical' && (
                        <span title="Level Sangat Kritis!" className="p-1 text-rose-500 animate-pulse">
                            <Bell size={16} />
                        </span>
                    )}
                    {r.level === 'Warning' && (
                        <span title="Level Warning" className="p-1 text-amber-500">
                            <AlertTriangle size={16} />
                        </span>
                    )}
                    {r.level === 'Notice' && (
                        <span title="Level Notice" className="p-1 text-blue-500">
                            <Info size={16} />
                        </span>
                    )}
                    {r.level === 'Normal' && (
                        <span title="Sistem Normal" className="p-1 text-slate-300">
                            <BellOff size={16} />
                        </span>
                    )}
                    <button title="Lihat detail EWS" className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded" onClick={() => setViewRow(r)}>
                        <Eye size={15} />
                    </button>
                    {!isAuditor && r.is_custom && (
                        <button title="Hapus Custom Threshold" className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded" onClick={() => handleDelete(r)}>
                            <Trash2 size={15} />
                        </button>
                    )}
                </div>
            )
        },
    ];

    const criticalCount = stats.critical;
    const warningCount = stats.warning;

    return (
        <div>
            {showThresholdModal && (
                <ThresholdModal
                    onClose={() => setShowThresholdModal(false)}
                    onSave={handleSaveThreshold}
                    units={units}
                    kriList={kriList}
                    saving={saving}
                />
            )}
            {viewRow && <ViewModal row={viewRow} onClose={() => setViewRow(null)} />}

            <PageHeader title="Early Warning System" subtitle="Sistem deteksi dini terintegrasi otomatis dengan Key Risk Indicator (KRI) dan aturan threshold." />

            {/* Score Cards Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                <ScoreCard
                    icon={<ShieldAlert size={22} className="text-slate-500" />}
                    title="Total Terdeteksi"
                    value={stats.total}
                    subtitle="Indikator EWS aktif"
                    colorClass="bg-slate-50 border-slate-100"
                />
                <ScoreCard
                    icon={<AlertTriangle size={22} className="text-rose-500" />}
                    title="Critical"
                    value={stats.critical}
                    subtitle="Over Limit toleransi"
                    colorClass="bg-rose-50 border-rose-100"
                />
                <ScoreCard
                    icon={<AlertTriangle size={22} className="text-amber-500" />}
                    title="Warning"
                    value={stats.warning}
                    subtitle="Mendekati batas atas"
                    colorClass="bg-amber-50 border-amber-100"
                />
                <ScoreCard
                    icon={<Info size={22} className="text-blue-500" />}
                    title="Notice"
                    value={stats.notice}
                    subtitle="Perhatian / bawah batas"
                    colorClass="bg-blue-50 border-blue-100"
                />
                <ScoreCard
                    icon={<CheckCircle2 size={22} className="text-emerald-500" />}
                    title="Normal"
                    value={stats.normal}
                    subtitle="Dalam batas aman"
                    colorClass="bg-emerald-50 border-emerald-100"
                />
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-8">
                {criticalCount > 0 && (
                    <div className="p-4 bg-rose-50 border-b border-rose-200 text-rose-800 text-sm flex items-center gap-2 font-semibold animate-pulse">
                        <AlertTriangle size={18} className="shrink-0" />
                        🚨 PERINGATAN KRITIS: {criticalCount} indikator dalam status CRITICAL (melebihi batas atas toleransi)! Segera lakukan tindakan penanganan.
                    </div>
                )}
                {criticalCount === 0 && warningCount > 0 && (
                    <div className="p-4 bg-amber-50 border-b border-amber-200 text-amber-800 text-sm flex items-center gap-2 font-medium">
                        <AlertTriangle size={18} className="shrink-0" />
                        ⚠️ PERHATIAN: {warningCount} indikator dalam status WARNING (mendekati batas atas toleransi).
                    </div>
                )}
                {criticalCount === 0 && warningCount === 0 && rows.length > 0 && (
                    <div className="p-4 bg-emerald-50 border-b border-emerald-100 text-emerald-800 text-sm flex items-center gap-2 font-medium">
                        <CheckCircle2 size={18} className="shrink-0" />
                        ✅ Live Monitoring Active: Seluruh indikator KRI terdeteksi dalam kondisi aman & normal.
                    </div>
                )}

                <TopActionBar
                    filters={
                        <div className="flex flex-wrap gap-3 items-center">
                            <FilterBar
                                searchValue={search} onSearchChange={setSearch} searchPlaceholder="Cari indikator / parameter..."
                                yearValue={year} onYearChange={setYear}
                            />
                            {isManager ? (
                                <div className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold border border-slate-200">
                                    {units.find(u => u.id === unitFilter)?.nama_unit || profile?.unit_kerja_name || 'Unit Anda'}
                                </div>
                            ) : (
                                <select className="form-select text-sm h-9" value={unitFilter} onChange={e => setUnitFilter(e.target.value)}>
                                    <option value="">Semua Unit Kerja</option>
                                    {units.map(u => <option key={u.id} value={u.id}>{u.nama_unit}</option>)}
                                </select>
                            )}

                            <select className="form-select text-sm h-9" value={levelFilter} onChange={e => setLevelFilter(e.target.value)}>
                                <option value="">Semua Level</option>
                                <option value="Critical">Critical (Merah)</option>
                                <option value="Warning">Warning (Kuning)</option>
                                <option value="Notice">Notice (Biru)</option>
                                <option value="Normal">Normal (Hijau)</option>
                            </select>
                        </div>
                    }
                    actions={
                        <>
                            <button className="btn-secondary" onClick={handleExportPDF} disabled={downloading}>
                                {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                                <span className="hidden sm:inline">Laporan</span>
                            </button>
                            {!isAuditor && (
                                <button className="btn-primary" onClick={() => setShowThresholdModal(true)}>
                                    <Settings size={15} />
                                    <span>Custom Threshold</span>
                                </button>
                            )}
                        </>
                    }
                />

                <DataTable columns={columns} data={filtered} isLoading={loading} />

                <div className="px-6 py-3 border-t border-slate-50 text-xs text-slate-400 flex justify-between items-center">
                    <span>{filtered.length} indikator terdeteksi · {criticalCount} Critical · {warningCount} Warning</span>
                    <span className="font-mono text-[11px]">Disinkronkan otomatis dari KRI</span>
                </div>
            </div>
        </div>
    );
}
