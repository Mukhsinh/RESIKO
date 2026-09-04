'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAppSettings } from '@/hooks/useAppSettings';
import { useUserProfile } from '@/hooks/useUserProfile';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { type ManajemenRisiko } from '@/lib/supabase';
import { PageHeader, ScoreCard, FilterBar, TopActionBar } from '@/components/SharedUI';
import DataTable, { type Column } from '@/components/DataTable';
import FormInputAI from '@/components/FormInputAI';
import { Plus, ClipboardList, CheckCircle2, Clock, AlertTriangle, Save, X, Loader2, Download, Search, RotateCcw } from 'lucide-react';

const CURRENT_YEAR = new Date().getFullYear();

interface Penanganan {
    id: string;
    manajemen_risiko_id: string;
    unit_kerja_id: string;
    tahun: number;
    jenis_penanganan: string;
    rencana_aksi: string;
    penanggung_jawab: string;
    target_selesai: string;
    status: string;
    progres: number;
    created_at: string;
    risiko?: { identifikasi_risiko: string; skor_risiko?: number; kode_risiko?: string };
    manajemen_risiko?: { identifikasi_risiko: string; skor_risiko?: number; kode_risiko?: string };
    unit_kerja?: { id?: string; nama_unit: string };
}

interface RisikoItem {
    id: string;
    kode_risiko: string;
    identifikasi_risiko: string;
    unit_kerja_id?: string;
    unit_name?: string;
}

interface Form {
    manajemen_risiko_id: string; unit_kerja_id: string; tahun: number;
    jenis_penanganan: string; rencana_aksi: string; penanggung_jawab: string;
    target_selesai: string; status: string; progres: number;
}

const defaultForm: Form = {
    manajemen_risiko_id: '', unit_kerja_id: '', tahun: CURRENT_YEAR,
    jenis_penanganan: 'Mitigasi', rencana_aksi: '', penanggung_jawab: '',
    target_selesai: '', status: 'Belum Mulai', progres: 0,
};

const STATUS_COLORS: Record<string, string> = {
    'Selesai': 'badge-green', 'Berjalan': 'badge-blue',
    'Terlambat': 'badge-red', 'Belum Mulai': 'badge-gray',
};

