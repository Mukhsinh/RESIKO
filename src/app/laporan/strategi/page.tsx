'use client';

import React, { useEffect, useState } from 'react';
import { supabase, type ManajemenStrategi } from '@/lib/supabase';
import { PageHeader, ScoreCard } from '@/components/SharedUI';
import { BarChart2, Target, CheckCircle2, TrendingUp, Download, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const CURRENT_YEAR = new Date().getFullYear();

function AchievementBar({ target, realisasi }: { target: string; realisasi: string }) {
    const t = parseFloat(target), r = parseFloat(realisasi);
    if (isNaN(t) || isNaN(r) || t === 0) return <span className="text-xs text-slate-400">N/A</span>;
    const pct = Math.min((r / t) * 100, 130);
    const color = pct >= 100 ? 'bg-emerald-400' : pct >= 80 ? 'bg-amber-400' : 'bg-rose-400';
    return (
        <div className="flex items-center gap-2">
            <div className="flex-1 bg-slate-100 rounded-full h-2 min-w-[80px]">
                <div className={`${color} h-2 rounded-full`} style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
            <span className="text-xs font-semibold text-slate-600 shrink-0">{pct.toFixed(0)}%</span>
        </div>
    );
}

export default function LaporanStrategiPage() {
    const [data, setData] = useState<ManajemenStrategi[]>([]);
    const [year, setYear] = useState(String(CURRENT_YEAR));
    const [loading, setLoading] = useState(true);

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

    const achieved = data.filter(d => { const t = parseFloat(d.target), r = parseFloat(d.realisasi); return !isNaN(t) && !isNaN(r) && r >= t; }).length;
    const avgAchievement = data.length ? (data.reduce((s, d) => {
        const t = parseFloat(d.target), r = parseFloat(d.realisasi);
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
        const rows = data.map(d => ({
            'Tahun': d.tahun,
            'Unit Kerja': (d.unit_kerja as any)?.nama_unit || 'Lainnya',
            'Sasaran Strategis': d.sasaran_strategis,
            'KPI': d.kpi,
            'Target': d.target,
            'Realisasi': d.realisasi || '-'
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Strategi");
        XLSX.writeFile(wb, `Laporan_Strategi_${year}.xlsx`);
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
        doc.text(`LAPORAN MANAJEMEN STRATEGI`, pageWidth / 2, pageHeight / 2 - 40, { align: 'center' });
        doc.setFontSize(20);
        doc.setFont('helvetica', 'normal');
        doc.text(`Tahun ${year}`, pageWidth / 2, pageHeight / 2, { align: 'center' });
        doc.setFontSize(14);
        doc.text('RUMAH SAKIT ANTIGRAVITY', pageWidth / 2, pageHeight / 2 + 40, { align: 'center' });

        doc.addPage();

        let tocPageNum = doc.getCurrentPageInfo().pageNumber;
        doc.addPage(); // skip for TOC

        let contentPageStart = doc.getCurrentPageInfo().pageNumber;
        addHeader(doc, 'Laporan Strategi');
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('1. Detail Capaian KPI Per Unit', 40, 100);

        let finalY = 120;

        byUnit.forEach(([unit, items]) => {
            doc.setFontSize(12);
            doc.text(`Unit: ${unit}`, 40, finalY + 15);

            const tableData = items.map(item => [
                item.sasaran_strategis,
                item.kpi,
                item.target,
                item.realisasi || '-'
            ]);

            autoTable(doc, {
                startY: finalY + 25,
                head: [['Sasaran Strategis', 'KPI', 'Target', 'Realisasi']],
                body: tableData,
                theme: 'striped',
                headStyles: { fillColor: [19, 127, 236] },
                margin: { left: 40, right: 40 },
                didDrawPage: (data) => {
                    addHeader(doc, 'Laporan Strategi');
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
        doc.text('1. Detail Capaian KPI Per Unit', 40, 130);
        doc.text(`${contentPageStart - 1}`, pageWidth - 40, 130, { align: 'right' });

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
                <div className="space-y-4">
                    {byUnit.map(([unit, items]) => {
                        const unitAchieved = items.filter(d => { const t = parseFloat(d.target), r = parseFloat(d.realisasi); return !isNaN(t) && !isNaN(r) && r >= t; }).length;
                        return (
                            <div key={unit} className="card">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-bold text-slate-700">{unit}</h3>
                                    <span className="text-xs text-slate-500 bg-slate-100 px-3 py-1 rounded-full">{unitAchieved}/{items.length} tercapai</span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-slate-100 text-xs text-slate-500">
                                                <th className="text-left pb-2 font-medium">Sasaran Strategis</th>
                                                <th className="text-left pb-2 font-medium">KPI</th>
                                                <th className="text-center pb-2 font-medium w-20">Target</th>
                                                <th className="text-center pb-2 font-medium w-20">Realisasi</th>
                                                <th className="text-left pb-2 font-medium w-40">Capaian</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {items.map(item => (
                                                <tr key={item.id} className="text-xs">
                                                    <td className="py-2.5 pr-3 max-w-xs"><span className="line-clamp-2 text-slate-700">{item.sasaran_strategis}</span></td>
                                                    <td className="py-2.5 pr-3 text-slate-600">{item.kpi}</td>
                                                    <td className="py-2.5 text-center text-slate-600">{item.target}</td>
                                                    <td className="py-2.5 text-center font-medium text-slate-700">{item.realisasi || '-'}</td>
                                                    <td className="py-2.5"><AchievementBar target={item.target} realisasi={item.realisasi} /></td>
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
