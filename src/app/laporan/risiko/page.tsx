'use client';

import React, { useEffect, useState } from 'react';
import { supabase, type ManajemenRisiko } from '@/lib/supabase';
import { PageHeader, ScoreCard } from '@/components/SharedUI';
import { ShieldAlert, AlertTriangle, CheckCircle2, BarChart2, Download, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

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
            q.then(({ data: rows, error }) => {
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

    const handleExportPDF = () => {
        const doc = new jsPDF('p', 'pt', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        const addHeader = (d: jsPDF, title: string) => {
            d.setFillColor(248, 250, 252);
            d.rect(0, 0, pageWidth, 60, 'F');
            d.setTextColor(19, 127, 236);
            d.setFontSize(16);
            d.setFont('helvetica', 'bold');
            d.text('RS ANTIGRAVITY', 40, 35);
            d.setTextColor(100, 116, 139);
            d.setFontSize(10);
            d.setFont('helvetica', 'normal');
            d.text(title, pageWidth - 40, 35, { align: 'right' });
        };
        const addFooter = (d: jsPDF) => {
            const totalPages = d.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                d.setPage(i);
                if (i === 1) continue; // skip cover
                d.setTextColor(148, 163, 184);
                d.setFontSize(9);
                d.setFont('helvetica', 'normal');
                d.text('Laporan Rahasia & Internal', 40, pageHeight - 30);
                d.text(`Halaman ${i - 1}`, pageWidth - 40, pageHeight - 30, { align: 'right' });
                d.setDrawColor(226, 232, 240);
                d.setLineWidth(1);
                d.line(40, pageHeight - 45, pageWidth - 40, pageHeight - 45);
            }
        };

        // Cover Page
        doc.setFillColor(19, 127, 236);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(28);
        doc.setFont('helvetica', 'bold');
        doc.text(`LAPORAN MANAJEMEN RISIKO`, pageWidth / 2, pageHeight / 2 - 40, { align: 'center' });
        doc.setFontSize(20);
        doc.setFont('helvetica', 'normal');
        doc.text(`Tahun ${year}`, pageWidth / 2, pageHeight / 2, { align: 'center' });
        doc.setFontSize(14);
        doc.text('RUMAH SAKIT ANTIGRAVITY', pageWidth / 2, pageHeight / 2 + 40, { align: 'center' });

        doc.addPage();

        let tocPageNum = doc.getCurrentPageInfo().pageNumber;
        doc.addPage(); // skip for TOC

        let contentPageStart = doc.getCurrentPageInfo().pageNumber;
        addHeader(doc, 'Laporan Risiko');
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('1. Detail Identifikasi Risiko Per Unit', 40, 100);

        let finalY = 120;

        byUnit.forEach(([unit, risks]) => {
            doc.setFontSize(12);
            doc.text(`Unit: ${unit}`, 40, finalY + 15);

            const tableData = risks.map(r => [
                r.identifikasi_risiko,
                r.probabilitas,
                r.dampak,
                r.skor_risiko,
                r.status
            ]);

            autoTable(doc, {
                startY: finalY + 25,
                head: [['Identifikasi Risiko', 'P', 'D', 'Skor', 'Status']],
                body: tableData,
                theme: 'striped',
                headStyles: { fillColor: [244, 63, 94] },
                margin: { left: 40, right: 40 },
                didDrawPage: (data) => {
                    addHeader(doc, 'Laporan Risiko');
                }
            });
            finalY = (doc as any).lastAutoTable.finalY + 10;
        });

        // Add TOC
        doc.setPage(tocPageNum);
        addHeader(doc, 'Daftar Isi');
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('Daftar Isi', 40, 100);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text('1. Detail Identifikasi Risiko Per Unit', 40, 130);
        doc.text(`${contentPageStart - 1}`, pageWidth - 40, 130, { align: 'right' });

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
