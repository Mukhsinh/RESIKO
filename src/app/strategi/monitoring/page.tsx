'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { supabase, type ManajemenStrategi, type UnitKerja } from '@/lib/supabase';
import { PageHeader, ScoreCard, FilterBar, TopActionBar } from '@/components/SharedUI';
import DataTable, { type Column } from '@/components/DataTable';
import FormInputAI from '@/components/FormInputAI';
import { Plus, Download, Upload, FileText, TrendingUp, Target, CheckCircle2, Clock, Save, X, Loader2 } from 'lucide-react';
import { useUserProfile } from '@/hooks/useUserProfile';

const CURRENT_YEAR = new Date().getFullYear();

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const PERIODE_LABELS: Record<string, string[]> = {
    tahunan: ['Tahunan'],
    semesteran: ['Semester 1', 'Semester 2'],
    triwulanan: ['Triwulan 1', 'Triwulan 2', 'Triwulan 3', 'Triwulan 4'],
    bulanan: MONTHS,
};

// --- Realisasi JSON encoding/decoding ---
interface RealisasiData { tipe: string; inputs: string[]; rata_rata: number; }

const serializeRealisasi = (tipe: string, inputs: string[]): string => {
    const validNums = inputs.map(i => parseFloat(i)).filter(n => !isNaN(n));
    const avg = validNums.length > 0 ? Math.round((validNums.reduce((a, b) => a + b, 0) / validNums.length) * 100) / 100 : 0;
    return JSON.stringify({ tipe, inputs, rata_rata: avg });
};

const deserializeRealisasi = (val: string | null | undefined): RealisasiData & { rawText: string } => {
    const def = { tipe: 'tahunan', inputs: [''], rata_rata: 0, rawText: val || '' };
    if (!val) return def;
    try {
        const p = JSON.parse(val);
        if (p && typeof p === 'object' && p.tipe) {
            return { tipe: p.tipe, inputs: p.inputs || [''], rata_rata: p.rata_rata || 0, rawText: String(p.rata_rata || '') };
        }
    } catch {
        const num = parseFloat(val);
        return { tipe: 'tahunan', inputs: [val], rata_rata: isNaN(num) ? 0 : num, rawText: val };
    }
    return def;
};

const getDisplayRealisasi = (val: string | null | undefined): string => {
    const d = deserializeRealisasi(val);
    if (d.rata_rata) return String(d.rata_rata);
    return d.rawText || '-';
};

// --- Speedometer Gauge Component ---
function SpeedometerGauge({ value, target, kpiName, satuan = '%' }: { value: number; target: number; kpiName: string; satuan?: string }) {
    let pct = target > 0 ? (value / target) * 100 : 0;
    pct = Math.min(Math.max(pct, 0), 150);
    const clampedPct = Math.min(pct, 100);

    let status: 'AMAN' | 'WASPADA' | 'BAHAYA';
    if (pct >= 100) status = 'AMAN';
    else if (pct >= 70) status = 'WASPADA';
    else status = 'BAHAYA';

    const statusMeta = {
        AMAN: { bg: 'bg-emerald-600', text: 'text-emerald-600' },
        WASPADA: { bg: 'bg-amber-500', text: 'text-amber-600' },
        BAHAYA: { bg: 'bg-rose-600', text: 'text-rose-600' },
    }[status];

    const needleAngle = -90 + (clampedPct * 180) / 100;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col justify-between h-full">
            <div className="p-3 flex flex-col items-center text-center">
                <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase truncate max-w-full block mb-1 line-clamp-1">{kpiName}</span>
                <div className="relative w-32 h-[68px] flex items-center justify-center overflow-hidden mt-1">
                    <svg className="w-full h-full" viewBox="0 0 120 68">
                        {/* Background track */}
                        <path d="M 10 60 A 50 50 0 0 1 110 60" fill="none" stroke="#e2e8f0" strokeWidth="10" strokeLinecap="round" />
                        {/* Red zone 0-70% */}
                        <path d="M 10 60 A 50 50 0 0 1 43.64 17.27" fill="none" stroke="#ef4444" strokeWidth="10" />
                        {/* Amber zone 70-100% */}
                        <path d="M 43.64 17.27 A 50 50 0 0 1 85 13" fill="none" stroke="#f59e0b" strokeWidth="10" />
                        {/* Green zone >100% */}
                        <path d="M 85 13 A 50 50 0 0 1 110 60" fill="none" stroke="#10b981" strokeWidth="10" />
                        {/* Needle */}
                        <line x1="60" y1="60" x2="60" y2="18" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" transform={`rotate(${needleAngle} 60 60)`} />
                        <circle cx="60" cy="60" r="5" fill="#1e293b" />
                        <circle cx="60" cy="60" r="2.5" fill="white" />
                    </svg>
                    <div className="absolute bottom-0 inset-x-0 text-center">
                        <span className={`text-lg font-extrabold leading-none ${statusMeta.text}`}>{value.toLocaleString('id-ID')}</span>
                        <span className="text-[9px] text-slate-400 font-medium block">{satuan}</span>
                    </div>
                </div>
                <span className="text-[10px] font-semibold text-slate-500 mt-1">Target: ≥ {target} {satuan}</span>
            </div>
            <div className={`w-full py-1 text-center text-[10px] font-bold text-white uppercase tracking-widest ${statusMeta.bg}`}>
                {status}
            </div>
        </div>
    );
}

