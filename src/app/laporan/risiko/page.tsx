'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { supabase, type ManajemenRisiko } from '@/lib/supabase';
import { PageHeader, ScoreCard } from '@/components/SharedUI';
import { ShieldAlert, AlertTriangle, CheckCircle2, BarChart2, FileText, ChevronDown } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { useAppSettings } from '@/hooks/useAppSettings';
import { useUserProfile } from '@/hooks/useUserProfile';

const CURRENT_YEAR = new Date().getFullYear();

export interface ExtendedManajemenRisiko extends ManajemenRisiko {
    kategori_risiko?: string;
    penyebab?: string;
    dampak_uraian?: string;
    status_mitigasi?: string;
    probabilitas_residual?: number;
    dampak_residual?: number;
    skor_residual?: number;
    realisasi_mitigasi?: string;
    evaluasi?: string;
}

interface WorkUnit {
    id: string;
    nama_unit: string;
}

interface KRIRow {
    id: string;
    unit_kerja_id?: string;
    risk_input_id?: string;
    kode_risiko?: string;
    nama_kri: string;
    indikator?: string;
    tahun: number;
    batas_bawah?: number;
    batas_atas?: number;
    nilai_aktual?: number;
    satuan?: string;
    frekuensi?: string;
    status: string;
    unit_kerja?: { id: string; nama_unit: string };
}

interface LossEventRow {
    id: string;
    unit_kerja_id?: string;
    tahun: number;
    tanggal_kejadian: string;
    judul_kejadian: string;
    deskripsi_kejadian?: string;
    penyebab?: string;
    dampak_finansial?: number;
    skala_dampak?: number;
    kategori?: string;
    tindak_lanjut?: string;
    penanggung_jawab?: string;
    status?: string;
    unit_kerja?: { id: string; nama_unit: string };
}

