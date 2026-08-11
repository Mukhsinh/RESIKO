'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAppSettings } from '@/hooks/useAppSettings';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PageHeader, FilterBar, TopActionBar } from '@/components/SharedUI';
import DataTable, { type Column } from '@/components/DataTable';
import { Download, FileText, Filter, Eye, X, Loader2 } from 'lucide-react';

/* ─── Types ─── */
interface RiskRegisterRow {
    id: string;
    unit_kerja_id?: string;
    tahun: number;
    kode_risiko?: string;
    identifikasi_risiko: string;
    probabilitas?: number;
    dampak?: number;
    skor_risiko?: number;
    mitigasi?: string;
    rencana_penanganan?: string;
    p_residual?: number;
    d_residual?: number;
    status: string;
    created_at: string;
    unit_kerja?: { id: string; nama_unit: string };
}

interface WorkUnit { id: string; nama_unit: string; }

/* ─── Helpers ─── */
function StatusBadge({ status }: { status: string }) {
    const map: Record<string, string> = {
        Open: 'badge-red', Monitoring: 'badge-amber', 'Mitigasi Berjalan': 'badge-blue', Closed: 'badge-green',
    };
    return <span className={map[status] ?? 'badge-gray'}>{status}</span>;
}

function RiskScoreBadge({ score }: { score: number }) {
    if (score >= 15) return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">Sangat Tinggi ({score})</span>;
    if (score >= 10) return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">Tinggi ({score})</span>;
    if (score >= 5) return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">Sedang ({score})</span>;
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">Rendah ({score})</span>;
}

/* ─── View Modal ─── */
function ViewModal({ row, onClose }: { row: RiskRegisterRow; onClose: () => void }) {
    const skor = row.skor_risiko ?? (row.probabilitas ?? 0) * (row.dampak ?? 0);
    const p_res = row.p_residual ?? Math.ceil((row.probabilitas ?? 0) * 0.5);
    const d_res = row.d_residual ?? Math.ceil((row.dampak ?? 0) * 0.8);
    const skor_res = p_res * d_res;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl my-8">
                <div className="flex justify-between items-center p-6 border-b border-slate-100">
                    <h2 className="font-bold text-slate-800 text-lg">Detail Risk Register</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"><X size={18} /></button>
                </div>
                <div className="p-6 space-y-4 text-sm">
                    <div className="grid grid-cols-2 gap-4">
                        <div><span className="text-xs text-slate-400">Unit Kerja</span><p className="font-semibold mt-0.5">{row.unit_kerja?.nama_unit ?? '-'}</p></div>
                        <div><span className="text-xs text-slate-400">Tahun</span><p className="font-semibold mt-0.5">{row.tahun}</p></div>
                        {row.kode_risiko && <div><span className="text-xs text-slate-400">Kode Risiko</span><p className="font-mono font-semibold mt-0.5">{row.kode_risiko}</p></div>}
                        <div><span className="text-xs text-slate-400">Status</span><div className="mt-1"><StatusBadge status={row.status} /></div></div>
                    </div>
                    <div><span className="text-xs text-slate-400">Pernyataan Risiko</span><p className="font-medium mt-0.5 leading-relaxed">{row.identifikasi_risiko}</p></div>

                    <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                            <p className="text-xs text-slate-500">Inherent</p>
                            <p className="text-2xl font-extrabold text-rose-600 mt-1">{skor}</p>
                            <p className="text-xs text-slate-400">P:{row.probabilitas} × D:{row.dampak}</p>
                        </div>
                        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                            <p className="text-xs text-slate-500">Residual</p>
                            <p className="text-2xl font-extrabold text-emerald-600 mt-1">{skor_res}</p>
                            <p className="text-xs text-slate-400">P:{p_res} × D:{d_res}</p>
                        </div>
                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                            <p className="text-xs text-slate-500">Reduksi</p>
                            <p className="text-2xl font-extrabold text-blue-600 mt-1">
                                {skor > 0 ? Math.round((1 - skor_res / skor) * 100) : 0}%
                            </p>
                        </div>
                    </div>

                    {row.mitigasi && <div><span className="text-xs text-slate-400">Mitigasi</span><p className="mt-0.5 text-slate-600 leading-relaxed">{row.mitigasi}</p></div>}
                    {row.rencana_penanganan && <div><span className="text-xs text-slate-400">Rencana Penanganan</span><p className="mt-0.5 text-slate-600 leading-relaxed">{row.rencana_penanganan}</p></div>}
                </div>
                <div className="flex justify-end px-6 pb-6"><button onClick={onClose} className="btn-secondary">Tutup</button></div>
            </div>
        </div>
    );
}

