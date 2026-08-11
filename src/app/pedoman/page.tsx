'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/SharedUI';
import { BookOpen, FileText, Download, X, Calendar, CheckCircle2, ChevronRight, HelpCircle } from 'lucide-react';
import { GUIDES_CONTENT, TOR_CONTENT } from './guide-content';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAppSettings } from '@/hooks/useAppSettings';

function hexToRgb(hex: string): [number, number, number] {
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return [isNaN(r) ? 19 : r, isNaN(g) ? 127 : g, isNaN(b) ? 236 : b];
}

export default function PedomanPage() {
    const [activeTab, setActiveTab] = useState<'guides' | 'tor'>('guides');
    const [selectedGuide, setSelectedGuide] = useState<typeof GUIDES_CONTENT[0] | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const { settings } = useAppSettings();
    const appName = settings?.nama_aplikasi || 'ManRisk RS';
    const rsName = settings?.nama_rs || 'RSUD BENDAN';

    const getPrimaryColorRgb = () => {
        return hexToRgb(settings?.warna_primer || '#137fec');
    };

    const exportToPDF = (guide: typeof GUIDES_CONTENT[0]) => {
        setIsExporting(true);
        const doc = new jsPDF('p', 'pt', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 45;
        const contentWidth = pageWidth - (margin * 2);
        const rgbColor = getPrimaryColorRgb();

        // 1. Cover Page
        doc.setFillColor(rgbColor[0], rgbColor[1], rgbColor[2]);
        doc.rect(0, 0, pageWidth, 18, 'F');
        doc.rect(0, pageHeight - 18, pageWidth, 18, 'F');

        // Outer Frame
        doc.setDrawColor(rgbColor[0], rgbColor[1], rgbColor[2]);
        doc.setLineWidth(2);
        doc.rect(margin, margin + 15, contentWidth, pageHeight - (margin * 2) - 30);

        doc.setTextColor(30, 41, 59);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        doc.text((rsName).toUpperCase(), pageWidth / 2, 135, { align: 'center' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10.5);
        doc.setTextColor(100, 116, 139);
        doc.text('SISTEM MANAJEMEN STRATEGI & RISIKO RUMAH SAKIT (MANRISK RS)', pageWidth / 2, 155, { align: 'center' });

        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(1);
        doc.line(margin + 40, 185, pageWidth - margin - 40, 185);

        // Primary Title Box
        doc.setFillColor(rgbColor[0], rgbColor[1], rgbColor[2]);
        doc.rect(margin + 20, 235, contentWidth - 40, 95, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text('DOKUMEN PEDOMAN OPERASIONAL BAKU', pageWidth / 2, 268, { align: 'center' });
        doc.setFontSize(16);
        doc.text(guide.title.toUpperCase(), pageWidth / 2, 298, { align: 'center' });

        // Metadata Box
        let metaY = 390;
        doc.setDrawColor(226, 232, 240);
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(margin + 30, metaY, contentWidth - 60, 150, 6, 6, 'FD');

        metaY += 25;
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('INFORMASI KONTROL DOKUMEN', margin + 50, metaY);
        metaY += 20;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(71, 85, 105);
        doc.text(`Kode Dokumen     : ${guide.code || 'PED-2026/01'}`, margin + 50, metaY); metaY += 18;
        doc.text(`Versi Dokumen    : ${guide.version || '2.0 (Edisi Digital)'}`, margin + 50, metaY); metaY += 18;
        doc.text(`Tanggal Berlaku  : ${guide.effectiveDate || '01 Januari 2026'}`, margin + 50, metaY); metaY += 18;
        doc.text(`Kategori          : Standar Operasional Instansi / SOP`, margin + 50, metaY); metaY += 18;
        doc.text(`Penerbit          : Komite Mutu & Manajemen Risiko ${rsName}`, margin + 50, metaY);

        doc.setFontSize(9);
        doc.setTextColor(148, 163, 184);
        doc.text(`Hak Cipta © 2026 ${rsName}. Seluruh Hak Cipta Dilindungi Undang-Undang.`, pageWidth / 2, pageHeight - 75, { align: 'center' });

        // 2. Content Pages
        doc.addPage();

        const addKop = () => {
            doc.setDrawColor(30, 41, 59);
            doc.setLineWidth(1.5);
            doc.line(margin, 82, pageWidth - margin, 82);
            doc.setLineWidth(0.5);
            doc.line(margin, 85, pageWidth - margin, 85);

            doc.setTextColor(30, 41, 59);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(13);
            doc.text((rsName).toUpperCase(), margin, 42);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(71, 85, 105);
            doc.text(settings?.alamat || 'Jl. KHM Mansyur No. 2, Kota Pekalongan, Jawa Tengah', margin, 56);
            doc.text(`Telp: ${settings?.telepon || '(0285) 437000'} | Email: ${settings?.email || 'info@rsudbendan.com'} | Web: ${settings?.website || 'www.rsudbendan.com'}`, margin, 70);

            // Document Badge Top-Right
            doc.setFillColor(241, 245, 249);
            doc.roundedRect(pageWidth - margin - 120, 36, 120, 34, 4, 4, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(30, 41, 59);
            doc.text(guide.code || 'PED-2026/01', pageWidth - margin - 60, 50, { align: 'center' });
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(100, 116, 139);
            doc.text(`Rev: ${guide.version || '2.0'}`, pageWidth - margin - 60, 62, { align: 'center' });
        };

        addKop();

        let yPos = 110;

        // Header Title
        doc.setTextColor(rgbColor[0], rgbColor[1], rgbColor[2]);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(15);
        doc.text(guide.title.toUpperCase(), margin, yPos);
        yPos += 18;

        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9.5);
        doc.setTextColor(100, 116, 139);
        const descLines = doc.splitTextToSize(guide.desc, contentWidth);
        doc.text(descLines, margin, yPos);
        yPos += (descLines.length * 12) + 14;

        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.5);
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 18;

        // Render Sections
        const bodyFontSize = 11; // 11pt font size as requested
        const lineHeightFactor = 1.25; // 1.25 line height as requested
        const lineGap = bodyFontSize * lineHeightFactor; // 13.75pt

        guide.sections.forEach((section) => {
            if (yPos > pageHeight - 90) {
                doc.addPage();
                addKop();
                yPos = 110;
            }

            // Section Banner
            doc.setFillColor(248, 250, 252);
            doc.roundedRect(margin, yPos - 12, contentWidth, 24, 4, 4, 'F');
            doc.setDrawColor(203, 213, 225);
            doc.roundedRect(margin, yPos - 12, contentWidth, 24, 4, 4, 'D');

            doc.setTextColor(15, 23, 42);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11.5);
            doc.text(section.title, margin + 10, yPos + 4);
            yPos += 26;

            const paragraphs = section.content.split('\n');

            paragraphs.forEach((para) => {
                const trimmed = para.trim();
                if (!trimmed) {
                    yPos += 5;
                    return;
                }

                const isSubHeader = /^[0-9]\.[0-9]|^[a-z]\./.test(trimmed);
                const isBullet = trimmed.startsWith('-') || trimmed.startsWith('*');

                if (isSubHeader) {
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(11);
                    doc.setTextColor(30, 41, 59);
                } else if (isBullet) {
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(bodyFontSize);
                    doc.setTextColor(51, 65, 85);
                } else {
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(bodyFontSize);
                    doc.setTextColor(51, 65, 85);
                }

                const lines = doc.splitTextToSize(trimmed, contentWidth);
                const blockHeight = lines.length * lineGap;

                if (yPos + blockHeight > pageHeight - 65) {
                    doc.addPage();
                    addKop();
                    yPos = 110;
                }

                doc.text(lines, margin, yPos, { lineHeightFactor });
                yPos += blockHeight + 5;
            });

            yPos += 14;
        });

        // Page Footers
        const totalPages = doc.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            if (i === 1) continue;
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.5);
            doc.line(margin, pageHeight - 35, pageWidth - margin, pageHeight - 35);

            doc.setTextColor(148, 163, 184);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.text(settings?.footer || `Dokumen Resmi Internal - ${rsName}`, margin, pageHeight - 20);
            doc.text(`Halaman ${i - 1} dari ${totalPages - 1}`, pageWidth - margin, pageHeight - 20, { align: 'right' });
        }

        doc.save(`${guide.title.replace(/\s+/g, '_')}_${rsName.replace(/\s+/g, '_')}.pdf`);
        setIsExporting(false);
    };

    const exportTORtoPDF = () => {
        setIsExporting(true);
        const doc = new jsPDF('p', 'pt', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 40;
        const rgbColor = getPrimaryColorRgb();

        // KOP
        doc.setDrawColor(30, 41, 59);
        doc.setLineWidth(1.5);
        doc.line(40, 100, pageWidth - 40, 100);
        doc.setLineWidth(0.5);
        doc.line(40, 104, pageWidth - 40, 104);

        doc.setTextColor(30, 41, 59);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text((rsName).toUpperCase(), 40, 50);

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
            doc.setTextColor(148, 163, 184);
            doc.setFontSize(8);
            doc.text(settings?.footer || `Dokumen Internal ${rsName}`, 40, pageHeight - 20);
            doc.text(`Halaman ${i} dari ${totalPages}`, pageWidth - 40, pageHeight - 20, { align: 'right' });
        }

        doc.save('TOR_Pelatihan_ManRiskRS.pdf');
        setIsExporting(false);
    };

    // Filter to only Strategi and Risiko guides
    const filteredGuides = GUIDES_CONTENT.filter(g => g.id === 'strategi' || g.id === 'risiko');

    return (
        <div className="max-w-7xl mx-auto pb-10">
            <PageHeader
                title="Pusat Dokumentasi & Panduan"
                subtitle={`Sumber daya komprehensif untuk penguasaan sistem ${appName}.`}
            />

            <div className="flex bg-white p-1 rounded-2xl shadow-xs border border-slate-100 mb-8 w-fit">
                <button
                    onClick={() => setActiveTab('guides')}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === 'guides' ? 'bg-[#137fec] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                    <BookOpen size={18} /> Buku Panduan
                </button>
                <button
                    onClick={() => setActiveTab('tor')}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === 'tor' ? 'bg-[#137fec] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                    <FileText size={18} /> Term of Reference (TOR)
                </button>
            </div>

            {activeTab === 'guides' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {filteredGuides.map(g => (
                        <div key={g.id} className="group relative bg-white rounded-3xl border border-slate-205/80 p-8 shadow-xs hover:shadow-md transition-shadow overflow-hidden flex flex-col justify-between">
                            <div>
                                <div className="flex items-center gap-4 mb-6">
                                    <span className="text-3xl bg-slate-100 p-3 rounded-2xl border border-slate-200/50">{g.icon}</span>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-800">{g.title}</h3>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Materi SOP Instansi</p>
                                    </div>
                                </div>
                                <p className="text-slate-500 text-sm leading-relaxed mb-6 font-medium italic bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                                    "{g.desc}"
                                </p>
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setSelectedGuide(g)}
                                    className="flex-1 px-4 py-2.5 bg-slate-50 text-[#137fec] rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-[#137fec] hover:text-white transition-all shadow-xs border border-transparent hover:border-[#137fec]/20"
                                >
                                    <BookOpen size={15} /> Pelajari Materi
                                </button>
                                <button
                                    onClick={() => exportToPDF(g)}
                                    className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-emerald-50 hover:text-emerald-600 transition-all shadow-xs border border-transparent hover:border-emerald-200"
                                    title="Unduh PDF"
                                >
                                    <Download size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
                    <div className="bg-[#137fec] p-10 text-white relative overflow-hidden bg-gradient-to-r from-[#137fec] to-blue-600">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                        <div className="relative z-10 max-w-3xl">
                            <h2 className="text-3xl font-black mb-4">{TOR_CONTENT.title}</h2>
                            <p className="text-blue-50 leading-relaxed opacity-90 text-sm font-medium">
                                {TOR_CONTENT.objective}
                            </p>
                            <button
                                onClick={exportTORtoPDF}
                                className="mt-8 px-6 py-3 bg-white text-[#137fec] rounded-2xl text-xs font-bold flex items-center gap-2 hover:bg-blue-50 transition-all shadow-lg"
                            >
                                <Download size={16} /> Unduh TOR Lengkap (PDF)
                            </button>
                        </div>
                    </div>

                    <div className="p-10 grid grid-cols-1 lg:grid-cols-12 gap-12">
                        <div className="lg:col-span-7">
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Jadwal Pelatihan</h4>
                            <div className="space-y-8">
                                {TOR_CONTENT.schedule.map((day, idx) => (
                                    <div key={idx} className="relative pl-6 border-l-2 border-slate-100 pb-2">
                                        <div className="absolute top-0 left-[-6px] w-3 h-3 rounded-full bg-white border-2 border-[#137fec]"></div>
                                        <h5 className="text-sm font-bold text-[#137fec] mb-4 flex items-center gap-2">
                                            <Calendar size={16} className="text-[#137fec]" />
                                            {day.day}
                                        </h5>
                                        <div className="space-y-3">
                                            {day.sessions.map((s, i) => (
                                                <div key={i} className="flex gap-4 p-3 bg-slate-50 rounded-xl hover:bg-slate-100/70 transition-colors">
                                                    <div className="text-xs font-bold text-slate-400 min-w-[90px] border-r border-slate-200/50 pr-2">
                                                        {s.time}
                                                    </div>
                                                    <div className="text-xs text-slate-650 font-semibold">
                                                        {s.activity}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="lg:col-span-5 space-y-8">
                            <div>
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Target Capaian (Outcomes)</h4>
                                <div className="space-y-3">
                                    {TOR_CONTENT.outcomes.map((o, i) => (
                                        <div key={i} className="flex gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 hover:border-[#137fec]/20 transition-all">
                                            <CheckCircle2 size={18} className="text-[#137fec] shrink-0 mt-0.5" />
                                            <p className="text-xs text-slate-650 font-bold leading-relaxed">{o}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Omitted the "Informasi Pendukung" Location & Contact section completely for professional client guidelines */}
                            <div className="pt-6 border-t border-slate-100">
                                <div className="p-5 bg-blue-50/50 rounded-2xl border border-blue-100/50 text-xs text-[#137fec] font-bold flex gap-3 items-center">
                                    <HelpCircle size={18} className="shrink-0" />
                                    <span>Informasi detail pelaksanaan training silakan hubungi tim administrator pusat.</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Guide View Modal */}
            {selectedGuide && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center gap-4">
                                <div className="text-3xl">{selectedGuide.icon}</div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 leading-tight">{selectedGuide.title}</h3>
                                    <p className="text-xs text-slate-400 font-medium mt-0.5 uppercase tracking-wider">Materi Panduan {appName}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => exportToPDF(selectedGuide)}
                                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:text-[#137fec] hover:border-[#137fec]/20 transition-all shadow-xs"
                                >
                                    <Download size={16} /> PDF
                                </button>
                                <button
                                    onClick={() => setSelectedGuide(null)}
                                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Content Area - Styled like a formal guide book */}
                        <div className="flex-1 overflow-y-auto p-10 md:p-16 bg-white selection:bg-[#137fec]/10">
                            <div className="max-w-3xl mx-auto space-y-12">
                                <div className="border-b-4 border-slate-100 pb-10">
                                    <p className="text-slate-400 font-black text-xs uppercase tracking-[0.3em] mb-4">SISTEM MANAJEMEN RUMAH SAKIT</p>
                                    <h1 className="text-4xl font-black text-slate-900 leading-tight mb-6">
                                        Panduan Strategis:<br />
                                        <span className="text-[#137fec]">{selectedGuide.title}</span>
                                    </h1>
                                    <p className="text-lg text-slate-500 italic font-medium leading-relaxed border-l-4 border-slate-100 pl-6">
                                        "{selectedGuide.desc}"
                                    </p>
                                </div>

                                <div className="space-y-16">
                                    {selectedGuide.sections.map((section, idx) => (
                                        <section key={idx} className="group">
                                            <div className="flex items-start gap-6">
                                                <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center shrink-0 group-hover:bg-[#137fec]/5 transition-colors">
                                                    <span className="text-[#137fec] font-black text-lg">{(idx + 1).toString().padStart(2, '0')}</span>
                                                </div>
                                                <div className="flex-1">
                                                    <h2 className="text-2xl font-black text-slate-800 mb-6 group-hover:text-[#137fec] transition-colors">{section.title}</h2>
                                                    <div className="text-md text-slate-600 leading-[1.8] font-medium space-y-4 whitespace-pre-line">
                                                        {section.content}
                                                    </div>
                                                </div>
                                            </div>
                                        </section>
                                    ))}
                                </div>

                                <div className="pt-20 mt-20 border-t border-slate-100 flex justify-between items-center text-xs font-black text-slate-400 uppercase tracking-widest">
                                    <span>Versi {selectedGuide.version || '2.0 (Digital Edition)'} | Kode: {selectedGuide.code || 'PED-2026'}</span>
                                    <span>{appName} &copy; 2026</span>
                                </div>
                            </div>
                        </div>

                        {/* Footer / Actions */}
                        <div className="p-5 bg-slate-50 border-t border-slate-100 flex justify-center">
                            <button
                                onClick={() => setSelectedGuide(null)}
                                className="px-10 py-3 bg-slate-800 text-white rounded-2xl text-sm font-black hover:bg-slate-900 transition-all shadow-lg"
                            >
                                Selesai Membaca
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isExporting && (
                <div className="fixed bottom-10 right-10 z-[60] bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce">
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                    <span className="text-sm font-bold">Sedang mempersiapkan dokumen PDF...</span>
                </div>
            )}
        </div>
    );
}
