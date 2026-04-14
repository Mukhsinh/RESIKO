'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader, ScoreCard, TopActionBar, FilterBar } from '@/components/SharedUI';
import DataTable, { type Column } from '@/components/DataTable';
import { Plus, Users, Shield, UserCheck, Save, X, Loader2, Download, Upload } from 'lucide-react';
import { downloadTemplate, importFromExcel, exportToExcel, type ExcelColumn } from '@/lib/excelUtils';

interface Profile {
    id: string;
    email: string;
    role: string;
    unit_kerja_id: string | null;
    unit_kerja?: { nama_unit: string } | null;
    created_at: string;
}

interface Form { email: string; role: string; unit_kerja_id: string; password: string; }
const defaultForm: Form = { email: '', role: 'manager', unit_kerja_id: '', password: '' };

const excelColumns: ExcelColumn[] = [
    { header: 'Email', key: 'email', width: 30 },
    { header: 'Password', key: 'password', width: 20 },
    { header: 'Role (admin/manager)', key: 'role', width: 25 },
    { header: 'Unit Kerja ID', key: 'unit_kerja_id', width: 35 }
];

export default function MasterPenggunaPage() {
    const [data, setData] = useState<Profile[]>([]);
    const [units, setUnits] = useState<{ id: string; nama_unit: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState<Form>(defaultForm);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [importing, setImporting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const { data: profiles, error: profilesError } = await supabase
                .from('profiles')
                .select(`
                    id, 
                    email, 
                    role, 
                    unit_kerja_id, 
                    unit_kerja (nama_unit), 
                    created_at
                `)
                .order('created_at', { ascending: false });

            if (profilesError) {
                console.error('Error fetching profiles:', profilesError);
                throw profilesError;
            }

            setData((profiles || []) as unknown as Profile[]);
        } catch (error) {
            console.error('Error fetching data:', error);
            alert('Gagal memuat data: ' + (error as Error).message);
            setData([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();

        // Fetch unit_kerja for dropdown
        supabase.from('unit_kerja').select('id, nama_unit').then(({ data: unitsData, error }) => {
            if (error) {
                console.error('Error fetching unit_kerja:', error);
            } else {
                setUnits((unitsData ?? []).map(u => ({ id: u.id, nama_unit: u.nama_unit })));
            }
        });
    }, [fetchData]);

    const filtered = data.filter(d =>
        d.email.toLowerCase().includes(search.toLowerCase()) ||
        d.role.toLowerCase().includes(search.toLowerCase())
    );

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault(); setSaving(true); setError('');
        try {
            const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                email: form.email, password: form.password, email_confirm: true,
            });
            if (authError) throw authError;
            if (authData.user) {
                await supabase.from('profiles').upsert({
                    id: authData.user.id,
                    email: form.email,
                    role: form.role,
                    unit_kerja_id: form.unit_kerja_id || null,
                });
            }
            setShowModal(false); setForm(defaultForm); fetchData();
        } catch (err: unknown) {
            setError((err as Error).message ?? 'Gagal membuat pengguna');
        }
        setSaving(false);
    };

    const handleDelete = async (row: Profile) => {
        if (!confirm(`Hapus pengguna ${row.email}?`)) return;
        await supabase.from('profiles').delete().eq('id', row.id);
        fetchData();
    };

    const handleDownloadTemplate = () => {
        const templateData = units.map(u => ({
            email: '',
            password: '',
            role: 'manager',
            unit_kerja_id: `${u.id} (${u.nama_unit})`
        }));

        const ws = require('xlsx').utils.aoa_to_sheet([
            excelColumns.map(col => col.header),
            ['user@example.com', 'password123', 'manager', units[0]?.id || ''],
            ...templateData.slice(0, 3).map(() => ['', '', '', ''])
        ]);

        ws['!cols'] = excelColumns.map(col => ({ wch: col.width || 20 }));

        const wb = require('xlsx').utils.book_new();
        require('xlsx').utils.book_append_sheet(wb, ws, 'Template');
        require('xlsx').writeFile(wb, 'Template_Pengguna.xlsx');
    };

    const handleExport = () => {
        const exportData = data.map(row => ({
            email: row.email,
            password: '********',
            role: row.role,
            unit_kerja_id: row.unit_kerja_id || ''
        }));
        exportToExcel('Data_Pengguna.xlsx', exportData, excelColumns);
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImporting(true);
        try {
            const importedData = await importFromExcel<{ email: string; password: string; role: string; unit_kerja_id: string }>(file, excelColumns);

            if (importedData.length === 0) {
                alert('Tidak ada data untuk diimport');
                return;
            }

            const validData = importedData.filter(row =>
                row.email && row.email.trim() !== '' &&
                row.password && row.password.trim() !== '' &&
                row.role && (row.role === 'admin' || row.role === 'manager')
            );

            if (validData.length === 0) {
                alert('Tidak ada data valid untuk diimport');
                return;
            }

            let successCount = 0;
            let errorCount = 0;

            for (const row of validData) {
                try {
                    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                        email: row.email.trim(),
                        password: row.password.trim(),
                        email_confirm: true,
                    });

                    if (authError) throw authError;

                    if (authData.user) {
                        await supabase.from('profiles').upsert({
                            id: authData.user.id,
                            email: row.email.trim(),
                            role: row.role.trim(),
                            unit_kerja_id: row.unit_kerja_id?.trim() || null,
                        });
                        successCount++;
                    }
                } catch (err) {
                    console.error('Error importing user:', row.email, err);
                    errorCount++;
                }
            }

            alert(`Import selesai!\nBerhasil: ${successCount}\nGagal: ${errorCount}`);
            fetchData();
        } catch (error) {
            console.error('Import error:', error);
            alert('Gagal mengimport data: ' + (error as Error).message);
        } finally {
            setImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const columns: Column<Profile>[] = [
        { key: 'email', label: 'Email' },
        {
            key: 'role', label: 'Role', render: r => (
                <span className={r.role === 'admin' ? 'badge-red' : 'badge-blue'}>{r.role}</span>
            )
        },
        { key: 'unit_kerja', label: 'Unit Kerja', render: r => r.unit_kerja?.nama_unit ?? <span className="text-slate-400 italic">-</span> },
        { key: 'created_at', label: 'Dibuat', render: r => new Date(r.created_at).toLocaleDateString('id-ID') },
    ];

    return (
        <div>
            <PageHeader title="Manajemen Pengguna" subtitle="Kelola akun dan hak akses pengguna sistem ManRisk RS." />
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
                <ScoreCard icon={<Users size={22} className="text-[#137fec]" />} title="Total Pengguna" value={data.length} colorClass="bg-blue-50 border-blue-100" />
                <ScoreCard icon={<Shield size={22} className="text-rose-500" />} title="Admin" value={data.filter(d => d.role === 'admin').length} colorClass="bg-rose-50 border-rose-100" />
                <ScoreCard icon={<UserCheck size={22} className="text-emerald-500" />} title="Manager" value={data.filter(d => d.role === 'manager').length} colorClass="bg-emerald-50 border-emerald-100" />
                <ScoreCard icon={<Users size={22} className="text-amber-500" />} title="Unit Kerja" value={new Set(data.filter(d => d.unit_kerja_id).map(d => d.unit_kerja_id)).size} colorClass="bg-amber-50 border-amber-100" />
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <TopActionBar
                    filters={<FilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Cari email / role..." />}
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
                            <button className="btn-primary" onClick={() => { setShowModal(true); setForm(defaultForm); setError(''); }}>
                                <Plus size={15} />
                                <span>Tambah Pengguna</span>
                            </button>
                        </div>
                    }
                />
                <DataTable columns={columns} data={filtered} onDelete={handleDelete} isLoading={loading} />
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <h3 className="text-base font-bold text-slate-800">Tambah Pengguna Baru</h3>
                            <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            {error && <p className="text-xs text-rose-600 bg-rose-50 p-3 rounded-lg">{error}</p>}
                            <div>
                                <label className="form-label">Email</label>
                                <input type="email" className="form-input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required placeholder="pengguna@rsud.go.id" />
                            </div>
                            <div>
                                <label className="form-label">Password Awal</label>
                                <input type="password" className="form-input" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required minLength={8} placeholder="Min. 8 karakter" />
                            </div>
                            <div>
                                <label className="form-label">Role</label>
                                <select className="form-input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                                    <option value="manager">Manager</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>
                            <div>
                                <label className="form-label">Unit Kerja</label>
                                <select className="form-input" value={form.unit_kerja_id} onChange={e => setForm(f => ({ ...f, unit_kerja_id: e.target.value }))}>
                                    <option value="">-- Pilih Unit Kerja --</option>
                                    {units.map(u => <option key={u.id} value={u.id}>{u.nama_unit}</option>)}
                                </select>
                            </div>
                            <div className="flex justify-end space-x-2 pt-2">
                                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Batal</button>
                                <button type="submit" className="btn-primary" disabled={saving}>
                                    {saving ? <><Loader2 size={15} className="animate-spin" /><span>Membuat...</span></> : <><Save size={15} /><span>Buat Pengguna</span></>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
