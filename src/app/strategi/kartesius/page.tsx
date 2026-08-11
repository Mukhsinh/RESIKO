'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Download, Filter, Target, Table as TableIcon, FileSpreadsheet, RotateCw, FileText } from 'lucide-react';
import {
    ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell
} from 'recharts';
import html2canvas from 'html2canvas-pro';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAppSettings } from '@/hooks/useAppSettings';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function DiagramKartesiusPage() {
    const { settings } = useAppSettings();
    const CURRENT_YEAR = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState(String(CURRENT_YEAR));
    const [selectedUnit, setSelectedUnit] = useState('semua');
    const [chartData, setChartData] = useState<any[]>([]);
    const [units, setUnits] = useState<{ id: string; name: string }[]>([]);
    const [availableYears, setAvailableYears] = useState<number[]>([]);
    const [loading, setLoading] = useState(false);

    const chartRef = useRef<HTMLDivElement>(null);
    const reportRef = useRef<HTMLDivElement>(null);

    // Fetch dynamic years from IKT table
    useEffect(() => {
        supabase.from('indikator_kinerja_utama')
            .select('target_tahun')
            .order('target_tahun', { ascending: true })
            .then(({ data: rows }: { data: any }) => {
                if (rows && rows.length > 0) {
                    const yearSet = new Set<number>();
                    rows.forEach((r: any) => { if (r.target_tahun) yearSet.add(r.target_tahun); });
                    const sorted = Array.from(yearSet).sort((a, b) => a - b);
                    if (sorted.length > 0) {
                        setAvailableYears(sorted);
                        if (!sorted.includes(Number(selectedYear))) {
                            setSelectedYear(String(sorted[0]));
                        }
                    }
                }
            });
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const { data: unitsData } = await supabase.from('unit_kerja').select('id, nama_unit').order('nama_unit');
            const normalizedUnits = (unitsData ?? []).map((u: any) => ({ id: u.id, name: u.nama_unit }));
            setUnits(normalizedUnits);

            const { data: swotData } = await supabase
                .from('swot_inventarisasi')
                .select('*')
                .eq('tahun', Number(selectedYear));

            if (swotData) {
                const mappedData = normalizedUnits.map((unit: any, index: number) => {
                    const unitSwots = swotData.filter((s: any) => s.unit_kerja_id === unit.id);
                    if (unitSwots.length === 0) return null;

                    const sumSkor = (kategori: string) =>
                        unitSwots.filter((s: any) => s.kategori === kategori)
                            .reduce((acc: number, curr: any) => acc + (Number(curr.skor) || 0), 0);

                    const totalKekuatan = sumSkor('Kekuatan');
                    const totalKelemahan = sumSkor('Kelemahan');
                    const totalPeluang = sumSkor('Peluang');
                    const totalAncaman = sumSkor('Tantangan'); // Tantangan maps to Ancaman

                    // Internal = Kekuatan - Kelemahan
                    const x = totalKekuatan - totalKelemahan;
                    // Eksternal = Peluang - Ancaman
                    const y = totalPeluang - totalAncaman;

                    return {
                        id: unit.id,
                        name: unit.name,
                        x: Number(x.toFixed(2)),
                        y: Number(y.toFixed(2)),
                        score: Number((totalKekuatan + totalKelemahan + totalPeluang + totalAncaman).toFixed(2)),
                        color: COLORS[index % COLORS.length],
                        details: { totalKekuatan, totalKelemahan, totalPeluang, totalAncaman }
                    };
                }).filter(Boolean);

                setChartData(mappedData as any[]);
            } else {
                setChartData([]);
            }
        } catch (error) {
            console.error("Error fetching kartesius data:", error);
        } finally {
            setLoading(false);
        }
    }, [selectedYear]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleDownloadPDF = async () => {
        if (!chartRef.current) return;
        setLoading(true);
        try {
            // Render chart to Canvas using html2canvas-pro
            const canvas = await html2canvas(chartRef.current, { backgroundColor: '#ffffff', scale: 2 });
            const chartImg = canvas.toDataURL('image/png', 1.0);

            const doc = new jsPDF('p', 'pt', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();

            const hexToRgb = (hex: string): [number, number, number] => {
                const def: [number, number, number] = [19, 127, 236]; // Blue primary
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
                d.setDrawColor(30, 41, 59);
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

            doc.setFontSize(20);
            doc.setFont('helvetica', 'bold');
            doc.text('LAPORAN DIAGRAM KARTESIUS SWOT', pageWidth / 2, pageHeight / 2 - 60, { align: 'center' });

            doc.setFontSize(14);
            doc.setFont('helvetica', 'normal');
            doc.text(`Tahun Evaluasi: ${selectedYear || 'Semua'}`, pageWidth / 2, pageHeight / 2, { align: 'center' });

            doc.setFontSize(12);
            doc.text((settings?.nama_rs || 'RUMAH SAKIT').toUpperCase(), pageWidth / 2, pageHeight / 2 + 50, { align: 'center' });

            doc.addPage();

            // TOC Page
            let tocPageNum = doc.getCurrentPageInfo().pageNumber;
            doc.addPage(); // skip for TOC

            let contentPageStart = doc.getCurrentPageInfo().pageNumber;

            // Draw KOP Surat on first content page
            drawKopSurat(doc);

            doc.setTextColor(30, 41, 59);
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('A. Pemetaan Diagram Kartesius SWOT', 40, 140);

            // Add the Chart diagram image
            // Width available: 595 - 80 = 515. Maintain aspect ratio (e.g. 515 x 280)
            doc.addImage(chartImg, 'PNG', 40, 160, 515, 280);

            // Move to Page 4: tabulasi data table
            doc.addPage();
            addHeader(doc, 'Tabulasi SWOT');

            doc.setTextColor(30, 41, 59);
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('B. Tabulasi Evaluasi Posisi SWOT', 40, 80);

            let rowIdx = 1;
            const tableData = filteredData.map(row => {
                let kuadran = "";
                let rekom = "";
                if (row.x >= 0 && row.y >= 0) { kuadran = "Kuadran I"; rekom = "Agresif / Pertumbuhan"; }
                else if (row.x < 0 && row.y >= 0) { kuadran = "Kuadran II"; rekom = "Diversifikasi"; }
                else if (row.x < 0 && row.y < 0) { kuadran = "Kuadran III"; rekom = "Defensif / Bertahan"; }
                else { kuadran = "Kuadran IV"; rekom = "Turnaround / Pembenahan"; }

                return [
                    rowIdx++,
                    row.name || '-',
                    row.x.toFixed(2),
                    row.y.toFixed(2),
                    kuadran,
                    rekom
                ];
            });

            if (tableData.length === 0) {
                tableData.push(['-', 'Belum ada data', '-', '-', '-', '-']);
            }

            autoTable(doc, {
                startY: 100,
                head: [['No', 'Unit Kerja', 'Skor Internal (X)', 'Skor Eksternal (Y)', 'Kuadran', 'Rekomendasi Strategi']],
                body: tableData,
                theme: 'grid',
                headStyles: { fillColor: rgbColor, fontSize: 8, fontStyle: 'bold' },
                styles: { fontSize: 8, cellPadding: 5 },
                columnStyles: {
                    0: { cellWidth: 30, halign: 'center' },
                    1: { cellWidth: 150 },
                    2: { cellWidth: 80, halign: 'center' },
                    3: { cellWidth: 80, halign: 'center' },
                    4: { cellWidth: 70, halign: 'center' },
                    5: { cellWidth: 105 }
                },
                margin: { left: 40, right: 40 },
                didDrawPage: (data) => {
                    const currentPage = doc.getCurrentPageInfo().pageNumber;
                    if (currentPage > contentPageStart) {
                        addHeader(doc, 'Laporan Diagram Kartesius SWOT');
                    }
                }
            });

            let finalY = (doc as any).lastAutoTable.finalY + 30;

            // Signature block
            if (finalY > pageHeight - 150) {
                doc.addPage();
                finalY = 70;
            }

            doc.setFontSize(9.5);
            doc.setTextColor(51, 65, 85);
            doc.setFont('helvetica', 'normal');
            doc.text('Disiapkan oleh,', 60, finalY);
            doc.text(settings?.jabatan_penandatangan_kiri || 'Penanggungjawab Unit', 60, finalY + 14);
            doc.line(60, finalY + 65, 200, finalY + 65);
            doc.text(settings?.nama_penandatangan_kiri || '............................', 60, finalY + 78);

            doc.text('Disetujui oleh,', pageWidth - 200, finalY);
            doc.setFont('helvetica', 'bold');
            doc.text(settings?.kepala_rs || 'Direktur RS', pageWidth - 200, finalY + 14);
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

            doc.text('1. Pemetaan Diagram Kartesius SWOT (Visualisasi)', 40, 140);
            doc.text(`${contentPageStart - 1}`, pageWidth - 40, 140, { align: 'right' });

            doc.text('2. Tabulasi Nilai Evaluasi & Rekomendasi Strategi', 40, 160);
            doc.text(`${contentPageStart}`, pageWidth - 40, 160, { align: 'right' });

            doc.text('3. Lembar Kesepakatan & Pengesahan Laporan', 40, 180);
            const lastPage = doc.getNumberOfPages();
            doc.text(`${lastPage - 1}`, pageWidth - 40, 180, { align: 'right' });

            addFooter(doc);
            doc.save(`Laporan_Kartesius_SWOT_${selectedYear || 'Semua'}.pdf`);
        } catch (err) {
            console.error('Failed to generate PDF Laporan', err);
            alert('Gagal mengunduh laporan PDF');
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadExcel = () => {
        const exportData = filteredData.map((row, i) => {
            let kuadran = "";
            let rekom = "";
            if (row.x >= 0 && row.y >= 0) { kuadran = "Kuadran I"; rekom = "Agresif / Pertumbuhan"; }
            else if (row.x < 0 && row.y >= 0) { kuadran = "Kuadran II"; rekom = "Diversifikasi"; }
            else if (row.x < 0 && row.y < 0) { kuadran = "Kuadran III"; rekom = "Defensif / Bertahan"; }
            else { kuadran = "Kuadran IV"; rekom = "Turnaround / Pembenahan"; }

            return {
                'No': i + 1,
                'Unit Kerja': row.name,
                'Total Skor Kekuatan': row.details.totalKekuatan,
                'Total Skor Kelemahan': row.details.totalKelemahan,
                'Skor Internal (X)': row.x,
                'Total Skor Peluang': row.details.totalPeluang,
                'Total Skor Ancaman': row.details.totalAncaman,
                'Skor Eksternal (Y)': row.y,
                'Total Skor Keseluruhan': row.score,
                'Posisi Kuadran': kuadran,
                'Rekomendasi Strategi': rekom
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(exportData);

        // Auto fit columns
        const colWidths = [
            { wpx: 40 }, { wpx: 200 }, { wpx: 120 }, { wpx: 130 }, { wpx: 100 },
            { wpx: 120 }, { wpx: 120 }, { wpx: 100 }, { wpx: 140 }, { wpx: 100 }, { wpx: 150 }
        ];
        worksheet['!cols'] = colWidths;

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, `Tabulasi SWOT ${selectedYear}`);
        XLSX.writeFile(workbook, `Laporan-Tabulasi-SWOT-${selectedYear}.xlsx`);
    };

    const filteredData = selectedUnit === 'semua'
        ? chartData
        : chartData.filter(d => d.id === selectedUnit);

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-white p-3 rounded-lg shadow-xl border border-slate-200 text-sm z-50">
                    <p className="font-bold text-slate-800 mb-2 border-b pb-1">{data.name}</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-2">
                        <span className="text-slate-500">Kekuatan:</span> <span className="font-semibold text-emerald-600">+{data.details.totalKekuatan}</span>
                        <span className="text-slate-500">Kelemahan:</span> <span className="font-semibold text-rose-600">-{data.details.totalKelemahan}</span>
                        <span className="text-slate-500">Peluang:</span> <span className="font-semibold text-blue-600">+{data.details.totalPeluang}</span>
                        <span className="text-slate-500">Ancaman:</span> <span className="font-semibold text-amber-600">-{data.details.totalAncaman}</span>
                    </div>
                    <div className="border-t pt-1 mb-1">
                        <p className="text-slate-700">Internal (X) = <span className="font-bold">{data.x}</span></p>
                        <p className="text-slate-700">Eksternal (Y) = <span className="font-bold">{data.y}</span></p>
                    </div>
                </div>
            );
        }
        return null;
    };

    // calculate dynamic domain rounding up to next hundreds or tens to fit all points
    const maxX = Math.max(...filteredData.map(d => Math.abs(d.x)), 10) * 1.2;
    const maxY = Math.max(...filteredData.map(d => Math.abs(d.y)), 10) * 1.2;
    const dynamicDomainX = [-maxX, maxX];
    const dynamicDomainY = [-maxY, maxY];

    return (
        <div className="p-6 max-w-7xl mx-auto pb-12">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 mb-2">Diagram Kartesius SWOT</h1>
                    <p className="text-slate-500">Pemetaan posisi strategis unit kerja berdasarkan evaluasi Internal dan Eksternal.</p>
                </div>

                <div className="flex space-x-3 mt-4 md:mt-0">
                    <button
                        onClick={handleDownloadPDF}
                        className="flex items-center space-x-2 px-4 py-2 bg-white border border-primary/20 text-primary hover:bg-primary/5 rounded-lg transition-colors shadow-sm"
                        disabled={loading || chartData.length === 0}
                    >
                        <FileText size={16} />
                        <span className="text-sm font-medium">Laporan</span>
                    </button>
                    <button
                        onClick={handleDownloadExcel}
                        className="flex items-center space-x-2 px-4 py-2 bg-[#10b981] text-white rounded-lg hover:bg-[#059669] transition-colors shadow-sm"
                        disabled={loading || chartData.length === 0}
                    >
                        <FileSpreadsheet size={16} />
                        <span className="text-sm font-medium">Laporan (Excel)</span>
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-wrap gap-4 items-center">
                <div className="flex items-center space-x-2 text-slate-500">
                    <Filter size={18} />
                    <span className="font-medium text-sm">Filter:</span>
                </div>

                <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#137fec] focus:border-transparent text-slate-700 bg-slate-50"
                >
                    {(availableYears.length > 0 ? availableYears : [CURRENT_YEAR + 1, CURRENT_YEAR, CURRENT_YEAR - 1]).map(y => (
                        <option key={y} value={y}>Tahun {y}</option>
                    ))}
                </select>

                <select
                    value={selectedUnit}
                    onChange={(e) => setSelectedUnit(e.target.value)}
                    className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#137fec] focus:border-transparent text-slate-700 bg-slate-50 min-w-[200px]"
                >
                    <option value="semua">Semua Unit Kerja</option>
                    {units.map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                </select>

                <button
                    type="button"
                    onClick={() => fetchData()}
                    className="flex items-center space-x-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-sm text-slate-700 font-medium transition-colors shadow-sm ml-auto"
                    disabled={loading}
                    title="Refresh Data"
                >
                    <RotateCw size={14} className={loading ? "animate-spin animate-infinite" : ""} />
                    <span>Refresh</span>
                </button>
            </div>

            {loading ? (
                <div className="text-center py-20 bg-white rounded-xl shadow-sm border border-slate-200">
                    <div className="animate-spin w-8 h-8 rounded-full border-4 border-slate-200 border-t-[#137fec] mx-auto mb-4"></div>
                    <p className="text-slate-500 font-medium">Memuat data diagram...</p>
                </div>
            ) : chartData.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-xl shadow-sm border border-slate-200">
                    <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Target className="text-slate-400" size={32} />
                    </div>
                    <h3 className="font-bold text-slate-700 mb-1">Belum Ada Data SWOT</h3>
                    <p className="text-slate-500 text-sm">Silakan isi evaluasi SWOT untuk tahun {selectedYear} terlebih dahulu.</p>
                </div>
            ) : (
                <>
                    {/* Main Chart Area */}
                    <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 mb-8" ref={chartRef}>
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center mb-4 md:mb-0">
                                <Target size={24} className="mr-3 text-[#137fec]" />
                                Peta Kuadran Strategi {selectedYear}
                            </h2>
                            <div className="flex flex-wrap gap-4 text-xs font-semibold bg-slate-50 px-4 py-2 rounded-lg border border-slate-100">
                                <div className="flex items-center"><span className="w-3 h-3 bg-[#10b981] rounded-full mr-1.5 shadow-sm"></span> Kuadran 1 (Agresif)</div>
                                <div className="flex items-center"><span className="w-3 h-3 bg-[#3b82f6] rounded-full mr-1.5 shadow-sm"></span> Kuadran 2 (Diversifikasi)</div>
                                <div className="flex items-center"><span className="w-3 h-3 bg-[#f59e0b] rounded-full mr-1.5 shadow-sm"></span> Kuadran 3 (Defensif)</div>
                                <div className="flex items-center"><span className="w-3 h-3 bg-[#ef4444] rounded-full mr-1.5 shadow-sm"></span> Kuadran 4 (Turnaround)</div>
                            </div>
                        </div>

                        <div className="h-[600px] w-full relative">
                            {/* Quadrant Labels */}
                            <div className="absolute top-6 right-10 font-black text-slate-100 text-4xl pointer-events-none select-none tracking-widest">KUADRAN I</div>
                            <div className="absolute top-6 left-10 font-black text-slate-100 text-4xl pointer-events-none select-none tracking-widest">KUADRAN II</div>
                            <div className="absolute bottom-16 left-10 font-black text-slate-100 text-4xl pointer-events-none select-none tracking-widest">KUADRAN III</div>
                            <div className="absolute bottom-16 right-10 font-black text-slate-100 text-4xl pointer-events-none select-none tracking-widest">KUADRAN IV</div>

                            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                <ScatterChart margin={{ top: 30, right: 30, bottom: 30, left: 30 }}>
                                    <CartesianGrid strokeDasharray="4 4" opacity={0.4} stroke="#cbd5e1" />
                                    <XAxis
                                        type="number"
                                        dataKey="x"
                                        name="Internal"
                                        domain={dynamicDomainX}
                                        tickCount={11}
                                        stroke="#475569"
                                        tick={{ fontSize: 12, fontWeight: 500 }}
                                        label={{ value: 'Kelemahan (-X) ← Faktor Internal (IFAS) → Kekuatan (+X)', position: 'bottom', offset: -15, fontWeight: 600, fill: '#475569' }}
                                    />
                                    <YAxis
                                        type="number"
                                        dataKey="y"
                                        name="Eksternal"
                                        domain={dynamicDomainY}
                                        tickCount={11}
                                        stroke="#475569"
                                        tick={{ fontSize: 12, fontWeight: 500 }}
                                        label={{ value: 'Ancaman (-Y) ← Faktor Eksternal (EFAS) → Peluang (+Y)', angle: -90, position: 'left', offset: 0, fontWeight: 600, fill: '#475569', style: { textAnchor: 'middle' } }}
                                    />
                                    <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />

                                    {/* Main Axis Lines */}
                                    <ReferenceLine y={0} stroke="#475569" strokeWidth={2.5} opacity={0.8} />
                                    <ReferenceLine x={0} stroke="#475569" strokeWidth={2.5} opacity={0.8} />

                                    <Scatter name="Units" data={filteredData}>
                                        {filteredData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Scatter>
                                </ScatterChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Detail Table */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center">
                            <TableIcon className="text-slate-500 mr-2" size={20} />
                            <h3 className="font-bold text-slate-800">Tabulasi Data Posisi Strategis</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-100 text-slate-600 text-xs uppercase tracking-wider font-bold">
                                        <th className="px-6 py-4 border-b border-r border-slate-200 w-12 text-center">No</th>
                                        <th className="px-6 py-4 border-b border-r border-slate-200">Unit Kerja</th>
                                        <th className="px-6 py-4 border-b border-r border-slate-200 text-center">Internal (X)<br /><span className="text-[10px] text-slate-400 font-medium normal-case">Kekuatan - Kelemahan</span></th>
                                        <th className="px-6 py-4 border-b border-r border-slate-200 text-center">Eksternal (Y)<br /><span className="text-[10px] text-slate-400 font-medium normal-case">Peluang - Ancaman</span></th>
                                        <th className="px-6 py-4 border-b border-r border-slate-200 text-center">Kuadran</th>
                                        <th className="px-6 py-4 border-b border-slate-200">Rekomendasi Strategi</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm divide-y divide-slate-100">
                                    {filteredData.map((row, i) => {
                                        let kuadran = "";
                                        let rekom = "";
                                        let badgeColor = "";

                                        if (row.x >= 0 && row.y >= 0) {
                                            kuadran = "Kuadran I"; rekom = "Agresif / Pertumbuhan"; badgeColor = "bg-emerald-100 text-emerald-800 border-emerald-200";
                                        } else if (row.x < 0 && row.y >= 0) {
                                            kuadran = "Kuadran II"; rekom = "Diversifikasi"; badgeColor = "bg-blue-100 text-blue-800 border-blue-200";
                                        } else if (row.x < 0 && row.y < 0) {
                                            kuadran = "Kuadran III"; rekom = "Defensif / Bertahan"; badgeColor = "bg-amber-100 text-amber-800 border-amber-200";
                                        } else {
                                            kuadran = "Kuadran IV"; rekom = "Turnaround / Pembenahan"; badgeColor = "bg-rose-100 text-rose-800 border-rose-200";
                                        }

                                        return (
                                            <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4 border-r border-slate-100 text-center font-medium text-slate-500">{i + 1}</td>
                                                <td className="px-6 py-4 border-r border-slate-100 font-bold text-slate-700 flex items-center gap-3">
                                                    <span className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: row.color }}></span>
                                                    {row.name}
                                                </td>
                                                <td className="px-6 py-4 border-r border-slate-100 text-center font-semibold text-slate-700">{row.x}</td>
                                                <td className="px-6 py-4 border-r border-slate-100 text-center font-semibold text-slate-700">{row.y}</td>
                                                <td className="px-6 py-4 border-r border-slate-100 text-center font-bold text-slate-800">{kuadran}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-3 py-1.5 rounded-md text-xs font-bold border ${badgeColor}`}>
                                                        {rekom}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
