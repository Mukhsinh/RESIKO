'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader, ScoreCard, FilterBar, TopActionBar } from '@/components/SharedUI';
import DataTable, { type Column } from '@/components/DataTable';
import FormInputAI from '@/components/FormInputAI';
import { Download, Upload, FileText, Target, Activity, AlertCircle, CheckCircle2, Save, X, Loader2, BarChart2, Plus, Link2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useUserProfile } from '@/hooks/useUserProfile';

const CURRENT_YEAR = new Date().getFullYear();

interface IKTEvaluasi {
    id: string;
    rencana_strategis_id?: string;
    indikator: string;
    target_tahun?: number;
    target_nilai?: number | null;
    satuan?: string;
    pic?: string;
    realisasi_nilai?: number | null;
    kendala?: string | null;
    tindak_lanjut?: string | null;
    unit_kerja_id?: string;
    unit_kerja?: { nama_unit: string };
}

// Form untuk Edit Realisasi (existing record)
interface EditForm {
    realisasi_nilai: string;
    kendala: string;
    tindak_lanjut: string;
}

// Form untuk Tambah Evaluasi (bisa pilih IKT existing atau baru)
interface EvalForm {
    // Pilih dari IKT existing
    selectedIKTId: string;
    // Data IKT (auto-fill dari pilihan, atau input manual)
    indikator: string;
    target_tahun: number;
    target_nilai: string;
    satuan: string;
    pic: string;
    // Data realisasi
    realisasi_nilai: string;
    kendala: string;
    tindak_lanjut: string;
}

const defaultEditForm: EditForm = { realisasi_nilai: '', kendala: '', tindak_lanjut: '' };

const defaultEvalForm: EvalForm = {
    selectedIKTId: '',
    indikator: '',
    target_tahun: CURRENT_YEAR,
    target_nilai: '',
    satuan: '',
    pic: '',
    realisasi_nilai: '',
    kendala: '',
    tindak_lanjut: '',
};

