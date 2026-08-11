'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader, ScoreCard, FilterBar, TopActionBar } from '@/components/SharedUI';
import DataTable, { type Column } from '@/components/DataTable';
import FormInputAI from '@/components/FormInputAI';
import { Plus, Download, Upload, FileText, Calendar, Target, CheckCircle2, Clock, Save, X, Loader2, Search, ChevronDown } from 'lucide-react';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useAppSettings } from '@/hooks/useAppSettings';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const CURRENT_YEAR = new Date().getFullYear();

interface RKT {
    id: string;
    unit_kerja_id: string;
    tahun: number;
    program: string;
    kegiatan: string;
    target: string;
    realisasi: string;
    anggaran: string;
    penanggung_jawab: string;
    triwulan: string;
    status: string;
    created_at: string;
    rencana_strategis_id?: string;
    unit_kerja?: { nama_unit: string };
    rencana_strategis?: { nama_rencana: string, misi_items?: { nomor: number } };
    nama_unit?: string;
}

interface Form {
    unit_kerja_id: string;
    tahun: number;
    program: string;
    kegiatan: string;
    target: string;
    realisasi: string;
    anggaran: string;
    penanggung_jawab: string;
    triwulan: string;
    status: string;
    rencana_strategis_id: string;
}

const defaultForm: Form = {
    unit_kerja_id: '', tahun: CURRENT_YEAR, program: '', kegiatan: '',
    target: '', realisasi: '', anggaran: '', penanggung_jawab: '', triwulan: 'TW1', status: 'Belum Mulai',
    rencana_strategis_id: ''
};

interface RenstraOption {
    id: string;
    nama_rencana: string;
    misi_nomor?: number;
    misi_isi?: string;
}

const STATUS_COLORS: Record<string, string> = {
    'Selesai': 'badge-green', 'Berjalan': 'badge-blue', 'Terlambat': 'badge-red', 'Belum Mulai': 'badge-gray',
};

