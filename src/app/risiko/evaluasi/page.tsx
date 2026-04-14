'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader, ScoreCard } from '@/components/SharedUI';
import { Activity, AlertTriangle, CheckCircle2, Plus, ShieldAlert, TrendingDown, X, Save, Loader2, Bell } from 'lucide-react';

const CURRENT_YEAR = new Date().getFullYear();

/* ─── Types ─── */
interface EvaluasiRow {
    id: string;
    unit_kerja_id?: string;
    risk_input_id?: string;
    kri_id?: string;
    tahun: number;
    tanggal_evaluasi: string;
    nilai_aktual?: number;
    target_nilai?: number;
    capaian_persen?: number;
    status: string;
    catatan?: string;
    rekomendasi?: string;
    created_at: string;
    unit_kerja?: { id: string; nama_unit: string };
    risk_inputs?: { id: string; nama_risiko?: string; kode_risiko?: string };
    key_risk_indicators?: { id: string; nama_kri: string; nilai_aktual?: number; batas_atas?: number; satuan?: string };
}

interface RisikoLinked {
    id: string;
    nama_risiko?: string;
    kode_risiko?: string;
    nama_unit_kerja_id?: string;
    // from manajemen_risiko
    identifikasi_risiko?: string;
    skor_risiko?: number;
    probabilitas?: number;
    dampak?: number;
    status?: string;
    mitigasi?: string;
}

interface KRIItem {
    id: string;
    nama_kri: string;
    nilai_aktual?: number;
    batas_atas?: number;
    batas_bawah?: number;
    satuan?: string;
    unit_kerja_id?: string;
}

interface WorkUnit { id: string; nama_unit: string; }

/* ─── Empty Form ─── */
const EMPTY_FORM = {
    unit_kerja_id: '',
    kri_id: '',
    risk_input_id: '',
    tanggal_evaluasi: new Date().toISOString().split('T')[0],
    nilai_aktual: 0,
    target_nilai: 0,
    catatan: '',
    rekomendasi: '',
    status: 'Normal',
};