export default function EvaluasiIKTPage() {
    const { profile } = useUserProfile();
    const [data, setData] = useState<IKTEvaluasi[]>([]);
    const [allIKT, setAllIKT] = useState<IKTEvaluasi[]>([]); // semua IKT untuk dropdown
    const [units, setUnits] = useState<{ id: string; nama_unit: string }[]>([]);
    const [filterUnit, setFilterUnit] = useState<string>('all');
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [year, setYear] = useState(String(CURRENT_YEAR));

    // Modal edit realisasi
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<IKTEvaluasi | null>(null);
    const [editForm, setEditForm] = useState<EditForm>(defaultEditForm);

    // Modal tambah evaluasi
    const [showAddModal, setShowAddModal] = useState(false);
    const [evalForm, setEvalForm] = useState<EvalForm>(defaultEvalForm);

    const [saving, setSaving] = useState(false);

    // Sync unit filter for managers
    useEffect(() => {
        if (profile?.role === 'user_unit' && profile.unit_kerja_id) {
            setFilterUnit(profile.unit_kerja_id);
        }
    }, [profile]);

    // Fetch units list
    useEffect(() => {
        supabase.from('unit_kerja').select('id, nama_unit').order('nama_unit').then(({ data: u }) => {
            if (u) setUnits(u);
        });
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            let query = supabase.from('indikator_kinerja_utama').select('*, unit_kerja(nama_unit)').order('created_at', { ascending: false });
            if (year) query = query.eq('target_tahun', Number(year));
            const unitToFilter = profile?.role === 'user_unit' ? profile.unit_kerja_id : (filterUnit === 'all' ? null : filterUnit);
            if (unitToFilter) {
                query = query.eq('unit_kerja_id', unitToFilter);
            }
            const { data: rows, error } = await query;
            if (error) {
                console.error('Error fetching evaluasi IKT:', error);
                setData([]);
            } else {
                setData((rows as IKTEvaluasi[]) ?? []);
            }
        } catch (err) {
            console.error('Error:', err);
            setData([]);
        } finally {
            setLoading(false);
        }
    }, [year, filterUnit, profile]);

    const fetchAllIKT = useCallback(async () => {
        try {
            let query = supabase
                .from('indikator_kinerja_utama')
                .select('id, indikator, target_tahun, target_nilai, satuan, pic, unit_kerja_id')
                .order('target_tahun', { ascending: false });

            const unitToFilter = profile?.role === 'user_unit' ? profile.unit_kerja_id : (filterUnit === 'all' ? null : filterUnit);
            if (unitToFilter) {
                query = query.eq('unit_kerja_id', unitToFilter);
            }
            const { data: rows } = await query;
            setAllIKT((rows as IKTEvaluasi[]) ?? []);
        } catch (err) {
            console.error('Error fetching all IKT:', err);
        }
    }, [filterUnit, profile]);

    useEffect(() => {
        fetchData();
        fetchAllIKT();
    }, [fetchData, fetchAllIKT]);

    const filtered = data.filter(d =>
        (d.indikator || '').toLowerCase().includes(search.toLowerCase()) ||
        (d.satuan || '').toLowerCase().includes(search.toLowerCase()) ||
        (d.pic || '').toLowerCase().includes(search.toLowerCase())
    );

    // Ketika pilih IKT dari dropdown, auto-fill data target
    const handleIKTSelect = (iktId: string) => {
        if (!iktId) {
            setEvalForm(f => ({ ...f, selectedIKTId: '', indikator: '', target_tahun: CURRENT_YEAR, target_nilai: '', satuan: '', pic: '' }));
            return;
        }
        const selected = allIKT.find(d => d.id === iktId);
        if (selected) {
            setEvalForm(f => ({
                ...f,
                selectedIKTId: iktId,
                indikator: selected.indikator,
                target_tahun: selected.target_tahun ?? CURRENT_YEAR,
                target_nilai: selected.target_nilai != null ? String(selected.target_nilai) : '',
                satuan: selected.satuan ?? '',
                pic: selected.pic ?? '',
            }));
        }
    };

    const openEditModal = (row: IKTEvaluasi) => {
        setSelectedItem(row);
        setEditForm({
            realisasi_nilai: row.realisasi_nilai != null ? String(row.realisasi_nilai) : '',
            kendala: row.kendala || '',
            tindak_lanjut: row.tindak_lanjut || '',
        });
        setShowEditModal(true);
    };

    // Simpan realisasi (untuk edit existing dari tabel)
    const handleEditSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = {
                realisasi_nilai: editForm.realisasi_nilai ? Number(editForm.realisasi_nilai) : null,
                kendala: editForm.kendala || null,
                tindak_lanjut: editForm.tindak_lanjut || null,
            };
            if (selectedItem) {
                const result = await supabase.from('indikator_kinerja_utama').update(payload).eq('id', selectedItem.id);
                if (result.error) {
                    alert('Gagal menyimpan: ' + result.error.message);
                } else {
                    setShowEditModal(false);
                    fetchData();
                    fetchAllIKT();
                }
            }
        } catch (err) {
            console.error('Error:', err);
            alert('Terjadi kesalahan saat menyimpan data');
        } finally {
            setSaving(false);
        }
    };

    // Simpan dari modal Tambah Evaluasi:
    // Hanya UPDATE realisasi pada IKT yang dipilih
    const handleEvalSave = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!evalForm.selectedIKTId) {
            alert('Silakan pilih target IKT terlebih dahulu.');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                realisasi_nilai: evalForm.realisasi_nilai ? Number(evalForm.realisasi_nilai) : null,
                kendala: evalForm.kendala || null,
                tindak_lanjut: evalForm.tindak_lanjut || null,
            };
            const result = await supabase.from('indikator_kinerja_utama').update(payload).eq('id', evalForm.selectedIKTId);

            if (result.error) {
                alert('Gagal menyimpan realisasi: ' + result.error.message);
                return;
            }

            setShowAddModal(false);
            setEvalForm(defaultEvalForm);
            fetchData();
            fetchAllIKT();
        } catch (err) {
            console.error('Error:', err);
            alert('Terjadi kesalahan saat menyimpan data');
        } finally {
            setSaving(false);
        }
    };

    const calculateCapaian = (realisasi?: number | null, target?: number | null) => {
        if (realisasi == null || target == null || target === 0) return 0;
        return (realisasi / target) * 100;
    };

    const columns: Column<IKTEvaluasi>[] = [
        { key: 'target_tahun', label: 'Tahun', className: 'w-16 text-center' },
        { key: 'unit_kerja_id', label: 'Unit', render: r => (r as any).unit_kerja?.nama_unit ?? '-' },
        { key: 'indikator', label: 'Indikator Kinerja', render: r => <span className="line-clamp-2">{r.indikator}</span> },
        { key: 'target_nilai', label: 'Target', className: 'text-center', render: r => r.target_nilai != null ? `${r.target_nilai} ${r.satuan ?? ''}`.trim() : '-' },
        {
            key: 'realisasi_nilai', label: 'Realisasi', className: 'text-center',
            render: r => r.realisasi_nilai != null
                ? <span className="font-semibold text-slate-800">{r.realisasi_nilai} {r.satuan ?? ''}</span>
                : <span className="text-slate-400 italic text-xs">Belum diisi</span>
        },
        {
            key: 'id', label: 'Capaian (%)', className: 'text-center',
            render: r => {
                if (r.realisasi_nilai == null || r.target_nilai == null) return <span className="text-slate-400">-</span>;
                const capaian = calculateCapaian(r.realisasi_nilai, r.target_nilai);
                const ok = capaian >= 100;
                return (
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {capaian.toFixed(1)}%
                    </span>
                );
            }
        },
        { key: 'pic', label: 'PIC', className: 'text-center', render: r => r.pic || '-' },
        { key: 'kendala', label: 'Kendala', render: r => <span className="line-clamp-1">{r.kendala || '-'}</span> },
    ];

    // Stats
    const totalDenganTarget = data.filter(d => d.target_nilai != null).length;
    const totalDenganRealisasi = data.filter(d => d.realisasi_nilai != null).length;
    const tercapai = data.filter(d => d.realisasi_nilai != null && d.target_nilai != null && calculateCapaian(d.realisasi_nilai, d.target_nilai) >= 100).length;

    const chartData = data.slice(0, 10).map(d => ({
        name: (d.indikator || '').substring(0, 18) + (d.indikator?.length > 18 ? '…' : ''),
        target: d.target_nilai ?? 0,
        realisasi: d.realisasi_nilai ?? 0,
    }));

    const isLinked = !!evalForm.selectedIKTId;

    return (
        <div>
            <PageHeader
                title="Evaluasi IKT"
                subtitle="Realisasi dan evaluasi Indikator Kinerja Tahunan yang telah ditetapkan."
            />

            <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
                <ScoreCard icon={<Target size={22} className="text-[#137fec]" />} title="Total Target IKT" value={totalDenganTarget} colorClass="bg-blue-50 border-blue-100" />
                <ScoreCard icon={<Activity size={22} className="text-amber-500" />} title="Sudah Direalisasi" value={totalDenganRealisasi} colorClass="bg-amber-50 border-amber-100" />
                <ScoreCard icon={<CheckCircle2 size={22} className="text-emerald-500" />} title="Target Tercapai" value={tercapai} colorClass="bg-emerald-50 border-emerald-100" />
                <ScoreCard icon={<AlertCircle size={22} className="text-rose-500" />} title="Target Belum Tercapai" value={Math.max(0, totalDenganRealisasi - tercapai)} colorClass="bg-rose-50 border-rose-100" />
            </div>

            {/* Grafik */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-8 p-6">
                <div className="flex items-center gap-2 mb-5">
                    <BarChart2 size={18} className="text-[#137fec]" />
                    <h3 className="font-bold text-slate-700">Grafik Capaian IKT — Target vs Realisasi</h3>
                </div>
                <div className="w-full h-[280px]">
                    {data.length === 0 ? (
                        <div className="flex items-center justify-center w-full h-full text-slate-400 text-sm">Tidak ada data untuk ditampilkan</div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 24 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" interval={0} />
                                <YAxis tick={{ fontSize: 11 }} />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="target" name="Target" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="realisasi" name="Realisasi" fill="#137fec" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* Tabel */}
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
                        <button className="btn-secondary"><Download size={15} /><span className="hidden sm:inline">Template</span></button>
                        <button className="btn-secondary"><Upload size={15} /><span className="hidden sm:inline">Import</span></button>
                        <button className="btn-secondary border-primary/20 text-primary hover:bg-primary/5">
                            <FileText size={15} /><span className="hidden sm:inline">Laporan</span>
                        </button>
                        <button className="btn-primary" onClick={() => { setEvalForm(defaultEvalForm); setShowAddModal(true); }}>
                            <Plus size={15} /><span>Tambah Data</span>
                        </button>
                    </>}
                />
                <DataTable columns={columns} data={filtered} onEdit={openEditModal} isLoading={loading} />
            </div>

            {/* ====== MODAL EDIT REALISASI ====== */}
            {showEditModal && selectedItem && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <h3 className="text-base font-bold text-slate-800">Update Realisasi IKT</h3>
                            <button onClick={() => setShowEditModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
                        </div>
                        {/* Info IKT */}
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 space-y-1">
                            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Indikator</p>
                            <p className="text-sm font-semibold text-slate-800">{selectedItem.indikator}</p>
                            <div className="flex gap-6 mt-1">
                                <p className="text-xs text-slate-500">Target: <span className="font-semibold text-slate-700">{selectedItem.target_nilai ?? '-'} {selectedItem.satuan ?? ''}</span></p>
                                <p className="text-xs text-slate-500">Tahun: <span className="font-semibold text-slate-700">{selectedItem.target_tahun ?? '-'}</span></p>
                                <p className="text-xs text-slate-500">PIC: <span className="font-semibold text-slate-700">{selectedItem.pic ?? '-'}</span></p>
                            </div>
                        </div>
                        <form onSubmit={handleEditSave} className="p-6 space-y-4">
                            <div>
                                <label className="form-label">Realisasi Nilai <span className="text-rose-500">*</span></label>
                                <input
                                    type="number"
                                    className="form-input text-lg font-medium"
                                    value={editForm.realisasi_nilai}
                                    onChange={e => setEditForm(f => ({ ...f, realisasi_nilai: e.target.value }))}
                                    placeholder="Input nilai yang dicapai..."
                                    required
                                />
                            </div>
                            <FormInputAI label="Kendala / Masalah" placeholder="Jelaskan kendala yang dihadapi..." value={editForm.kendala} onChange={v => setEditForm(f => ({ ...f, kendala: v }))} />
                            <FormInputAI label="Tindak Lanjut / Action Plan" placeholder="Rencana tindak lanjut..." value={editForm.tindak_lanjut} onChange={v => setEditForm(f => ({ ...f, tindak_lanjut: v }))} />
                            <div className="flex justify-end space-x-2 pt-2">
                                <button type="button" className="btn-secondary" onClick={() => setShowEditModal(false)}>Batal</button>
                                <button type="submit" className="btn-primary" disabled={saving}>
                                    {saving ? <><Loader2 size={15} className="animate-spin" /><span>Menyimpan...</span></> : <><Save size={15} /><span>Simpan Realisasi</span></>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ====== MODAL TAMBAH EVALUASI ====== */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <h3 className="text-base font-bold text-slate-800">Tambah Data Evaluasi IKT</h3>
                            <button onClick={() => setShowAddModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleEvalSave} className="p-6 space-y-5">

                            {/* Pilih IKT dari data yang sudah ada */}
                            <div>
                                <label className="form-label flex items-center gap-1.5">
                                    <Link2 size={14} className="text-[#137fec]" />
                                    Pilih Target IKT yang Sudah Ditetapkan <span className="text-rose-500">*</span>
                                </label>
                                <select
                                    className="form-input"
                                    value={evalForm.selectedIKTId}
                                    onChange={e => handleIKTSelect(e.target.value)}
                                    required
                                >
                                    <option value="">-- Pilih Target IKT --</option>
                                    {allIKT.map(ikt => (
                                        <option key={ikt.id} value={ikt.id}>
                                            [{ikt.target_tahun ?? '-'}] {ikt.indikator} (Target: {ikt.target_nilai ?? '-'} {ikt.satuan ?? ''})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Input Realisasi */}
                            <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 space-y-4">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">✅ Input Realisasi & Evaluasi</p>
                                <div>
                                    <label className="form-label">Realisasi Nilai <span className="text-rose-500">*</span></label>
                                    <input
                                        type="number"
                                        className="form-input text-lg font-medium"
                                        value={evalForm.realisasi_nilai}
                                        onChange={e => setEvalForm(f => ({ ...f, realisasi_nilai: e.target.value }))}
                                        placeholder={`Nilai yang dicapai${evalForm.satuan ? ` (${evalForm.satuan})` : ''}...`}
                                        required
                                    />
                                    {evalForm.realisasi_nilai && evalForm.target_nilai && (
                                        <p className="text-xs mt-1.5">
                                            Capaian:{' '}
                                            <span className={`font-bold ${(Number(evalForm.realisasi_nilai) / Number(evalForm.target_nilai)) * 100 >= 100 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {((Number(evalForm.realisasi_nilai) / Number(evalForm.target_nilai)) * 100).toFixed(1)}%
                                            </span>
                                            <span className="text-slate-400 ml-1">dari target {evalForm.target_nilai}</span>
                                        </p>
                                    )}
                                </div>
                                <FormInputAI label="Kendala / Masalah" placeholder="Jelaskan kendala yang dihadapi (jika ada)..." value={evalForm.kendala} onChange={v => setEvalForm(f => ({ ...f, kendala: v }))} />
                                <FormInputAI label="Tindak Lanjut / Action Plan" placeholder="Rencana tindak lanjut untuk perbaikan..." value={evalForm.tindak_lanjut} onChange={v => setEvalForm(f => ({ ...f, tindak_lanjut: v }))} />
                            </div>

                            <div className="flex justify-end space-x-2 pt-1">
                                <button type="button" className="btn-secondary" onClick={() => setShowAddModal(false)}>Batal</button>
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