export default function RKTPage() {
    const { profile } = useUserProfile();
    const { settings } = useAppSettings();
    const [data, setData] = useState<RKT[]>([]);
    const [units, setUnits] = useState<{ id: string; nama_unit: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [year, setYear] = useState(String(CURRENT_YEAR));
    const [filterUnit, setFilterUnit] = useState<string>('all');
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState<Form>(defaultForm);
    const [saving, setSaving] = useState(false);

    // Renstra items
    const [renstraOptions, setRenstraOptions] = useState<RenstraOption[]>([]);
    const [loadingRenstra, setLoadingRenstra] = useState(false);

    // Custom dropdown state for Renstra selector
    const [renstraDropdownOpen, setRenstraDropdownOpen] = useState(false);
    const [renstraSearchQuery, setRenstraSearchQuery] = useState('');
    const renstraDropdownRef = useRef<HTMLDivElement>(null);
    const renstraSearchRef = useRef<HTMLInputElement>(null);

    const fetchRenstraOptions = useCallback(async () => {
        setLoadingRenstra(true);
        try {
            const { data: rows, error } = await supabase
                .from('rencana_strategis')
                .select('id, nama_rencana, misi_items(nomor, isi_misi)')
                .order('created_at', { ascending: false });

            if (!error && rows) {
                const mapped = rows.map((r: any) => ({
                    id: r.id,
                    nama_rencana: r.nama_rencana,
                    misi_nomor: r.misi_items?.nomor,
                    misi_isi: r.misi_items?.isi_misi,
                }));
                setRenstraOptions(mapped);
            } else {
                setRenstraOptions([]);
            }
        } catch {
            setRenstraOptions([]);
        } finally {
            setLoadingRenstra(false);
        }
    }, []);

    const fetchUnits = useCallback(async () => {
        const { data: unitData } = await supabase.from('unit_kerja').select('id, nama_unit').order('nama_unit');
        if (unitData) setUnits(unitData);
    }, []);

    // Sync unit filter for managers
    useEffect(() => {
        if (profile?.role === 'user_unit' && profile.unit_kerja_id) {
            setFilterUnit(profile.unit_kerja_id);
        }
    }, [profile]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            let query = supabase.from('rkt').select('*, unit_kerja(nama_unit), rencana_strategis(nama_rencana, misi_items(nomor))');
            if (year) {
                query = query.eq('tahun', Number(year));
            }
            const unitToFilter = profile?.role === 'user_unit' ? profile.unit_kerja_id : (filterUnit === 'all' ? null : filterUnit);
            if (unitToFilter) {
                query = query.eq('unit_kerja_id', unitToFilter);
            }
            const { data: rows, error } = await query.order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching rkt:', error);
                setData([]);
            } else {
                setData(rows as any[] ?? []);
            }
        } catch (err) {
            console.error('Error:', err);
            setData([]);
        } finally {
            setLoading(false);
        }
    }, [year, filterUnit, profile]);

    useEffect(() => {
        fetchUnits();
        fetchRenstraOptions();
        fetchData();
    }, [fetchUnits, fetchRenstraOptions, fetchData]);

    const filtered = data.filter(d =>
        (d.program || '').toLowerCase().includes(search.toLowerCase()) ||
        (d.kegiatan || '').toLowerCase().includes(search.toLowerCase())
    );

    const selesai = data.filter(d => d.status === 'Selesai').length;

    const openAdd = () => {
        setEditId(null);
        const newForm = { ...defaultForm };
        if (profile?.role === 'user_unit' && profile.unit_kerja_id) {
            newForm.unit_kerja_id = profile.unit_kerja_id;
        }
        setForm(newForm);
        setShowModal(true);
    };
    const openEdit = (row: RKT) => {
        setEditId(row.id);
        setForm({
            unit_kerja_id: row.unit_kerja_id || '',
            tahun: row.tahun || CURRENT_YEAR,
            program: row.program || '',
            kegiatan: row.kegiatan || '',
            target: row.target || '',
            realisasi: row.realisasi || '',
            anggaran: row.anggaran || '',
            penanggung_jawab: row.penanggung_jawab || '',
            triwulan: row.triwulan || 'TW1',
            status: row.status || 'Belum Mulai',
            rencana_strategis_id: row.rencana_strategis_id || ''
        });
        setShowModal(true);
    };
    const handleDelete = async (row: RKT) => {
        if (!confirm(`Hapus kegiatan "${(row.kegiatan || '').slice(0, 50)}"?`)) return;
        const { error } = await supabase.from('rkt').delete().eq('id', row.id);
        if (error) {
            alert('Gagal menghapus data: ' + error.message);
        } else {
            fetchData();
        }
    };
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (!form.unit_kerja_id) {
            alert('Pilih Unit Kerja terlebih dahulu');
            return;
        }

        setSaving(true);
        let errorObj;

        // Clean form before saving
        const dataToSave = { ...form };
        if (!dataToSave.rencana_strategis_id) {
            delete (dataToSave as any).rencana_strategis_id; // Let default or omit trigger DB null logic
        }

        if (dataToSave.rencana_strategis_id === '') (dataToSave as any).rencana_strategis_id = null;

        if (editId) {
            const { error } = await supabase.from('rkt').update(dataToSave).eq('id', editId);
            errorObj = error;
        } else {
            const { error } = await supabase.from('rkt').insert([dataToSave]);
            errorObj = error;
        }

        if (errorObj) {
            console.error('Error saving:', errorObj);
            alert('Gagal menyimpan: ' + errorObj.message);
        } else {
            setShowModal(false);
            fetchData();
        }
        setSaving(false);
    };

    const handleExportPDF = () => {
        const doc = new jsPDF('p', 'pt', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        const hexToRgb = (hex: string): [number, number, number] => {
            const def: [number, number, number] = [19, 127, 236]; // Blue primary
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
                if (i === 1) continue; // skip cover
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
        doc.text('LAPORAN RENCANA KERJA TAHUNAN (RKT)', pageWidth / 2, pageHeight / 2 - 60, { align: 'center' });

        doc.setFontSize(16);
        doc.setFont('helvetica', 'normal');
        doc.text(`Tahun: ${year || 'Semua'}`, pageWidth / 2, pageHeight / 2, { align: 'center' });

        doc.setFontSize(12);
        doc.text((settings?.nama_rs || 'RUMAH SAKIT').toUpperCase(), pageWidth / 2, pageHeight / 2 + 50, { align: 'center' });

        doc.addPage();

        // TOC Page
        let tocPageNum = doc.getCurrentPageInfo().pageNumber;
        doc.addPage(); // skip for TOC

        let contentPageStart = doc.getCurrentPageInfo().pageNumber;

        // Draw KOP Surat on first content page
        drawKopSurat(doc);

        doc.setTextColor(30, 41, 59);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('A. Rencana Kerja Tahunan per Unit Kerja', 40, 140);

        let finalY = 160;

        const byUnit = Object.entries(
            filtered.reduce<Record<string, RKT[]>>((acc, d) => {
                const unit = d.unit_kerja?.nama_unit ?? d.nama_unit ?? 'Lainnya';
                if (!acc[unit]) acc[unit] = [];
                acc[unit].push(d);
                return acc;
            }, {})
        );

        byUnit.forEach(([unit, items]) => {
            if (finalY > pageHeight - 140) {
                doc.addPage();
                finalY = 70;
            }

            doc.setFontSize(10.5);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(30, 41, 59);
            doc.text(`Unit Kerja: ${unit}`, 40, finalY + 15);

            let rowIdx = 1;
            const tableData = items.map(item => {
                const renstraLabel = item.rencana_strategis?.nama_rencana
                    ? `${item.rencana_strategis.misi_items?.nomor ? `Misi ${item.rencana_strategis.misi_items.nomor}: ` : ''}${item.rencana_strategis.nama_rencana}`
                    : '-';
                return [
                    rowIdx++,
                    String(item.tahun || year || '-'),
                    renstraLabel,
                    item.program || '-',
                    item.kegiatan || '-',
                    item.triwulan || '-',
                    item.target || '-',
                    item.realisasi || '-',
                    item.status || '-'
                ];
            });

            autoTable(doc, {
                startY: finalY + 22,
                head: [['No', 'Tahun', 'Rencana Strategis', 'Program', 'Kegiatan', 'TW', 'Target', 'Realisasi', 'Status']],
                body: tableData,
                theme: 'grid',
                headStyles: { fillColor: rgbColor, fontSize: 8, fontStyle: 'bold' },
                styles: { fontSize: 7, cellPadding: 3 },
                columnStyles: {
                    0: { cellWidth: 20, halign: 'center' },
                    1: { cellWidth: 35, halign: 'center' },
                    2: { cellWidth: 100 },
                    3: { cellWidth: 90 },
                    4: { cellWidth: 100 },
                    5: { cellWidth: 25, halign: 'center' },
                    6: { cellWidth: 35, halign: 'center' },
                    7: { cellWidth: 40, halign: 'center' },
                    8: { cellWidth: 50, halign: 'center' }
                },
                margin: { left: 40, right: 40 },
                didDrawPage: (data) => {
                    const currentPage = doc.getCurrentPageInfo().pageNumber;
                    if (currentPage > contentPageStart) {
                        addHeader(doc, 'Laporan Rencana Kerja Tahunan');
                    }
                }
            });
            finalY = (doc as any).lastAutoTable.finalY + 20;
        });

        // Signature block
        if (finalY > pageHeight - 150) {
            doc.addPage();
            finalY = 70;
        } else {
            finalY += 15;
        }

        doc.setFontSize(9.5);
        doc.setTextColor(51, 65, 85);
        doc.setFont('helvetica', 'normal');
        doc.text('Disiapkan oleh,', 60, finalY);
        doc.text(settings?.jabatan_penandatangan_kiri || 'Penanggungjawab Unit', 60, finalY + 14);
        doc.line(60, finalY + 65, 200, finalY + 65);
        doc.text(settings?.nama_penandatangan_kiri || '............................', 60, finalY + 78);

        doc.text('Disetujui oleh,', pageWidth - 200, finalY);
        doc.setFont('helvetica', 'bold');
        doc.text(settings?.kepala_rs || 'Direktur RS', pageWidth - 200, finalY + 14);
        doc.line(pageWidth - 200, finalY + 65, pageWidth - 60, finalY + 65);
        doc.setFont('helvetica', 'normal');
        doc.text(`NIP: ${settings?.nip_kepala || '-'}`, pageWidth - 200, finalY + 78);

        // Add TOC Content
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

        doc.text('1. Detail Rencana Kerja Tahunan (RKT) per Unit Kerja', 40, 140);
        doc.text(`${contentPageStart - 1}`, pageWidth - 40, 140, { align: 'right' });

        doc.text('2. Lembar Tanda Tangan Pengesahan Laporan', 40, 160);
        const lastPage = doc.getNumberOfPages();
        doc.text(`${lastPage - 1}`, pageWidth - 40, 160, { align: 'right' });

        addFooter(doc);
        doc.save(`Laporan_RKT_${year || 'Semua'}.pdf`);
    };

    const columns: Column<RKT>[] = [
        { key: 'tahun', label: 'Tahun', className: 'w-16' },
        { key: 'unit_kerja_id', label: 'Unit', render: r => r.unit_kerja?.nama_unit ?? '-' },
        {
            key: 'rencana_strategis_id', label: 'Renstra', render: r => (
                <div>
                    {r.rencana_strategis?.misi_items && <div className="text-xs text-blue-600 font-medium mb-1 line-clamp-1">Misi {r.rencana_strategis.misi_items.nomor}</div>}
                    <div className="line-clamp-2" title={r.rencana_strategis?.nama_rencana}>{r.rencana_strategis?.nama_rencana || '-'}</div>
                </div>
            )
        },
        { key: 'program', label: 'Program', render: r => <span className="line-clamp-2" title={r.program}>{r.program}</span> },
        { key: 'kegiatan', label: 'Kegiatan', render: r => <span className="line-clamp-3" title={r.kegiatan}>{r.kegiatan}</span> },
        { key: 'triwulan', label: 'TW', className: 'text-center' },
        { key: 'target', label: 'Target', className: 'text-center' },
        { key: 'realisasi', label: 'Realisasi', className: 'text-center', render: r => r.realisasi || '-' },
        { key: 'status', label: 'Status', render: r => <span className={STATUS_COLORS[r.status] ?? 'badge-gray'}>{r.status}</span> },
    ];

    // Group options by Misi
    const groupedRenstraOptions = renstraOptions.reduce((acc, opt) => {
        const key = opt.misi_nomor ? `Misi ${opt.misi_nomor}` : 'Tanpa Misi';
        if (!acc[key]) acc[key] = { items: [], isi: opt.misi_isi };
        acc[key].items.push(opt);
        return acc;
    }, {} as Record<string, { items: RenstraOption[], isi?: string }>);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (renstraDropdownRef.current && !renstraDropdownRef.current.contains(event.target as Node)) {
                setRenstraDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Focus search input on dropdown open
    useEffect(() => {
        if (renstraDropdownOpen && renstraSearchRef.current) {
            renstraSearchRef.current.focus();
        }
    }, [renstraDropdownOpen]);

    // Get selected renstra display text
    const selectedRenstra = renstraOptions.find(r => r.id === form.rencana_strategis_id);
    const selectedRenstraLabel = selectedRenstra
        ? `${selectedRenstra.misi_nomor ? `Misi ${selectedRenstra.misi_nomor} — ` : ''}${selectedRenstra.nama_rencana}`
        : '';

    // Filter renstra options based on search
    const filteredGroupedRenstra = Object.entries(groupedRenstraOptions).reduce((acc, [misiGroup, { items, isi }]) => {
        const q = renstraSearchQuery.toLowerCase();
        const filteredItems = items.filter(opt =>
            opt.nama_rencana.toLowerCase().includes(q) ||
            (isi && isi.toLowerCase().includes(q)) ||
            misiGroup.toLowerCase().includes(q)
        );
        if (filteredItems.length > 0) {
            acc[misiGroup] = { items: filteredItems, isi };
        }
        return acc;
    }, {} as Record<string, { items: RenstraOption[], isi?: string }>);

    return (
        <div>
            <PageHeader title="Rencana Kerja Tahunan (RKT)" subtitle="Program dan kegiatan operasional tahunan unit kerja rumah sakit." />

            <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
                <ScoreCard icon={<Calendar size={22} className="text-[#137fec]" />} title="Total Kegiatan" value={data.length} colorClass="bg-blue-50 border-blue-100" />
                <ScoreCard icon={<CheckCircle2 size={22} className="text-emerald-500" />} title="Selesai" value={selesai} colorClass="bg-emerald-50 border-emerald-100" />
                <ScoreCard icon={<Clock size={22} className="text-amber-500" />} title="Berjalan" value={data.filter(d => d.status === 'Berjalan').length} colorClass="bg-amber-50 border-amber-100" />
                <ScoreCard icon={<Target size={22} className="text-rose-500" />} title="Capaian" value={data.length ? `${Math.round(selesai * 100 / data.length)}%` : '0%'} colorClass="bg-rose-50 border-rose-100" />
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <TopActionBar
                    filters={
                        <div className="flex flex-wrap items-center gap-3">
                            <FilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Cari program / kegiatan..." yearValue={year} onYearChange={setYear} />
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
                        <button className="btn-secondary border-primary/20 text-primary hover:bg-primary/5" onClick={handleExportPDF}><FileText size={15} /><span className="hidden sm:inline">Laporan</span></button>
                        <button className="btn-primary" onClick={openAdd}><Plus size={15} /><span>Tambah</span></button>
                    </>}
                />
                <DataTable columns={columns} data={filtered} onEdit={openEdit} onDelete={handleDelete} onView={openEdit} isLoading={loading} />
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 sticky top-0 z-10">
                            <h3 className="text-base font-bold text-slate-800">{editId ? 'Edit' : 'Tambah'} Kegiatan RKT</h3>
                            <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-5">

                            {/* Relasi Renstra */}
                            <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100/50 space-y-4">
                                <div>
                                    <label className="form-label text-indigo-800 font-medium flex items-center gap-2">
                                        <Target size={14} /> Rencana Strategis Yang Dituju (Opsional)
                                    </label>
                                    <div ref={renstraDropdownRef} className="relative">
                                        {/* Trigger Button */}
                                        <button
                                            type="button"
                                            className="form-input bg-white text-left flex items-center justify-between gap-2 cursor-pointer"
                                            onClick={() => { if (!loadingRenstra) { setRenstraDropdownOpen(!renstraDropdownOpen); setRenstraSearchQuery(''); } }}
                                            disabled={loadingRenstra}
                                        >
                                            <span className={`block truncate ${!form.rencana_strategis_id ? 'text-slate-400' : 'text-slate-800'}`} title={selectedRenstraLabel || '-- Tidak dikaitkan dengan Renstra spesifik --'}>
                                                {selectedRenstraLabel || '-- Tidak dikaitkan dengan Renstra spesifik --'}
                                            </span>
                                            <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${renstraDropdownOpen ? 'rotate-180' : ''}`} />
                                        </button>

                                        {/* Dropdown Panel */}
                                        {renstraDropdownOpen && (
                                            <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-xl max-h-80 overflow-hidden flex flex-col" style={{ minWidth: '400px' }}>
                                                {/* Search */}
                                                <div className="p-2 border-b border-slate-100">
                                                    <div className="relative">
                                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                        <input
                                                            ref={renstraSearchRef}
                                                            type="text"
                                                            className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                                                            placeholder="Cari rencana strategis..."
                                                            value={renstraSearchQuery}
                                                            onChange={e => setRenstraSearchQuery(e.target.value)}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Options List */}
                                                <div className="overflow-y-auto flex-1">
                                                    {/* Default option */}
                                                    <button
                                                        type="button"
                                                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 transition-colors ${!form.rencana_strategis_id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-500 italic'
                                                            }`}
                                                        onClick={() => { setForm(f => ({ ...f, rencana_strategis_id: '' })); setRenstraDropdownOpen(false); }}
                                                    >
                                                        -- Tidak dikaitkan dengan Renstra spesifik --
                                                    </button>

                                                    {Object.entries(filteredGroupedRenstra).map(([misiGroup, { items, isi }]) => (
                                                        <div key={misiGroup}>
                                                            {/* Group Header */}
                                                            <div className="px-4 py-2 bg-slate-50 border-y border-slate-100">
                                                                <span className="text-xs font-bold text-indigo-700 uppercase tracking-wide">{misiGroup}</span>
                                                                {isi && <span className="text-xs text-slate-500 ml-1">— {isi}</span>}
                                                            </div>
                                                            {/* Group Items */}
                                                            {items.map(opt => (
                                                                <button
                                                                    key={opt.id}
                                                                    type="button"
                                                                    className={`w-full text-left px-5 py-2.5 text-sm hover:bg-blue-50 transition-colors leading-relaxed ${form.rencana_strategis_id === opt.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'
                                                                        }`}
                                                                    onClick={() => { setForm(f => ({ ...f, rencana_strategis_id: opt.id })); setRenstraDropdownOpen(false); }}
                                                                >
                                                                    {opt.nama_rencana}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    ))}

                                                    {Object.keys(filteredGroupedRenstra).length === 0 && (
                                                        <div className="px-4 py-6 text-center text-sm text-slate-400">Tidak ada hasil ditemukan</div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1.5">Pilih Rencana Strategis (Renstra) terkait untuk turunan kegiatan RKT ini</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div className="col-span-2">
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
                                <div>
                                    <label className="form-label flex gap-1">Tahun <span className="text-red-500">*</span></label>
                                    <input type="number" className="form-input" value={form.tahun} onChange={e => setForm(f => ({ ...f, tahun: Number(e.target.value) }))} required />
                                </div>
                            </div>

                            <FormInputAI label="Program" placeholder="Nama program kegiatan..." value={form.program} onChange={v => setForm(f => ({ ...f, program: v }))} />
                            <FormInputAI label="Kegiatan" placeholder="Rincian kegiatan yang akan dilaksanakan..." value={form.kegiatan} onChange={v => setForm(f => ({ ...f, kegiatan: v }))} />

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="form-label">Target Capaian</label>
                                    <input type="text" className="form-input" value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))} placeholder="Contoh: 100%" />
                                </div>
                                <div>
                                    <label className="form-label">Realisasi Capaian</label>
                                    <input type="text" className="form-input" value={form.realisasi} onChange={e => setForm(f => ({ ...f, realisasi: e.target.value }))} placeholder="Contoh: 85%" />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="form-label">Triwulan Pelaksanaan</label>
                                    <select className="form-input" value={form.triwulan} onChange={e => setForm(f => ({ ...f, triwulan: e.target.value }))}>
                                        <option value="TW1">Triwulan 1</option>
                                        <option value="TW2">Triwulan 2</option>
                                        <option value="TW3">Triwulan 3</option>
                                        <option value="TW4">Triwulan 4</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="form-label">Status</label>
                                    <select className="form-input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                                        <option value="Belum Mulai">Belum Mulai</option>
                                        <option value="Berjalan">Berjalan</option>
                                        <option value="Selesai">Selesai</option>
                                        <option value="Terlambat">Terlambat</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="form-label">Penanggung Jawab</label>
                                    <input type="text" className="form-input" value={form.penanggung_jawab} onChange={e => setForm(f => ({ ...f, penanggung_jawab: e.target.value }))} placeholder="Nama PIC" />
                                </div>
                            </div>

                            <div>
                                <label className="form-label">Anggaran (Rp)</label>
                                <input type="text" className="form-input" value={form.anggaran} onChange={e => setForm(f => ({ ...f, anggaran: e.target.value }))} placeholder="Contoh: 50.000.000" />
                            </div>

                            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                                <button type="button" className="btn-secondary px-6" onClick={() => setShowModal(false)}>Batal</button>
                                <button type="submit" className="btn-primary px-6" disabled={saving}>
                                    {saving ? <><Loader2 size={16} className="animate-spin mr-2" /><span>Menyimpan...</span></> : <><Save size={16} className="mr-2" /><span>Simpan Kegiatan</span></>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
