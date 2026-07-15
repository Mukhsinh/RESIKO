'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader, ScoreCard, FilterBar, TopActionBar } from '@/components/SharedUI';
import DataTable, { type Column } from '@/components/DataTable';
import FormInputAI from '@/components/FormInputAI';
import { Plus, Download, Upload, FileText, Target, TrendingUp, AlertCircle, CheckCircle2, Save, X, Loader2, Trash2 } from 'lucide-react';
import { useUserProfile } from '@/hooks/useUserProfile';

const CURRENT_YEAR = new Date().getFullYear();

// Helper to reliably parse numeric inputs even if users enter symbols/letters like %, currency symbols, etc.
const parseNumericValue = (val: string | number | null | undefined): number | null => {
    if (val === null || val === undefined) return null;
    const str = String(val).trim();
    if (!str) return null;
    const cleaned = str.replace(/[^\d.,-]/g, '').replace(/,/g, '.');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
};

interface IKT {
    id: string;
    rencana_strategis_id?: string;
    rkt_id?: string;
    sasaran_strategi_id?: string;
    sasaran_strategis?: string;
    indikator: string;
    baseline_tahun?: number;
    baseline_nilai?: number;
    target_tahun?: number;
    target_nilai?: number;
    satuan?: string;
    initiatif_strategi?: string;
    pic?: string;
    created_at: string;
    unit_kerja_id?: string;
    unit_kerja?: { nama_unit: string };
    rkt?: { program: string; kegiatan: string };
}

interface FormTarget {
    target_tahun: number;
    target_nilai: string;
}

interface FormIndikator {
    id: string; // UI key
    indikator: string;
    baseline_tahun: number;
    baseline_nilai: string;
    satuan: string;
    pic: string;
    initiatif_strategi: string;
    targets: FormTarget[];
}

interface Form {
    rkt_id: string;
    sasaran_strategis: string;
    unit_kerja_id: string;
    indikators: FormIndikator[];
}

const defaultForm: Form = {
    rkt_id: '',
    sasaran_strategis: '',
    unit_kerja_id: '',
    indikators: [{
        id: 'init',
        indikator: '',
        baseline_tahun: CURRENT_YEAR - 1,
        baseline_nilai: '',
        satuan: '',
        pic: '',
        initiatif_strategi: '',
        targets: [{ target_tahun: CURRENT_YEAR, target_nilai: '' }]
    }]
};

