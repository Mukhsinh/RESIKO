'use client';

import React, { useEffect, useState } from 'react';
import { supabase, type ManajemenRisiko, type ManajemenStrategi } from '@/lib/supabase';
import { PageHeader, ScoreCard } from '@/components/SharedUI';
import { TrendingUp, ShieldAlert, Target, CheckCircle2, AlertTriangle, Download, FileText, BookOpen, Calendar, HelpCircle } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { useAppSettings } from '@/hooks/useAppSettings';
import { GUIDES_CONTENT, TOR_CONTENT } from '../../pedoman/guide-content';

const CURRENT_YEAR = new Date().getFullYear();

export default function LaporanEksekutifPage() {
    const [risiko, setRisiko] = useState<ManajemenRisiko[]>([]);
    const [strategi, setStrategi] = useState<ManajemenStrategi[]>([]);
    const [year, setYear] = useState(String(CURRENT_YEAR));
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'ringkasan' | 'panduan' | 'tor'>('ringkasan');
    const { settings } = useAppSettings();

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

    const hexToRgb = (hex: string): [number, number, number] => {
        const def: [number, number, number] = [19, 127, 236]; // #137fec
        if (!hex) return def;
        const h = hex.replace('#', '');
        if (h.length !== 6) return def;
        const num = parseInt(h, 16);
        return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
    };

    const exportSummaryPDF = () => {
        const doc = new jsPDF('p', 'pt', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

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
        doc.text('LAPORAN EKSEKUTIF TAHUNAN', pageWidth / 2, pageHeight / 2 - 60, { align: 'center' });

        doc.setFontSize(18);
        doc.setFont('helvetica', 'normal');
        doc.text(`Tahun Evaluasi ${year}`, pageWidth / 2, pageHeight / 2, { align: 'center' });

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
        doc.text('A. Ringkasan Evaluasi Kinerja Eksekutif', 40, 140);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text(`Tingkat Capaian KPI Utama : ${kpiPct}% (${kpiAchieved} dari ${strategi.length} KPI tercapai)`, 50, 170);
        doc.text(`Tingkat Risiko Ditangani      : ${riskClosePct}% (${closedRisk} dari ${risiko.length} risiko dengan status ditutup)`, 50, 190);
        doc.text(`Risiko Sangat Tinggi Aktif  : ${highRisk} risiko aktif teridentifikasi`, 50, 210);

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text('B. Prioritas Risiko Tertinggi (Top 5)', 40, 245);

        const tableData = topRisks.map((r, i) => [
            String(i + 1),
            r.identifikasi_risiko,
            (r.unit_kerja as any)?.nama_unit || '-',
            String(r.skor_risiko),
            r.status
        ]);

        autoTable(doc, {
            startY: 260,
            head: [['No', 'Identifikasi Risiko', 'Unit Kerja', 'Skor', 'Status']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: rgbColor },
            styles: { fontSize: 8.5 },
            columnStyles: {
                0: { cellWidth: 25, halign: 'center' },
                1: { cellWidth: 220 },
                2: { cellWidth: 150 },
                3: { cellWidth: 40, halign: 'center' },
                4: { cellWidth: 60, halign: 'center' }
            },
            margin: { left: 40, right: 40 }
        });

        let finalY = (doc as any).lastAutoTable.finalY + 30;

        // Signature block
        if (finalY > pageHeight - 160) {
            doc.addPage();
            finalY = 70;
        }

        doc.setFontSize(10);
        doc.setTextColor(51, 65, 85);
        doc.setFont('helvetica', 'normal');
        doc.text('Disiapkan oleh,', 60, finalY);
        doc.text('Staff Perencanaan & Risiko', 60, finalY + 15);
        doc.line(60, finalY + 70, 200, finalY + 70);
        doc.text('Koordinator Program', 60, finalY + 85);

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

        doc.text('1. Ringkasan Kinerja & Indikator Kunci', 40, 145);
        doc.text(`${contentPageStart - 1}`, pageWidth - 40, 145, { align: 'right' });

        doc.text('2. Penilaian Prioritas Risiko Tertinggi (Top 5)', 40, 165);
        doc.text(`${contentPageStart - 1}`, pageWidth - 40, 165, { align: 'right' });

        doc.text('3. Lembar Tanda Tangan Pengesahan Laporan', 40, 185);
        const lastPage = doc.getNumberOfPages();
        doc.text(`${lastPage - 1}`, pageWidth - 40, 185, { align: 'right' });

        addFooter(doc);
        doc.save(`Laporan_Eksekutif_${year}.pdf`);
    };

    const exportPanduanPDF = () => {
        const doc = new jsPDF('p', 'pt', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 40;

        const primaryColor = settings?.warna_primer || '#137fec';
        const rgbColor = hexToRgb(primaryColor);

        // Only include Panduan Manajemen Strategi and Panduan Manajemen Risiko
        const guides = GUIDES_CONTENT.filter(g => g.id === 'strategi' || g.id === 'risiko');

        // Cover Page
        doc.setFillColor(rgbColor[0], rgbColor[1], rgbColor[2]);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text('BUKU PANDUAN PENGENDALIAN', pageWidth / 2, pageHeight / 2 - 60, { align: 'center' });
        doc.setFontSize(18);
        doc.setFont('helvetica', 'normal');
        doc.text('Manajemen Strategi & Manajemen Risiko', pageWidth / 2, pageHeight / 2, { align: 'center' });
        doc.setFontSize(12);
        doc.text((settings?.nama_rs || 'RUMAH SAKIT').toUpperCase(), pageWidth / 2, pageHeight / 2 + 50, { align: 'center' });

        guides.forEach(guide => {
            doc.addPage();
            // KOP
            doc.setDrawColor(30, 41, 59);
            doc.setLineWidth(1.5);
            doc.line(40, 100, pageWidth - 40, 100);
            doc.setLineWidth(0.5);
            doc.line(40, 104, pageWidth - 40, 104);

            doc.setTextColor(30, 41, 59);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            doc.text((settings?.nama_rs || 'RUMAH SAKIT').toUpperCase(), 40, 50);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(71, 85, 105);
            doc.text(settings?.alamat || '', 40, 68);
            doc.text(`Kota: ${settings?.kota || '-'} | Telp: ${settings?.telepon || '-'} | Email: ${settings?.email || '-'} | Web: ${settings?.website || '-'}`, 40, 84);

            let yPos = 130;
            doc.setTextColor(rgbColor[0], rgbColor[1], rgbColor[2]);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(16);
            doc.text(guide.title.toUpperCase(), margin, yPos);
            yPos += 15;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.setTextColor(100, 116, 139);
            doc.text(guide.desc, margin, yPos);
            yPos += 25;

            guide.sections.forEach(section => {
                if (yPos > pageHeight - 120) {
                    doc.addPage();
                    yPos = 60;
                }
                doc.setTextColor(30, 41, 59);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(11);
                doc.text(section.title, margin, yPos);
                yPos += 15;

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9.5);
                doc.setTextColor(60, 60, 60);

                const splitText = doc.splitTextToSize(section.content, pageWidth - (margin * 2));
                doc.text(splitText, margin, yPos);
                yPos += (splitText.length * 14) + 20;
            });
        });

        // Add running footers
        const totalPages = doc.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            if (i === 1) continue;
            doc.setTextColor(148, 163, 184);
            doc.setFontSize(8);
            doc.text(settings?.footer || 'Laporan Internal Rumah Sakit', 40, pageHeight - 20);
            doc.text(`Halaman ${i - 1} dari ${totalPages - 1}`, pageWidth - 40, pageHeight - 20, { align: 'right' });
        }

        doc.save('Buku_Panduan_Manajemen_Strategi_Risiko.pdf');
    };

    const exportTORtoPDF = () => {
        const doc = new jsPDF('p', 'pt', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 40;

        const primaryColor = settings?.warna_primer || '#137fec';
        const rgbColor = hexToRgb(primaryColor);

        // KOP
        doc.setDrawColor(30, 41, 59);
        doc.setLineWidth(1.5);
        doc.line(40, 100, pageWidth - 40, 100);
        doc.setLineWidth(0.5);
        doc.line(40, 104, pageWidth - 40, 104);

        doc.setTextColor(30, 41, 59);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text((settings?.nama_rs || 'RUMAH SAKIT').toUpperCase(), 40, 50);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        doc.text(settings?.alamat || '', 40, 68);
        doc.text(`Kota: ${settings?.kota || '-'} | Telp: ${settings?.telepon || '-'} | Email: ${settings?.email || '-'} | Web: ${settings?.website || '-'}`, 40, 84);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text(TOR_CONTENT.title.toUpperCase(), pageWidth / 2, 130, { align: 'center' });

        let yPos = 160;

        doc.setFontSize(11);
        doc.text('I. PENDAHULUAN', margin, yPos);
        yPos += 15;
        doc.setFont('helvetica', 'normal');
        const objectiveText = doc.splitTextToSize(TOR_CONTENT.objective, pageWidth - (margin * 2));
        doc.text(objectiveText, margin, yPos);
        yPos += (objectiveText.length * 15) + 20;

        doc.setFont('helvetica', 'bold');
        doc.text('II. OUTPUT PEMBELAJARAN', margin, yPos);
        yPos += 15;
        doc.setFont('helvetica', 'normal');
        TOR_CONTENT.outcomes.forEach(outcome => {
            doc.text(`• ${outcome}`, margin + 10, yPos);
            yPos += 18;
        });
        yPos += 20;

        doc.setFont('helvetica', 'bold');
        doc.text('III. JADWAL PELATIHAN', margin, yPos);
        yPos += 10;

        const tableData: any[] = [];
        TOR_CONTENT.schedule.forEach(day => {
            tableData.push([{ content: day.day, colSpan: 2, styles: { fillColor: [240, 240, 240], fontStyle: 'bold' } }]);
            day.sessions.forEach(session => {
                tableData.push([session.time, session.activity]);
            });
        });

        autoTable(doc, {
            startY: yPos,
            head: [['Waktu', 'Kegiatan']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: rgbColor },
            margin: { left: margin, right: margin }
        });

        // Add running footers (No locations or contacts added anywhere)
        const totalPages = doc.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            // Header
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(1);
            doc.line(40, 35, pageWidth - 40, 35);
            doc.setTextColor(71, 85, 105);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.text((settings?.nama_rs || 'RUMAH SAKIT').toUpperCase(), 40, 28);
            doc.setTextColor(148, 163, 184);
            doc.setFont('helvetica', 'normal');
            doc.text('TOR Pelatihan', pageWidth - 40, 28, { align: 'right' });

            // Footer
            doc.setTextColor(148, 163, 184);
            doc.setFontSize(8);
            doc.text(settings?.footer || 'Laporan Internal Rumah Sakit', 40, pageHeight - 20);
            doc.text(`Halaman ${i} dari ${totalPages}`, pageWidth - 40, pageHeight - 20, { align: 'right' });
        }

        doc.save('TOR_Pelatihan_ManRiskRS.pdf');
    };

    const handleExportPDF = () => {
        if (activeTab === 'panduan') {
            exportPanduanPDF();
        } else if (activeTab === 'tor') {
            exportTORtoPDF();
        } else {
            exportSummaryPDF();
        }
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
                        <button className="btn-secondary" onClick={handleExportPDF}>
                            <FileText size={15} />
                            <span>Export PDF {activeTab === 'panduan' ? 'Panduan' : activeTab === 'tor' ? 'TOR' : ''}</span>
                        </button>
                        {activeTab === 'ringkasan' && (
                            <button className="btn-secondary" onClick={handleExportExcel}><Download size={15} /><span>Excel</span></button>
                        )}
                    </div>
                }
            />

            {/* Navigation Tabs */}
            <div className="flex bg-[#f1f5f9] p-1 rounded-xl shadow-xs border border-slate-200/60 mb-6 w-fit">
                <button
                    onClick={() => setActiveTab('ringkasan')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-all duration-200 ${activeTab === 'ringkasan' ? 'bg-[#137fec] text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'
                        }`}
                >
                    <TrendingUp size={14} />
                    Ringkasan Eksekutif
                </button>
                <button
                    onClick={() => setActiveTab('panduan')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-all duration-200 ${activeTab === 'panduan' ? 'bg-[#137fec] text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'
                        }`}
                >
                    <BookOpen size={14} />
                    Buku Panduan
                </button>
                <button
                    onClick={() => setActiveTab('tor')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-all duration-200 ${activeTab === 'tor' ? 'bg-[#137fec] text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'
                        }`}
                >
                    <Calendar size={14} />
                    Term of Reference (TOR)
                </button>
            </div>

            {loading ? (
                <div className="card flex items-center justify-center py-16 text-slate-400">
                    <div className="animate-spin w-5 h-5 border-2 border-slate-200 border-t-[#137fec] rounded-full mr-2" />
                    <span className="text-sm">Menyiapkan data eksekutif...</span>
                </div>
            ) : (
                <>
                    {activeTab === 'ringkasan' && (
                        <>
                            {/* Executive KPIs */}
                            <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
                                <ScoreCard icon={<Target size={22} className="text-[#137fec]" />} title="Total KPI" value={strategi.length} colorClass="bg-blue-50 border-blue-100" />
                                <ScoreCard icon={<CheckCircle2 size={22} className="text-emerald-500" />} title="KPI Tercapai" value={`${kpiAchieved} (${kpiPct}%)`} subtitle="dari total KPI" colorClass="bg-emerald-50 border-emerald-100" />
                                <ScoreCard icon={<ShieldAlert size={22} className="text-slate-500" />} title="Total Risiko" value={risiko.length} colorClass="bg-slate-50 border-slate-100" />
                                <ScoreCard icon={<AlertTriangle size={22} className="text-rose-500" />} title="Risiko Sangat Tinggi" value={`${highRisk} risiko`} colorClass="bg-rose-50 border-rose-100" />
                            </div>

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
                                <div className="xl:col-span-2 card bg-gradient-to-br from-slate-800 to-slate-900 text-white border-0 shadow-lg">
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
                        </>
                    )}

                    {activeTab === 'panduan' && (
                        <div className="space-y-8">
                            <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-3xl p-8 border border-slate-200/60 shadow-xs">
                                <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-2">Buku Panduan Manajemen Organisasi</h3>
                                <p className="text-slate-500 text-sm">Referensi formal standardisasi implementasi Manajemen Strategi dan Manajemen Risiko berasaskan ISO 31000 dan Balanced Scorecard.</p>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {GUIDES_CONTENT.filter(g => g.id === 'strategi' || g.id === 'risiko').map(guide => (
                                    <div key={guide.id} className="bg-white rounded-3xl border border-slate-200/80 p-8 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
                                        <div>
                                            <div className="flex items-center gap-3 mb-5">
                                                <span className="text-3xl bg-slate-100 p-2.5 rounded-2xl border border-slate-200/50">{guide.icon}</span>
                                                <div>
                                                    <h4 className="text-lg font-bold text-slate-800">{guide.title}</h4>
                                                    <p className="text-xs text-slate-400 font-medium">Standard Operating Procedure</p>
                                                </div>
                                            </div>
                                            <p className="text-slate-500 text-sm leading-relaxed mb-6 font-medium bg-slate-50/50 p-4 rounded-2xl border border-slate-100 italic">
                                                "{guide.desc}"
                                            </p>
                                            <div className="space-y-6">
                                                {guide.sections.map((sec, idx) => (
                                                    <div key={idx} className="border-l-2 border-[#137fec]/20 pl-4 py-0.5">
                                                        <h5 className="font-bold text-slate-700 text-sm mb-1">{sec.title}</h5>
                                                        <p className="text-xs text-slate-500 leading-relaxed font-semibold whitespace-pre-line">{sec.content}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'tor' && (
                        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
                            <div className="bg-gradient-to-r from-[#137fec] to-blue-600 p-8 text-white">
                                <h3 className="text-2xl font-black mb-2">{TOR_CONTENT.title}</h3>
                                <p className="text-blue-105/90 text-sm leading-relaxed max-w-3xl font-medium">
                                    {TOR_CONTENT.objective}
                                </p>
                            </div>

                            <div className="p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
                                <div className="lg:col-span-7">
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-6">Jadwal Sesi Pelatihan</h4>
                                    <div className="space-y-8">
                                        {TOR_CONTENT.schedule.map((day, dIdx) => (
                                            <div key={dIdx} className="relative pl-6 border-l-2 border-slate-100 pb-2">
                                                <div className="absolute top-0 left-[-6px] w-3 h-3 rounded-full bg-white border-2 border-[#137fec]"></div>
                                                <h5 className="text-sm font-bold text-[#137fec] mb-4">{day.day}</h5>
                                                <div className="space-y-3">
                                                    {day.sessions.map((sess, sIdx) => (
                                                        <div key={sIdx} className="flex gap-4 p-3 bg-slate-50 rounded-xl hover:bg-slate-100/70 transition-colors">
                                                            <span className="text-xs font-bold text-slate-400 min-w-[90px]">{sess.time}</span>
                                                            <span className="text-xs font-semibold text-slate-650">{sess.activity}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="lg:col-span-5">
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-6">Target Capaian (Outcomes)</h4>
                                    <div className="space-y-3">
                                        {TOR_CONTENT.outcomes.map((out, oIdx) => (
                                            <div key={oIdx} className="flex items-start gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-[#137fec]/20 transition-all">
                                                <span className="w-1.5 h-1.5 rounded-full bg-[#137fec] mt-2 shrink-0"></span>
                                                <p className="text-xs text-slate-600 font-bold leading-relaxed">{out}</p>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Omitted the "Informasi Pendukung" Location & Contact section completely for professional client guidelines */}
                                    <div className="mt-8 p-5 bg-blue-50/50 rounded-2xl border border-blue-100/50 text-xs text-[#137fec] font-bold flex gap-3 items-center">
                                        <HelpCircle size={18} className="shrink-0" />
                                        <span>Informasi detail pelaksanaan training silakan hubungi tim administrator pusat.</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