/* ─── Priority Bar ─── */
function PriorityBar({ score, max = 25 }: { score: number; max?: number }) {
    const pct = Math.min((score / max) * 100, 100);
    const color = score >= 15 ? 'bg-rose-500' : score >= 10 ? 'bg-orange-400' : score >= 5 ? 'bg-amber-400' : 'bg-emerald-400';
    return (
        <div className="w-full bg-slate-100 rounded-full h-2">
            <div className={`${color} h-2 rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
        </div>
    );
}

/* ─── Evaluasi Modal ─── */
function EvaluasiModal({ onClose, onSave, units, kriList, risikoList, saving }: {
    onClose: () => void;
    onSave: (data: typeof EMPTY_FORM, capaian: number) => void;
    units: WorkUnit[];
    kriList: KRIItem[];
    risikoList: RisikoLinked[];
    saving: boolean;
}) {
    const [form, setForm] = useState({ ...EMPTY_FORM });
    const [selectedKRI, setSelectedKRI] = useState<KRIItem | null>(null);
    const [filteredRisiko, setFilteredRisiko] = useState<RisikoLinked[]>([]);

    const f = (k: keyof typeof form, v: string | number) => setForm(prev => ({ ...prev, [k]: v }));

    const handleUnitChange = (unitId: string) => {
        f('unit_kerja_id', unitId);
        f('kri_id', '');
        f('risk_input_id', '');
        setSelectedKRI(null);
        setFilteredRisiko(risikoList.filter(r => !r.nama_unit_kerja_id || r.nama_unit_kerja_id === unitId));
    };

    const handleKRIChange = (id: string) => {
        f('kri_id', id);
        const kri = kriList.find(k => k.id === id);
        setSelectedKRI(kri ?? null);
        if (kri) {
            f('target_nilai', kri.batas_atas ?? 0);
            f('nilai_aktual', kri.nilai_aktual ?? 0);
        }
    };

    const capaian = form.target_nilai > 0 ? Math.min(100, Math.round((Number(form.nilai_aktual) / Number(form.target_nilai)) * 100)) : 0;
    const isBreached = selectedKRI ? Number(form.nilai_aktual) > (selectedKRI.batas_atas ?? Infinity) : false;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">
                <div className="flex justify-between items-center p-6 border-b border-slate-100">
                    <div>
                        <h2 className="font-bold text-slate-800 text-lg">Tambah Evaluasi Risiko</h2>
                        <p className="text-xs text-slate-500 mt-0.5">Evaluasi capaian KRI dan status risiko per unit kerja</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"><X size={18} /></button>
                </div>

                <div className="p-6 space-y-5 text-sm">
                    {/* Unit & Tanggal */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="form-label">Unit Kerja *</label>
                            <select className="form-input w-full" value={form.unit_kerja_id} onChange={e => handleUnitChange(e.target.value)} required>
                                <option value="">-- Pilih Unit --</option>
                                {units.map(u => <option key={u.id} value={u.id}>{u.nama_unit}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="form-label">Tanggal Evaluasi *</label>
                            <input type="date" className="form-input w-full" value={form.tanggal_evaluasi} onChange={e => f('tanggal_evaluasi', e.target.value)} required />
                        </div>
                    </div>

                    {/* KRI */}
                    <div>
                        <label className="form-label">KRI yang Dievaluasi *</label>
                        <select className="form-input w-full" value={form.kri_id} onChange={e => handleKRIChange(e.target.value)} required>
                            <option value="">-- Pilih KRI --</option>
                            {kriList
                                .filter(k => !form.unit_kerja_id || k.unit_kerja_id === form.unit_kerja_id)
                                .map(k => (
                                    <option key={k.id} value={k.id}>
                                        {k.nama_kri} (Batas: {k.batas_atas ?? '-'} {k.satuan ?? ''})
                                    </option>
                                ))}
                        </select>
                    </div>

                    {/* KRI info & linked risiko */}
                    {selectedKRI && (
                        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 space-y-3">
                            <p className="text-xs font-bold text-indigo-700 uppercase tracking-wide">Ringkasan KRI Terpilih</p>
                            <div className="grid grid-cols-3 gap-3 text-center">
                                <div className="bg-white rounded-xl p-2">
                                    <p className="text-xs text-slate-500">Batas Bawah</p>
                                    <p className="font-bold text-slate-700">{selectedKRI.batas_bawah ?? '-'} {selectedKRI.satuan ?? ''}</p>
                                </div>
                                <div className={`rounded-xl p-2 ${isBreached ? 'bg-rose-100' : 'bg-emerald-100'}`}>
                                    <p className="text-xs text-slate-500">Nilai Aktual Saat Ini</p>
                                    <p className={`font-bold ${isBreached ? 'text-rose-600' : 'text-emerald-600'}`}>{selectedKRI.nilai_aktual ?? 0} {selectedKRI.satuan ?? ''}</p>
                                </div>
                                <div className="bg-white rounded-xl p-2">
                                    <p className="text-xs text-slate-500">Batas Atas</p>
                                    <p className="font-bold text-rose-600">{selectedKRI.batas_atas ?? '-'} {selectedKRI.satuan ?? ''}</p>
                                </div>
                            </div>

                            {/* Linked risiko */}
                            {filteredRisiko.length > 0 && (
                                <div>
                                    <p className="text-xs font-semibold text-slate-600 mb-2">Risiko Terkait pada Unit Ini:</p>
                                    <select className="form-input w-full" value={form.risk_input_id} onChange={e => f('risk_input_id', e.target.value)}>
                                        <option value="">-- Pilih Risiko Terkait --</option>
                                        {filteredRisiko.map(r => (
                                            <option key={r.id} value={r.id}>
                                                {r.kode_risiko ? `[${r.kode_risiko}] ` : ''}{r.nama_risiko || r.identifikasi_risiko || 'Tanpa Nama'}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Nilai Aktual & Target */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="form-label">Nilai Aktual Baru</label>
                            <input type="number" className="form-input w-full" value={form.nilai_aktual} onChange={e => f('nilai_aktual', Number(e.target.value))} />
                        </div>
                        <div>
                            <label className="form-label">Target / Nilai Batas</label>
                            <input type="number" className="form-input w-full" value={form.target_nilai} onChange={e => f('target_nilai', Number(e.target.value))} />
                        </div>
                    </div>

                    {/* Capaian indicator */}
                    <div className="bg-slate-50 rounded-xl p-4">
                        <div className="flex justify-between text-xs text-slate-500 mb-2">
                            <span>Capaian terhadap Target</span>
                            <span className="font-bold">{capaian}%</span>
                        </div>
                        <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all ${isBreached ? 'bg-rose-500' : capaian >= 80 ? 'bg-emerald-500' : capaian >= 60 ? 'bg-amber-400' : 'bg-rose-400'}`}
                                style={{ width: `${Math.min(capaian, 100)}%` }}
                            />
                        </div>
                        {isBreached && (
                            <div className="mt-2 text-xs text-rose-700 font-semibold flex items-center gap-2">
                                <AlertTriangle size={12} />
                                Nilai aktual melebihi batas atas — akan memicu notifikasi EWS dan Dashboard!
                            </div>
                        )}
                    </div>

                    {/* Catatan */}
                    <div>
                        <label className="form-label">Catatan Evaluasi</label>
                        <textarea className="form-input w-full h-16 resize-none" value={form.catatan} onChange={e => f('catatan', e.target.value)} placeholder="Temuan, kendala, atau catatan evaluasi..." />
                    </div>

                    {/* Rekomendasi */}
                    <div>
                        <label className="form-label">Rekomendasi Tindak Lanjut</label>
                        <textarea className="form-input w-full h-16 resize-none" value={form.rekomendasi} onChange={e => f('rekomendasi', e.target.value)} placeholder="Langkah perbaikan yang disarankan..." />
                    </div>
                </div>

                <div className="flex justify-end gap-3 px-6 pb-6">
                    <button onClick={onClose} className="btn-secondary">Batal</button>
                    <button
                        onClick={() => onSave(form, capaian)}
                        className="btn-primary flex items-center gap-2"
                        disabled={saving || !form.kri_id || !form.unit_kerja_id}
                    >
                        {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                        Simpan Evaluasi
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─── Main Page ─── */
export default function EvaluasiRisikoPage() {
    const [data, setData] = useState<EvaluasiRow[]>([]);
    const [year, setYear] = useState(String(CURRENT_YEAR));
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [units, setUnits] = useState<WorkUnit[]>([]);
    const [kriList, setKriList] = useState<KRIItem[]>([]);
    const [risikoList, setRisikoList] = useState<RisikoLinked[]>([]);
    const [alerts, setAlerts] = useState<{ unit: string; kri: string; aktual: number; batas: number }[]>([]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        const yearStart = `${year}-01-01`;
        const yearEnd = `${year}-12-31`;

        const [evalRes, kriRes] = await Promise.all([
            supabase
                .from('evaluasi_risiko')
                .select('*, unit_kerja(id, nama_unit), risk_inputs(id, nama_risiko, kode_risiko), key_risk_indicators(id, nama_kri, nilai_aktual, batas_atas, satuan)')
                .gte('tanggal_evaluasi', yearStart)
                .lte('tanggal_evaluasi', yearEnd)
                .order('tanggal_evaluasi', { ascending: false }),
            supabase
                .from('key_risk_indicators')
                .select('id, nama_kri, nilai_aktual, batas_atas, batas_bawah, satuan, unit_kerja_id, unit_kerja(id, nama_unit)')
        ]);

        setData((evalRes.data as EvaluasiRow[]) ?? []);
        const kris = (kriRes.data ?? []) as KRIItem[];
        setKriList(kris);

        // Build alerts for breached KRIs
        const breached = kris.filter(k => (k.nilai_aktual ?? 0) > (k.batas_atas ?? Infinity));
        setAlerts(breached.map(k => ({
            unit: (k as any).unit_kerja?.nama_unit ?? 'Unknown Unit',
            kri: k.nama_kri,
            aktual: k.nilai_aktual ?? 0,
            batas: k.batas_atas ?? 0,
        })));

        setLoading(false);
    }, [year]);

    useEffect(() => { fetchData(); }, [fetchData]);

    useEffect(() => {
        supabase.from('unit_kerja').select('id, nama_unit').then(({ data }) => setUnits((data ?? []) as WorkUnit[]));
        supabase.from('risk_inputs').select('id, nama_risiko, kode_risiko, nama_unit_kerja_id').then(({ data }) => setRisikoList((data ?? []) as RisikoLinked[]));
    }, []);

    const byStatus = {
        Open: data.filter(d => d.status === 'Open').length,
        Monitoring: data.filter(d => d.status === 'Monitoring').length,
        MitigasiBerjalan: data.filter(d => d.status === 'Mitigasi Berjalan').length,
        Closed: data.filter(d => d.status === 'Closed').length,
    };

    // Group by unit kerja
    const grouped = Object.entries(
        data.reduce<Record<string, EvaluasiRow[]>>((acc, r) => {
            const unit = (r.unit_kerja as { nama_unit: string })?.nama_unit ?? 'Tidak Diketahui';
            if (!acc[unit]) acc[unit] = [];
            acc[unit].push(r);
            return acc;
        }, {})
    );

    const handleSaveEvaluasi = async (form: typeof EMPTY_FORM, capaian: number) => {
        setSaving(true);
        try {
            // Determine status based on value vs KRI bounds
            const kri = kriList.find(k => k.id === form.kri_id);
            let status = 'Normal';
            if (kri && Number(form.nilai_aktual) > (kri.batas_atas ?? Infinity)) status = 'Melebihi Batas';
            else if (kri && Number(form.nilai_aktual) > (kri.batas_atas ?? Infinity) * 0.8) status = 'Mendekati Batas';
            else if (kri && Number(form.nilai_aktual) < (kri.batas_bawah ?? 0)) status = 'Di Bawah Batas';

            const payload = {
                unit_kerja_id: form.unit_kerja_id || null,
                kri_id: form.kri_id || null,
                risk_input_id: form.risk_input_id || null,
                tahun: new Date(form.tanggal_evaluasi).getFullYear(),
                tanggal_evaluasi: form.tanggal_evaluasi,
                nilai_aktual: Number(form.nilai_aktual),
                target_nilai: Number(form.target_nilai),
                capaian_persen: capaian,
                status,
                catatan: form.catatan || null,
                rekomendasi: form.rekomendasi || null,
            };

            const { error } = await supabase.from('evaluasi_risiko').insert(payload);
            if (error) { console.error(error); alert('Gagal menyimpan evaluasi: ' + error.message); }
            else {
                setShowModal(false);
                fetchData();

                // If breached, also insert EWS alert
                if (status === 'Melebihi Batas' && kri) {
                    await supabase.from('ews_thresholds').insert({
                        unit_kerja_id: form.unit_kerja_id || null,
                        kri_id: form.kri_id,
                        nama_threshold: `Auto-EWS: ${kri.nama_kri}`,
                        parameter: `Nilai aktual melebihi batas pada evaluasi ${form.tanggal_evaluasi}`,
                        nilai_batas: kri.batas_atas ?? 0,
                        satuan: kri.satuan ?? null,
                        level: 'Warning',
                        is_active: true,
                    });
                }
            }
        } catch (e) { console.error(e); }
        finally { setSaving(false); }
    };

    return (
        <div>
            {showModal && (
                <EvaluasiModal
                    onClose={() => setShowModal(false)}
                    onSave={handleSaveEvaluasi}
                    units={units}
                    kriList={kriList}
                    risikoList={risikoList}
                    saving={saving}
                />
            )}

            <PageHeader
                title="Evaluasi Risiko"
                subtitle="Evaluasi dan perbandingan profil risiko antar unit kerja."
                actions={
                    <div className="flex gap-3 items-center">
                        <select className="form-input w-36" value={year} onChange={e => setYear(e.target.value)}>
                            {[CURRENT_YEAR + 1, CURRENT_YEAR, CURRENT_YEAR - 1].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <button className="btn-primary flex items-center gap-2" onClick={() => setShowModal(true)}>
                            <Plus size={15} /> Tambah Evaluasi
                        </button>
                    </div>
                }
            />

            {/* Alerts Banner */}
            {alerts.length > 0 && (
                <div className="mb-6 bg-rose-50 border border-rose-200 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Bell size={18} className="text-rose-600 animate-pulse" />
                        <p className="font-bold text-rose-700">⚠️ PERINGATAN — {alerts.length} KRI Melebihi Batas Ambang!</p>
                    </div>
                    <div className="space-y-2">
                        {alerts.map((a, i) => (
                            <div key={i} className="flex items-center gap-3 bg-white border border-rose-100 rounded-xl p-3 text-sm">
                                <AlertTriangle size={16} className="text-rose-500 flex-shrink-0" />
                                <div>
                                    <p className="font-semibold text-slate-800">{a.kri}</p>
                                    <p className="text-xs text-slate-500">{a.unit} · Nilai Aktual: <strong className="text-rose-600">{a.aktual}</strong> &gt; Batas Atas: <strong>{a.batas}</strong></p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
                <ScoreCard icon={<ShieldAlert size={22} className="text-slate-500" />} title="Total Evaluasi" value={data.length} colorClass="bg-slate-50 border-slate-100" />
                <ScoreCard icon={<AlertTriangle size={22} className="text-rose-500" />} title="Open" value={byStatus.Open} colorClass="bg-rose-50 border-rose-100" />
                <ScoreCard icon={<Activity size={22} className="text-[#137fec]" />} title="Mitigasi Berjalan" value={byStatus.MitigasiBerjalan} colorClass="bg-blue-50 border-blue-100" />
                <ScoreCard icon={<CheckCircle2 size={22} className="text-emerald-500" />} title="Closed" value={byStatus.Closed} colorClass="bg-emerald-50 border-emerald-100" />
            </div>

            <div className="card">
                <div className="flex items-center gap-2 mb-6">
                    <TrendingDown size={18} className="text-[#137fec]" />
                    <h3 className="font-bold text-slate-700">Profil Risiko per Unit Kerja</h3>
                </div>
                {loading ? (
                    <div className="flex items-center justify-center py-12 text-slate-400">
                        <div className="animate-spin w-5 h-5 border-2 border-slate-200 border-t-[#137fec] rounded-full mr-2" />
                        <span className="text-sm">Memuat data...</span>
                    </div>
                ) : data.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                        <div className="text-4xl mb-3">📊</div>
                        <p className="text-sm font-medium">Belum ada evaluasi risiko untuk tahun ini</p>
                        <p className="text-xs mt-1">Klik "Tambah Evaluasi" untuk mencatat evaluasi baru</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {grouped.map(([unit, evals]) => {
                            const avgCapaian = evals.reduce((s, r) => s + (r.capaian_persen ?? 0), 0) / evals.length;
                            const hasAlert = alerts.some(a => a.unit === unit);
                            return (
                                <div key={unit} className={`p-4 rounded-xl ${hasAlert ? 'bg-rose-50 border border-rose-100' : 'bg-slate-50'}`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            {hasAlert && <AlertTriangle size={16} className="text-rose-500" />}
                                            <p className="font-semibold text-slate-700 text-sm">{unit}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-lg font-bold ${avgCapaian < 60 ? 'text-rose-600' : avgCapaian < 80 ? 'text-amber-500' : 'text-emerald-600'}`}>{avgCapaian.toFixed(0)}%</p>
                                            <p className="text-[10px] text-slate-400">Rata-rata Capaian</p>
                                        </div>
                                    </div>
                                    <PriorityBar score={avgCapaian} max={100} />
                                    <div className="flex gap-3 mt-2 flex-wrap text-[10px] text-slate-500">
                                        <span>{evals.length} evaluasi</span>
                                        {hasAlert && <span className="text-rose-600 font-semibold">⚠️ Melebihi batas KRI</span>}
                                    </div>

                                    {/* KRI detail cards */}
                                    <div className="mt-3 space-y-2">
                                        {evals.map(ev => (
                                            <div key={ev.id} className="bg-white rounded-lg p-3 text-xs flex items-center justify-between border border-slate-100">
                                                <div>
                                                    <p className="font-medium text-slate-700">{(ev.key_risk_indicators as any)?.nama_kri ?? 'KRI'}</p>
                                                    <p className="text-slate-400 mt-0.5">{new Date(ev.tanggal_evaluasi).toLocaleDateString('id-ID')} · {ev.catatan ?? ''}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className={`font-bold text-sm ${ev.status === 'Melebihi Batas' ? 'text-rose-600' : ev.status === 'Normal' ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                        {ev.nilai_aktual ?? '-'}
                                                    </p>
                                                    <p className="text-slate-400">Target: {ev.target_nilai ?? '-'}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
