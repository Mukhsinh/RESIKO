import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { ManajemenRisiko, ManajemenStrategi } from '@/lib/supabase';

export interface KRIRow {
    id: string;
    unit_kerja_id?: string;
    nama_kri: string;
    nilai_aktual?: number;
    batas_atas?: number;
    status: string;
    unit_kerja?: { id: string; nama_unit: string };
}

export interface LossEventRow {
    id: string;
    unit_kerja_id?: string;
    judul_kejadian: string;
    dampak_finansial?: number;
    status?: string;
    unit_kerja?: { id: string; nama_unit: string };
}

export interface StrategicObjItem {
    id: string;
    title: string;
    perspective: 'financial' | 'customer' | 'internal' | 'learning';
    unit: string;
}

export interface KartesiusRow {
    no: number;
    unit: string;
    totalK: number;
    totalW: number;
    x: number;
    totalP: number;
    totalT: number;
    y: number;
    kuadran: string;
    rekom: string;
}

export interface ExportDataParams {
    year: string;
    unitLabel: string;
    filteredRisiko: ManajemenRisiko[];
    filteredStrategi: ManajemenStrategi[];
    filteredKris: KRIRow[];
    filteredLossEvents: LossEventRow[];
    topKpiFail: ManajemenStrategi[];
    topRisks: ManajemenRisiko[];
    riskByLevel: { sangatTinggi: number; tinggi: number; sedang: number; rendah: number };
    kartesiusRows: KartesiusRow[];
    strategicObjectives: StrategicObjItem[];
    kpiAchieved: number;
    kpiPct: number;
    highRisk: number;
    closedRisk: number;
    riskClosePct: number;
    totalLossValuation: number;
    kriOverLimit: number;
    settings: any;
}