export default function IKTPage() {
    const { profile } = useUserProfile();
    const [data, setData] = useState<IKT[]>([]);
    const [rktList, setRktList] = useState<{ id: string; program: string; kegiatan: string; rencana_strategis_id?: string; }[]>([]);
    const [units, setUnits] = useState<{ id: string; nama_unit: string }[]>([]);
    const [filterUnit, setFilterUnit] = useState<string>('all');
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [year, setYear] = useState(String(CURRENT_YEAR));
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [selectedRow, setSelectedRow] = useState<IKT | null>(null);
    const [form, setForm] = useState<Form>(defaultForm);
    const [saving, setSaving] = useState(false);
    const [hasUnitKerjaId, setHasUnitKerjaId] = useState<boolean | null>(null);

    // Sync unit filter for managers
    useEffect(() => {
        if (profile?.role === 'user_unit' && profile.unit_kerja_id) {
            setFilterUnit(profile.unit_kerja_id);
        }
    }, [profile]);

    // Probe if unit_kerja_id exists in indikator_kinerja_utama
    useEffect(() => {
        supabase.from('indikator_kinerja_utama').select('unit_kerja_id').limit(1)
            .then(({ error }: { error: any }) => {
                const exists = !error || (error.code !== '42703' && error.code !== 'PGRST100' && error.code !== '42883');
                setHasUnitKerjaId(exists);
            });
    }, []);

    // Fetch units list
    useEffect(() => {
        supabase.from('unit_kerja').select('id, nama_unit').order('nama_unit').then(({ data: u }: { data: any }) => {
            if (u) setUnits(u);
        });
    }, []);

    const fetchData = useCallback(async () => {
        if (hasUnitKerjaId === null) return;
        setLoading(true);
        try {
            const selectFields = hasUnitKerjaId
                ? '*, unit_kerja(nama_unit), sasaran_strategi(sasaran)'
                : '*, sasaran_strategi(sasaran)';
            let query = supabase.from('indikator_kinerja_utama').select(selectFields).order('created_at', { ascending: false });
            if (year) query = query.eq('target_tahun', Number(year));
            if (hasUnitKerjaId) {
                const unitToFilter = profile?.role === 'user_unit' ? profile.unit_kerja_id : (filterUnit === 'all' ? null : filterUnit);
                if (unitToFilter) {
                    query = query.eq('unit_kerja_id', unitToFilter);
                }
            }
            const { data: rows, error } = await query;
            if (error) {
                console.error('Error fetching IKT:', error);
                setData([]);
            } else {
                setData((rows as IKT[]) ?? []);
            }
        } catch (err) {
            console.error('Error:', err);
            setData([]);
        } finally {
            setLoading(false);
        }
    }, [year, filterUnit, profile, hasUnitKerjaId]);

    useEffect(() => {
        if (hasUnitKerjaId === null) return;
        fetchData();
    }, [fetchData, hasUnitKerjaId]);

    // React to unit changes in Add mode
    useEffect(() => {
        if (!form.unit_kerja_id) { setRktList([]); return; }
        supabase.from('rkt').select('id, program, kegiatan, rencana_strategis_id').eq('unit_kerja_id', form.unit_kerja_id).then(({ data: r }: { data: any }) => {
            if (r) setRktList(r as any);
        });
    }, [form.unit_kerja_id]);

    const filtered = data.filter(d =>
        (d.indikator || '').toLowerCase().includes(search.toLowerCase()) ||
        (d.satuan || '').toLowerCase().includes(search.toLowerCase()) ||
        (d.pic || '').toLowerCase().includes(search.toLowerCase())
    );

    const openAdd = () => {
        setEditId(null);
        setSelectedRow(null);
        const newForm = { ...defaultForm };
        if (profile?.role === 'user_unit' && profile.unit_kerja_id) {
            newForm.unit_kerja_id = profile.unit_kerja_id;
        }
        setForm(newForm);
        setShowModal(true);
    };

    const openEdit = async (row: IKT) => {
        setEditId(row.id);
        setSelectedRow(row);

        let matchingRktId = '';
        if (row.unit_kerja_id) {
            const { data: rkts } = await supabase
                .from('rkt')
                .select('id, program, kegiatan, rencana_strategis_id')
                .eq('unit_kerja_id', row.unit_kerja_id);

            if (rkts) {
                setRktList(rkts);
                const match = rkts.find((r: any) => r.rencana_strategis_id === row.rencana_strategis_id);
                if (match) matchingRktId = match.id;
            }
        }

        // Search and load all sibling target years for this indicator & unit kerja
        let targets = [{ target_tahun: row.target_tahun || CURRENT_YEAR, target_nilai: String(row.target_nilai ?? '') }];

        try {
            const { data: siblings } = await supabase
                .from('indikator_kinerja_utama')
                .select('id, target_tahun, target_nilai')
                .eq('indikator', row.indikator)
                .eq('unit_kerja_id', row.unit_kerja_id)
                .order('target_tahun', { ascending: true });

            if (siblings && siblings.length > 0) {
                targets = siblings.map((s: any) => ({
                    target_tahun: s.target_tahun,
                    target_nilai: String(s.target_nilai ?? '')
                }));
            }
        } catch (err) {
            console.error('Error fetching sibling targets for Edit:', err);
        }

        setForm({
            rkt_id: matchingRktId,
            sasaran_strategis: (row as any).sasaran_strategi?.sasaran || '',
            unit_kerja_id: row.unit_kerja_id || '',
            indikators: [{
                id: row.id,
                indikator: row.indikator,
                baseline_tahun: row.baseline_tahun || CURRENT_YEAR - 1,
                baseline_nilai: String(row.baseline_nilai ?? ''),
                satuan: row.satuan || '',
                pic: row.pic || '',
                initiatif_strategi: row.initiatif_strategi || '',
                targets: targets
            }]
        });
        setShowModal(true);
    };

    const handleDelete = async (row: IKT) => {
        if (!confirm(`Hapus indikator "${row.indikator.slice(0, 50)}"?`)) return;
        await supabase.from('indikator_kinerja_utama').delete().eq('id', row.id);
        fetchData();
    };

    const cleanPayload = async (arr: any[]) => {
        const { data: tb } = await supabase.from('indikator_kinerja_utama').select('*').limit(1);
        if (!tb) return arr;
        const validKeys = tb.length > 0 ? Object.keys(tb[0]) : ['rencana_strategis_id', 'sasaran_strategi_id', 'indikator', 'baseline_tahun', 'baseline_nilai', 'target_tahun', 'target_nilai', 'satuan', 'pic', 'initiatif_strategi', 'unit_kerja_id'];

        return arr.map(obj => {
            const cleaned: any = {};
            for (let k of Object.keys(obj)) {
                if (validKeys.includes(k)) cleaned[k] = obj[k];
            }
            return cleaned;
        });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            // Resolve RKT and its parent rencana_strategis_id
            let selectedRkt = rktList.find((r: any) => r.id === form.rkt_id);
            let targetRenstraId = selectedRkt?.rencana_strategis_id || null;

            // Resolve or insert Sasaran Strategi manually
            let resolvedSasaranId = null;
            if (form.sasaran_strategis && form.sasaran_strategis.trim()) {
                const cleanSasaran = form.sasaran_strategis.trim();

                // Search for existing sasaran_strategi matching cleanSasaran & renstra_id
                const { data: existingSas } = await supabase
                    .from('sasaran_strategi')
                    .select('id')
                    .eq('sasaran', cleanSasaran)
                    .eq('rencana_strategis_id', targetRenstraId)
                    .limit(1);

                if (existingSas && existingSas.length > 0) {
                    resolvedSasaranId = existingSas[0].id;
                } else if (targetRenstraId) {
                    // Insert new sasaran since it doesn't exist
                    const { data: newSas, error: insertErr } = await supabase
                        .from('sasaran_strategi')
                        .insert({
                            sasaran: cleanSasaran,
                            rencana_strategis_id: targetRenstraId,
                            kode: 'SAS-AUTO-' + Math.floor(Math.random() * 1000)
                        })
                        .select('id')
                        .single();

                    if (insertErr) {
                        console.error('Error inserting sasaran_strategi:', insertErr);
                    } else if (newSas) {
                        resolvedSasaranId = newSas.id;
                    }
                }
            }

            const createPayloads = (resolvedSasId: string | null, targetRenId: string | null) => {
                const results: any[] = [];
                for (const ind of form.indikators) {
                    for (const tgt of ind.targets) {
                        const p: any = {
                            rencana_strategis_id: targetRenId,
                            sasaran_strategi_id: resolvedSasId,
                            indikator: ind.indikator,
                            baseline_tahun: ind.baseline_tahun,
                            baseline_nilai: parseNumericValue(ind.baseline_nilai),
                            target_tahun: tgt.target_tahun,
                            target_nilai: parseNumericValue(tgt.target_nilai),
                            satuan: ind.satuan,
                            pic: ind.pic,
                            initiatif_strategi: ind.initiatif_strategi
                        };
                        if (hasUnitKerjaId) p.unit_kerja_id = form.unit_kerja_id || null;
                        results.push(p);
                    }
                }
                return results;
            };

            const payloads = createPayloads(resolvedSasaranId, targetRenstraId);
            const finalPayloads = await cleanPayload(payloads);

            let result;
            if (editId && selectedRow) {
                // Query existing sibling rows for this indicator and unit_kerja_id BEFORE the update
                const { data: siblings } = await supabase
                    .from('indikator_kinerja_utama')
                    .select('id, target_tahun')
                    .eq('indikator', selectedRow.indikator)
                    .eq('unit_kerja_id', selectedRow.unit_kerja_id);

                // We will match targets in finalPayloads to siblings
                for (const p of finalPayloads) {
                    const existing = siblings?.find((s: any) => s.target_tahun === p.target_tahun);
                    if (existing) {
                        // Update existing row
                        const { error: updErr } = await supabase
                            .from('indikator_kinerja_utama')
                            .update(p)
                            .eq('id', existing.id);
                        if (updErr) console.error('Error updating target:', updErr);
                    } else {
                        // Insert new row if target_tahun didn't exist before
                        const { error: insErr } = await supabase
                            .from('indikator_kinerja_utama')
                            .insert(p);
                        if (insErr) console.error('Error inserting new target year/row:', insErr);
                    }
                }

                // Delete sibling rows that are no longer in this edit session's targets
                const payloadYears = finalPayloads.map(p => p.target_tahun);
                const toDelete = siblings?.filter((s: any) => !payloadYears.includes(s.target_tahun)) || [];
                for (const d of toDelete) {
                    const { error: delErr } = await supabase
                        .from('indikator_kinerja_utama')
                        .delete()
                        .eq('id', d.id);
                    if (delErr) console.error('Error deleting removed target year:', delErr);
                }

                result = { error: null }; // Mock success
            } else {
                result = await supabase.from('indikator_kinerja_utama').insert(finalPayloads);
            }

            if (result.error) {
                console.error('Error saving IKT:', result.error);
                alert('Gagal menyimpan data: ' + result.error.message);
            } else {
                setShowModal(false);
                fetchData();
            }
        } catch (err) {
            console.error('Error:', err);
            alert('Terjadi kesalahan saat menyimpan data');
        } finally {
            setSaving(false);
        }
    };

    const columns: Column<IKT>[] = [
        { key: 'target_tahun', label: 'Tahun', className: 'w-16 text-center' },
        { key: 'unit_kerja_id', label: 'Unit', render: r => r.unit_kerja?.nama_unit ?? '-' },
        { key: 'indikator', label: 'Indikator Kinerja', render: r => <span className="line-clamp-2">{r.indikator}</span> },
        { key: 'baseline_nilai', label: 'Baseline', className: 'text-center', render: r => r.baseline_nilai != null ? `${r.baseline_nilai} ${r.satuan ?? ''}`.trim() : '-' },
        { key: 'target_nilai', label: 'Target', className: 'text-center', render: r => r.target_nilai != null ? `${r.target_nilai} ${r.satuan ?? ''}`.trim() : '-' },
        { key: 'satuan', label: 'Satuan', className: 'text-center' },
        { key: 'pic', label: 'PIC', className: 'text-center' },
    ];

    return (
        <div>
            <PageHeader
                title="Indikator Kinerja Tahunan (IKT)"
                subtitle="Indikator kinerja utama untuk mengukur pencapaian target tahunan unit kerja."
            />

            <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
                <ScoreCard
                    icon={<Target size={22} className="text-[#137fec]" />}
                    title="Total Indikator"
                    value={data.length}
                    colorClass="bg-blue-50 border-blue-100"
                />
                <ScoreCard
                    icon={<CheckCircle2 size={22} className="text-emerald-500" />}
                    title="Dengan Target"
                    value={data.filter(d => d.target_nilai != null).length}
                    colorClass="bg-emerald-50 border-emerald-100"
                />
                <ScoreCard
                    icon={<AlertCircle size={22} className="text-amber-500" />}
                    title="Dengan Baseline"
                    value={data.filter(d => d.baseline_nilai != null).length}
                    colorClass="bg-amber-50 border-amber-100"
                />
                <ScoreCard
                    icon={<TrendingUp size={22} className="text-emerald-500" />}
                    title="Tahun Target"
                    value={year || 'Semua'}
                    colorClass="bg-emerald-50 border-emerald-100"
                />
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <TopActionBar
                    filters={
                        <div className="flex flex-wrap items-center gap-3">
                            <FilterBar
                                searchValue={search}
                                onSearchChange={setSearch}
                                searchPlaceholder="Cari indikator..."
                                yearValue={year}
                                onYearChange={setYear}
                            />
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
                        <button className="btn-secondary">
                            <Download size={15} />
                            <span className="hidden sm:inline">Template</span>
                        </button>
                        <button className="btn-secondary">
                            <Upload size={15} />
                            <span className="hidden sm:inline">Import</span>
                        </button>
                        <button className="btn-secondary">
                            <FileText size={15} />
                            <span className="hidden sm:inline">Export</span>
                        </button>
                        <button className="btn-primary" onClick={openAdd}>
                            <Plus size={15} />
                            <span>Tambah</span>
                        </button>
                    </>}
                />
                <DataTable
                    columns={columns}
                    data={filtered}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                    onView={openEdit}
                    isLoading={loading}
                />
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 sticky top-0 z-10">
                            <h3 className="text-base font-bold text-slate-800">
                                {editId ? 'Edit' : 'Tambah'} Indikator Kinerja
                            </h3>
                            <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-slate-200 rounded-lg">
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-5">
                            <div className="space-y-4 pb-4 border-b border-slate-100">
                                <div>
                                    <label className="form-label flex gap-1">Unit Kerja <span className="text-red-500">*</span></label>
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
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="form-label">Program/Kegiatan RKT</label>
                                        <select
                                            className="form-input"
                                            value={form.rkt_id}
                                            onChange={e => setForm(f => ({ ...f, rkt_id: e.target.value }))}
                                            required
                                            disabled={!form.unit_kerja_id}
                                        >
                                            <option value="">-- Pilih Program/Kegiatan --</option>
                                            {rktList.map(r => <option key={r.id} value={r.id}>{r.program?.slice(0, 40) || '-'} / {r.kegiatan?.slice(0, 40) || '-'}</option>)}
                                        </select>
                                        {rktList.length === 0 && form.unit_kerja_id && <p className="text-xs text-amber-500 mt-1">Gagal memuat atau tidak ada RKT untuk unit ini.</p>}
                                    </div>
                                    <div>
                                        <label className="form-label">Sasaran Strategi (Opsional)</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={form.sasaran_strategis}
                                            onChange={e => setForm(f => ({ ...f, sasaran_strategis: e.target.value }))}
                                            placeholder="Ketik manual sasaran..."
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Indikator List */}
                            <div className="space-y-6">
                                {form.indikators.map((ind, indIdx) => (
                                    <div key={ind.id} className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-4 relative">
                                        {!editId && form.indikators.length > 1 && (
                                            <button type="button" onClick={() => setForm(f => ({ ...f, indikators: f.indikators.filter((_, i) => i !== indIdx) }))} className="absolute top-3 right-3 text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors group" title="Hapus Indikator">
                                                <Trash2 size={16} />
                                            </button>
                                        )}

                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">{indIdx + 1}</div>
                                            <h4 className="font-semibold text-slate-800 text-sm">Indikator Kinerja</h4>
                                        </div>

                                        <FormInputAI
                                            label="Nama Indikator"
                                            placeholder="Masukkan nama indikator kinerja..."
                                            value={ind.indikator}
                                            onChange={v => {
                                                const newInds = [...form.indikators];
                                                newInds[indIdx].indikator = v;
                                                setForm(f => ({ ...f, indikators: newInds }));
                                            }}
                                        />
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="form-label">Tahun Baseline</label>
                                                <input
                                                    type="number"
                                                    className="form-input"
                                                    value={ind.baseline_tahun}
                                                    onChange={e => {
                                                        const newInds = [...form.indikators];
                                                        newInds[indIdx].baseline_tahun = Number(e.target.value);
                                                        setForm(f => ({ ...f, indikators: newInds }));
                                                    }}
                                                />
                                            </div>
                                            <div>
                                                <label className="form-label">Nilai Baseline</label>
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    value={ind.baseline_nilai}
                                                    onChange={e => {
                                                        const newInds = [...form.indikators];
                                                        newInds[indIdx].baseline_nilai = e.target.value;
                                                        setForm(f => ({ ...f, indikators: newInds }));
                                                    }}
                                                    placeholder="Contoh: 75"
                                                />
                                            </div>
                                        </div>

                                        {/* Dynamic Targets */}
                                        <div className="space-y-3 bg-white p-4 rounded-lg border border-slate-100 shadow-sm">
                                            <div className="flex items-center justify-between">
                                                <label className="form-label !mb-0 font-bold text-slate-700 flex items-center gap-2"><Target size={14} /> Target Capaian</label>
                                                {ind.targets.length < 5 && (
                                                    <button type="button" onClick={() => {
                                                        const newInds = [...form.indikators];
                                                        const nextYear = newInds[indIdx].targets.length > 0
                                                            ? Number(newInds[indIdx].targets[newInds[indIdx].targets.length - 1].target_tahun) + 1
                                                            : CURRENT_YEAR;
                                                        newInds[indIdx].targets.push({ target_tahun: nextYear, target_nilai: '' });
                                                        setForm(f => ({ ...f, indikators: newInds }));
                                                    }} className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-md transition-colors">
                                                        <Plus size={12} /> Tambah Tahun Target
                                                    </button>
                                                )}
                                            </div>

                                            <div className="flex flex-col gap-2">
                                                {ind.targets.map((tgt, tgtIdx) => (
                                                    <div key={tgtIdx} className="flex items-center gap-3 w-full bg-slate-50 p-2 rounded-md border border-slate-100">
                                                        <div className="w-24 shrink-0">
                                                            <input
                                                                type="number"
                                                                className="form-input text-sm !py-1.5"
                                                                value={tgt.target_tahun}
                                                                onChange={e => {
                                                                    const newInds = [...form.indikators];
                                                                    newInds[indIdx].targets[tgtIdx].target_tahun = Number(e.target.value);
                                                                    setForm(f => ({ ...f, indikators: newInds }));
                                                                }}
                                                                placeholder="Tahun"
                                                            />
                                                        </div>
                                                        <div className="flex-1">
                                                            <input
                                                                type="text"
                                                                className="form-input text-sm !py-1.5"
                                                                value={tgt.target_nilai}
                                                                onChange={e => {
                                                                    const newInds = [...form.indikators];
                                                                    newInds[indIdx].targets[tgtIdx].target_nilai = e.target.value;
                                                                    setForm(f => ({ ...f, indikators: newInds }));
                                                                }}
                                                                placeholder="Nilai Target (Contoh: 100)"
                                                            />
                                                        </div>
                                                        {ind.targets.length > 1 && (
                                                            <button type="button" onClick={() => {
                                                                const newInds = [...form.indikators];
                                                                newInds[indIdx].targets = newInds[indIdx].targets.filter((_, i) => i !== tgtIdx);
                                                                setForm(f => ({ ...f, indikators: newInds }));
                                                            }} className="shrink-0 text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-md transition-colors">
                                                                <X size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                            {editId && <p className="text-[10px] text-amber-600 mt-1 italic">* Dalam mode Edit, Anda dapat mengelola seluruh target tahunan untuk indikator ini.</p>}
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="form-label">Satuan</label>
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    value={ind.satuan}
                                                    onChange={e => {
                                                        const newInds = [...form.indikators];
                                                        newInds[indIdx].satuan = e.target.value;
                                                        setForm(f => ({ ...f, indikators: newInds }));
                                                    }}
                                                    placeholder="Contoh: Persen, Orang"
                                                />
                                            </div>
                                            <div>
                                                <label className="form-label">PIC (Penanggung Jawab)</label>
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    value={ind.pic}
                                                    onChange={e => {
                                                        const newInds = [...form.indikators];
                                                        newInds[indIdx].pic = e.target.value;
                                                        setForm(f => ({ ...f, indikators: newInds }));
                                                    }}
                                                    placeholder="Masukkan PIC..."
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="form-label">Inisiatif Strategi</label>
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={ind.initiatif_strategi}
                                                onChange={e => {
                                                    const newInds = [...form.indikators];
                                                    newInds[indIdx].initiatif_strategi = e.target.value;
                                                    setForm(f => ({ ...f, indikators: newInds }));
                                                }}
                                                placeholder="Contoh: Rencana aksi taktis..."
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Batal</button>
                                <button type="submit" className="btn-primary" disabled={saving}>
                                    {saving ? <><Loader2 size={15} className="animate-spin" /><span>Menyimpan...</span></> : <><Save size={15} /><span>Simpan</span></>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