/* ─── Main Page ─── */
export default function RiskRegisterPage() {
    const [rows, setRows] = useState<RiskRegisterRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState(false);
    const [search, setSearch] = useState('');
    const [year, setYear] = useState(String(new Date().getFullYear()));
    const [unitFilter, setUnitFilter] = useState('');
    const [units, setUnits] = useState<WorkUnit[]>([]);
    const [viewRow, setViewRow] = useState<RiskRegisterRow | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            let q = supabase
                .from('manajemen_risiko')
                .select('*, unit_kerja(id, nama_unit)')
                .order('skor_risiko', { ascending: false });
            if (year) q = q.eq('tahun', Number(year));
            const { data, error } = await q;
            if (error) { console.error('Error fetching risk register:', error); setRows([]); }
            else setRows((data as RiskRegisterRow[]) ?? []);
        } catch (e) { console.error(e); setRows([]); }
        finally { setLoading(false); }
    }, [year]);

    useEffect(() => { fetchData(); }, [fetchData]);

    useEffect(() => {
        supabase.from('unit_kerja').select('id, nama_unit').then(({ data }: { data: any }) => setUnits((data ?? []) as WorkUnit[]));
    }, []);

    const filtered = rows.filter(d => {
        const matchSearch = d.identifikasi_risiko.toLowerCase().includes(search.toLowerCase()) ||
            (d.kode_risiko || '').toLowerCase().includes(search.toLowerCase());
        const matchUnit = unitFilter ? d.unit_kerja_id === unitFilter : true;
        return matchSearch && matchUnit;
    });

    const { settings } = useAppSettings();

    const handleUnduhLaporan = async () => {
        setDownloading(true);
        try {
            const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
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
                d.line(40, 40, pageWidth - 40, 40);

                d.setTextColor(71, 85, 105);
                d.setFontSize(8);
                d.setFont('helvetica', 'bold');
                d.text((settings?.nama_rs || 'RUMAH SAKIT').toUpperCase(), 40, 32);

                d.setTextColor(148, 163, 184);
                d.setFont('helvetica', 'normal');
                d.text(title, pageWidth - 40, 32, { align: 'right' });
            };

            const addFooter = (d: jsPDF) => {
                const totalPages = d.getNumberOfPages();
                for (let i = 1; i <= totalPages; i++) {
                    d.setPage(i);
                    if (i === 1) continue;
                    d.setTextColor(148, 163, 184);
                    d.setFontSize(8);
                    d.setFont('helvetica', 'normal');
                    d.text(settings?.footer || 'Laporan Internal Rumah Sakit', 40, pageHeight - 25);
                    d.text(`Halaman ${i - 1} dari ${totalPages - 1}`, pageWidth - 40, pageHeight - 25, { align: 'right' });
                    d.setDrawColor(226, 232, 240);
                    d.setLineWidth(0.75);
                    d.line(40, pageHeight - 35, pageWidth - 40, pageHeight - 35);
                }
            };

            const drawKopSurat = (d: jsPDF) => {
                d.setDrawColor(30, 41, 59);
                d.setLineWidth(1.5);
                d.line(40, 95, pageWidth - 40, 95);
                d.setLineWidth(0.5);
                d.line(40, 98, pageWidth - 40, 98);

                d.setTextColor(30, 41, 59);
                d.setFont('helvetica', 'bold');
                d.setFontSize(14);
                d.text((settings?.nama_rs || 'RUMAH SAKIT').toUpperCase(), 40, 45);

                d.setFont('helvetica', 'normal');
                d.setFontSize(9);
                d.setTextColor(71, 85, 105);
                d.text(settings?.alamat || '', 40, 60);
                d.text(`Kota: ${settings?.kota || '-'} | Telp: ${settings?.telepon || '-'} | Email: ${settings?.email || '-'} | Web: ${settings?.website || '-'}`, 40, 74);

                if (settings?.tagline) {
                    d.setFont('helvetica', 'italic');
                    d.setFontSize(8);
                    d.text(`"${settings.tagline}"`, 40, 86);
                }
            };

            // Cover Page
            doc.setFillColor(rgbColor[0], rgbColor[1], rgbColor[2]);
            doc.rect(0, 0, pageWidth, pageHeight, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(24);
            doc.setFont('helvetica', 'bold');
            doc.text('LAPORAN RISK REGISTER', pageWidth / 2, pageHeight / 2 - 40, { align: 'center' });
            doc.setFontSize(16);
            doc.setFont('helvetica', 'normal');
            doc.text(`Tahun: ${year || 'Semua'}`, pageWidth / 2, pageHeight / 2 + 10, { align: 'center' });
            doc.setFontSize(12);
            doc.text((settings?.nama_rs || 'RUMAH SAKIT').toUpperCase(), pageWidth / 2, pageHeight / 2 + 60, { align: 'center' });

            doc.addPage();
            let tocPageNum = doc.getCurrentPageInfo().pageNumber;
            doc.addPage();
            let contentPageStart = doc.getCurrentPageInfo().pageNumber;

            drawKopSurat(doc);

            doc.setTextColor(30, 41, 59);
            doc.setFontSize(13);
            doc.setFont('helvetica', 'bold');
            doc.text('A. Daftar Risiko Terintegrasi (Risk Register)', 40, 120);

            let finalY = 135;
            let rowIdx = 1;

            const tableData = filtered.map(r => {
                const skor = r.skor_risiko ?? (r.probabilitas ?? 0) * (r.dampak ?? 0);
                const p_res = r.p_residual ?? Math.ceil((r.probabilitas ?? 0) * 0.5);
                const d_res = r.d_residual ?? Math.ceil((r.dampak ?? 0) * 0.8);
                const skor_res = p_res * d_res;
                const unit_name = r.unit_kerja?.nama_unit ?? '-';

                return [
                    rowIdx++,
                    r.tahun,
                    unit_name,
                    r.kode_risiko ?? '-',
                    r.identifikasi_risiko,
                    `Skor: ${skor} (P:${r.probabilitas ?? '-'} D:${r.dampak ?? '-'})`,
                    `Skor: ${skor_res} (P:${p_res} D:${d_res})`,
                    r.mitigasi || r.rencana_penanganan || '-',
                    r.status ?? 'Open'
                ];
            });

            autoTable(doc, {
                startY: finalY,
                head: [['No', 'Tahun', 'Unit Kerja', 'Kode', 'Pernyataan Risiko', 'Inherent Risk', 'Residual Risk', 'Rencana Mitigasi', 'Status']],
                body: tableData,
                theme: 'grid',
                headStyles: { fillColor: rgbColor, fontSize: 8, fontStyle: 'bold' },
                styles: { fontSize: 8, cellPadding: 4 },
                columnStyles: {
                    0: { cellWidth: 25, halign: 'center' },
                    1: { cellWidth: 35, halign: 'center' },
                    2: { cellWidth: 90 },
                    3: { cellWidth: 50 },
                    4: { cellWidth: 150 },
                    5: { cellWidth: 80 },
                    6: { cellWidth: 80 },
                    7: { cellWidth: 170 },
                    8: { cellWidth: 50, halign: 'center' }
                },
                margin: { left: 40, right: 40 },
                didDrawPage: () => {
                    const currentPage = doc.getCurrentPageInfo().pageNumber;
                    if (currentPage > contentPageStart) {
                        addHeader(doc, 'Laporan Risk Register');
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
            doc.text('DAFTAR ISI LAPORAN', 40, 80);

            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(1);
            doc.line(40, 92, pageWidth - 40, 92);

            doc.setFontSize(10.5);
            doc.setFont('helvetica', 'normal');
            doc.text('1. Daftar Risiko Terintegrasi (Risk Register)', 40, 120);
            doc.text(`${contentPageStart - 1}`, pageWidth - 40, 120, { align: 'right' });

            doc.text('2. Lembar Tanda Tangan Pengesahan Laporan', 40, 140);
            const lastPage = doc.getNumberOfPages();
            doc.text(`${lastPage - 1}`, pageWidth - 40, 140, { align: 'right' });

            // Signature block on last page
            doc.setPage(lastPage);
            if (finalY > pageHeight - 130) {
                doc.addPage();
                finalY = 60;
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
            doc.line(60, finalY + 60, 220, finalY + 60);

            doc.text(`${kota}, ${tgl}`, pageWidth - 220, finalY);
            doc.text('Disetujui oleh,', pageWidth - 220, finalY + 14);
            doc.setFont('helvetica', 'bold');
            doc.text(settings?.kepala_rs || 'Kepala / Direktur RS', pageWidth - 220, finalY + 28);
            doc.line(pageWidth - 220, finalY + 60, pageWidth - 60, finalY + 60);
            doc.setFont('helvetica', 'normal');
            doc.text(`NIP: ${settings?.nip_kepala || '-'}`, pageWidth - 220, finalY + 72);

            addFooter(doc);
            doc.save(`Laporan_Risk_Register_${year || 'Semua'}.pdf`);
        } catch (e) {
            console.error(e);
            alert('Gagal mengunduh laporan PDF');
        } finally {
            setDownloading(false);
        }
    };

    // Extensive columns for a full Register view — using unique keys per column
    const columns: Column<RiskRegisterRow>[] = [
        { key: 'tahun', label: 'Tahun', className: 'w-16' },
        { key: 'unit_kerja_id', label: 'Unit / Pemilik Risiko', render: r => (r as any).unit_kerja?.nama_unit ?? '-' },
        {
            key: 'identifikasi_risiko', label: 'Pernyataan Risiko', className: 'min-w-[200px]',
            render: r => (
                <div>
                    {r.kode_risiko && <span className="text-xs font-mono text-slate-400 block">{r.kode_risiko}</span>}
                    <span className="line-clamp-3">{r.identifikasi_risiko}</span>
                </div>
            )
        },
        { key: 'probabilitas', label: 'P Inh', className: 'text-center text-slate-500', render: r => String(r.probabilitas ?? '-') },
        { key: 'dampak', label: 'D Inh', className: 'text-center text-slate-500', render: r => String(r.dampak ?? '-') },
        {
            key: 'skor_risiko', label: 'Inherent', className: 'text-center',
            render: r => <RiskScoreBadge score={r.skor_risiko ?? (r.probabilitas ?? 0) * (r.dampak ?? 0)} />
        },
        {
            key: 'mitigasi', label: 'Rencana Mitigasi', className: 'min-w-[200px]',
            render: r => <span className="line-clamp-2 text-slate-600 italic text-xs">{r.mitigasi ?? 'Belum ada mitigasi'}</span>
        },
        {
            key: 'p_residual', label: 'P Res', className: 'text-center text-emerald-600',
            render: r => String(r.p_residual ?? Math.ceil((r.probabilitas ?? 0) * 0.5))
        },
        {
            key: 'd_residual', label: 'D Res', className: 'text-center text-emerald-600',
            render: r => String(r.d_residual ?? Math.ceil((r.dampak ?? 0) * 0.8))
        },
        {
            key: 'rencana_penanganan', label: 'Residual', className: 'text-center',
            render: r => {
                const res = (r.p_residual ?? Math.ceil((r.probabilitas ?? 0) * 0.5)) * (r.d_residual ?? Math.ceil((r.dampak ?? 0) * 0.8));
                return <RiskScoreBadge score={res} />;
            }
        },
        { key: 'status', label: 'Status', render: r => <StatusBadge status={r.status} /> },
        {
            key: 'actions', label: 'Aksi', render: r => (
                <div className="flex gap-1 justify-center">
                    <button title="Lihat detail" className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded" onClick={() => setViewRow(r)}><Eye size={15} /></button>
                </div>
            )
        },
    ];

    return (
        <div>
            {viewRow && <ViewModal row={viewRow} onClose={() => setViewRow(null)} />}

            <PageHeader title="Risk Register (Daftar Risiko)" subtitle="Kumpulan komprehensif seluruh data profil risiko terintegrasi." />

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-8">
                <TopActionBar
                    filters={
                        <div className="flex flex-wrap gap-3 items-center">
                            <FilterBar
                                searchValue={search} onSearchChange={setSearch} searchPlaceholder="Cari risk register..."
                                yearValue={year} onYearChange={setYear}
                            />
                            <select className="form-select text-sm h-9" value={unitFilter} onChange={e => setUnitFilter(e.target.value)}>
                                <option value="">Semua Unit</option>
                                {units.map(u => <option key={u.id} value={u.id}>{u.nama_unit}</option>)}
                            </select>
                        </div>
                    }
                    actions={
                        <>
                            <button className="btn-secondary flex items-center gap-2" onClick={() => alert('Fitur advanced filter')}>
                                <Filter size={15} /><span className="hidden sm:inline">Filter Lanjutan</span>
                            </button>
                            <button
                                className="btn-primary flex items-center gap-2"
                                onClick={handleUnduhLaporan}
                                disabled={downloading}
                            >
                                {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                                <span>Unduh Laporan</span>
                            </button>
                        </>
                    }
                />

                {/* Wrap in horizontal scroll for large tables */}
                <div className="w-full overflow-x-auto">
                    <DataTable columns={columns} data={filtered} isLoading={loading} />
                </div>
            </div>

            <div className="text-right text-sm text-slate-500 mt-4 mr-2">
                Menampilkan {filtered.length} dari {rows.length} baris Risk Register · Tahun {year}
            </div>
        </div>
    );
}