export default function PenangananRisikoPage() {
    const { settings } = useAppSettings();
    const { profile, isManager, isAuditor, validUnitIds, isMatchUnit } = useUserProfile();
    const [data, setData] = useState<Penanganan[]>([]);
    const [risikoList, setRisikoList] = useState<RisikoItem[]>([]);
    const [units, setUnits] = useState<{ id: string; nama_unit: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState(false);
    const [search, setSearch] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUnitId, setSelectedUnitId] = useState('');
    const [year, setYear] = useState(String(CURRENT_YEAR));
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState<Form>(defaultForm);
    const [saving, setSaving] = useState(false);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSearchQuery(search);
    };

    const handleResetFilters = () => {
        setSearch('');
        setSearchQuery('');
        setSelectedUnitId('');
        setYear(String(CURRENT_YEAR));
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
            doc.text('LAPORAN PENANGANAN RISIKO', pageWidth / 2, pageHeight / 2 - 60, { align: 'center' });
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
            doc.text('A. Rencana Aksi dan Mitigasi Penanganan Risiko', 40, 140);

            let finalY = 160;
            let rowIdx = 1;

            const tableData = filtered.map(r => {
                const unit_name = r.unit_kerja?.nama_unit ?? '-';
                const target = r.target_selesai ? new Date(r.target_selesai).toLocaleDateString('id-ID') : '-';

                return [
                    rowIdx++,
                    unit_name,
                    r.risiko?.identifikasi_risiko ?? '-',
                    r.jenis_penanganan,
                    r.rencana_aksi,
                    r.penanggung_jawab || '-',
                    target,
                    `${r.progres}%`,
                    r.status
                ];
            });

            autoTable(doc, {
                startY: finalY,
                head: [['No', 'Unit', 'Pernyataan Risiko', 'Jenis', 'Rencana Aksi', 'PJ', 'Target', 'Progres', 'Status']],
                body: tableData,
                theme: 'grid',
                headStyles: { fillColor: rgbColor, fontSize: 8, fontStyle: 'bold' },
                styles: { fontSize: 8, cellPadding: 4 },
                columnStyles: {
                    0: { cellWidth: 20, halign: 'center' },
                    1: { cellWidth: 65 },
                    2: { cellWidth: 100 },
                    3: { cellWidth: 50, halign: 'center' },
                    4: { cellWidth: 110 },
                    5: { cellWidth: 55 },
                    6: { cellWidth: 45, halign: 'center' },
                    7: { cellWidth: 35, halign: 'center' },
                    8: { cellWidth: 35, halign: 'center' }
                },
                margin: { left: 40, right: 40 },
                didDrawPage: () => {
                    const currentPage = doc.getCurrentPageInfo().pageNumber;
                    if (currentPage > contentPageStart) {
                        addHeader(doc, 'Laporan Penanganan Risiko');
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
            doc.text('1. Rencana Aksi dan Mitigasi Penanganan Risiko', 40, 140);
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
            doc.save(`Laporan_Penanganan_Risiko_${year || 'Semua'}.pdf`);
        } catch (e) {
            console.error(e);
            alert('Gagal mengunduh laporan PDF');
        } finally {
            setDownloading(false);
        }
    };

    const riskMap = React.useMemo(() => {
        const map = new Map<string, { identifikasi_risiko: string; kode_risiko: string }>();
        risikoList.forEach(r => {
            map.set(r.id, { identifikasi_risiko: r.identifikasi_risiko, kode_risiko: r.kode_risiko });
        });
        return map;
    }, [risikoList]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        let query = supabase.from('penanganan_risiko').select('*, unit_kerja(id, nama_unit), manajemen_risiko(identifikasi_risiko, skor_risiko, kode_risiko)');
        if (year) query = query.eq('tahun', Number(year));

        const { data: res } = await query;
        if (res) {
            setData((res as unknown as Penanganan[]).map(d => ({ ...d, risiko: d.manajemen_risiko })) || []);
        }
        setLoading(false);
    }, [year, isManager, validUnitIds]);

    useEffect(() => {
        fetchData();
        supabase.from('unit_kerja').select('id, nama_unit').order('nama_unit', { ascending: true }).then(({ data }: { data: any }) => setUnits(data || []));

        // Fetch ALL identified risks from risk_inputs (the main table for /risiko/identifikasi)
        supabase
            .from('risk_inputs')
            .select('id, kode_risiko, nama_risiko, identifikasi_deskripsi, nama_unit_kerja_id, master_work_units(id, name)')
            .range(0, 4999)
            .then(({ data: riData }: { data: any }) => {
                const formatted = (riData || []).map((r: any) => ({
                    id: r.id,
                    kode_risiko: r.kode_risiko,
                    identifikasi_risiko: r.nama_risiko || r.identifikasi_deskripsi || '',
                    unit_kerja_id: r.nama_unit_kerja_id,
                    unit_name: r.master_work_units?.name || '',
                }));
                setRisikoList(formatted);
            });
    }, [fetchData]);

    const filtered = React.useMemo(() => {
        return data.filter(d => {
            if (selectedUnitId && d.unit_kerja_id !== selectedUnitId && d.unit_kerja?.id !== selectedUnitId) {
                return false;
            }
            const q = (searchQuery || search).toLowerCase().trim();
            if (q) {
                const match =
                    (d.rencana_aksi || '').toLowerCase().includes(q) ||
                    (d.penanggung_jawab || '').toLowerCase().includes(q) ||
                    (d.jenis_penanganan || '').toLowerCase().includes(q) ||
                    (d.status || '').toLowerCase().includes(q) ||
                    (d.risiko?.identifikasi_risiko || '').toLowerCase().includes(q) ||
                    (d.unit_kerja?.nama_unit || '').toLowerCase().includes(q);
                if (!match) return false;
            }
            return true;
        });
    }, [data, selectedUnitId, search, searchQuery]);

    const selesai = filtered.filter(d => d.status === 'Selesai').length;
    const berjalan = filtered.filter(d => d.status === 'Berjalan').length;
    const terlambat = filtered.filter(d => d.status === 'Terlambat').length;

    const selectedUnitObj = units.find(u => u.id === form.unit_kerja_id);
    const selectedUnitName = selectedUnitObj?.nama_unit || '';

    const cleanUnitName = (str: string) =>
        (str || '').toLowerCase().replace(/^(unit|instalasi|ruang|pelayanan|bagian|sub\s+bagian)\s+/i, '').trim();

    const filteredRisiko = (form.unit_kerja_id
        ? risikoList.filter(r => {
            if (!r.unit_kerja_id && !r.unit_name) return true;
            if (r.unit_kerja_id === form.unit_kerja_id) return true;
            if (selectedUnitName && r.unit_name) {
                const cleanSelected = cleanUnitName(selectedUnitName);
                const cleanRiskUnit = cleanUnitName(r.unit_name);
                if (cleanSelected && cleanRiskUnit && (cleanSelected.includes(cleanRiskUnit) || cleanRiskUnit.includes(cleanSelected))) {
                    return true;
                }
            }
            return false;
        })
        : risikoList
    ).sort((a, b) => {
        const codeA = a.kode_risiko || '';
        const codeB = b.kode_risiko || '';
        if (codeA && codeB) {
            return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
        }
        if (codeA) return -1;
        if (codeB) return 1;
        const nameA = a.identifikasi_risiko || '';
        const nameB = b.identifikasi_risiko || '';
        return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
    });

    const openAdd = () => {
        setEditId(null);
        setForm({
            ...defaultForm,
            unit_kerja_id: isManager && profile?.unit_kerja_id ? profile.unit_kerja_id : '',
        });
        setShowModal(true);
    };
    const openEdit = (row: Penanganan) => {
        setEditId(row.id);
        setForm({ manajemen_risiko_id: row.manajemen_risiko_id, unit_kerja_id: row.unit_kerja_id, tahun: row.tahun, jenis_penanganan: row.jenis_penanganan, rencana_aksi: row.rencana_aksi, penanggung_jawab: row.penanggung_jawab, target_selesai: row.target_selesai ?? '', status: row.status, progres: row.progres });
        setShowModal(true);
    };
    const handleDelete = async (row: Penanganan) => {
        if (!confirm('Hapus rencana penanganan ini?')) return;
        await supabase.from('penanganan_risiko').delete().eq('id', row.id);
        fetchData();
    };
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault(); setSaving(true);
        const { ...payload } = form;
        if (editId) { await supabase.from('penanganan_risiko').update(payload).eq('id', editId); }
        else { await supabase.from('penanganan_risiko').insert(payload); }
        setSaving(false); setShowModal(false); fetchData();
    };

    const columns: Column<Penanganan>[] = [
        {
            key: 'risiko',
            label: 'Risiko',
            render: r => {
                const riskObj = r.risiko?.identifikasi_risiko ? r.risiko : riskMap.get(r.manajemen_risiko_id);
                const code = riskObj?.kode_risiko;
                const text = riskObj?.identifikasi_risiko ?? '-';
                return <span className="line-clamp-2 text-xs">{code ? `[${code}] ` : ''}{text}</span>;
            }
        },
        { key: 'unit_kerja_id', label: 'Unit', render: r => r.unit_kerja?.nama_unit ?? '-' },
        { key: 'jenis_penanganan', label: 'Jenis', className: 'text-center' },
        { key: 'rencana_aksi', label: 'Rencana Aksi', render: r => <span className="line-clamp-2">{r.rencana_aksi}</span> },
        { key: 'penanggung_jawab', label: 'PJ' },
        { key: 'target_selesai', label: 'Target', render: r => r.target_selesai ? new Date(r.target_selesai).toLocaleDateString('id-ID') : '-' },
        {
            key: 'progres', label: 'Progres', render: r => (
                <div className="flex items-center gap-2">
                    <div className="flex-1 bg-slate-100 rounded-full h-1.5 min-w-[60px]">
                        <div className="bg-[#137fec] h-1.5 rounded-full" style={{ width: `${r.progres}%` }} />
                    </div>
                    <span className="text-xs text-slate-500 shrink-0">{r.progres}%</span>
                </div>
            )
        },
        { key: 'status', label: 'Status', render: r => <span className={STATUS_COLORS[r.status] ?? 'badge-gray'}>{r.status}</span> },
    ];

    return (
        <div>
            <PageHeader title="Penanganan Risiko" subtitle="Rencana aksi dan mitigasi untuk setiap risiko yang teridentifikasi." />

            <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
                <ScoreCard icon={<ClipboardList size={22} className="text-[#137fec]" />} title="Total Rencana" value={filtered.length} colorClass="bg-blue-50 border-blue-100" />
                <ScoreCard icon={<CheckCircle2 size={22} className="text-emerald-500" />} title="Selesai" value={selesai} colorClass="bg-emerald-50 border-emerald-100" />
                <ScoreCard icon={<Clock size={22} className="text-amber-500" />} title="Berjalan" value={berjalan} colorClass="bg-amber-50 border-amber-100" />
                <ScoreCard icon={<AlertTriangle size={22} className="text-rose-500" />} title="Terlambat" value={terlambat} colorClass="bg-rose-50 border-rose-100" />
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <TopActionBar
                    filters={
                        <div className="flex flex-wrap items-center gap-3">
                            <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input
                                        type="text"
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                        placeholder="Cari rencana aksi / PJ..."
                                        className="pl-9 pr-4 h-10 bg-slate-50 border border-slate-200 rounded-xl text-xs w-52 sm:w-60 focus:outline-none focus:ring-2 focus:ring-[#137fec]/40 focus:border-transparent transition-all"
                                    />
                                </div>
                                <button type="submit" className="h-10 px-3.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer">
                                    <Search size={14} />
                                    <span>Cari</span>
                                </button>
                            </form>

                            <select
                                value={selectedUnitId}
                                onChange={e => setSelectedUnitId(e.target.value)}
                                className="h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#137fec]/40"
                            >
                                <option value="">Semua Unit Kerja</option>
                                {units.map(u => <option key={u.id} value={u.id}>{u.nama_unit}</option>)}
                            </select>

                            <select
                                value={year}
                                onChange={e => setYear(e.target.value)}
                                className="h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#137fec]/40"
                            >
                                <option value="">Semua Tahun</option>
                                {[CURRENT_YEAR + 1, CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2].map(y => (
                                    <option key={y} value={String(y)}>{y}</option>
                                ))}
                            </select>

                            {(selectedUnitId || year !== String(CURRENT_YEAR) || search || searchQuery) && (
                                <button
                                    type="button"
                                    onClick={handleResetFilters}
                                    className="h-10 px-3 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer"
                                >
                                    <RotateCcw size={13} />
                                    <span>Reset</span>
                                </button>
                            )}
                        </div>
                    }
                    actions={<>
                        <button className="btn-secondary" onClick={handleExportPDF} disabled={downloading}>
                            {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                            <span className="hidden sm:inline">Laporan</span>
                        </button>
                        {!isAuditor && (
                            <button className="btn-primary" onClick={openAdd}><Plus size={15} /><span>Tambah</span></button>
                        )}
                    </>}
                />
                <DataTable columns={columns} data={filtered} onEdit={isAuditor ? undefined : openEdit} onDelete={isAuditor ? undefined : handleDelete} onView={openEdit} isLoading={loading} />
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <h3 className="text-base font-bold text-slate-800">{editId ? 'Edit' : 'Tambah'} Penanganan Risiko</h3>
                            <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="form-label">Unit Kerja *</label>
                                    <select
                                        className="form-input"
                                        value={form.unit_kerja_id}
                                        onChange={e => {
                                            const newUnit = e.target.value;
                                            setForm(f => ({ ...f, unit_kerja_id: newUnit, manajemen_risiko_id: '' }));
                                        }}
                                        required
                                    >
                                        <option value="">-- Pilih Unit --</option>
                                        {units.map(u => <option key={u.id} value={u.id}>{u.nama_unit}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="form-label">Risiko Terkait *</label>
                                    <select
                                        className="form-input"
                                        value={form.manajemen_risiko_id}
                                        onChange={e => {
                                            const newMR = e.target.value;
                                            setForm(f => ({
                                                ...f,
                                                manajemen_risiko_id: newMR
                                            }));
                                        }}
                                        required
                                        disabled={!form.unit_kerja_id}
                                    >
                                        <option value="">{form.unit_kerja_id ? '-- Pilih Risiko --' : '-- Pilih Unit Dahulu --'}</option>
                                        {filteredRisiko.map(r => (
                                            <option key={r.id} value={r.id}>
                                                {r.kode_risiko ? `[${r.kode_risiko}] ` : ''}{r.identifikasi_risiko}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="form-label">Tahun</label>
                                    <input type="number" className="form-input" value={form.tahun} onChange={e => setForm(f => ({ ...f, tahun: Number(e.target.value) }))} required />
                                </div>
                                <div>
                                    <label className="form-label">Jenis</label>
                                    <select className="form-input" value={form.jenis_penanganan} onChange={e => setForm(f => ({ ...f, jenis_penanganan: e.target.value }))}>
                                        <option>Mitigasi</option><option>Transfer</option><option>Toleransi</option><option>Eliminasi</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="form-label">Target Selesai</label>
                                    <input type="date" className="form-input" value={form.target_selesai} onChange={e => setForm(f => ({ ...f, target_selesai: e.target.value }))} />
                                </div>
                            </div>
                            <FormInputAI label="Rencana Aksi / Tindakan" placeholder="Langkah-langkah penanganan risiko secara konkret..." value={form.rencana_aksi} onChange={v => setForm(f => ({ ...f, rencana_aksi: v }))} />
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="form-label">Penanggung Jawab</label>
                                    <input type="text" className="form-input" value={form.penanggung_jawab} onChange={e => setForm(f => ({ ...f, penanggung_jawab: e.target.value }))} />
                                </div>
                                <div>
                                    <label className="form-label">Status</label>
                                    <select className="form-input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                                        <option>Belum Mulai</option><option>Berjalan</option><option>Selesai</option><option>Terlambat</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="form-label">Progres (%)</label>
                                    <input type="number" min="0" max="100" className="form-input" value={form.progres} onChange={e => setForm(f => ({ ...f, progres: Number(e.target.value) }))} />
                                </div>
                            </div>
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
