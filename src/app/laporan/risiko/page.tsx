'use client';

import React, { useEffect, useState } from 'react';
import { supabase, type ManajemenRisiko } from '@/lib/supabase';
import { PageHeader, ScoreCard } from '@/components/SharedUI';
import { ShieldAlert, AlertTriangle, CheckCircle2, BarChart2, Download, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { useAppSettings } from '@/hooks/useAppSettings';

const CURRENT_YEAR = new Date().getFullYear();

export default function LaporanRisikoPage() {
    const [data, setData] = useState<ManajemenRisiko[]>([]);
    const [year, setYear] = useState(String(CURRENT_YEAR));
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        try {
            let q = supabase.from('manajemen_risiko').select('*, unit_kerja(nama_unit)').order('skor_risiko', { ascending: false });
            if (year) q = q.eq('tahun', Number(year));
            q.then(({ data: rows, error }: { data: any; error: any }) => {
                if (error) {
                    console.error('Error fetching laporan risiko:', error);
                    setData([]);
                } else {
                    setData((rows as ManajemenRisiko[]) ?? []);
                }
                setLoading(false);
            });
        } catch (err) {
            console.error('Error:', err);
            setData([]);
            setLoading(false);
        }
    }, [year]);

    const avg = data.length ? (data.reduce((s, r) => s + r.skor_risiko, 0) / data.length).toFixed(1) : '0';
    const sangat_tinggi = data.filter(r => r.skor_risiko >= 15).length;
    const closed = data.filter(r => r.status === 'Closed').length;

    const byUnit = Object.entries(
        data.reduce<Record<string, ManajemenRisiko[]>>((acc, r) => {
            const unit = (r.unit_kerja as { nama_unit: string })?.nama_unit ?? 'Lainnya';
            if (!acc[unit]) acc[unit] = [];
            acc[unit].push(r);
            return acc;
        }, {})
    ).sort((a, b) => {
        const avgA = a[1].reduce((s, r) => s + r.skor_risiko, 0) / a[1].length;
        const avgB = b[1].reduce((s, r) => s + r.skor_risiko, 0) / b[1].length;
        return avgB - avgA;
    });

    const LEVEL_COLORS: Record<string, string> = {
        'Sangat Tinggi (≥15)': 'bg-rose-100 text-rose-700',
        'Tinggi (10–14)': 'bg-orange-100 text-orange-700',
        'Sedang (5–9)': 'bg-amber-100 text-amber-700',
        'Rendah (<5)': 'bg-emerald-100 text-emerald-700',
    };
    const getLevel = (s: number) => s >= 15 ? 'Sangat Tinggi (≥15)' : s >= 10 ? 'Tinggi (10–14)' : s >= 5 ? 'Sedang (5–9)' : 'Rendah (<5)';

    const handleExportExcel = () => {
        const rows = data.map(r => ({
            'Tahun': r.tahun,
            'Unit Kerja': (r.unit_kerja as any)?.nama_unit || 'Lainnya',
            'Identifikasi Risiko': r.identifikasi_risiko,
            'Probabilitas': r.probabilitas,
            'Dampak': r.dampak,
            'Skor': r.skor_risiko,
            'Level': getLevel(r.skor_risiko),
            'Status': r.status,
            'Mitigasi': r.mitigasi || '-'
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Risiko");
        XLSX.writeFile(wb, `Laporan_Risiko_${year}.xlsx`);
    };

    const { settings } = useAppSettings();

    const handleExportPDF = () => {
        const doc = new jsPDF('p', 'pt', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        const hexToRgb = (hex: string): [number, number, number] => {
            const def: [number, number, number] = [244, 63, 94]; // Rose color for risks
            if (!hex) return def;
            const h = hex.replace('#', '');
            if (h.length !== 6) return def;
            const num = parseInt(h, 16);
            return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
        };

        const primaryColor = settings?.warna_primer || '#f43f5e';
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
                d.setFont('helvetica', 'oblique');
                d.setFontSize(8);
                d.text(`"${settings.tagline}"`, 40, 98);
            }
        };

        // Cover Page
        doc.setFillColor(rgbColor[0], rgbColor[1], rgbColor[2]);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');
        doc.setTextColor(255, 255, 255);

        doc.setFontSize(26);
        doc.setFont('helvetica', 'bold');
        doc.text('LAPORAN MANAJEMEN RISIKO', pageWidth / 2, pageHeight / 2 - 60, { align: 'center' });

        doc.setFontSize(18);
        doc.setFont('helvetica', 'normal');
        doc.text(`Tahun Anggaran ${year}`, pageWidth / 2, pageHeight / 2, { align: 'center' });

        doc.setFontSize(12);
        doc.text((settings?.nama_rs || 'RUMAH SAKIT').toUpperCase(), pageWidth / 2, pageHeight / 2 + 50, { align: 'center' });
        doc.text(settings?.footer || '', pageWidth / 2, pageHeight - 50, { align: 'center' });

        doc.addPage();

        // TOC Page
        let tocPageNum = doc.getCurrentPageInfo().pageNumber;
        doc.addPage(); // skip for TOC

        let contentPageStart = doc.getCurrentPageInfo().pageNumber;

        // Draw KOP Surat on first content page
        drawKopSurat(doc);

        doc.setTextColor(30, 41, 59);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('A. Daftar Identifikasi Risiko Berdasarkan Unit Kerja', 40, 140);

        let finalY = 160;

        byUnit.forEach(([unit, risks]) => {
            if (finalY > pageHeight - 120) {
                doc.addPage();
                finalY = 70;
            }

            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(51, 65, 85);
            doc.text(`Unit Kerja: ${unit}`, 40, finalY + 15);

            const tableData = risks.map(r => [
                r.identifikasi_risiko,
                String(r.probabilitas),
                String(r.dampak),
                String(r.skor_risiko),
                r.status,
                r.mitigasi || '-'
            ]);

            autoTable(doc, {
                startY: finalY + 25,
                head: [['Identifikasi Risiko', 'P', 'D', 'Skor', 'Status', 'Mitigasi']],
                body: tableData,
                theme: 'striped',
                headStyles: { fillColor: rgbColor },
                styles: { fontSize: 8 },
                columnStyles: {
                    0: { cellWidth: 150 },
                    1: { cellWidth: 25, halign: 'center' },
                    2: { cellWidth: 25, halign: 'center' },
                    3: { cellWidth: 35, halign: 'center' },
                    4: { cellWidth: 50, halign: 'center' },
                    5: { cellWidth: 150 }
                },
                margin: { left: 40, right: 40 },
                didDrawPage: (data) => {
                    const currentPage = doc.getCurrentPageInfo().pageNumber;
                    if (currentPage > contentPageStart) {
                        addHeader(doc, 'Laporan Risiko');
                    }
                }
            });
            finalY = (doc as any).lastAutoTable.finalY + 20;
        });

        // Add Signature block at the end
        if (finalY > pageHeight - 160) {
            doc.addPage();
            finalY = 70;
        } else {
            finalY += 20;
        }

        doc.setFontSize(10);
        doc.setTextColor(51, 65, 85);
        doc.setFont('helvetica', 'normal');
        doc.text('Disiapkan oleh,', 60, finalY);
        doc.text('Staff Manajemen Risiko', 60, finalY + 15);
        doc.line(60, finalY + 70, 200, finalY + 70);
        doc.text('Koordinator K3 / Mutu', 60, finalY + 85);

        doc.text('Disetujui oleh,', pageWidth - 200, finalY);
        doc.setFont('helvetica', 'bold');
        doc.text(settings?.kepala_rs || 'Pimpinan Rumah Sakit', pageWidth - 200, finalY + 15);
        doc.line(pageWidth - 200, finalY + 70, pageWidth - 60, finalY + 70);
        doc.setFont('helvetica', 'normal');
        doc.text(`NIP: ${settings?.nip_kepala || '-'}`, pageWidth - 200, finalY + 85);

        // Add TOC Content
        doc.setPage(tocPageNum);
        addHeader(doc, 'Daftar Isi');
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('DAFTAR ISI LAPORAN', 40, 100);

        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(1);
        doc.line(40, 115, pageWidth - 40, 115);

        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');

        doc.text('1. Detail Identifikasi Risiko Berdasarkan Unit Kerja', 40, 145);
        doc.text(`${contentPageStart - 1}`, pageWidth - 40, 145, { align: 'right' });

        doc.text('2. Lembar Tanda Tangan Pengesahan Laporan', 40, 165);
        const lastPage = doc.getNumberOfPages();
        doc.text(`${lastPage - 1}`, pageWidth - 40, 165, { align: 'right' });

        addFooter(doc);
        doc.save(`Laporan_Risiko_${year}.pdf`);
    };

    return (
        <div>
            <PageHeader
                title="Laporan Rekap Risiko"
                subtitle="Rekap identifikasi dan status penanganan risiko per unit kerja dan tahun anggaran."
                actions={
                    <div className="flex gap-2 flex-wrap">
                        <select className="form-input w-32" value={year} onChange={e => setYear(e.target.value)}>
                            {[CURRENT_YEAR + 1, CURRENT_YEAR, CURRENT_YEAR - 1].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <button className="btn-secondary" onClick={handleExportPDF}><FileText size={15} /><span>Export PDF</span></button>
                        <button className="btn-secondary" onClick={handleExportExcel}><Download size={15} /><span>Export Excel</span></button>
                    </div>
                }
            />

            <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
                <ScoreCard icon={<ShieldAlert size={22} className="text-slate-500" />} title="Total Risiko" value={data.length} colorClass="bg-slate-50 border-slate-100" />
                <ScoreCard icon={<AlertTriangle size={22} className="text-rose-500" />} title="Sangat Tinggi" value={sangat_tinggi} colorClass="bg-rose-50 border-rose-100" />
                <ScoreCard icon={<BarChart2 size={22} className="text-amber-500" />} title="Rata-rata Skor" value={avg} colorClass="bg-amber-50 border-amber-100" />
                <ScoreCard icon={<CheckCircle2 size={22} className="text-emerald-500" />} title="Closed" value={closed} colorClass="bg-emerald-50 border-emerald-100" />
            </div>

            {loading ? (
                <div className="card flex items-center justify-center py-16 text-slate-400">
                    <div className="animate-spin w-5 h-5 border-2 border-slate-200 border-t-[#137fec] rounded-full mr-2" />
                </div>
            ) : (
                <div className="space-y-4">
                    {byUnit.map(([unit, risks]) => {
                        const unitAvg = (risks.reduce((s, r) => s + r.skor_risiko, 0) / risks.length).toFixed(1);
                        return (
                            <div key={unit} className="card">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-bold text-slate-700">{unit}</h3>
                                    <div className="flex gap-2 text-xs">
                                        <span className="text-slate-400">{risks.length} risiko</span>
                                        <span className="text-slate-400">·</span>
                                        <span className="font-semibold text-slate-600">Rata-rata skor: {unitAvg}</span>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="border-b border-slate-100 text-slate-500">
                                                <th className="text-left pb-2 font-medium">Identifikasi Risiko</th>
                                                <th className="text-center pb-2 font-medium w-12">P</th>
                                                <th className="text-center pb-2 font-medium w-12">D</th>
                                                <th className="text-center pb-2 font-medium w-24">Level</th>
                                                <th className="text-left pb-2 font-medium w-28">Status</th>
                                                <th className="text-left pb-2 font-medium">Mitigasi</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {risks.map(r => (
                                                <tr key={r.id}>
                                                    <td className="py-2 pr-3"><span className="line-clamp-2 text-slate-700">{r.identifikasi_risiko}</span></td>
                                                    <td className="py-2 text-center text-slate-600">{r.probabilitas}</td>
                                                    <td className="py-2 text-center text-slate-600">{r.dampak}</td>
                                                    <td className="py-2 text-center">
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${LEVEL_COLORS[getLevel(r.skor_risiko)]}`}>
                                                            {r.skor_risiko}
                                                        </span>
                                                    </td>
                                                    <td className="py-2 text-slate-600">{r.status}</td>
                                                    <td className="py-2 pr-3"><span className="line-clamp-1 text-slate-500">{r.mitigasi || '-'}</span></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
