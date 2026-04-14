'use client';

import React, { useEffect, useState } from 'react';
import { supabase, type ManajemenRisiko, type ManajemenStrategi } from '@/lib/supabase';
import { PageHeader, ScoreCard } from '@/components/SharedUI';
import { TrendingUp, ShieldAlert, Target, CheckCircle2, AlertTriangle, Download, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const CURRENT_YEAR = new Date().getFullYear();

export default function LaporanEksekutifPage() {
    const [risiko, setRisiko] = useState<ManajemenRisiko[]>([]);
    const [strategi, setStrategi] = useState<ManajemenStrategi[]>([]);
    const [year, setYear] = useState(String(CURRENT_YEAR));
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        Promise.all([
            supabase.from('manajemen_risiko').select('*, unit_kerja(nama_unit)').eq('tahun', Number(year)),
            supabase.from('manajemen_strategi').select('*, unit_kerja(nama_unit)').eq('tahun', Number(year)),
        ]).then(([{ data: r, error: rError }, { data: s, error: sError }]) => {
            if (rError) console.error('Error fetching risiko:', rError);
            if (sError) console.error('Error fetching strategi:', sError);
            setRisiko((r as ManajemenRisiko[]) ?? []);
            setStrategi((s as ManajemenStrategi[]) ?? []);
            setLoading(false);
        }).catch(err => {
            console.error('Error:', err);
            setRisiko([]);
            setStrategi([]);
            setLoading(false);
        });
    }, [year]);

    const kpiAchieved = strategi.filter(d => {
        const t = parseFloat(d.target), r = parseFloat(d.realisasi);
        return !isNaN(t) && !isNaN(r) && r >= t;
    }).length;
    const kpiPct = strategi.length ? Math.round(kpiAchieved * 100 / strategi.length) : 0;
    const highRisk = risiko.filter(r => r.skor_risiko >= 15).length;
    const closedRisk = risiko.filter(r => r.status === 'Closed').length;
    const riskClosePct = risiko.length ? Math.round(closedRisk * 100 / risiko.length) : 0;

    const topRisks = [...risiko].sort((a, b) => b.skor_risiko - a.skor_risiko).slice(0, 5);
    const topKpiFail = strategi.filter(d => {
        const t = parseFloat(d.target), r = parseFloat(d.realisasi);
        return !isNaN(t) && !isNaN(r) && r < t;
    }).sort((a, b) => {
        const pctA = parseFloat(a.realisasi) / parseFloat(a.target);
        const pctB = parseFloat(b.realisasi) / parseFloat(b.target);
        return pctA - pctB;
    }).slice(0, 5);

    const handleExportExcel = () => {
        const wb = XLSX.utils.book_new();

        const stRows = strategi.map(d => ({
            'Tahun': d.tahun,
            'Unit Kerja': (d.unit_kerja as any)?.nama_unit || 'Lainnya',
            'Sasaran Strategis': d.sasaran_strategis,
            'KPI': d.kpi,
            'Target': d.target,
            'Realisasi': d.realisasi || '-'
        }));
        const wsStrategi = XLSX.utils.json_to_sheet(stRows);
        XLSX.utils.book_append_sheet(wb, wsStrategi, "Strategi");

        const rRows = risiko.map(r => ({
            'Tahun': r.tahun,
            'Unit Kerja': (r.unit_kerja as any)?.nama_unit || 'Lainnya',
            'Identifikasi Risiko': r.identifikasi_risiko,
            'Probabilitas': r.probabilitas,
            'Dampak': r.dampak,
            'Skor': r.skor_risiko,
            'Status': r.status,
            'Mitigasi': r.mitigasi || '-'
        }));
        const wsRisiko = XLSX.utils.json_to_sheet(rRows);
        XLSX.utils.book_append_sheet(wb, wsRisiko, "Risiko");

        XLSX.writeFile(wb, `Laporan_Eksekutif_${year}.xlsx`);
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
        doc.text(`LAPORAN EKSEKUTIF`, pageWidth / 2, pageHeight / 2 - 40, { align: 'center' });
        doc.setFontSize(20);
        doc.setFont('helvetica', 'normal');
        doc.text(`Tahun ${year}`, pageWidth / 2, pageHeight / 2, { align: 'center' });
        doc.setFontSize(14);
        doc.text('RUMAH SAKIT ANTIGRAVITY', pageWidth / 2, pageHeight / 2 + 40, { align: 'center' });

        doc.addPage();
        let tocPageNum = doc.getCurrentPageInfo().pageNumber;
        doc.addPage();

        let contentPageStart = doc.getCurrentPageInfo().pageNumber;
        addHeader(doc, 'Laporan Eksekutif');
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('1. Ringkasan Eksekutif', 40, 100);

        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(`Tingkat Capaian KPI : ${kpiPct}% (${kpiAchieved}/${strategi.length})`, 40, 130);
        doc.text(`Risiko Terselesaikan : ${riskClosePct}% (${closedRisk}/${risiko.length})`, 40, 150);
        doc.text(`Risiko Sangat Tinggi : ${highRisk}`, 40, 170);

        doc.text('5 Risiko Prioritas Tertinggi:', 40, 200);
        let currentY = 220;
        topRisks.forEach((r, i) => {
            doc.text(`${i + 1}. [${r.skor_risiko}] ${r.identifikasi_risiko}`, 50, currentY);
            currentY += 20;
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
        doc.text('1. Ringkasan Eksekutif', 40, 130);
        doc.text(`${contentPageStart - 1}`, pageWidth - 40, 130, { align: 'right' });

        addFooter(doc);
        doc.save(`Laporan_Eksekutif_${year}.pdf`);
    };

    return (
        <div>
            <PageHeader
                title="Laporan Eksekutif"
                subtitle="Ringkasan eksekutif kinerja manajemen strategi dan risiko rumah sakit."
                actions={
                    <div className="flex gap-2 flex-wrap">
                        <select className="form-input w-32" value={year} onChange={e => setYear(e.target.value)}>
                            {[CURRENT_YEAR + 1, CURRENT_YEAR, CURRENT_YEAR - 1].map(y => <option key={y}>{y}</option>)}
                        </select>
                        <button className="btn-secondary" onClick={handleExportPDF}><FileText size={15} /><span>Export PDF</span></button>
                        <button className="btn-secondary" onClick={handleExportExcel}><Download size={15} /><span>Excel</span></button>
                    </div>
                }
            />

            {/* Executive KPIs */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
                <ScoreCard icon={<Target size={22} className="text-[#137fec]" />} title="Total KPI" value={strategi.length} colorClass="bg-blue-50 border-blue-100" />
                <ScoreCard icon={<CheckCircle2 size={22} className="text-emerald-500" />} title="KPI Tercapai" value={`${kpiAchieved} (${kpiPct}%)`} subtitle="dari total KPI" colorClass="bg-emerald-50 border-emerald-100" />
                <ScoreCard icon={<ShieldAlert size={22} className="text-slate-500" />} title="Total Risiko" value={risiko.length} colorClass="bg-slate-50 border-slate-100" />
                <ScoreCard icon={<AlertTriangle size={22} className="text-rose-500" />} title="Risiko Sangat Tinggi" value={`${highRisk} risiko`} colorClass="bg-rose-50 border-rose-100" />
            </div>

            {loading ? (
                <div className="card flex items-center justify-center py-16 text-slate-400">
                    <div className="animate-spin w-5 h-5 border-2 border-slate-200 border-t-[#137fec] rounded-full mr-2" />
                    <span className="text-sm">Menyiapkan laporan eksekutif...</span>
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {/* Strategy summary card */}
                    <div className="card">
                        <div className="flex items-center gap-2 mb-5">
                            <TrendingUp size={18} className="text-[#137fec]" />
                            <h3 className="font-bold text-slate-700">Status Strategi {year}</h3>
                        </div>
                        <div className="flex items-center gap-4 mb-5">
                            <div className="relative w-20 h-20 shrink-0">
                                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
                                    <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#f1f5f9" strokeWidth="3.5" />
                                    <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#137fec" strokeWidth="3.5"
                                        strokeDasharray={`${kpiPct} ${100 - kpiPct}`} strokeLinecap="round" />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-sm font-bold text-slate-700">{kpiPct}%</span>
                                </div>
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-slate-700">Tingkat Capaian KPI</p>
                                <p className="text-xs text-slate-500 mt-1">{kpiAchieved} dari {strategi.length} indikator tercapai</p>
                                <p className="text-xs text-slate-400 mt-0.5">{strategi.length - kpiAchieved} indikator belum tercapai</p>
                            </div>
                        </div>
                        {topKpiFail.length > 0 && (
                            <>
                                <p className="text-xs font-semibold text-rose-600 mb-2">⚠ KPI Perlu Perhatian</p>
                                <div className="space-y-2">
                                    {topKpiFail.map(d => {
                                        const pct = Math.round((parseFloat(d.realisasi) / parseFloat(d.target)) * 100);
                                        return (
                                            <div key={d.id} className="flex items-center gap-3 text-xs">
                                                <div className="flex-1 min-w-0">
                                                    <p className="truncate text-slate-700">{d.kpi}</p>
                                                    <p className="text-slate-400">{(d.unit_kerja as { nama_unit: string })?.nama_unit ?? ''}</p>
                                                </div>
                                                <span className="text-rose-600 font-bold shrink-0">{pct}%</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Risk summary card */}
                    <div className="card">
                        <div className="flex items-center gap-2 mb-5">
                            <ShieldAlert size={18} className="text-rose-500" />
                            <h3 className="font-bold text-slate-700">Status Risiko {year}</h3>
                        </div>
                        <div className="flex items-center gap-4 mb-5">
                            <div className="relative w-20 h-20 shrink-0">
                                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
                                    <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#f1f5f9" strokeWidth="3.5" />
                                    <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#10b981" strokeWidth="3.5"
                                        strokeDasharray={`${riskClosePct} ${100 - riskClosePct}`} strokeLinecap="round" />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-sm font-bold text-slate-700">{riskClosePct}%</span>
                                </div>
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-slate-700">Risiko Terselesaikan</p>
                                <p className="text-xs text-slate-500 mt-1">{closedRisk} dari {risiko.length} risiko ditutup</p>
                                <p className="text-xs text-slate-400 mt-0.5">{highRisk} risiko sangat tinggi aktif</p>
                            </div>
                        </div>
                        {topRisks.length > 0 && (
                            <>
                                <p className="text-xs font-semibold text-rose-600 mb-2">🔴 5 Risiko Prioritas Tertinggi</p>
                                <div className="space-y-2">
                                    {topRisks.map((r, i) => (
                                        <div key={r.id} className="flex items-center gap-3 text-xs">
                                            <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="truncate text-slate-700">{r.identifikasi_risiko}</p>
                                                <p className="text-slate-400">{(r.unit_kerja as { nama_unit: string })?.nama_unit ?? ''}</p>
                                            </div>
                                            <span className={`font-bold shrink-0 ${r.skor_risiko >= 15 ? 'text-rose-600' : 'text-amber-500'}`}>{r.skor_risiko}</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Overall summary */}
                    <div className="xl:col-span-2 card bg-gradient-to-br from-slate-800 to-slate-900 text-white border-0">
                        <h3 className="font-bold text-white mb-4">Kesimpulan Eksekutif Tahun {year}</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                                { label: 'Capaian KPI', value: `${kpiPct}%`, color: kpiPct >= 80 ? 'text-emerald-400' : kpiPct >= 60 ? 'text-amber-400' : 'text-rose-400' },
                                { label: 'Risiko Selesai', value: `${riskClosePct}%`, color: riskClosePct >= 50 ? 'text-emerald-400' : 'text-amber-400' },
                                { label: 'Risiko Sangat Tinggi', value: highRisk, color: highRisk === 0 ? 'text-emerald-400' : 'text-rose-400' },
                                { label: 'KPI Belum Tercapai', value: strategi.length - kpiAchieved, color: strategi.length - kpiAchieved === 0 ? 'text-emerald-400' : 'text-amber-400' },
                            ].map(item => (
                                <div key={item.label} className="text-center p-4 rounded-xl bg-white/5">
                                    <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                                    <p className="text-slate-400 text-xs mt-1">{item.label}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
