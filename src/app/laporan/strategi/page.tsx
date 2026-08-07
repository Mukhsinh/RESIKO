'use client';

import React, { useEffect, useState } from 'react';
import { supabase, type ManajemenStrategi } from '@/lib/supabase';
import { PageHeader, ScoreCard } from '@/components/SharedUI';
import { BarChart2, Target, CheckCircle2, TrendingUp, Download, FileText, AlertTriangle } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { useAppSettings } from '@/hooks/useAppSettings';

const CURRENT_YEAR = new Date().getFullYear();

interface RealisasiData {
    tipe: string;
    inputs: string[];
    rata_rata: number;
}

const deserializeRealisasi = (val: string | null | undefined): RealisasiData & { rawText: string } => {
    const def = { tipe: 'tahunan', inputs: [''], rata_rata: 0, rawText: val || '' };
    if (!val) return def;
    try {
        const p = JSON.parse(val);
        if (p && typeof p === 'object' && p.tipe) {
            return { tipe: p.tipe, inputs: p.inputs || [''], rata_rata: p.rata_rata || 0, rawText: String(p.rata_rata || '') };
        }
    } catch {
        const num = parseFloat(val);
        return { tipe: 'tahunan', inputs: [val], rata_rata: isNaN(num) ? 0 : num, rawText: val };
    }
    return def;
};

const getDisplayRealisasi = (val: string | null | undefined): string => {
    const d = deserializeRealisasi(val);
    if (d.rata_rata) return String(d.rata_rata);
    return d.rawText || '-';
};

const getNumericRealisasi = (val: string | null | undefined): number => {
    const d = deserializeRealisasi(val);
    if (d.rata_rata) return d.rata_rata;
    const num = parseFloat(d.rawText);
    return isNaN(num) ? 0 : num;
};