export default function LaporanRisikoPage() {
    const { settings } = useAppSettings();
    const { profile, isManager, validUnitIds, isMatchUnit } = useUserProfile();

    const [risks, setRisks] = useState<ExtendedManajemenRisiko[]>([]);
    const [kris, setKris] = useState<KRIRow[]>([]);
    const [lossEvents, setLossEvents] = useState<LossEventRow[]>([]);
    const [units, setUnits] = useState<WorkUnit[]>([]);

    const [year, setYear] = useState(String(CURRENT_YEAR));
    const [unitFilter, setUnitFilter] = useState('');
    const [loading, setLoading] = useState(true);
    const [showReportDropdown, setShowReportDropdown] = useState(false);

    // Sync unit filter with user profile
    useEffect(() => {
        if ((profile?.role === 'user_unit' || isManager) && profile?.unit_kerja_id) {
            setUnitFilter(profile.unit_kerja_id);
        }
    }, [profile, isManager]);

    // Fetch units
    useEffect(() => {
        supabase.from('unit_kerja').select('id, nama_unit').order('nama_unit').then(({ data }) => {
            if (data) setUnits(data as WorkUnit[]);
        });
    }, []);

    // Fetch all risk data
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch Manajemen Risiko
            let qRisk = supabase.from('manajemen_risiko').select('*, unit_kerja(id, nama_unit)').order('skor_risiko', { ascending: false });
            if (year) qRisk = qRisk.eq('tahun', Number(year));

            // Fetch Key Risk Indicators
            let qKri = supabase.from('key_risk_indicators').select('*, unit_kerja(id, nama_unit)').order('created_at', { ascending: false });
            if (year) qKri = qKri.eq('tahun', Number(year));

            // Fetch Loss Events
            let qLoss = supabase.from('loss_events').select('*, unit_kerja(id, nama_unit)').order('tanggal_kejadian', { ascending: false });
            if (year) qLoss = qLoss.eq('tahun', Number(year));

            const [resRisk, resKri, resLoss] = await Promise.all([qRisk, qKri, qLoss]);

            setRisks((resRisk.data as ExtendedManajemenRisiko[]) ?? []);
            setKris((resKri.data as KRIRow[]) ?? []);
            setLossEvents((resLoss.data as LossEventRow[]) ?? []);
        } catch (err) {
            console.error('Error fetching risk reports:', err);
            setRisks([]);
            setKris([]);
            setLossEvents([]);
        } finally {
            setLoading(false);
        }
    }, [year]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const checkMatch = (uId?: string, uObj?: any) => {
        if (isManager) return isMatchUnit(uId, uObj);
        if (!unitFilter) return true;
        return uId === unitFilter || uObj?.id === unitFilter;
    };

    // Filter datasets by unitFilter
    const filteredRisks = risks.filter(r => checkMatch(r.unit_kerja_id, r.unit_kerja));
    const filteredKris = kris.filter(k => checkMatch(k.unit_kerja_id, k.unit_kerja));
    const filteredLossEvents = lossEvents.filter(l => checkMatch(l.unit_kerja_id, l.unit_kerja));

    // Summary Statistics
    const totalRisks = filteredRisks.length;
    const avgScore = totalRisks ? (filteredRisks.reduce((s, r) => s + (r.skor_risiko || 0), 0) / totalRisks).toFixed(1) : '0';
    const sangatTinggi = filteredRisks.filter(r => (r.skor_risiko || 0) >= 15).length;
    const closedRisks = filteredRisks.filter(r => r.status === 'Closed' || r.status_mitigasi === 'Selesai').length;
    const totalLossValuation = filteredLossEvents.reduce((s, l) => s + (l.dampak_finansial || 0), 0);
    const totalKriOverLimit = filteredKris.filter(k => (k.nilai_aktual ?? 0) > (k.batas_atas ?? Infinity)).length;

    // Grouping for page view
    const byUnit = Object.entries(
        filteredRisks.reduce<Record<string, ExtendedManajemenRisiko[]>>((acc, r) => {
            const unit = (r.unit_kerja as any)?.nama_unit ?? 'Lainnya';
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
        'Sangat Tinggi (>=15)': 'bg-rose-100 text-rose-700',
        'Tinggi (10-14)': 'bg-orange-100 text-orange-700',
        'Sedang (5-9)': 'bg-amber-100 text-amber-700',
        'Rendah (<5)': 'bg-emerald-100 text-emerald-700',
    };
    const getLevel = (s: number) => s >= 15 ? 'Sangat Tinggi (>=15)' : s >= 10 ? 'Tinggi (10-14)' : s >= 5 ? 'Sedang (5-9)' : 'Rendah (<5)';

    // --- EXCEL EXPORT ---
    const handleExportExcel = () => {
        const selectedUnitObj = units.find(u => u.id === unitFilter);
        const unitLabel = selectedUnitObj ? selectedUnitObj.nama_unit : 'Semua Unit Kerja';

        const summaryRows = [
            { 'Metrik Risiko': 'Tahun Anggaran', 'Nilai / Keterangan': year },
            { 'Metrik Risiko': 'Unit Kerja Filter', 'Nilai / Keterangan': unitLabel },
            { 'Metrik Risiko': 'Total Identifikasi Risiko', 'Nilai / Keterangan': totalRisks },
            { 'Metrik Risiko': 'Rata-rata Skor Risiko Awal', 'Nilai / Keterangan': avgScore },
            { 'Metrik Risiko': 'Risiko Sangat Tinggi (≥15)', 'Nilai / Keterangan': sangatTinggi },
            { 'Metrik Risiko': 'Risiko Selesai / Closed', 'Nilai / Keterangan': closedRisks },
            { 'Metrik Risiko': 'Total Key Risk Indicator (KRI)', 'Nilai / Keterangan': filteredKris.length },
            { 'Metrik Risiko': 'KRI Over Limit Alert', 'Nilai / Keterangan': totalKriOverLimit },
            { 'Metrik Risiko': 'Total Incident (Loss Event)', 'Nilai / Keterangan': filteredLossEvents.length },
            { 'Metrik Risiko': 'Total Kerugian Finansial (Rp)', 'Nilai / Keterangan': `Rp ${totalLossValuation.toLocaleString('id-ID')}` },
        ];

        const riskRows = filteredRisks.map((r, idx) => ({
            'No': idx + 1,
            'Tahun': r.tahun,
            'Unit Kerja': (r.unit_kerja as any)?.nama_unit || 'Lainnya',
            'Identifikasi Risiko': r.identifikasi_risiko || '-',
            'Kategori Risiko': r.kategori_risiko || '-',
            'Penyebab / Root Cause': r.penyebab || '-',
            'Uraian Dampak': r.dampak_uraian || '-',
            'Probabilitas (P)': r.probabilitas || 0,
            'Dampak (D)': r.dampak || 0,
            'Skor Awal': r.skor_risiko || 0,
            'Level Risiko': getLevel(r.skor_risiko || 0),
            'Mitigasi / Action Plan': r.mitigasi || '-',
            'Status Mitigasi': r.status_mitigasi || r.status || '-',
            'Status Final': r.status || '-'
        }));

        const residualRows = filteredRisks.map((r, idx) => ({
            'No': idx + 1,
            'Unit Kerja': (r.unit_kerja as any)?.nama_unit || 'Lainnya',
            'Identifikasi Risiko': r.identifikasi_risiko || '-',
            'Skor Awal': r.skor_risiko || 0,
            'Program Mitigasi': r.mitigasi || '-',
            'P Residual': r.probabilitas_residual || '-',
            'D Residual': r.dampak_residual || '-',
            'Skor Residual': r.skor_residual || '-',
            'Level Residual': r.skor_residual ? getLevel(Number(r.skor_residual)) : '-',
            'Realisasi Mitigasi': r.realisasi_mitigasi || '-',
            'Evaluasi Efektivitas': r.evaluasi || '-'
        }));

        const kriRows = filteredKris.map((k, idx) => ({
            'No': idx + 1,
            'Unit Kerja': (k.unit_kerja as any)?.nama_unit || 'Lainnya',
            'Kode Risiko': k.kode_risiko || '-',
            'Nama KRI': k.nama_kri || '-',
            'Deskripsi Indikator': k.indikator || '-',
            'Batas Bawah': k.batas_bawah ?? '-',
            'Batas Atas': k.batas_atas ?? '-',
            'Nilai Aktual': k.nilai_aktual ?? '-',
            'Satuan': k.satuan || '-',
            'Frekuensi': k.frekuensi || 'Bulanan',
            'Status Pemenuhan': k.status || '-'
        }));

        const lossRows = filteredLossEvents.map((l, idx) => ({
            'No': idx + 1,
            'Tanggal Kejadian': l.tanggal_kejadian || '-',
            'Unit Kerja': (l.unit_kerja as any)?.nama_unit || 'Lainnya',
            'Judul Kejadian': l.judul_kejadian || '-',
            'Kategori Kejadian': l.kategori || '-',
            'Penyebab': l.penyebab || '-',
            'Skala Dampak': `${l.skala_dampak || 0}/5`,
            'Dampak Finansial (Rp)': l.dampak_finansial || 0,
            'Tindak Lanjut': l.tindak_lanjut || '-',
            'Penanggung Jawab': l.penanggung_jawab || '-',
            'Status Investigasi': l.status || '-'
        }));

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Ringkasan Eksekutif');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(riskRows), 'Identifikasi & Profil Risiko');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(residualRows), 'Residual Risk & Evaluasi');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(kriRows), 'Key Risk Indicators (KRI)');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lossRows), 'Loss Event Database');

        const cleanUnit = unitLabel.replace(/[^a-zA-Z0-9]/g, '_');
        XLSX.writeFile(wb, `Laporan_Manajemen_Risiko_${year}_${cleanUnit}.xlsx`);
    };

    // --- PDF EXPORT ---
    const handleExportPDF = () => {
        const doc = new jsPDF('p', 'pt', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        const selectedUnitObj = units.find(u => u.id === unitFilter);
        const unitLabel = selectedUnitObj ? selectedUnitObj.nama_unit : 'Semua Unit Kerja';

        const hexToRgb = (hex: string): [number, number, number] => {
            const def: [number, number, number] = [244, 63, 94]; // Rose color for risks
            if (!hex) return def;
            const h = hex.replace('#', '');
            if (h.length !== 6) return def;
            const num = parseInt(h, 16);
            return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
        };

        const primaryColor = settings?.warna_primer || '#f43f5e';
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
                if (i === 1) continue; // skip cover page
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
            d.setTextColor(30, 41, 59);
            d.setFont('helvetica', 'bold');
            d.setFontSize(14);
            d.text((settings?.nama_rs || 'RUMAH SAKIT').toUpperCase(), 40, 45);

            d.setFont('helvetica', 'normal');
            d.setFontSize(8.5);
            d.setTextColor(71, 85, 105);
            if (settings?.alamat) {
                d.text(settings.alamat, 40, 59);
            }
            const contactLine1 = `Kota: ${settings?.kota || '-'} | Telp: ${settings?.telepon || '-'}`;
            const contactLine2 = `Email: ${settings?.email || '-'} | Web: ${settings?.website || '-'}`;
            d.text(contactLine1, 40, 72);
            d.text(contactLine2, 40, 84);

            let lineY = 96;
            if (settings?.tagline) {
                d.setFont('helvetica', 'italic');
                d.setFontSize(8);
                d.text(`"${settings.tagline}"`, 40, 96);
                lineY = 106;
            }

            d.setDrawColor(30, 41, 59);
            d.setLineWidth(1.5);
            d.line(40, lineY, pageWidth - 40, lineY);
            d.setLineWidth(0.5);
            d.line(40, lineY + 3, pageWidth - 40, lineY + 3);
        };

        // --- PAGE 1: COVER PAGE ---
        doc.setFillColor(rgbColor[0], rgbColor[1], rgbColor[2]);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');
        doc.setTextColor(255, 255, 255);

        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('LAPORAN MANAJEMEN RISIKO TERPADU', pageWidth / 2, pageHeight / 2 - 60, { align: 'center' });

        doc.setFontSize(14);
        doc.setFont('helvetica', 'normal');
        doc.text('Profil Risiko, Evaluasi Heatmap, Residual Risk, KRI & Loss Event', pageWidth / 2, pageHeight / 2 - 30, { align: 'center' });

        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text(`Tahun Anggaran: ${year} | Unit: ${unitLabel}`, pageWidth / 2, pageHeight / 2 + 10, { align: 'center' });

        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.text((settings?.nama_rs || 'RUMAH SAKIT').toUpperCase(), pageWidth / 2, pageHeight / 2 + 60, { align: 'center' });

        // --- PAGE 2: TABLE OF CONTENTS (TOC) ---
        doc.addPage();
        let tocPageNum = doc.getCurrentPageInfo().pageNumber;

        // --- PAGE 3: EXECUTIVE SUMMARY ---
        doc.addPage();
        let pSummary = doc.getCurrentPageInfo().pageNumber;
        drawKopSurat(doc);

        doc.setTextColor(30, 41, 59);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('A. Ringkasan Eksekutif Profil Risiko Organisasi', 40, 135);

        // Metric Scorecards
        const metrics = [
            { label: 'Total Risiko', val: totalRisks, color: [239, 246, 255] as [number, number, number], textCol: [30, 64, 175] as [number, number, number] },
            { label: 'Sangat Tinggi (>=15)', val: sangatTinggi, color: [254, 242, 242] as [number, number, number], textCol: [153, 27, 27] as [number, number, number] },
            { label: 'Rata-rata Skor Awal', val: avgScore, color: [255, 251, 235] as [number, number, number], textCol: [146, 64, 14] as [number, number, number] },
            { label: 'Loss Event Valuasi', val: `Rp ${(totalLossValuation / 1_000_000).toFixed(1)}Jt`, color: [245, 243, 255] as [number, number, number], textCol: [91, 33, 182] as [number, number, number] },
        ];

        const boxW = (pageWidth - 80 - 30) / 4;
        const boxY = 150;
        metrics.forEach((m, idx) => {
            const bx = 40 + idx * (boxW + 10);
            doc.setFillColor(m.color[0], m.color[1], m.color[2]);
            doc.roundedRect(bx, boxY, boxW, 45, 6, 6, 'F');
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(bx, boxY, boxW, 45, 6, 6, 'S');

            doc.setFontSize(7.5); doc.setFont('helvetica', 'bold');
            doc.setTextColor(m.textCol[0], m.textCol[1], m.textCol[2]);
            doc.text(m.label, bx + boxW / 2, boxY + 16, { align: 'center' });

            doc.setFontSize(12); doc.setFont('helvetica', 'bold');
            doc.text(String(m.val), bx + boxW / 2, boxY + 36, { align: 'center' });
        });

        // Metodologi & Risk Appetite Text Box
        let expY = 210;
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(40, expY, pageWidth - 80, 260, 8, 8, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(40, expY, pageWidth - 80, 260, 8, 8, 'S');

        doc.setTextColor(30, 41, 59);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Keterangan Penjelasan Metodologi & Toleransi Risiko:', 52, expY + 20);

        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85);

        const expLines = [
            '1. Konsep Inherent vs Residual Risk:',
            '   Profil Risiko menyajikan perbandingan murni antara Inherent Risk (skor risiko sebelum tindakan mitigasi)',
            '   dan Residual Risk (skor risiko tersisa yang masih ada setelah seluruh mitigasi dilaksanakan secara berkesinambungan).',
            '',
            '2. Matriks Matrikulasi Risiko 5x5 (Probabilitas x Dampak):',
            '   - Probabilitas (Frekuensi Kejadian): Skala 1 (Sangat Jarang) hingga Skala 5 (Sangat Sering).',
            '   - Dampak (Konsekuensi Finansial/Klinis/K3/Reputasi): Skala 1 (Sangat Ringan) hingga Skala 5 (Bencana).',
            '   - Skor Risiko dihitung dari perkalian Probabilitas x Dampak (Rentang Skor 1 s/d 25).',
            '',
            '3. Pengkategorian Tingkat Risiko:',
            '   - Sangat Tinggi / Ekstrem (Skor 15-25): Risiko tingkat tinggi yang memerlukan penanganan langsung Direksi/Pimpinan.',
            '   - Tinggi (Skor 10-14): Memerlukan tindakan mitigasi spesifik dan pengawasan rutin bulanan.',
            '   - Sedang (Skor 5-9): Dikelola melalui prosedur operasional standar (SOP) dan penanganan berkala.',
            '   - Rendah (Skor 1-4): Risiko ringan yang dapat diterima (within risk appetite).',
            '',
            '4. Batas Selera Risiko (Risk Appetite):',
            '   Toleransi selera risiko Rumah Sakit ditetapkan pada skor maksimal 6. Setiap risiko dengan skor awal > 6 wajib',
            '   memiliki Rencana Mitigasi dan dimonitor hingga skor residual mencapai batas toleransi.'
        ];

        let lineY = expY + 36;
        expLines.forEach(txt => {
            if (txt.trim() === '') {
                lineY += 5;
            } else {
                const wrapped = doc.splitTextToSize(txt, pageWidth - 104);
                doc.text(wrapped, 52, lineY);
                lineY += wrapped.length * 11;
            }
        });

        // --- PAGE 4: SECTION B - HEATMAP MATRIX 5x5 & ANALISIS DISTRIBUSI ---
        doc.addPage();
        let pHeatmap = doc.getCurrentPageInfo().pageNumber;
        addHeader(doc, 'Visualisasi Heatmap Risiko');

        doc.setTextColor(30, 41, 59);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('B. Visualisasi Matriks Heatmap Risiko 5x5 (Inherent & Residual)', 40, 75);

        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text('Peta sebaran posisi risiko murni (I) dan posisi setelah mitigasi (R) pada matriks 5x5.', 40, 88);

        // Draw 5x5 Grid Matrix
        const gridStartX = 90;
        const gridStartY = 105;
        const cellW = 82;
        const cellH = 44;

        // Axis Labels
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(71, 85, 105);
        doc.text('P R O B A B I L I T A S', 30, gridStartY + (cellH * 2.5), { angle: 90, align: 'center' });
        doc.text('D A M P A K', gridStartX + (cellW * 2.5), gridStartY + (cellH * 5) + 30, { align: 'center' });

        const getMatrixCellColor = (p: number, d: number): [number, number, number] => {
            const sc = p * d;
            if (sc >= 15) return [254, 202, 202]; // Red
            if (sc >= 10) return [254, 215, 170]; // Orange
            if (sc >= 5) return [254, 243, 199];  // Yellow
            return [209, 250, 229];                  // Green
        };

        for (let p = 5; p >= 1; p--) {
            const rowIndex = 5 - p;
            const cy = gridStartY + rowIndex * cellH;

            // Y-axis label
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(71, 85, 105);
            doc.text(`P${p}`, gridStartX - 15, cy + cellH / 2 + 3);

            for (let d = 1; d <= 5; d++) {
                const colIndex = d - 1;
                const cx = gridStartX + colIndex * cellW;

                if (p === 1) {
                    doc.text(`D${d}`, cx + cellW / 2, gridStartY + 5 * cellH + 16, { align: 'center' });
                }

                const bg = getMatrixCellColor(p, d);
                doc.setFillColor(bg[0], bg[1], bg[2]);
                doc.rect(cx, cy, cellW, cellH, 'F');
                doc.setDrawColor(255, 255, 255);
                doc.setLineWidth(1.5);
                doc.rect(cx, cy, cellW, cellH, 'S');

                // Cell score top right
                doc.setFontSize(7);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(148, 163, 184);
                doc.text(`${p * d}`, cx + cellW - 5, cy + 10, { align: 'right' });

                const inhCount = filteredRisks.filter(r => (r.probabilitas || 0) === p && (r.dampak || 0) === d).length;
                const resCount = filteredRisks.filter(r => {
                    const pr = r.probabilitas_residual ?? Math.ceil((r.probabilitas || 1) * 0.5);
                    const dr = r.dampak_residual ?? Math.ceil((r.dampak || 1) * 0.8);
                    return pr === p && dr === d;
                }).length;

                // Risk Appetite target count (Target score <= 6, default target cell P2xD3=6)
                const appCount = filteredRisks.filter(r => {
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
                    const bWidth = bCount === 3 ? 22 : bCount === 2 ? 32 : 36;
                    const gap = 3;
                    const startX = cx + (cellW - (bCount * bWidth + (bCount - 1) * gap)) / 2;

                    activeBadges.forEach((b, idx) => {
                        const bx = startX + idx * (bWidth + gap);
                        doc.setFillColor(b.color[0], b.color[1], b.color[2]);
                        doc.roundedRect(bx, cy + 17, bWidth, 18, 4, 4, 'F');
                        doc.setFontSize(7);
                        doc.setFont('helvetica', 'bold');
                        doc.setTextColor(255, 255, 255);
                        doc.text(`${b.tag}:${b.count}`, bx + bWidth / 2, cy + 29, { align: 'center' });
                    });
                }
            }
        }

        // Legend Block
        let legY = gridStartY + 5 * cellH + 42;
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(40, legY, pageWidth - 80, 48, 6, 6, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(40, legY, pageWidth - 80, 48, 6, 6, 'S');

        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(51, 65, 85);
        doc.text('Keterangan Badge Heatmap:', 52, legY + 18);

        // Badge 1: Inherent
        doc.setFillColor(225, 29, 72);
        doc.roundedRect(52, legY + 24, 26, 14, 3, 3, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7.5);
        doc.text('I: X', 65, legY + 34, { align: 'center' });
        doc.setTextColor(71, 85, 105);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text('Inherent Risk (Awal)', 82, legY + 34);

        // Badge 2: Residual
        doc.setFillColor(5, 150, 105);
        doc.roundedRect(190, legY + 24, 26, 14, 3, 3, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.text('R: Y', 203, legY + 34, { align: 'center' });
        doc.setTextColor(71, 85, 105);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text('Residual Risk (Setelah Mitigasi)', 220, legY + 34);

        // Badge 3: Risk Appetite
        doc.setFillColor(37, 99, 235);
        doc.roundedRect(360, legY + 24, 26, 14, 3, 3, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.text('A: Z', 373, legY + 34, { align: 'center' });
        doc.setTextColor(71, 85, 105);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text('Risk Appetite Target (<=6)', 390, legY + 34);

        // Analysis Box
        let analY = legY + 58;
        doc.setFillColor(239, 246, 255);
        doc.roundedRect(40, analY, pageWidth - 80, 150, 6, 6, 'F');
        doc.setDrawColor(191, 219, 254);
        doc.roundedRect(40, analY, pageWidth - 80, 150, 6, 6, 'S');

        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 64, 175);
        doc.text('Penjelasan Analisis Profil & Heatmap Risiko:', 52, analY + 20);

        const tinggiCount = filteredRisks.filter(r => (r.skor_risiko || 0) >= 15).length;
        const sedangCount = filteredRisks.filter(r => (r.skor_risiko || 0) >= 10 && (r.skor_risiko || 0) < 15).length;
        const moderatCount = filteredRisks.filter(r => (r.skor_risiko || 0) >= 5 && (r.skor_risiko || 0) < 10).length;
        const rendahCount = filteredRisks.filter(r => (r.skor_risiko || 0) < 5).length;

        const summaryAnalText = [
            `- Dari total ${totalRisks} data risiko teridentifikasi, terdapat ${tinggiCount} risiko Sangat Tinggi (Skor >= 15), ${sedangCount} risiko Tinggi (10-14), ${moderatCount} risiko Sedang (5-9), dan ${rendahCount} risiko Rendah (< 5).`,
            `- Rata-rata skor inherent murni organisasi berada pada angka ${avgScore}. Setelah penerapan langkah mitigasi, proyeksi residual risk menunjukkan penurunan risiko yang signifikan ke area hijau/kuning.`,
            `- Risiko yang tergolong Sangat Tinggi (Merah) diprioritaskan untuk pemantauan langsung oleh Direksi dan pengalokasian sumber daya/anggaran mitigasi prioritas.`,
            `- Seluruh unit kerja diimbau secara konsisten memperbarui status mitigasi dan indikator KRI guna memastikan tidak terjadi lonjakan tingkat risiko di pertengahan tahun berjalan.`
        ];

        let aTextY = analY + 36;
        summaryAnalText.forEach(txt => {
            const wrapped = doc.splitTextToSize(txt, pageWidth - 104);
            doc.text(wrapped, 52, aTextY);
            aTextY += wrapped.length * 11 + 2;
        });

        // --- SECTION C: IDENTIFIKASI & PROFIL RISIKO PER UNIT ---
        doc.addPage();
        let pRiskProfile = doc.getCurrentPageInfo().pageNumber;
        addHeader(doc, 'Identifikasi & Profil Risiko');

        doc.setTextColor(30, 41, 59);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('C. Detail Identifikasi & Risk Profile per Unit Kerja', 40, 75);

        let finalY = 95;

        byUnit.forEach(([unit, items]) => {
            if (finalY > pageHeight - 120) {
                doc.addPage();
                finalY = 70;
            }

            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(30, 41, 59);
            doc.text(`Unit Kerja: ${unit}`, 40, finalY + 15);

            let rowIdx = 1;
            const tableData = items.map(item => [
                rowIdx++,
                item.identifikasi_risiko || '-',
                item.kategori_risiko || '-',
                item.penyebab || '-',
                String(item.probabilitas || 0),
                String(item.dampak || 0),
                String(item.skor_risiko || 0),
                getLevel(item.skor_risiko || 0)
            ]);

            autoTable(doc, {
                startY: finalY + 22,
                head: [['No', 'Identifikasi Risiko', 'Kategori', 'Penyebab / Root Cause', 'P', 'D', 'Skor', 'Level']],
                body: tableData,
                theme: 'grid',
                headStyles: { fillColor: rgbColor, fontSize: 8, fontStyle: 'bold' },
                styles: { fontSize: 7.5, cellPadding: 4 },
                columnStyles: {
                    0: { cellWidth: 25, halign: 'center' },
                    1: { cellWidth: 140 },
                    2: { cellWidth: 80 },
                    3: { cellWidth: 130 },
                    4: { cellWidth: 25, halign: 'center' },
                    5: { cellWidth: 25, halign: 'center' },
                    6: { cellWidth: 35, halign: 'center' },
                    7: { cellWidth: 55, halign: 'center' },
                },
                margin: { left: 40, right: 40 },
                didDrawPage: () => { addHeader(doc, 'Identifikasi & Profil Risiko'); }
            });
            finalY = (doc as any).lastAutoTable.finalY + 20;
        });

        // --- SECTION D: RENCANA PENANGANAN & MITIGASI ---
        doc.addPage();
        let pTreatment = doc.getCurrentPageInfo().pageNumber;
        addHeader(doc, 'Rencana Penanganan Risiko');

        doc.setTextColor(30, 41, 59);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('D. Matriks Rencana Penanganan & Mitigasi Risiko', 40, 75);

        let tIdx = 1;
        const treatmentTableData = filteredRisks.map(r => [
            tIdx++,
            (r.unit_kerja as any)?.nama_unit || 'Lainnya',
            r.identifikasi_risiko || '-',
            r.mitigasi || '-',
            r.status_mitigasi || r.status || '-',
            r.status || '-'
        ]);

        autoTable(doc, {
            startY: 95,
            head: [['No', 'Unit Kerja', 'Identifikasi Risiko', 'Rencana Mitigasi', 'Status Mitigasi', 'Status Final']],
            body: treatmentTableData,
            theme: 'grid',
            headStyles: { fillColor: rgbColor, fontSize: 8, fontStyle: 'bold' },
            styles: { fontSize: 7.5, cellPadding: 4 },
            columnStyles: {
                0: { cellWidth: 25, halign: 'center' },
                1: { cellWidth: 80 },
                2: { cellWidth: 140 },
                3: { cellWidth: 160 },
                4: { cellWidth: 55, halign: 'center' },
                5: { cellWidth: 55, halign: 'center' }
            },
            margin: { left: 40, right: 40 },
            didDrawPage: () => { addHeader(doc, 'Rencana Penanganan Risiko'); }
        });

        // --- SECTION E: RESIDUAL RISK ---
        doc.addPage();
        let pResidual = doc.getCurrentPageInfo().pageNumber;
        addHeader(doc, 'Evaluasi Residual Risk');

        doc.setTextColor(30, 41, 59);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('E. Evaluasi Residual Risk Setelah Mitigasi', 40, 75);

        let resIdx = 1;
        const residualTableData = filteredRisks.map(r => [
            resIdx++,
            (r.unit_kerja as any)?.nama_unit || 'Lainnya',
            r.identifikasi_risiko || '-',
            String(r.skor_risiko || 0),
            r.probabilitas_residual ? String(r.probabilitas_residual) : '-',
            r.dampak_residual ? String(r.dampak_residual) : '-',
            r.skor_residual ? String(r.skor_residual) : '-',
            r.realisasi_mitigasi || '-'
        ]);

        autoTable(doc, {
            startY: 95,
            head: [['No', 'Unit Kerja', 'Identifikasi Risiko', 'Skor Awal', 'P Res', 'D Res', 'Skor Res', 'Realisasi Mitigasi']],
            body: residualTableData,
            theme: 'grid',
            headStyles: { fillColor: rgbColor, fontSize: 8, fontStyle: 'bold' },
            styles: { fontSize: 7.5, cellPadding: 4 },
            columnStyles: {
                0: { cellWidth: 25, halign: 'center' },
                1: { cellWidth: 80 },
                2: { cellWidth: 140 },
                3: { cellWidth: 45, halign: 'center' },
                4: { cellWidth: 35, halign: 'center' },
                5: { cellWidth: 35, halign: 'center' },
                6: { cellWidth: 45, halign: 'center' },
                7: { cellWidth: 110 }
            },
            margin: { left: 40, right: 40 },
            didDrawPage: () => { addHeader(doc, 'Evaluasi Residual Risk'); }
        });

        // --- SECTION F: KEY RISK INDICATOR (KRI) ---
        doc.addPage();
        let pKRI = doc.getCurrentPageInfo().pageNumber;
        addHeader(doc, 'Pemantauan KRI');

        doc.setTextColor(30, 41, 59);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('F. Pemantauan Ambang Batas Key Risk Indicator (KRI)', 40, 75);

        let kriIdx = 1;
        const kriTableData = filteredKris.map(k => [
            kriIdx++,
            (k.unit_kerja as any)?.nama_unit || 'Lainnya',
            (k.kode_risiko ? `[${k.kode_risiko}] ` : '') + (k.nama_kri || '-'),
            `${k.batas_bawah ?? '-'} - ${k.batas_atas ?? '-'} ${k.satuan || ''}`,
            `${k.nilai_aktual ?? '-'} ${k.satuan || ''}`,
            k.frekuensi || 'Bulanan',
            k.status || 'Normal'
        ]);

        if (kriTableData.length === 0) {
            kriTableData.push(['-', '-', 'Belum ada data Key Risk Indicator', '-', '-', '-', '-']);
        }

        autoTable(doc, {
            startY: 95,
            head: [['No', 'Unit Kerja', 'Nama KRI', 'Batas (Min - Max)', 'Nilai Aktual', 'Frekuensi', 'Status']],
            body: kriTableData,
            theme: 'grid',
            headStyles: { fillColor: rgbColor, fontSize: 8, fontStyle: 'bold' },
            styles: { fontSize: 7.5, cellPadding: 4 },
            columnStyles: {
                0: { cellWidth: 25, halign: 'center' },
                1: { cellWidth: 80 },
                2: { cellWidth: 140 },
                3: { cellWidth: 80, halign: 'center' },
                4: { cellWidth: 70, halign: 'center' },
                5: { cellWidth: 55, halign: 'center' },
                6: { cellWidth: 65, halign: 'center' }
            },
            margin: { left: 40, right: 40 },
            didDrawPage: () => { addHeader(doc, 'Pemantauan KRI'); }
        });

        // --- SECTION G: LOSS EVENT DATABASE ---
        doc.addPage();
        let pLoss = doc.getCurrentPageInfo().pageNumber;
        addHeader(doc, 'Loss Event Database');

        doc.setTextColor(30, 41, 59);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('G. Pencatatan Kejadian Kerugian (Loss Event Database)', 40, 75);

        let lossIdx = 1;
        const lossTableData = filteredLossEvents.map(l => [
            lossIdx++,
            l.tanggal_kejadian ? new Date(l.tanggal_kejadian).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-',
            (l.unit_kerja as any)?.nama_unit || 'Lainnya',
            l.judul_kejadian || '-',
            l.kategori || '-',
            `${l.skala_dampak || 0}/5`,
            `Rp ${((l.dampak_finansial || 0) / 1_000_000).toFixed(1)} Jt`,
            l.status || '-'
        ]);

        if (lossTableData.length === 0) {
            lossTableData.push(['-', '-', '-', 'Belum ada kejadian risiko yang tercatat', '-', '-', '-', '-']);
        }

        autoTable(doc, {
            startY: 95,
            head: [['No', 'Tanggal', 'Unit Kerja', 'Judul Kejadian', 'Kategori', 'Dampak', 'Valuasi', 'Status']],
            body: lossTableData,
            theme: 'grid',
            headStyles: { fillColor: rgbColor, fontSize: 8, fontStyle: 'bold' },
            styles: { fontSize: 7.5, cellPadding: 4 },
            columnStyles: {
                0: { cellWidth: 25, halign: 'center' },
                1: { cellWidth: 60, halign: 'center' },
                2: { cellWidth: 70 },
                3: { cellWidth: 130 },
                4: { cellWidth: 70 },
                5: { cellWidth: 40, halign: 'center' },
                6: { cellWidth: 65, halign: 'right' },
                7: { cellWidth: 55, halign: 'center' }
            },
            margin: { left: 40, right: 40 },
            didDrawPage: () => { addHeader(doc, 'Loss Event Database'); }
        });

        let sigY = (doc as any).lastAutoTable.finalY + 25;

        // --- SIGNATURE PAGE ---
        if (sigY > pageHeight - 150) {
            doc.addPage();
            sigY = 70;
        }

        doc.setFontSize(9.5);
        doc.setTextColor(51, 65, 85);
        doc.setFont('helvetica', 'normal');
        doc.text('Disiapkan oleh,', 60, sigY);
        doc.text(settings?.jabatan_penandatangan_kiri || 'Penanggungjawab Unit', 60, sigY + 14);
        doc.line(60, sigY + 65, 200, sigY + 65);
        doc.text(settings?.nama_penandatangan_kiri || 'Penanggungjawab Unit Kerja', 60, sigY + 78);

        doc.text('Disetujui oleh,', pageWidth - 200, sigY);
        doc.setFont('helvetica', 'bold');
        doc.text(settings?.kepala_rs || 'Kepala / Direktur RS', pageWidth - 200, sigY + 14);
        doc.line(pageWidth - 200, sigY + 65, pageWidth - 60, sigY + 65);
        doc.setFont('helvetica', 'normal');
        doc.text(`NIP: ${settings?.nip_kepala || '-'}`, pageWidth - 200, sigY + 78);

        // --- WRITE TABLE OF CONTENTS (TOC) ---
        doc.setPage(tocPageNum);
        addHeader(doc, 'Daftar Isi');
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(15);
        doc.setFont('helvetica', 'bold');
        doc.text('DAFTAR ISI LAPORAN RISIKO', 40, 95);

        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(1);
        doc.line(40, 107, pageWidth - 40, 107);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');

        const tocItems = [
            { label: 'A. Ringkasan Eksekutif Profil Risiko Organisasi', page: pSummary },
            { label: 'B. Visualisasi Matriks Heatmap Risiko 5x5 & Analisis Distribusi', page: pHeatmap },
            { label: 'C. Detail Identifikasi & Risk Profile per Unit Kerja', page: pRiskProfile },
            { label: 'D. Matriks Rencana Penanganan & Mitigasi Risiko', page: pTreatment },
            { label: 'E. Evaluasi Residual Risk Setelah Mitigasi', page: pResidual },
            { label: 'F. Pemantauan Ambang Batas Key Risk Indicator (KRI)', page: pKRI },
            { label: 'G. Pencatatan Kejadian Kerugian (Loss Event Database)', page: pLoss },
            { label: 'H. Lembar Pengesahan & Tanda Tangan Pimpinan', page: doc.getNumberOfPages() }
        ];

        let tocY = 130;
        tocItems.forEach(item => {
            doc.text(item.label, 40, tocY);
            doc.text(String(item.page - 1), pageWidth - 40, tocY, { align: 'right' });
            tocY += 22;
        });

        addFooter(doc);
        const cleanUnit = unitLabel.replace(/[^a-zA-Z0-9]/g, '_');
        doc.save(`Laporan_Manajemen_Risiko_${year}_${cleanUnit}.pdf`);
    };

    return (
        <div>
            <PageHeader
                title="Laporan Rekap Risiko"
                subtitle="Rekapitulasi terpadu identifikasi, evaluasi, mitigasi, residual risk, KRI, dan loss event per unit kerja."
                actions={
                    <div className="flex items-center gap-2 flex-wrap">
                        <select
                            className="filter-select w-44"
                            value={unitFilter}
                            onChange={e => setUnitFilter(e.target.value)}
                            disabled={profile?.role === 'user_unit' || isManager}
                            title="Filter Unit Kerja"
                        >
                            <option value="">Semua Unit Kerja</option>
                            {units.map(u => <option key={u.id} value={u.id}>{u.nama_unit}</option>)}
                        </select>
                        <select className="filter-select w-32" value={year} onChange={e => setYear(e.target.value)} title="Tahun Anggaran">
                            {[CURRENT_YEAR + 1, CURRENT_YEAR, CURRENT_YEAR - 1].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>

                        <div className="relative inline-block text-left">
                            <button
                                onClick={() => setShowReportDropdown(prev => !prev)}
                                className="btn-primary btn-sm flex items-center gap-1.5 shadow-sm"
                            >
                                <FileText size={15} />
                                <span>Laporan</span>
                                <ChevronDown size={14} />
                            </button>
                            {showReportDropdown && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowReportDropdown(false)} />
                                    <div className="absolute right-0 mt-2 w-60 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-50 animate-in fade-in zoom-in-95">
                                        <div className="px-3 py-1.5 border-b border-slate-100 mb-1">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pilih Format Laporan</p>
                                        </div>
                                        <button
                                            onClick={() => { setShowReportDropdown(false); handleExportPDF(); }}
                                            className="w-full text-left px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-rose-50 hover:text-rose-600 flex items-center gap-3 transition-colors"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                                                <FileText size={16} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800">Laporan Terpadu (PDF)</p>
                                                <p className="text-[10px] text-slate-400 font-normal">Format PDF resmi dengan pengesahan</p>
                                            </div>
                                        </button>
                                        <button
                                            onClick={() => { setShowReportDropdown(false); handleExportExcel(); }}
                                            className="w-full text-left px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-600 flex items-center gap-3 transition-colors"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                                                <BarChart2 size={16} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800">Laporan Terpadu (Excel)</p>
                                                <p className="text-[10px] text-slate-400 font-normal">Multi-sheet Workbook (.xlsx)</p>
                                            </div>
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                }
            />

            <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
                <ScoreCard icon={<ShieldAlert size={22} className="text-slate-500" />} title="Total Risiko" value={totalRisks} colorClass="bg-slate-50 border-slate-100" />
                <ScoreCard icon={<AlertTriangle size={22} className="text-rose-500" />} title="Sangat Tinggi (≥15)" value={sangatTinggi} colorClass="bg-rose-50 border-rose-100" />
                <ScoreCard icon={<BarChart2 size={22} className="text-amber-500" />} title="Rata-rata Skor" value={avgScore} colorClass="bg-amber-50 border-amber-100" />
                <ScoreCard icon={<CheckCircle2 size={22} className="text-emerald-500" />} title="Closed / Selesai" value={closedRisks} colorClass="bg-emerald-50 border-emerald-100" />
            </div>

            {loading ? (
                <div className="card flex items-center justify-center py-16 text-slate-400">
                    <div className="animate-spin w-5 h-5 border-2 border-slate-200 border-t-[#f43f5e] rounded-full mr-2" />
                </div>
            ) : (
                <div className="space-y-4">
                    {byUnit.map(([unit, unitRisks]) => {
                        const unitAvg = (unitRisks.reduce((s, r) => s + (r.skor_risiko || 0), 0) / unitRisks.length).toFixed(1);
                        return (
                            <div key={unit} className="card">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-bold text-slate-700">{unit}</h3>
                                    <div className="flex gap-2 text-xs">
                                        <span className="text-slate-400">{unitRisks.length} risiko</span>
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
                                            {unitRisks.map(r => (
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
