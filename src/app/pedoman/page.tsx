'use client';
import { useState, useRef } from 'react';
import { PageHeader } from '@/components/SharedUI';
import { BookOpen, FileText, Download, Printer, X, Calendar, MapPin, Phone, CheckCircle2, ChevronRight } from 'lucide-react';
import { GUIDES_CONTENT, TOR_CONTENT } from './guide-content';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function PedomanPage() {
    const [activeTab, setActiveTab] = useState<'guides' | 'tor'>('guides');
    const [selectedGuide, setSelectedGuide] = useState<typeof GUIDES_CONTENT[0] | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);

    const exportToPDF = (guide: typeof GUIDES_CONTENT[0]) => {
        setIsExporting(true);
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 20;

        // Cover Page
        doc.setFillColor(19, 127, 236); // #137fec
        doc.rect(0, 0, pageWidth, 60, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text('BUKU PANDUAN', margin, 35);

        doc.setTextColor(51, 51, 51);
        doc.setFontSize(28);
        doc.text(guide.title.toUpperCase(), margin, 85);

        doc.setFontSize(14);
        doc.setFont('helvetica', 'normal');
        doc.text('Sistem Manajemen Strategi & Risiko (ManRisk RS)', margin, 95);

        doc.setDrawColor(19, 127, 236);
        doc.setLineWidth(1.5);
        doc.line(margin, 105, pageWidth - margin, 105);

        let yPos = 120;

        guide.sections.forEach((section) => {
            if (yPos > 250) {
                doc.addPage();
                yPos = 20;
            }

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(16);
            doc.setTextColor(19, 127, 236);
            doc.text(section.title, margin, yPos);
            yPos += 10;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(11);
            doc.setTextColor(60, 60, 60);

            const splitText = doc.splitTextToSize(section.content, pageWidth - (margin * 2));
            doc.text(splitText, margin, yPos);
            yPos += (splitText.length * 6) + 15;
        });

        // Footer
        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(9);
            doc.setTextColor(150, 150, 150);
            doc.text(`Dicetak melalui ManRisk RS pada ${new Date().toLocaleDateString('id-ID')}`, margin, doc.internal.pageSize.getHeight() - 10);
            doc.text(`Halaman ${i} dari ${pageCount}`, pageWidth - margin - 20, doc.internal.pageSize.getHeight() - 10);
        }

        doc.save(`${guide.title.replace(/\s+/g, '_')}.pdf`);
        setIsExporting(false);
    };

    const exportTORtoPDF = () => {
        setIsExporting(true);
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 20;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text(TOR_CONTENT.title.toUpperCase(), pageWidth / 2, 25, { align: 'center' });

        doc.setFontSize(12);
        doc.text('MANRISK RS - RSUD BENDAN', pageWidth / 2, 32, { align: 'center' });
        doc.setLineWidth(0.5);
        doc.line(margin, 38, pageWidth - margin, 38);

        let yPos = 50;

        doc.setFontSize(12);
        doc.text('I. PENDAHULUAN', margin, yPos);
        yPos += 8;
        doc.setFont('helvetica', 'normal');
        const objectiveText = doc.splitTextToSize(TOR_CONTENT.objective, pageWidth - (margin * 2));
        doc.text(objectiveText, margin, yPos);
        yPos += (objectiveText.length * 6) + 10;

        doc.setFont('helvetica', 'bold');
        doc.text('II. OUTPUT PEMBELAJARAN', margin, yPos);
        yPos += 8;
        doc.setFont('helvetica', 'normal');
        TOR_CONTENT.outcomes.forEach(outcome => {
            doc.text(`• ${outcome}`, margin + 5, yPos);
            yPos += 7;
        });
        yPos += 5;

        doc.setFont('helvetica', 'bold');
        doc.text('III. JADWAL PELATIHAN', margin, yPos);
        yPos += 5;

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
            headStyles: { fillColor: [19, 127, 236] },
            margin: { left: margin, right: margin }
        });

        yPos = (doc as any).lastAutoTable.finalY + 15;
        doc.setFont('helvetica', 'bold');
        doc.text('IV. INFORMASI TAMBAHAN', margin, yPos);
        yPos += 8;
        doc.setFont('helvetica', 'normal');
        doc.text(`Lokasi: ${TOR_CONTENT.location}`, margin, yPos);
        yPos += 7;
        doc.text(`Kontak: ${TOR_CONTENT.contact}`, margin, yPos);

        doc.save('TOR_Pelatihan_ManRiskRS.pdf');
        setIsExporting(false);
    };

    return (
        <div className="max-w-7xl mx-auto pb-10">
            <PageHeader
                title="Pusat Dokumentasi & Panduan"
                subtitle="Sumber daya komprehensif untuk penguasaan sistem ManRisk RS."
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {GUIDES_CONTENT.map(g => (
                        <div key={g.id} className="group relative bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-xl hover:border-[#137fec]/20 transition-all duration-500 overflow-hidden">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-slate-50 rounded-bl-full flex items-center justify-center -mr-8 -mt-8 group-hover:bg-[#137fec]/5 transition-colors">
                                <span className="text-3xl opacity-50 mr-4 mt-4 select-none">{g.icon}</span>
                            </div>

                            <h3 className="text-lg font-bold text-slate-800 pr-10 mb-2">{g.title}</h3>
                            <p className="text-sm text-slate-500 leading-relaxed mb-6 min-h-[40px]">{g.desc}</p>

                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setSelectedGuide(g)}
                                    className="flex-1 px-4 py-2 bg-slate-50 text-[#137fec] rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#137fec] hover:text-white transition-all shadow-xs"
                                >
                                    <BookOpen size={16} /> Pelajari
                                </button>
                                <button
                                    onClick={() => exportToPDF(g)}
                                    className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-emerald-50 hover:text-emerald-600 transition-all shadow-xs"
                                    title="Unduh PDF"
                                >
                                    <Download size={18} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="bg-[#137fec] p-10 text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                        <div className="relative z-10 max-w-3xl">
                            <h2 className="text-3xl font-black mb-4">{TOR_CONTENT.title}</h2>
                            <p className="text-blue-50 leading-relaxed opacity-90 text-lg">
                                {TOR_CONTENT.objective}
                            </p>
                            <button
                                onClick={exportTORtoPDF}
                                className="mt-8 px-6 py-3 bg-white text-[#137fec] rounded-2xl text-sm font-bold flex items-center gap-2 hover:bg-blue-50 transition-all shadow-lg"
                            >
                                <Download size={18} /> Unduh TOR Lengkap (PDF)
                            </button>
                        </div>
                    </div>

                    <div className="p-10 grid grid-cols-1 lg:grid-cols-12 gap-12">
                        <div className="lg:col-span-7">
                            <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">Jadwal Pelatihan</h4>
                            <div className="space-y-10">
                                {TOR_CONTENT.schedule.map((day, idx) => (
                                    <div key={idx} className="relative pl-10 border-l-2 border-slate-100">
                                        <div className="absolute top-0 left-[-11px] w-5 h-5 rounded-full bg-white border-4 border-[#137fec]"></div>
                                        <h5 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                                            <Calendar size={20} className="text-[#137fec]" />
                                            {day.day}
                                        </h5>
                                        <div className="space-y-4">
                                            {day.sessions.map((s, i) => (
                                                <div key={i} className="flex gap-4 group">
                                                    <div className="w-32 shrink-0 py-2 border-r border-slate-100 text-xs font-black text-slate-400 group-hover:text-[#137fec] transition-colors">
                                                        {s.time}
                                                    </div>
                                                    <div className="py-2 text-sm text-slate-600 font-medium group-hover:text-slate-900 transition-colors">
                                                        {s.activity}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="lg:col-span-5 space-y-10">
                            <div>
                                <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">Target Capaian (Outcomes)</h4>
                                <div className="space-y-4">
                                    {TOR_CONTENT.outcomes.map((o, i) => (
                                        <div key={i} className="flex gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 hover:border-[#137fec]/20 transition-all">
                                            <CheckCircle2 size={20} className="text-[#137fec] shrink-0 mt-0.5" />
                                            <p className="text-sm text-slate-700 font-medium leading-relaxed">{o}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden">
                                <div className="absolute bottom-0 right-0 w-32 h-32 bg-[#137fec]/20 rounded-full mb-[-16px] mr-[-16px] blur-2xl"></div>
                                <h4 className="text-xs font-black text-white/40 uppercase tracking-widest mb-6">Informasi Pendukung</h4>
                                <div className="space-y-6 relative z-10">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                                            <MapPin size={20} className="text-blue-400" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-white/50 mb-0.5">Lokasi</p>
                                            <p className="text-sm font-bold">{TOR_CONTENT.location}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                                            <Phone size={20} className="text-blue-400" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-white/50 mb-0.5">Kontak Panitia</p>
                                            <p className="text-sm font-bold">{TOR_CONTENT.contact}</p>
                                        </div>
                                    </div>
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
                                    <p className="text-xs text-slate-400 font-medium mt-0.5 uppercase tracking-wider">Materi Panduan ManRisk RS</p>
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

                                <div className="pt-20 mt-20 border-t border-slate-100 flex justify-between items-center text-xs font-black text-slate-300 uppercase tracking-widest">
                                    <span>Versi 1.0 (Digital Edition)</span>
                                    <span>ManRisk RS &copy; 2026</span>
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