// --- Achievement Badge ---
function AchievementBadge({ target, realisasi }: { target: string; realisasi: string }) {
    const displayVal = getDisplayRealisasi(realisasi);
    const t = parseFloat(target), r = parseFloat(displayVal);
    if (isNaN(t) || isNaN(r)) return <span className="badge-gray">{displayVal || '-'}</span>;
    const pct = (r / t) * 100;
    if (pct >= 100) return <span className="badge-green">✓ {displayVal} ({pct.toFixed(0)}%)</span>;
    if (pct >= 70) return <span className="badge-amber">{displayVal} ({pct.toFixed(0)}%)</span>;
    return <span className="badge-red">{displayVal} ({pct.toFixed(0)}%)</span>;
}

// --- Form ---
interface FormData {
    tahun: number; unit_kerja_id: string; sasaran_strategis: string; kpi: string;
    target: string; realisasi: string; cascading_id?: string;
    periode_tipe: string; periode_inputs: string[];
}
const defaultForm: FormData = {
    tahun: CURRENT_YEAR, unit_kerja_id: '', sasaran_strategis: '', kpi: '', target: '', realisasi: '',
    periode_tipe: 'tahunan', periode_inputs: [''],
};

export default function MonitoringKPIPage() {
    const { profile } = useUserProfile();
    const [data, setData] = useState<ManajemenStrategi[]>([]);
    const [units, setUnits] = useState<UnitKerja[]>([]);
    const [cascadingData, setCascadingData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [year, setYear] = useState(String(CURRENT_YEAR));
    const [filterUnit, setFilterUnit] = useState<string>('all');
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState<FormData>(defaultForm);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (profile?.role === 'user_unit' && profile.unit_kerja_id) setFilterUnit(profile.unit_kerja_id);
    }, [profile]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            let q = supabase.from('manajemen_strategi').select('*, unit_kerja(nama_unit)').order('created_at', { ascending: false });
            if (year) q = q.eq('tahun', Number(year));
            const unitToFilter = profile?.role === 'user_unit' ? profile.unit_kerja_id : (filterUnit === 'all' ? null : filterUnit);
            if (unitToFilter) q = q.eq('unit_kerja_id', unitToFilter);
            const { data: rows, error } = await q;
            if (error) { setData([]); } else { setData((rows as ManajemenStrategi[]) ?? []); }
        } catch { setData([]); }
        finally { setLoading(false); }
    }, [year, filterUnit, profile]);

    useEffect(() => {
        fetchData();
        supabase.from('unit_kerja').select('*').then(({ data: u }: { data: any }) => setUnits(u ?? []));
    }, [fetchData]);

    useEffect(() => {
        if (!form.unit_kerja_id || !form.tahun) { setCascadingData([]); return; }
        supabase.from('cascading_kpi').select('id, kpi, sasaran_strategis, target')
            .eq('unit_kerja_id', form.unit_kerja_id).eq('tahun', form.tahun)
            .then(({ data: cData }: { data: any }) => setCascadingData(cData ?? []));
    }, [form.unit_kerja_id, form.tahun]);

    const handleSelectKpi = (selectedKpiName: string) => {
        const found = cascadingData.find((c: any) => c.kpi === selectedKpiName);
        if (found) setForm(f => ({ ...f, kpi: found.kpi, sasaran_strategis: found.sasaran_strategis || '', target: found.target || '' }));
        else setForm(f => ({ ...f, kpi: selectedKpiName }));
    };

    const handleChangePeriode = (tipe: string) => {
        const labels = PERIODE_LABELS[tipe] || ['Tahunan'];
        setForm(f => ({ ...f, periode_tipe: tipe, periode_inputs: Array(labels.length).fill('') }));
    };

    const handlePeriodeInput = (i: number, val: string) => {
        setForm(f => { const n = [...f.periode_inputs]; n[i] = val; return { ...f, periode_inputs: n }; });
    };

    const filtered = data.filter(d =>
        d.sasaran_strategis?.toLowerCase().includes(search.toLowerCase()) ||
        d.kpi?.toLowerCase().includes(search.toLowerCase())
    );

    const achieved = data.filter(d => {
        const t = parseFloat(d.target), displayVal = getDisplayRealisasi(d.realisasi), r = parseFloat(displayVal);
        return !isNaN(t) && !isNaN(r) && r >= t;
    }).length;

    // Top KPIs for speedometer gauges
    const gaugeData = data.slice(0, 6).map(d => {
        const displayVal = getDisplayRealisasi(d.realisasi);
        return { kpi: d.kpi, value: parseFloat(displayVal) || 0, target: parseFloat(d.target) || 100, satuan: '%' };
    });

    const openAdd = () => {
        setEditId(null);
        const newForm = { ...defaultForm };
        if (profile?.role === 'user_unit' && profile.unit_kerja_id) newForm.unit_kerja_id = profile.unit_kerja_id;
        setForm(newForm); setShowModal(true);
    };

    const openEdit = (row: ManajemenStrategi) => {
        setEditId(row.id);
        const d = deserializeRealisasi(row.realisasi);
        setForm({
            tahun: row.tahun, unit_kerja_id: row.unit_kerja_id,
            sasaran_strategis: row.sasaran_strategis, kpi: row.kpi, target: row.target,
            realisasi: row.realisasi,
            periode_tipe: d.tipe, periode_inputs: d.inputs,
        });
        setShowModal(true);
    };

    const handleDelete = async (row: ManajemenStrategi) => {
        if (!confirm(`Hapus monitoring "${row.kpi.slice(0, 50)}"?`)) return;
        await supabase.from('manajemen_strategi').delete().eq('id', row.id);
        fetchData();
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault(); setSaving(true);
        try {
            const serializedRealisasi = serializeRealisasi(form.periode_tipe, form.periode_inputs);
            const payload = {
                tahun: form.tahun, unit_kerja_id: form.unit_kerja_id,
                sasaran_strategis: form.sasaran_strategis, kpi: form.kpi, target: form.target,
                realisasi: serializedRealisasi,
            };
            let result;
            if (editId) { result = await supabase.from('manajemen_strategi').update(payload).eq('id', editId); }
            else { result = await supabase.from('manajemen_strategi').insert(payload); }
            if (result.error) { alert('Gagal menyimpan data: ' + result.error.message); }
            else { setShowModal(false); fetchData(); }
        } catch { alert('Terjadi kesalahan saat menyimpan data'); }
        finally { setSaving(false); }
    };

    const columns: Column<ManajemenStrategi>[] = [
        { key: 'tahun', label: 'Tahun', className: 'w-20' },
        { key: 'unit_kerja_id', label: 'Unit Kerja', render: r => r.unit_kerja?.nama_unit ?? '-' },
        { key: 'sasaran_strategis', label: 'Sasaran Strategis', render: r => <span className="line-clamp-2">{r.sasaran_strategis}</span> },
        { key: 'kpi', label: 'KPI / Indikator' },
        { key: 'target', label: 'Target' },
        { key: 'realisasi', label: 'Realisasi', render: r => <AchievementBadge target={r.target} realisasi={r.realisasi} /> },
    ];

    const periodeLabels = PERIODE_LABELS[form.periode_tipe] || ['Tahunan'];

    return (
        <div>
            <PageHeader title="Monitoring KPI" subtitle="Pantau realisasi sasaran strategis dan KPI unit kerja per tahun anggaran." />

            {/* Speedometer Gauges */}
            {gaugeData.length > 0 && (
                <div className="mb-8">
                    <h3 className="text-sm font-bold text-slate-600 mb-3 flex items-center gap-2">
                        <TrendingUp size={16} className="text-[#137fec]" /> Dashboard KPI Utama
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                        {gaugeData.map((g, i) => (
                            <SpeedometerGauge key={i} value={g.value} target={g.target} kpiName={g.kpi} satuan={g.satuan} />
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
                <ScoreCard icon={<Target size={22} className="text-[#137fec]" />} title="Total Data Monitoring" value={data.length} colorClass="bg-blue-50 border-blue-100" />
                <ScoreCard icon={<CheckCircle2 size={22} className="text-emerald-500" />} title="KPI Tercapai" value={achieved} colorClass="bg-emerald-50 border-emerald-100" />
                <ScoreCard icon={<Clock size={22} className="text-amber-500" />} title="Belum Tercapai" value={data.length - achieved} colorClass="bg-amber-50 border-amber-100" />
                <ScoreCard icon={<TrendingUp size={22} className="text-violet-500" />} title="Tingkat Capaian" value={data.length ? `${Math.round(achieved * 100 / data.length)}%` : '0%'} colorClass="bg-violet-50 border-violet-100" />
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <TopActionBar
                    filters={
                        <div className="flex flex-wrap items-center gap-3">
                            <FilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Cari sasaran / KPI..." yearValue={year} onYearChange={setYear} />
                            {profile?.role === 'user_unit' ? (
                                <div className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold border border-slate-200">
                                    {units.find(u => u.id === filterUnit)?.nama_unit || 'Unit Anda'}
                                </div>
                            ) : (
                                <select className="form-input text-xs py-2 w-48" value={filterUnit} onChange={e => setFilterUnit(e.target.value)}>
                                    <option value="all">Semua Unit Kerja</option>
                                    {units.map(u => <option key={u.id} value={u.id}>{u.nama_unit}</option>)}
                                </select>
                            )}
                        </div>
                    }
                    actions={<>
                        <button className="btn-secondary"><Download size={15} /><span className="hidden sm:inline">Template</span></button>
                        <button className="btn-secondary"><Upload size={15} /><span className="hidden sm:inline">Import</span></button>
                        <button className="btn-secondary"><FileText size={15} /><span className="hidden sm:inline">Laporan</span></button>
                        <button className="btn-primary" onClick={openAdd}><Plus size={15} /><span>Input Realisasi</span></button>
                    </>}
                />
                <DataTable columns={columns} data={filtered} onEdit={openEdit} onDelete={handleDelete} onView={openEdit} isLoading={loading} />
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <h3 className="text-base font-bold text-slate-800">{editId ? 'Edit' : 'Tambah'} Capaian KPI</h3>
                            <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="form-label">Tahun</label>
                                    <input type="number" className="form-input" value={form.tahun} onChange={e => setForm(f => ({ ...f, tahun: Number(e.target.value) }))} required />
                                </div>
                                <div>
                                    <label className="form-label">Unit Kerja</label>
                                    {profile?.role === 'user_unit' ? (
                                        <div className="form-input bg-slate-100 text-slate-600 cursor-not-allowed">
                                            {units.find(u => u.id === form.unit_kerja_id)?.nama_unit || 'Unit Kerja Anda'}
                                        </div>
                                    ) : (
                                        <select className="form-input" value={form.unit_kerja_id} onChange={e => setForm(f => ({ ...f, unit_kerja_id: e.target.value }))} required>
                                            <option value="">-- Pilih Unit --</option>
                                            {units.map(u => <option key={u.id} value={u.id}>{u.nama_unit}</option>)}
                                        </select>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="form-label">KPI / Indikator Kinerja</label>
                                <select className="form-input" value={form.kpi} onChange={e => handleSelectKpi(e.target.value)} required disabled={!form.unit_kerja_id || !form.tahun}>
                                    <option value="">-- Pilih KPI yang tersedia --</option>
                                    {cascadingData.map((c: any) => <option key={c.id} value={c.kpi}>{c.kpi}</option>)}
                                </select>
                                {!form.unit_kerja_id && <p className="text-xs text-rose-500 mt-1">Pilih Unit Kerja terlebih dahulu agar KPI muncul.</p>}
                            </div>

                            {form.kpi && (
                                <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-3">
                                    <div>
                                        <label className="text-xs font-semibold text-slate-500 block mb-1">Sasaran Strategis</label>
                                        <div className="text-sm font-medium text-slate-800 bg-white p-2 border border-slate-200 rounded-md">{form.sasaran_strategis || '-'}</div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-slate-500 block mb-1">Target Berdasarkan Cascading</label>
                                        <div className="text-sm font-medium text-slate-800 bg-white p-2 border border-slate-200 rounded-md">{form.target || '-'}</div>
                                    </div>
                                </div>
                            )}

                            {/* Tipe Periode */}
                            <div>
                                <label className="form-label">Tipe Periode Realisasi</label>
                                <select className="form-input" value={form.periode_tipe} onChange={e => handleChangePeriode(e.target.value)}>
                                    <option value="tahunan">Tahunan</option>
                                    <option value="semesteran">Semesteran</option>
                                    <option value="triwulanan">Triwulanan</option>
                                    <option value="bulanan">Bulanan</option>
                                </select>
                            </div>

                            {/* Periode Inputs */}
                            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                                <p className="text-xs font-bold text-slate-500 mb-3">Input Realisasi ({form.periode_tipe === 'tahunan' ? 'Tahunan' : form.periode_tipe === 'bulanan' ? '12 Bulan' : form.periode_tipe === 'triwulanan' ? '4 Triwulan' : '2 Semester'})</p>
                                <div className={`grid gap-3 ${form.periode_tipe === 'bulanan' ? 'grid-cols-2 md:grid-cols-3' : form.periode_tipe === 'triwulanan' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                    {periodeLabels.map((label, i) => (
                                        <div key={label}>
                                            <label className="text-[11px] text-slate-500 font-semibold block mb-1">{label}</label>
                                            <input
                                                type="text"
                                                className="form-input text-sm"
                                                placeholder="Nilai"
                                                value={form.periode_inputs[i] || ''}
                                                onChange={e => handlePeriodeInput(i, e.target.value)}
                                            />
                                        </div>
                                    ))}
                                </div>
                                {/* Average display */}
                                {form.periode_inputs.some(v => v.trim()) && (
                                    <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-500">Rata-rata Realisasi:</span>
                                        <span className="text-sm font-extrabold text-[#137fec]">
                                            {(() => {
                                                const nums = form.periode_inputs.map(v => parseFloat(v)).filter(n => !isNaN(n));
                                                if (nums.length === 0) return '0';
                                                return (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2);
                                            })()}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Batal</button>
                                <button type="submit" className="btn-primary" disabled={saving}>
                                    {saving ? <><Loader2 size={15} className="animate-spin" /><span>Menyimpan...</span></> : <><Save size={15} /><span>Simpan Realisasi</span></>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
