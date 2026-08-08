'use client';

import React, { useEffect, useState, useRef } from 'react';
import { supabase, type UnitKerja } from '@/lib/supabase';
import { PageHeader, TopActionBar } from '@/components/SharedUI';
import DataTable, { type Column } from '@/components/DataTable';
import { Plus, Save, X, Loader2, Download, Upload } from 'lucide-react';
import { downloadTemplate, importFromExcel, exportToExcel, type ExcelColumn } from '@/lib/excelUtils';

const excelColumns: ExcelColumn[] = [
    { header: 'Nama Unit Kerja', key: 'nama_unit', width: 40 }
];

export default function UnitKerjaPage() {
    const [data, setData] = useState<UnitKerja[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [nama, setNama] = useState('');
    const [saving, setSaving] = useState(false);
    const [importing, setImporting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: rows, error } = await supabase.from('unit_kerja').select('*').order('nama_unit');

            if (error) {
                console.error('Error fetching unit_kerja:', error);
                alert('Gagal memuat data: ' + error.message);
                setData([]);
            } else {
                setData(rows ?? []);
            }
        } catch (err) {
            console.error('Exception in fetchData:', err);
            alert('Terjadi kesalahan: ' + (err as Error).message);
            setData([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const openAdd = () => { setEditId(null); setNama(''); setShowModal(true); };
    const openEdit = (row: UnitKerja) => { setEditId(row.id); setNama(row.nama_unit); setShowModal(true); };
    const handleDelete = async (row: UnitKerja) => {
        if (!confirm(`Hapus unit kerja "${row.nama_unit}"?`)) return;
        try {
            console.log('Deleting unit kerja:', row.id);
            const { error } = await supabase.from('unit_kerja').delete().eq('id', row.id);
            if (error) {
                console.error('Error deleting unit_kerja:', error);
                alert('Gagal menghapus: ' + error.message);
            } else {
                console.log('Delete successful');
                await fetchData();
            }
        } catch (err) {
            console.error('Exception in handleDelete:', err);
            alert('Terjadi kesalahan: ' + (err as Error).message);
        }
    };
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            console.log('Saving unit kerja:', { editId, nama });
            let result;
            if (editId) {
                result = await supabase.from('unit_kerja').update({ nama_unit: nama }).eq('id', editId);
            } else {
                result = await supabase.from('unit_kerja').insert({ nama_unit: nama });
            }

            console.log('Save result:', result);

            if (result.error) {
                console.error('Error saving unit_kerja:', result.error);
                alert('Gagal menyimpan: ' + result.error.message);
            } else {
                console.log('Save successful');
                setShowModal(false);
                await fetchData();
            }
        } catch (err) {
            console.error('Exception in handleSave:', err);
            alert('Terjadi kesalahan: ' + (err as Error).message);
        } finally {
            setSaving(false);
        }
    };

    const handleDownloadTemplate = () => {
        downloadTemplate('Template_Unit_Kerja.xlsx', excelColumns);
    };

    const handleExport = () => {
        const exportData = data.map(row => ({ nama_unit: row.nama_unit }));
        exportToExcel('Data_Unit_Kerja.xlsx', exportData, excelColumns);
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImporting(true);
        try {
            const importedData = await importFromExcel<{ nama_unit: string }>(file, excelColumns);

            if (importedData.length === 0) {
                alert('Tidak ada data untuk diimport');
                return;
            }

            const validData = importedData.filter(row => row.nama_unit && row.nama_unit.trim() !== '');

            if (validData.length === 0) {
                alert('Tidak ada data valid untuk diimport');
                return;
            }

            const { error } = await supabase.from('unit_kerja').insert(
                validData.map(row => ({ nama_unit: row.nama_unit.trim() }))
            );

            if (error) throw error;

            alert(`Berhasil mengimport ${validData.length} data unit kerja`);
            fetchData();
        } catch (error) {
            console.error('Import error:', error);
            alert('Gagal mengimport data: ' + (error as Error).message);
        } finally {
            setImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const columns: Column<UnitKerja>[] = [
        { key: 'nama_unit', label: 'Nama Unit Kerja' },
        { key: 'created_at', label: 'Dibuat', render: r => new Date(r.created_at).toLocaleDateString('id-ID') },
    ];

    return (
        <div>
            <PageHeader title="Master Data: Unit Kerja" subtitle="Kelola daftar unit kerja / departemen rumah sakit." />
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <TopActionBar
                    filters={
                        <div className="flex items-center gap-3">
                            <span className="text-sm text-slate-500">{data.length} unit kerja terdaftar</span>
                            {loading && <span className="text-xs text-amber-500">⟳ Memuat...</span>}
                        </div>
                    }
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
                                <span>Tambah Unit</span>
                            </button>
                        </div>
                    }
                />
                <DataTable columns={columns} data={data} onEdit={openEdit} onDelete={handleDelete} isLoading={loading} />
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <h3 className="text-base font-bold text-slate-800">{editId ? 'Edit' : 'Tambah'} Unit Kerja</h3>
                            <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div>
                                <label className="form-label">Nama Unit Kerja</label>
                                <input type="text" className="form-input" value={nama} onChange={e => setNama(e.target.value)} placeholder="Contoh: IGD, ICU, Rawat Inap..." required />
                            </div>
                            <div className="flex justify-end space-x-2">
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