export const hexToRgb = (hex: string): [number, number, number] => {
    const def: [number, number, number] = [19, 127, 236];
    if (!hex) return def;
    const h = hex.replace('#', '');
    if (h.length !== 6) return def;
    const num = parseInt(h, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
};

export const getMatrixCellColor = (p: number, d: number): [number, number, number] => {
    const sc = p * d;
    if (sc >= 15) return [254, 202, 202];
    if (sc >= 10) return [254, 215, 170];
    if (sc >= 5) return [254, 243, 199];
    return [209, 250, 229];
};

export const exportExecutivePDF = (params: ExportDataParams) => {
    const {
        year, unitLabel, filteredRisiko, filteredStrategi, filteredLossEvents,
        topKpiFail, topRisks, kartesiusRows, strategicObjectives, kpiAchieved,
        kpiPct, highRisk, closedRisk, riskClosePct, totalLossValuation,
        kriOverLimit, settings
    } = params;

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
            if (i === 1) continue; // Skip cover page
            d.setTextColor(148, 163, 184);
            d.setFontSize(8);
            d.setFont('helvetica', 'normal');
            d.text(settings?.footer || 'Laporan Eksekutif Terpadu Rumah Sakit', 40, pageHeight - 30);
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
            d.setFont('helvetica', 'italic');
            d.setFontSize(8);
            d.text(`"${settings.tagline}"`, 40, 98);
        }
    };

    // ====== 1. COVER PAGE ======
    doc.setFillColor(rgbColor[0], rgbColor[1], rgbColor[2]);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('LAPORAN EKSEKUTIF TERPADU', pageWidth / 2, pageHeight / 2 - 80, { align: 'center' });
    doc.setFontSize(15);
    doc.setFont('helvetica', 'normal');
    doc.text('Manajemen Strategi & Manajemen Risiko', pageWidth / 2, pageHeight / 2 - 45, { align: 'center' });
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(`Tahun Evaluasi: ${year} | Unit: ${unitLabel}`, pageWidth / 2, pageHeight / 2 + 5, { align: 'center' });
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text((settings?.nama_rs || 'RUMAH SAKIT').toUpperCase(), pageWidth / 2, pageHeight / 2 + 50, { align: 'center' });

    // ====== 2. TOC PAGE ======
    doc.addPage();
    const tocPageNum = doc.getCurrentPageInfo().pageNumber;

    // ====== 3. SECTION A: EXECUTIVE SUMMARY ======
    doc.addPage();
    const pSummary = doc.getCurrentPageInfo().pageNumber;
    drawKopSurat(doc);
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('A. Ringkasan Eksekutif Terpadu', 40, 135);

    const metrics = [
        { label: 'Capaian KPI Strategi', val: `${kpiPct}%`, sub: `${kpiAchieved}/${filteredStrategi.length} Tercapai`, color: [239, 246, 255] as [number, number, number], textCol: [30, 64, 175] as [number, number, number] },
        { label: 'Risiko Ditangani', val: `${riskClosePct}%`, sub: `${closedRisk}/${filteredRisiko.length} Closed`, color: [236, 253, 245] as [number, number, number], textCol: [6, 95, 70] as [number, number, number] },
        { label: 'Risiko Sangat Tinggi', val: String(highRisk), sub: 'Perlu Monitoring', color: [254, 242, 242] as [number, number, number], textCol: [153, 27, 27] as [number, number, number] },
        { label: 'Valuasi Loss Event', val: `Rp ${(totalLossValuation / 1_000_000).toFixed(1)}Jt`, sub: `${filteredLossEvents.length} Event`, color: [255, 251, 235] as [number, number, number], textCol: [146, 64, 14] as [number, number, number] },
    ];

    const boxW = (pageWidth - 80 - 30) / 4;
    const boxY = 150;
    metrics.forEach((m, idx) => {
        const bx = 40 + idx * (boxW + 10);
        doc.setFillColor(m.color[0], m.color[1], m.color[2]);
        doc.roundedRect(bx, boxY, boxW, 52, 6, 6, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(bx, boxY, boxW, 52, 6, 6, 'S');

        doc.setFontSize(7.5); doc.setFont('helvetica', 'bold');
        doc.setTextColor(m.textCol[0], m.textCol[1], m.textCol[2]);
        doc.text(m.label, bx + boxW / 2, boxY + 16, { align: 'center' });

        doc.setFontSize(14); doc.setFont('helvetica', 'bold');
        doc.text(m.val, bx + boxW / 2, boxY + 34, { align: 'center' });

        doc.setFontSize(7); doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text(m.sub, bx + boxW / 2, boxY + 45, { align: 'center' });
    });

    let expY = 215;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(40, expY, pageWidth - 80, 100, 6, 6, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(40, expY, pageWidth - 80, 100, 6, 6, 'S');

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Kinerja Eksekutif Tahun ${year} (${unitLabel}):`, 52, expY + 18);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);

    const summaryLines = [
        `1. Manajemen Strategi: ${kpiAchieved} dari ${filteredStrategi.length} KPI (${kpiPct}%) berhasil mencapai target yang ditetapkan.`,
        `2. Identifikasi Risiko: Terdaftar ${filteredRisiko.length} risiko, dengan ${highRisk} risiko berkategori Sangat Tinggi (≥15). ${closedRisk} risiko (${riskClosePct}%) telah Closed.`,
        `3. Early Warning KRI & Incident: ${kriOverLimit} indikator KRI melampaui limit dan ${filteredLossEvents.length} kejadian loss event tercatat dengan total potensi kerugian Rp ${totalLossValuation.toLocaleString('id-ID')}.`,
    ];

    let lineY = expY + 32;
    summaryLines.forEach(txt => {
        const wrapped = doc.splitTextToSize(txt, pageWidth - 104);
        doc.text(wrapped, 52, lineY);
        lineY += wrapped.length * 11;
    });

    // ====== 4. SECTION B: DIAGRAM KARTESIUS SWOT ======
    doc.addPage();
    const pKartesius = doc.getCurrentPageInfo().pageNumber;
    addHeader(doc, 'Diagram Kartesius SWOT');

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('B. Visualisasi Diagram Kartesius SWOT', 40, 75);

    const chartX = 140;
    const chartY = 90;
    const chartW = 315;
    const chartH = 160;
    const centerX = chartX + chartW / 2;
    const centerY = chartY + chartH / 2;

    doc.setFillColor(248, 250, 252);
    doc.rect(chartX, chartY, chartW, chartH, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(1);
    doc.rect(chartX, chartY, chartW, chartH, 'S');

    doc.setDrawColor(71, 85, 105);
    doc.setLineWidth(1.5);
    doc.line(chartX, centerY, chartX + chartW, centerY);
    doc.line(centerX, chartY, centerX, chartY + chartH);

    doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(148, 163, 184);
    doc.text('KUADRAN I (Agresif)', chartX + chartW - 10, chartY + 14, { align: 'right' });
    doc.text('KUADRAN II (Diversifikasi)', chartX + 10, chartY + 14, { align: 'left' });
    doc.text('KUADRAN III (Defensif)', chartX + 10, chartY + chartH - 10, { align: 'left' });
    doc.text('KUADRAN IV (Turnaround)', chartX + chartW - 10, chartY + chartH - 10, { align: 'right' });

    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139);
    doc.text('Faktor Internal (+X Kekuatan / -X Kelemahan)', centerX, chartY + chartH + 12, { align: 'center' });

    const maxValX = Math.max(...kartesiusRows.map(k => Math.abs(k.x)), 5) * 1.2;
    const maxValY = Math.max(...kartesiusRows.map(k => Math.abs(k.y)), 5) * 1.2;

    kartesiusRows.forEach(k => {
        const px = centerX + (k.x / maxValX) * (chartW / 2 - 20);
        const py = centerY - (k.y / maxValY) * (chartH / 2 - 20);
        doc.setFillColor(19, 127, 236);
        doc.circle(px, py, 4, 'F');
        doc.setFontSize(6.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 41, 59);
        doc.text(`${k.unit} (${k.x}, ${k.y})`, px + 6, py + 2);
    });

    const kartTableData = kartesiusRows.map(k => [k.no, k.unit, k.x.toFixed(2), k.y.toFixed(2), k.kuadran, k.rekom]);
    autoTable(doc, {
        startY: chartY + chartH + 25,
        head: [['No', 'Unit Kerja', 'Internal (X)', 'Eksternal (Y)', 'Posisi Kuadran', 'Rekomendasi Strategi']],
        body: kartTableData.length > 0 ? kartTableData : [['-', 'Belum ada data SWOT', '-', '-', '-', '-']],
        theme: 'grid',
        headStyles: { fillColor: rgbColor, fontSize: 8, fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 4 },
        columnStyles: {
            0: { cellWidth: 25, halign: 'center' },
            1: { cellWidth: 130 },
            2: { cellWidth: 70, halign: 'center' },
            3: { cellWidth: 70, halign: 'center' },
            4: { cellWidth: 80, halign: 'center' },
            5: { cellWidth: 140 }
        },
        margin: { left: 40, right: 40 },
        didDrawPage: () => addHeader(doc, 'Diagram Kartesius SWOT')
    });

    // ====== 5. SECTION C: STRATEGIC MAP BSC ======
    doc.addPage();
    const pMap = doc.getCurrentPageInfo().pageNumber;
    addHeader(doc, 'Strategic Map');

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('C. Strategic Map (Peta Strategi 4 Perspektif BSC)', 40, 75);

    const bscPerspectives = [
        { key: 'financial', label: '1. Perspektif Keuangan (Financial)' },
        { key: 'customer', label: '2. Perspektif Pelanggan (Customer)' },
        { key: 'internal', label: '3. Perspektif Proses Bisnis Internal' },
        { key: 'learning', label: '4. Perspektif Pembelajaran & Pertumbuhan' },
    ];

    let mapY = 90;
    bscPerspectives.forEach(p => {
        if (mapY > pageHeight - 120) {
            doc.addPage();
            mapY = 70;
        }
        doc.setFontSize(9.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 41, 59);
        doc.text(p.label, 40, mapY + 12);

        const items = strategicObjectives.filter(o => o.perspective === p.key);
        const mapTableData = items.map((o, idx) => [idx + 1, o.unit, o.title]);

        autoTable(doc, {
            startY: mapY + 18,
            head: [['No', 'Unit Kerja', 'Sasaran Strategis']],
            body: mapTableData.length > 0 ? mapTableData : [['-', '-', 'Belum ada sasaran']],
            theme: 'grid',
            headStyles: { fillColor: rgbColor, fontSize: 7.5, fontStyle: 'bold' },
            styles: { fontSize: 7.5, cellPadding: 3 },
            columnStyles: { 0: { cellWidth: 25, halign: 'center' }, 1: { cellWidth: 120 }, 2: { cellWidth: 370 } },
            margin: { left: 40, right: 40 },
            didDrawPage: () => addHeader(doc, 'Strategic Map')
        });
        mapY = (doc as any).lastAutoTable.finalY + 15;
    });

    // ====== 6. SECTION D: HEATMAP RISIKO 5x5 ======
    doc.addPage();
    const pHeatmap = doc.getCurrentPageInfo().pageNumber;
    addHeader(doc, 'Visualisasi Heatmap Risiko');

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('D. Visualisasi Matriks Heatmap Risiko 5x5', 40, 75);

    const gridStartX = 90;
    const gridStartY = 95;
    const cellW = 82;
    const cellH = 40;

    doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(71, 85, 105);
    doc.text('P R O B A B I L I T A S', 30, gridStartY + (cellH * 2.5), { angle: 90, align: 'center' });
    doc.text('D A M P A K', gridStartX + (cellW * 2.5), gridStartY + (cellH * 5) + 25, { align: 'center' });

    for (let p = 5; p >= 1; p--) {
        const rowIndex = 5 - p;
        const cy = gridStartY + rowIndex * cellH;
        doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(71, 85, 105);
        doc.text(`P${p}`, gridStartX - 15, cy + cellH / 2 + 3);

        for (let d = 1; d <= 5; d++) {
            const colIndex = d - 1;
            const cx = gridStartX + colIndex * cellW;
            if (p === 1) {
                doc.text(`D${d}`, cx + cellW / 2, gridStartY + 5 * cellH + 14, { align: 'center' });
            }

            const bg = getMatrixCellColor(p, d);
            doc.setFillColor(bg[0], bg[1], bg[2]);
            doc.rect(cx, cy, cellW, cellH, 'F');
            doc.setDrawColor(255, 255, 255);
            doc.setLineWidth(1.5);
            doc.rect(cx, cy, cellW, cellH, 'S');

            doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(148, 163, 184);
            doc.text(`${p * d}`, cx + cellW - 4, cy + 9, { align: 'right' });

            const inhCount = filteredRisiko.filter(r => (r.probabilitas || 0) === p && (r.dampak || 0) === d).length;
            const resCount = filteredRisiko.filter(r => {
                const pr = (r as any).probabilitas_residual ?? Math.ceil((r.probabilitas || 1) * 0.5);
                const dr = (r as any).dampak_residual ?? Math.ceil((r.dampak || 1) * 0.8);
                return pr === p && dr === d;
            }).length;
            const appCount = filteredRisiko.filter(r => {
                let pa = (r as any).probabilitas_appetite;
                let da = (r as any).dampak_appetite;
                if (!pa || !da) {
                    const s = (r as any).selera_risiko ?? 6;
                    if (s <= 4) { pa = 2; da = 2; }
                    else if (s <= 6) { pa = 2; da = 3; }
                    else if (s <= 9) { pa = 3; da = 3; }
                    else { pa = 2; da = 3; }
                }
                return pa === p && da === d;
            }).length;

            const activeBadges: { tag: string; count: number; color: [number, number, number] }[] = [];
            if (inhCount > 0) activeBadges.push({ tag: 'I', count: inhCount, color: [225, 29, 72] });
            if (resCount > 0) activeBadges.push({ tag: 'R', count: resCount, color: [5, 150, 105] });
            if (appCount > 0) activeBadges.push({ tag: 'A', count: appCount, color: [37, 99, 235] });

            if (activeBadges.length > 0) {
                const bCount = activeBadges.length;
                const bWidth = bCount === 3 ? 22 : bCount === 2 ? 30 : 36;
                const gap = 3;
                const startX = cx + (cellW - (bCount * bWidth + (bCount - 1) * gap)) / 2;

                activeBadges.forEach((b, idx) => {
                    const bx = startX + idx * (bWidth + gap);
                    doc.setFillColor(b.color[0], b.color[1], b.color[2]);
                    doc.roundedRect(bx, cy + 15, bWidth, 18, 4, 4, 'F');
                    doc.setFontSize(7);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(255, 255, 255);
                    doc.text(`${b.tag}:${b.count}`, bx + bWidth / 2, cy + 27, { align: 'center' });
                });
            }
        }
    }

    // Legend Block for Heatmap Badges
    let legY = gridStartY + 5 * cellH + 35;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(40, legY, pageWidth - 80, 42, 6, 6, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(40, legY, pageWidth - 80, 42, 6, 6, 'S');

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(51, 65, 85);
    doc.text('Keterangan Badge Heatmap:', 52, legY + 16);

    // Badge 1: Inherent
    doc.setFillColor(225, 29, 72);
    doc.roundedRect(52, legY + 22, 26, 13, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7.5);
    doc.text('I: X', 65, legY + 31, { align: 'center' });
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Inherent Risk (Awal)', 82, legY + 31);

    // Badge 2: Residual
    doc.setFillColor(5, 150, 105);
    doc.roundedRect(190, legY + 22, 26, 13, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.text('R: Y', 203, legY + 31, { align: 'center' });
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Residual Risk (Setelah Mitigasi)', 220, legY + 31);

    // Badge 3: Risk Appetite
    doc.setFillColor(37, 99, 235);
    doc.roundedRect(360, legY + 22, 26, 13, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.text('A: Z', 373, legY + 31, { align: 'center' });
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Risk Appetite (Target Selera)', 390, legY + 31);

    // ====== 7. SECTION E: KPI STRATEGI & RISIKO TERTINGGI ======
    doc.addPage();
    const pTopLists = doc.getCurrentPageInfo().pageNumber;
    addHeader(doc, 'Laporan Eksekutif');

    doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 41, 59);
    doc.text('E. Top 5 KPI Belum Tercapai & Top 5 Risiko Tertinggi', 40, 75);

    const kpiFailData = topKpiFail.map((d, i) => [
        String(i + 1), d.sasaran_strategis || '-', d.kpi || '-', (d.unit_kerja as any)?.nama_unit || '-', d.target || '-', d.realisasi || '-', `${Math.round((parseFloat(d.realisasi) / parseFloat(d.target)) * 100)}%`
    ]);

    autoTable(doc, {
        startY: 88,
        head: [['No', 'Sasaran Strategis', 'KPI / Indikator', 'Unit Kerja', 'Target', 'Realisasi', 'Capaian']],
        body: kpiFailData.length > 0 ? kpiFailData : [['-', 'Semua KPI tercapai', '-', '-', '-', '-', '-']],
        theme: 'grid',
        headStyles: { fillColor: rgbColor, fontSize: 7.5, fontStyle: 'bold' },
        styles: { fontSize: 7, cellPadding: 3, overflow: 'linebreak' },
        columnStyles: {
            0: { cellWidth: 22, halign: 'center' },
            1: { cellWidth: 125 },
            2: { cellWidth: 120 },
            3: { cellWidth: 95 },
            4: { cellWidth: 45, halign: 'center' },
            5: { cellWidth: 45, halign: 'center' },
            6: { cellWidth: 45, halign: 'center' },
        },
        margin: { left: 40, right: 40 },
        didDrawPage: () => addHeader(doc, 'Laporan Eksekutif')
    });

    const riskTableData = topRisks.map((r, i) => [
        String(i + 1), r.identifikasi_risiko || '-', (r.unit_kerja as any)?.nama_unit || '-', String(r.probabilitas || '-'), String(r.dampak || '-'), String(r.skor_risiko), r.status || '-', r.mitigasi || '-'
    ]);

    autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 20,
        head: [['No', 'Identifikasi Risiko', 'Unit Kerja', 'Prob.', 'Dmpk.', 'Skor', 'Status', 'Rencana Mitigasi']],
        body: riskTableData.length > 0 ? riskTableData : [['-', 'Tidak ada data risiko', '-', '-', '-', '-', '-', '-']],
        theme: 'grid',
        headStyles: { fillColor: rgbColor, fontSize: 7.5, fontStyle: 'bold' },
        styles: { fontSize: 7, cellPadding: 3, overflow: 'linebreak' },
        columnStyles: {
            0: { cellWidth: 22, halign: 'center' },
            1: { cellWidth: 120 },
            2: { cellWidth: 80 },
            3: { cellWidth: 28, halign: 'center' },
            4: { cellWidth: 28, halign: 'center' },
            5: { cellWidth: 28, halign: 'center' },
            6: { cellWidth: 45, halign: 'center' },
            7: { cellWidth: 145 },
        },
        margin: { left: 40, right: 40 },
        didDrawPage: () => addHeader(doc, 'Laporan Eksekutif')
    });

    // ====== 8. SIGNATURE BLOCK ======
    let finalY = (doc as any).lastAutoTable.finalY + 35;
    if (finalY > pageHeight - 150) {
        doc.addPage();
        addHeader(doc, 'Laporan Eksekutif');
        finalY = 80;
    }

    doc.setFontSize(9.5); doc.setTextColor(51, 65, 85); doc.setFont('helvetica', 'normal');
    doc.text('Disiapkan oleh,', 60, finalY);
    doc.text(settings?.jabatan_penandatangan_kiri || 'Penanggungjawab Unit', 60, finalY + 14);
    doc.line(60, finalY + 60, 200, finalY + 60);
    doc.text(settings?.nama_penandatangan_kiri || '............................', 60, finalY + 72);

    doc.text('Disetujui oleh,', pageWidth - 200, finalY);
    doc.setFont('helvetica', 'bold');
    doc.text(settings?.kepala_rs || 'Direktur RS', pageWidth - 200, finalY + 14);
    doc.line(pageWidth - 200, finalY + 60, pageWidth - 60, finalY + 60);
    doc.setFont('helvetica', 'normal');
    doc.text(`NIP: ${settings?.nip_kepala || '-'}`, pageWidth - 200, finalY + 72);

    // ====== 9. POPULATE TOC ======
    doc.setPage(tocPageNum);
    addHeader(doc, 'Daftar Isi');
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.text('DAFTAR ISI LAPORAN EKSEKUTIF', 40, 95);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(1);
    doc.line(40, 108, pageWidth - 40, 108);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    const tocItems = [
        { label: 'A. Ringkasan Eksekutif Terpadu', page: pSummary },
        { label: 'B. Visualisasi Diagram Kartesius SWOT', page: pKartesius },
        { label: 'C. Strategic Map (Peta Strategi 4 Perspektif BSC)', page: pMap },
        { label: 'D. Visualisasi Matriks Heatmap Risiko 5x5', page: pHeatmap },
        { label: 'E. Top 5 KPI Belum Tercapai & Top 5 Risiko Tertinggi', page: pTopLists },
        { label: 'F. Lembar Pengesahan & Tanda Tangan Pimpinan', page: doc.getNumberOfPages() }
    ];

    let tocY = 130;
    tocItems.forEach(item => {
        doc.text(item.label, 40, tocY);
        doc.text(String(item.page - 1), pageWidth - 40, tocY, { align: 'right' });
        tocY += 22;
    });

    addFooter(doc);
    const cleanUnit = unitLabel.replace(/[^a-zA-Z0-9]/g, '_');
    doc.save(`Laporan_Eksekutif_Terpadu_${year}_${cleanUnit}.pdf`);
};

export const exportExecutiveExcel = (params: ExportDataParams) => {
    const {
        year, unitLabel, filteredRisiko, filteredStrategi, filteredKris,
        filteredLossEvents, kartesiusRows, strategicObjectives, kpiAchieved,
        kpiPct, highRisk, closedRisk, riskClosePct, totalLossValuation
    } = params;

    const wb = XLSX.utils.book_new();

    const summaryRows = [
        { 'Kategori Evaluasi': 'Tahun Evaluasi', 'Nilai / Jumlah': year, 'Keterangan': '' },
        { 'Kategori Evaluasi': 'Unit Kerja Filter', 'Nilai / Jumlah': unitLabel, 'Keterangan': '' },
        { 'Kategori Evaluasi': 'Total KPI Strategi', 'Nilai / Jumlah': filteredStrategi.length, 'Keterangan': '' },
        { 'Kategori Evaluasi': 'KPI Tercapai', 'Nilai / Jumlah': kpiAchieved, 'Keterangan': `${kpiPct}%` },
        { 'Kategori Evaluasi': 'Total Identifikasi Risiko', 'Nilai / Jumlah': filteredRisiko.length, 'Keterangan': '' },
        { 'Kategori Evaluasi': 'Risiko Sangat Tinggi (≥15)', 'Nilai / Jumlah': highRisk, 'Keterangan': '' },
        { 'Kategori Evaluasi': 'Risiko Closed / Selesai', 'Nilai / Jumlah': closedRisk, 'Keterangan': `${riskClosePct}%` },
        { 'Kategori Evaluasi': 'Total Key Risk Indicator (KRI)', 'Nilai / Jumlah': filteredKris.length, 'Keterangan': '' },
        { 'Kategori Evaluasi': 'Valuasi Total Loss Event', 'Nilai / Jumlah': totalLossValuation, 'Keterangan': `Rp ${totalLossValuation.toLocaleString('id-ID')}` },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Ringkasan Eksekutif');

    const stRows = filteredStrategi.map((d, idx) => ({
        'No': idx + 1, 'Tahun': d.tahun, 'Unit Kerja': (d.unit_kerja as any)?.nama_unit || '-', 'Sasaran Strategis': d.sasaran_strategis, 'KPI': d.kpi, 'Target': d.target, 'Realisasi': d.realisasi || '-'
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stRows.length > 0 ? stRows : [{ 'Keterangan': 'Tidak ada data' }]), 'Strategi');

    const rRows = filteredRisiko.map((r, idx) => ({
        'No': idx + 1, 'Tahun': r.tahun, 'Unit Kerja': (r.unit_kerja as any)?.nama_unit || '-', 'Identifikasi Risiko': r.identifikasi_risiko, 'Probabilitas': r.probabilitas, 'Dampak': r.dampak, 'Skor': r.skor_risiko, 'Status': r.status, 'Mitigasi': r.mitigasi || '-'
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rRows.length > 0 ? rRows : [{ 'Keterangan': 'Tidak ada data' }]), 'Risiko');

    const kartRows = kartesiusRows.map(k => ({
        'No': k.no, 'Unit Kerja': k.unit, 'Internal (X)': k.x, 'Eksternal (Y)': k.y, 'Kuadran': k.kuadran, 'Rekomendasi': k.rekom
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(kartRows.length > 0 ? kartRows : [{ 'Keterangan': 'Tidak ada data' }]), 'Kartesius SWOT');

    const mapRows = strategicObjectives.map((o, idx) => ({
        'No': idx + 1, 'Unit Kerja': o.unit, 'Perspektif BSC': o.perspective, 'Sasaran Strategis': o.title
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mapRows.length > 0 ? mapRows : [{ 'Keterangan': 'Tidak ada data' }]), 'Strategic Map');

    const cleanUnit = unitLabel.replace(/[^a-zA-Z0-9]/g, '_');
    XLSX.writeFile(wb, `Laporan_Eksekutif_Terpadu_${year}_${cleanUnit}.xlsx`);
};
