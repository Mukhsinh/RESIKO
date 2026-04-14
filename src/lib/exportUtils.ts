import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export interface ReportConfig {
    title: string;
    subtitle: string;
    year: string;
    type: 'Strategi' | 'Risiko' | 'Eksekutif';
}

export function exportToExcel(data: any[], config: ReportConfig, sheets?: { sheetName: string, data: any[] }[]) {
    const wb = XLSX.utils.book_new();

    if (sheets && sheets.length > 0) {
        sheets.forEach((s) => {
            const ws = XLSX.utils.json_to_sheet(s.data);
            XLSX.utils.book_append_sheet(wb, ws, s.sheetName);
        });
    } else {
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, config.title.substring(0, 31));
    }

    XLSX.writeFile(wb, `Laporan_${config.type}_${config.year}.xlsx`);
}

export function exportToPDF(config: ReportConfig, contentRenderer: (doc: jsPDF, startY: number) => void) {
    const doc = new jsPDF('p', 'pt', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // 1. Cover Page
    doc.setFillColor(19, 127, 236); // #137fec
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    const titleText = `LAPORAN ${config.type.toUpperCase()}`;
    doc.text(titleText, pageWidth / 2, pageHeight / 2 - 40, { align: 'center' });

    doc.setFontSize(20);
    doc.setFont('helvetica', 'normal');
    doc.text(`Tahun ${config.year}`, pageWidth / 2, pageHeight / 2, { align: 'center' });

    doc.setFontSize(14);
    doc.text('RUMAH SAKIT ANTIGRAVITY', pageWidth / 2, pageHeight / 2 + 40, { align: 'center' });

    doc.setFontSize(10);
    doc.text('Dicetak pada: ' + new Date().toLocaleDateString('id-ID'), pageWidth / 2, pageHeight - 50, { align: 'center' });

    doc.addPage();

    // 2. Daftar Isi (TOC)
    let pageNumbers: { title: string; page: number }[] = [];
    let tocPageNumber = doc.getCurrentPageInfo().pageNumber;

    // Helper functions
    const addHeader = (d: jsPDF) => {
        d.setFillColor(248, 250, 252);
        d.rect(0, 0, pageWidth, 60, 'F');
        d.setTextColor(19, 127, 236);
        d.setFontSize(16);
        d.setFont('helvetica', 'bold');
        d.text('RS ANTIGRAVITY', 40, 35);
        d.setTextColor(100, 116, 139);
        d.setFontSize(10);
        d.setFont('helvetica', 'normal');
        d.text(config.title, pageWidth - 40, 35, { align: 'right' });
    };

    const addFooter = (d: jsPDF) => {
        const totalPages = d.getNumberOfPages();
        for (let i = 2; i <= totalPages; i++) { // Skip cover page
            d.setPage(i);
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

    // Main Content
    addHeader(doc);
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('1. Ringkasan Laporan', 40, 100);
    pageNumbers.push({ title: 'Ringkasan Laporan', page: doc.getCurrentPageInfo().pageNumber - 1 });

    // Add custom content from page
    contentRenderer(doc, 130);

    // Apply headers and footers
    addFooter(doc);

    // Add actual TOC content (Back to TOC page)
    // Wait, adding TOC at the end then moving it is tricky. We'll simply insert the TOC page, then render content, then come back.
    doc.setPage(tocPageNumber);
    addHeader(doc);
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Daftar Isi', 40, 100);

    let yPos = 130;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    pageNumbers.forEach((item, index) => {
        doc.text(`${item.title}`, 40, yPos);
        const dotsStr = '.'.repeat(120); // rough estimation
        doc.text(dotsStr, 200, yPos, { maxWidth: pageWidth - 260, align: 'left' });
        doc.text(`${item.page}`, pageWidth - 40, yPos, { align: 'right' });
        yPos += 20;
    });

    doc.save(`Laporan_${config.type}_${config.year}.pdf`);
}
