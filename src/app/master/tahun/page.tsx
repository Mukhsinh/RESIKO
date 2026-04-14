'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase, type TahunAnggaran } from '@/lib/supabase';
import { PageHeader, ScoreCard, TopActionBar, FilterBar } from '@/components/SharedUI';
import DataTable, { type Column } from '@/components/DataTable';
import { Plus, Calendar, CheckCircle2, Clock, Save, X, Loader2, Download, Upload } from 'lucide-react';
import { downloadTemplate, importFromExcel, exportToExcel, type ExcelColumn } from '@/lib/excelUtils';

interface Form { tahun: number; keterangan: string; aktif: boolean; }
const defaultForm: Form = { tahun: new Date().getFullYear(), keterangan: '', aktif: false };

const excelColumns: ExcelColumn[] = [
    { header: 'Tahun', key: 'tahun', width: 15 },
    { header: 'Keterangan', key: 'keterangan', width: 40 },
    { header: 'Aktif (true/false)', key: 'aktif', width: 20 }
];

export default function MasterTahunPage() {
    const [data, setData] = useState<TahunAnggaran[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState<Form>(defaultForm);
    const [saving, setSaving] = useState(false);
    const [importing, setImporting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        const { data: rows } = await supabase.from('tahun_anggaran').select('*').order('tahun', { ascending: false });
        setData((rows as TahunAnggaran[]) ?? []);
        setLoading(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const filtered = data.filter(d =>
        String(d.tahun).includes(search) || d.keterangan.toLowerCase().includes(search.toLowerCase())
    );

    const openAdd = () => { setEditId(null); setForm(defaultForm); setShowModal(true); };
    const openEdit = (row: TahunAnggaran) => {
        setEditId(row.id);
        setForm({ tahun: row.tahun, keterangan: row.keterangan, aktif: row.aktif });
        setShowModal(true);
    };
    const handleDelete = async (row: TahunAnggaran) => {
        if (!confirm(`Hapus tahun anggaran ${row.tahun}?`)) return;
        await supabase.from('tahun_anggaran').delete().eq('id', row.id);
        fetchData();
    };
    const handleSetAktif = async (row: TahunAnggaran) => {
        await supabase.from('tahun_anggaran').update({ aktif: false }).neq('id', row.id);
        await supabase.from('tahun_anggaran').update({ aktif: true }).eq('id', row.id);
        fetchData();
    };
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault(); setSaving(true);
        if (form.aktif) {
            await supabase.from('tahun_anggaran').update({ aktif: false }).neq('id', editId ?? '');
        }
        if (editId) { await supabase.from('tahun_anggaran').update(form).eq('id', editId); }
        else { await supabase.from('tahun_anggaran').insert(form); }
        setSaving(false); setShowModal(false); fetchData();
    };

    const handleDownloadTemplate = () => {
        downloadTemplate('Template_Tahun_Anggaran.xlsx', excelColumns);
    };

    const handleExport = () => {
        const exportData = data.map(row => ({
            tahun: row.tahun,
            keterangan: row.keterangan,
            aktif: row.aktif
        }));
        exportToExcel('Data_Tahun_Anggaran.xlsx', exportData, excelColumns);
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImporting(true);
        try {
            const importedData = await importFromExcel<{ tahun: number; keterangan: string; aktif: string | boolean }>(file, excelColumns);
            
            if (importedData.length === 0) {
                alert('Tidak ada data untuk diimport');
                return;
            }

            const validData = importedData
                .filter(row => row.tahun && !isNaN(Number(row.tahun)))
                .map(row => ({
                    tahun: Number(row.tahun),
                    keterangan: String(row.keterangan || '').trim(),
                    aktif: row.aktif === true || row.aktif === 'true' || row.aktif === 'TRUE'
                }));
            
            if (validData.length === 0) {
                alert('Tidak ada data valid untuk diimport');
                return;
            }

            const { error } = await supabase.from('tahun_anggaran').insert(validData);

            if (error) throw error;

            alert(`Berhasil mengimport ${validData.length} data tahun anggaran`);
            fetchData();
        } catch (error) {
            console.error('Import error:', error);
            alert('Gagal mengimport data: ' + (error as Error).message);
        } finally {
            setImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const columns: Column<TahunAnggaran>[] = [
        { key: 'tahun', label: 'Tahun', className: 'font-bold text-slate-700 text-base' },
        { key: 'keterangan', label: 'Keterangan' },
        {
            key: 'aktif', label: 'Status', render: r => (
                <div className="flex items-center gap-2">
                    {r.aktif
                        ? <span className="badge-green flex items-center gap-1"><CheckCircle2 size={12} /> Aktif</span>
                        : <span className="badge-gray flex items-center gap-1"><Clock size={12} /> Tidak Aktif</span>}
                    {!r.aktif && (
                        <button onClick={() => handleSetAktif(r)} className="text-[10px] text-[#137fec] hover:underline ml-1">Set Aktif</button>
                    )}
                </div>
            )
        },
        { key: 'created_at', label: 'Dibuat', render: r => new Date(r.created_at).toLocaleDateString('id-ID') },
    ];

    const aktif = data.find(d => d.aktif);

    return (
        <div>
            <PageHeader title="Manajemen Tahun Anggaran" subtitle="Kelola daftar tahun anggaran yang digunakan dalam sistem." />
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
                <ScoreCard icon={<Calendar size={22} className="text-[#137fec]" />} title="Total Tahun" value={data.length} colorClass="bg-blue-50 border-blue-100" />
                <ScoreCard icon={<CheckCircle2 size={22} className="text-emerald-500" />} title="Tahun Aktif" value={aktif?.tahun ?? '-'} colorClass="bg-emerald-50 border-emerald-100" />
                <ScoreCard icon={<Clock size={22} className="text-amber-500" />} title="Tahun Terlama" value={data.length ? Math.min(...data.map(d => d.tahun)) : '-'} colorClass="bg-amber-50 border-amber-100" />
                <ScoreCard icon={<Calendar size={22} className="text-violet-500" />} title="Tahun Terbaru" value={data.length ? Math.max(...data.map(d => d.tahun)) : '-'} colorClass="bg-violet-50 border-violet-100" />
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <TopActionBar
                    filters={<FilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Cari tahun..." />}
                    actions={
                        <div className="flex gap-2">
                            <button className="btn-secondary" onClick={handleDownloadTemplate}>
                                <Download size={15} />
                                <span>Unduh Template</span>
                            </button>
                            <button className="btn-secondary" onClick={handleExport} disabled={data.length === 0}>
                                <Download size={15} />
                                <span>Export Data</span>
                            </button>
                            <button className="btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={importing}>
                                {importing ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                                <span>{importing ? 'Mengimport...' : 'Import Data'}</span>
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx,.xls"
                                onChange={handleImport}
                                className="hidden"
                            />
                            <button className="btn-primary" onClick={openAdd}>
                                <Plus size={15} />
                                <span>Tambah Tahun</span>
                            </button>
                        </div>
                    }
                />
                <DataTable columns={columns} data={filtered} onEdit={openEdit} onDelete={handleDelete} isLoading={loading} />
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <h3 className="text-base font-bold text-slate-800">{editId ? 'Edit' : 'Tambah'} Tahun Anggaran</h3>
                            <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div>
                                <label className="form-label">Tahun</label>
                                <input type="number" className="form-input" value={form.tahun} min="2000" max="2100" onChange={e => setForm(f => ({ ...f, tahun: Number(e.target.value) }))} required />
                            </div>
                            <div>
                                <label className="form-label">Keterangan</label>
                                <input type="text" className="form-input" value={form.keterangan} onChange={e => setForm(f => ({ ...f, keterangan: e.target.value }))} placeholder={`Tahun Anggaran ${form.tahun}`} />
                            </div>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" className="w-4 h-4 accent-[#137fec]" checked={form.aktif} onChange={e => setForm(f => ({ ...f, aktif: e.target.checked }))} />
                                <span className="text-sm text-slate-700">Jadikan Tahun Aktif</span>
                            </label>
                            <div className="flex justify-end space-x-2 pt-2">
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