function AchievementBadge({ target, realisasi }: { target: string; realisasi: string }) {
    const t = parseFloat(target);
    const r = getNumericRealisasi(realisasi);
    const displayVal = getDisplayRealisasi(realisasi);

    if (isNaN(t) || t === 0 || displayVal === '-') {
        return <span className="text-xs text-slate-400 font-medium">N/A</span>;
    }

    const pct = (r / t) * 100;
    const colorClass = pct >= 100
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : pct >= 70
            ? 'bg-amber-50 text-amber-700 border-amber-200'
            : 'bg-rose-50 text-rose-700 border-rose-200';
    const statusText = pct >= 100 ? 'Tercapai' : pct >= 70 ? 'Waspada' : 'Belum';

    return (
        <div className="flex items-center gap-2">
            <div className="flex-1 bg-slate-100 rounded-full h-2 min-w-[60px] overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-emerald-500' : pct >= 70 ? 'bg-amber-500' : 'bg-rose-500'}`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                />
            </div>
            <span className="text-xs font-bold text-slate-700 shrink-0">{pct.toFixed(0)}%</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${colorClass} shrink-0`}>
                {statusText}
            </span>
        </div>
    );
}

export default function LaporanStrategiPage() {
    const [data, setData] = useState<ManajemenStrategi[]>([]);
    const [year, setYear] = useState(String(CURRENT_YEAR));
    const [loading, setLoading] = useState(true);
    const { settings } = useAppSettings();

    useEffect(() => {
        setLoading(true);
        try {
            let q = supabase.from('manajemen_strategi').select('*, unit_kerja(nama_unit)').order('unit_kerja_id');
            if (year) q = q.eq('tahun', Number(year));
            q.then(({ data: rows, error }: { data: any; error: any }) => {
                if (error) {
                    console.error('Error fetching laporan strategi:', error);
                    setData([]);
                } else {
                    setData((rows as ManajemenStrategi[]) ?? []);
                }
                setLoading(false);
            });
        } catch (err) {
            console.error('Error:', err);
            setData([]);
            setLoading(false);
        }
    }, [year]);

    const achieved = data.filter(d => {
        const t = parseFloat(d.target);
        const r = getNumericRealisasi(d.realisasi);
        return !isNaN(t) && !isNaN(r) && t > 0 && r >= t;
    }).length;

    const avgAchievement = data.length ? (data.reduce((s, d) => {
        const t = parseFloat(d.target);
        const r = getNumericRealisasi(d.realisasi);
        return s + (isNaN(t) || isNaN(r) || t === 0 ? 0 : (r / t) * 100);
    }, 0) / data.length) : 0;

    const byUnit = Object.entries(
        data.reduce<Record<string, ManajemenStrategi[]>>((acc, d) => {
            const unit = (d.unit_kerja as { nama_unit: string })?.nama_unit ?? 'Lainnya';
            if (!acc[unit]) acc[unit] = [];
            acc[unit].push(d);
            return acc;
        }, {})
    );

    const handleExportExcel = () => {
        let globalIndex = 1;
        const rows = data.map(d => {
            const t = parseFloat(d.target);
            const r = getNumericRealisasi(d.realisasi);
            const pct = !isNaN(t) && t > 0 ? ((r / t) * 100).toFixed(1) + '%' : '0%';
            const status = !isNaN(t) && t > 0 && r >= t ? 'Tercapai' : (r / t >= 0.7 ? 'Waspada' : 'Belum Tercapai');
            const des = deserializeRealisasi(d.realisasi);

            return {
                'No': globalIndex++,
                'Tahun': d.tahun,
                'Unit Kerja': (d.unit_kerja as any)?.nama_unit || 'Lainnya',
                'Sasaran Strategis': d.sasaran_strategis,
                'KPI / Indikator': d.kpi,
                'Periode Realisasi': des.tipe.toUpperCase(),
                'Target': d.target,
                'Realisasi': getDisplayRealisasi(d.realisasi),
                'Capaian (%)': pct,
                'Status Capaian': status
            };
        });
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Laporan Strategi");
        XLSX.writeFile(wb, `Laporan_Strategi_${year}.xlsx`);
    };

    const handleExportPDF = () => {
        const doc = new jsPDF('p', 'pt', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        const hexToRgb = (hex: string): [number, number, number] => {
            const def: [number, number, number] = [19, 127, 236];
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
                d.setFont('helvetica', 'oblique');
                d.setFontSize(8);
                d.text(`"${settings.tagline}"`, 40, 98);
            }
        };

        // Cover Page
        doc.setFillColor(rgbColor[0], rgbColor[1], rgbColor[2]);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');
        doc.setTextColor(255, 255, 255);

        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text('LAPORAN REALISASI STRATEGI', pageWidth / 2, pageHeight / 2 - 60, { align: 'center' });

        doc.setFontSize(16);
        doc.setFont('helvetica', 'normal');
        doc.text(`Tahun Anggaran ${year}`, pageWidth / 2, pageHeight / 2, { align: 'center' });

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
        doc.text('A. Rekapitulasi Capaian KPI Berdasarkan Unit Kerja', 40, 140);

        let finalY = 160;

        byUnit.forEach(([unit, items]) => {
            if (finalY > pageHeight - 120) {
                doc.addPage();
                finalY = 70;
            }

            doc.setFontSize(10.5);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(30, 41, 59);
            doc.text(`Unit Kerja: ${unit}`, 40, finalY + 15);

            let rowIdx = 1;
            const tableData = items.map(item => {
                const des = deserializeRealisasi(item.realisasi);
                const t = parseFloat(item.target);
                const r = getNumericRealisasi(item.realisasi);
                const pct = !isNaN(t) && t > 0 ? ((r / t) * 100).toFixed(0) + '%' : '0%';
                const status = !isNaN(t) && t > 0 && r >= t ? 'Tercapai' : (r / t >= 0.7 ? 'Waspada' : 'Belum');

                return [
                    rowIdx++,
                    item.sasaran_strategis,
                    item.kpi,
                    des.tipe.toUpperCase(),
                    item.target,
                    getDisplayRealisasi(item.realisasi),
                    pct,
                    status
                ];
            });

            autoTable(doc, {
                startY: finalY + 22,
                head: [['No', 'Sasaran Strategis', 'KPI / Indikator', 'Periode', 'Target', 'Realisasi', 'Capaian', 'Status']],
                body: tableData,
                theme: 'grid',
                headStyles: { fillColor: rgbColor, fontSize: 8, fontStyle: 'bold' },
                styles: { fontSize: 8, cellPadding: 4 },
                columnStyles: {
                    0: { cellWidth: 25, halign: 'center' },
                    1: { cellWidth: 140 },
                    2: { cellWidth: 120 },
                    3: { cellWidth: 50, halign: 'center' },
                    4: { cellWidth: 45, halign: 'center' },
                    5: { cellWidth: 50, halign: 'center' },
                    6: { cellWidth: 45, halign: 'center' },
                    7: { cellWidth: 50, halign: 'center' },
                },
                margin: { left: 40, right: 40 },
                didDrawPage: (data) => {
                    const currentPage = doc.getCurrentPageInfo().pageNumber;
                    if (currentPage > contentPageStart) {
                        addHeader(doc, 'Laporan Realisasi Strategi');
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
        doc.text('Tim Pengelola Strategi', 60, finalY + 14);
        doc.line(60, finalY + 65, 200, finalY + 65);
        doc.text('Staf Kepegawaian / Perencana', 60, finalY + 78);

        doc.text('Disetujui oleh,', pageWidth - 200, finalY);
        doc.setFont('helvetica', 'bold');
        doc.text(settings?.kepala_rs || 'Pimpinan Rumah Sakit', pageWidth - 200, finalY + 14);
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

        doc.text('1. Detail Capaian KPI Berdasarkan Unit Kerja', 40, 140);
        doc.text(`${contentPageStart - 1}`, pageWidth - 40, 140, { align: 'right' });

        doc.text('2. Lembar Tanda Tangan Pengesahan Laporan', 40, 160);
        const lastPage = doc.getNumberOfPages();
        doc.text(`${lastPage - 1}`, pageWidth - 40, 160, { align: 'right' });

        addFooter(doc);
        doc.save(`Laporan_Strategi_${year}.pdf`);
    };

    return (
        <div>
            <PageHeader
                title="Laporan Realisasi Strategi"
                subtitle="Rekap capaian KPI dan realisasi sasaran strategis per unit kerja."
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
                <ScoreCard icon={<Target size={22} className="text-[#137fec]" />} title="Total KPI" value={data.length} colorClass="bg-blue-50 border-blue-100" />
                <ScoreCard icon={<CheckCircle2 size={22} className="text-emerald-500" />} title="KPI Tercapai" value={achieved} colorClass="bg-emerald-50 border-emerald-100" />
                <ScoreCard icon={<BarChart2 size={22} className="text-amber-500" />} title="Belum Tercapai" value={data.length - achieved} colorClass="bg-amber-50 border-amber-100" />
                <ScoreCard icon={<TrendingUp size={22} className="text-violet-500" />} title="Rata-rata Capaian" value={`${avgAchievement.toFixed(1)}%`} colorClass="bg-violet-50 border-violet-100" />
            </div>

            {loading ? (
                <div className="card flex items-center justify-center py-16 text-slate-400">
                    <div className="animate-spin w-5 h-5 border-2 border-slate-200 border-t-[#137fec] rounded-full mr-2" />
                    <span className="text-sm">Memuat laporan...</span>
                </div>
            ) : byUnit.length === 0 ? (
                <div className="card text-center py-16"><p className="text-slate-400">Belum ada data strategi untuk tahun ini.</p></div>
            ) : (
                <div className="space-y-6">
                    {byUnit.map(([unit, items]) => {
                        const unitAchieved = items.filter(d => {
                            const t = parseFloat(d.target);
                            const r = getNumericRealisasi(d.realisasi);
                            return !isNaN(t) && !isNaN(r) && t > 0 && r >= t;
                        }).length;

                        return (
                            <div key={unit} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 overflow-hidden">
                                <div className="flex items-center justify-between mb-5 border-b border-slate-100 pb-3">
                                    <h3 className="font-bold text-slate-800 text-base">{unit}</h3>
                                    <span className="text-xs font-bold text-[#137fec] bg-blue-50 px-3 py-1 rounded-lg border border-blue-100">
                                        {unitAchieved} dari {items.length} KPI Tercapai
                                    </span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/70 uppercase tracking-wider text-[10px]">
                                                <th className="py-2.5 px-3 text-center font-bold w-10">No</th>
                                                <th className="py-2.5 px-3 text-left font-bold">Sasaran Strategis</th>
                                                <th className="py-2.5 px-3 text-left font-bold">KPI / Indikator Kinerja</th>
                                                <th className="py-2.5 px-3 text-center font-bold w-24">Periode</th>
                                                <th className="py-2.5 px-3 text-center font-bold w-20">Target</th>
                                                <th className="py-2.5 px-3 text-center font-bold w-24">Realisasi</th>
                                                <th className="py-2.5 px-3 text-left font-bold w-48">Tingkat Capaian</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {items.map((item, idx) => {
                                                const des = deserializeRealisasi(item.realisasi);
                                                return (
                                                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                                                        <td className="py-3 px-3 text-center font-semibold text-slate-400">{idx + 1}</td>
                                                        <td className="py-3 px-3 text-slate-700 font-medium max-w-xs">{item.sasaran_strategis}</td>
                                                        <td className="py-3 px-3 text-slate-800 font-semibold">{item.kpi}</td>
                                                        <td className="py-3 px-3 text-center">
                                                            <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-bold uppercase text-[10px]">
                                                                {des.tipe}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-3 text-center font-bold text-slate-700">{item.target}</td>
                                                        <td className="py-3 px-3 text-center font-extrabold text-[#137fec]">
                                                            {getDisplayRealisasi(item.realisasi)}
                                                        </td>
                                                        <td className="py-3 px-3">
                                                            <AchievementBadge target={item.target} realisasi={item.realisasi} />
                                                        </td>
                                                    </tr>
                                                );
                                            })}
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
