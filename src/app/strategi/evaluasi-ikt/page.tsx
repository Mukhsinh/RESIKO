'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader, ScoreCard, FilterBar, TopActionBar } from '@/components/SharedUI';
import DataTable, { type Column } from '@/components/DataTable';
import FormInputAI from '@/components/FormInputAI';
import { Download, Upload, FileText, Target, Activity, AlertCircle, CheckCircle2, Save, X, Loader2, BarChart2, Plus, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useAppSettings } from '@/hooks/useAppSettings';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const CURRENT_YEAR = new Date().getFullYear();

const MONTHS = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const PERIODE_OPTIONS = [
    { value: 'tahunan', label: 'Tahunan', details: ['Tahunan'] },
    { value: 'semesteran', label: 'Semesteran', details: ['Semester I', 'Semester II'] },
    { value: 'triwulanan', label: 'Triwulanan', details: ['Triwulan I', 'Triwulan II', 'Triwulan III', 'Triwulan IV'] },
    { value: 'bulanan', label: 'Bulanan', details: MONTHS },
];

interface IKTEvaluasi {
    id: string;
    rencana_strategis_id?: string;
    sasaran_strategi_id?: string;
    indikator: string;
    baseline_tahun?: number;
    baseline_nilai?: number | null;
    target_tahun?: number;
    target_nilai?: number | null;
    satuan?: string;
    initiatif_strategi?: string;
    pic?: string;
    realisasi_nilai?: number | null;
    kendala?: string | null;
    tindak_lanjut?: string | null;
    unit_kerja_id?: string;
    unit_kerja?: { nama_unit: string };
    sasaran_strategi?: { sasaran: string };
}

interface EditForm {
    realisasi_nilai: string;
    kendala: string;
    tindak_lanjut: string;
    periode_tipe: string;
    periode_detail: string;
    monthly_values: string[];
}

const defaultEditForm: EditForm = {
    realisasi_nilai: '',
    kendala: '',
    tindak_lanjut: '',
    periode_tipe: 'tahunan',
    periode_detail: 'Tahunan',
    monthly_values: Array(12).fill(''),
};

interface EvalForm {
    unit_kerja_id: string;
    eval_year: string;
    selectedIKTId: string;
    realisasi_nilai: string;
    kendala: string;
    tindak_lanjut: string;
    periode_tipe: string;
    periode_detail: string;
    monthly_values: string[];
}

const defaultEvalForm: EvalForm = {
    unit_kerja_id: '',
    eval_year: String(CURRENT_YEAR),
    selectedIKTId: '',
    realisasi_nilai: '',
    kendala: '',
    tindak_lanjut: '',
    periode_tipe: 'tahunan',
    periode_detail: 'Tahunan',
    monthly_values: Array(12).fill(''),
};

// Helper: calculate achievement percentage
const calculateCapaian = (realisasi?: number | null, target?: number | null) => {
    if (realisasi == null || target == null || target === 0) return 0;
    return (realisasi / target) * 100;
};

// Helper: format display value — show number or '-' with satuan
const fmtVal = (val: number | null | undefined, satuan?: string) => {
    if (val == null) return '-';
    return `${val}${satuan ? ` ${satuan}` : ''}`;
};

// Helper: encode/decode period info into kendala field
const encodePeriode = (tipe: string, detail: string, monthly: string[], kendala: string) => {
    const monthlyStr = monthly.map(m => m.trim() === '' ? '' : m.trim()).join(',');
    const prefix = `[PeriodType: ${tipe}][PeriodDetail: ${detail}][Monthly: ${monthlyStr}]`;
    return kendala ? `${prefix} ${kendala}` : prefix;
};

const decodePeriode = (kendala: string | null | undefined) => {
    if (!kendala) return { tipe: 'tahunan', detail: 'Tahunan', monthly: Array(12).fill(''), text: '' };

    const match = kendala.match(/^\[PeriodType:\s*(.*?)\]\[PeriodDetail:\s*(.*?)\]\[Monthly:\s*(.*?)\]\s*([\s\S]*)$/);
    if (match) {
        const tipe = match[1].toLowerCase();
        const detail = match[2];
        const monthly = match[3].split(',');
        const text = match[4];
        const paddedMonthly = Array(12).fill('').map((_: string, i: number) => monthly[i] || '');
        return { tipe, detail, monthly: paddedMonthly, text };
    }

    const legacyMatch = kendala.match(/^\[Periode:\s*(.*?)\s*-\s*(.*?)\]\s*([\s\S]*)$/);
    if (legacyMatch) {
        return { tipe: legacyMatch[1].toLowerCase(), detail: legacyMatch[2], monthly: Array(12).fill(''), text: legacyMatch[3] };
    }

    return { tipe: 'tahunan', detail: 'Tahunan', monthly: Array(12).fill(''), text: kendala };
};

const getPeriodeInputs = (tipe: string): string[] => {
    switch (tipe) {
        case 'tahunan':
            return ['Tahunan'];
        case 'semesteran':
            return ['Semester I', 'Semester II'];
        case 'triwulanan':
            return ['Triwulan I', 'Triwulan II', 'Triwulan III', 'Triwulan IV'];
        case 'bulanan':
        default:
            return MONTHS;
    }
};

const calculateAverage = (monthly: string[], tipe: string) => {
    const limit = tipe === 'tahunan' ? 1 : tipe === 'semesteran' ? 2 : tipe === 'triwulanan' ? 4 : 12;
    const activeValues = monthly.slice(0, limit);
    const numbers = activeValues.map(m => parseFloat(m)).filter(n => !isNaN(n));
    if (numbers.length === 0) return 0;
    return numbers.reduce((a, b) => a + b, 0) / numbers.length;
};

const PIE_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#6366f1'];

// Build year options dynamically based on available IKT data
const FALLBACK_YEARS = Array.from({ length: 12 }, (_, i) => CURRENT_YEAR - 2 + i);

export default function EvaluasiIKTPage() {
    const { profile } = useUserProfile();
    const { settings } = useAppSettings();
    const [data, setData] = useState<IKTEvaluasi[]>([]);
    const [iktForUnit, setIktForUnit] = useState<IKTEvaluasi[]>([]);
    const [units, setUnits] = useState<{ id: string; nama_unit: string }[]>([]);
    const [availableYears, setAvailableYears] = useState<number[]>(FALLBACK_YEARS);
    const [filterUnit, setFilterUnit] = useState<string>('all');
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [year, setYear] = useState(String(CURRENT_YEAR));

    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<IKTEvaluasi | null>(null);
    const [editForm, setEditForm] = useState<EditForm>(defaultEditForm);

    const [showAddModal, setShowAddModal] = useState(false);
    const [evalForm, setEvalForm] = useState<EvalForm>(defaultEvalForm);

    const [saving, setSaving] = useState(false);
    const [hasUnitKerjaId, setHasUnitKerjaId] = useState<boolean | null>(null);

    // Sync unit filter for user role
    useEffect(() => {
        if (profile?.role === 'user_unit' && profile.unit_kerja_id) {
            setFilterUnit(profile.unit_kerja_id);
        }
    }, [profile]);

    // Probe if unit_kerja_id exists
    useEffect(() => {
        supabase.from('indikator_kinerja_utama').select('unit_kerja_id').limit(1)
            .then(({ error }: { error: any }) => {
                const exists = !error || (error.code !== '42703' && error.code !== 'PGRST100' && error.code !== '42883');
                setHasUnitKerjaId(exists);
            });
    }, []);

    // Fetch units list
    useEffect(() => {
        supabase.from('unit_kerja').select('id, nama_unit').order('nama_unit').then(({ data: u }: { data: any }) => {
            if (u) setUnits(u);
        });
    }, []);

    // Fetch available years from DB
    useEffect(() => {
        supabase.from('indikator_kinerja_utama')
            .select('target_tahun')
            .order('target_tahun', { ascending: true })
            .then(({ data: rows }: { data: any }) => {
                if (rows && rows.length > 0) {
                    const yearSet = new Set<number>();
                    rows.forEach((r: any) => { if (r.target_tahun) yearSet.add(r.target_tahun); });
                    const sorted = Array.from(yearSet).sort((a, b) => a - b);
                    if (sorted.length > 0) setAvailableYears(sorted);
                }
            });
    }, []);

    // Main data fetch - respects year and unit filter
    const fetchData = useCallback(async () => {
        if (hasUnitKerjaId === null) return;
        setLoading(true);
        try {
            const selectFields = hasUnitKerjaId
                ? '*, unit_kerja(nama_unit), sasaran_strategi(sasaran)'
                : '*, sasaran_strategi(sasaran)';
            let query = supabase.from('indikator_kinerja_utama').select(selectFields).order('created_at', { ascending: false });
            if (year) query = query.eq('target_tahun', Number(year));

            if (hasUnitKerjaId) {
                const unitToFilter = profile?.role === 'user_unit' ? profile.unit_kerja_id : (filterUnit === 'all' ? null : filterUnit);
                if (unitToFilter) {
                    query = query.eq('unit_kerja_id', unitToFilter);
                }
            }
            const { data: rows, error } = await query;
            if (error) {
                console.error('Error fetching evaluasi IKT:', error);
                setData([]);
            } else {
                setData((rows as unknown as IKTEvaluasi[]) ?? []);
            }
        } catch (err) {
            console.error('Error:', err);
            setData([]);
        } finally {
            setLoading(false);
        }
    }, [year, filterUnit, profile, hasUnitKerjaId]);

    useEffect(() => {
        if (hasUnitKerjaId !== null) fetchData();
    }, [fetchData, hasUnitKerjaId]);

    // Fetch IKT for selected unit in Add modal — uses modal's own year field
    const fetchIktForUnit = useCallback(async (unitId: string, targetYear: string) => {
        if (!unitId) { setIktForUnit([]); return; }
        try {
            let query = supabase
                .from('indikator_kinerja_utama')
                .select('id, indikator, target_tahun, target_nilai, satuan, pic, unit_kerja_id, baseline_tahun, baseline_nilai, realisasi_nilai, kendala, tindak_lanjut')
                .eq('unit_kerja_id', unitId)
                .order('target_tahun', { ascending: false });
            if (targetYear) query = query.eq('target_tahun', Number(targetYear));
            const { data: rows } = await query;
            setIktForUnit((rows as IKTEvaluasi[]) ?? []);
        } catch (err) {
            console.error('Error fetching IKT for unit:', err);
            setIktForUnit([]);
        }
    }, []);

    // When unit or year changes in Add modal
    useEffect(() => {
        if (evalForm.unit_kerja_id) {
            fetchIktForUnit(evalForm.unit_kerja_id, evalForm.eval_year);
        } else {
            setIktForUnit([]);
        }
    }, [evalForm.unit_kerja_id, evalForm.eval_year, fetchIktForUnit]);

    const filtered = data.filter(d =>
        (d.indikator || '').toLowerCase().includes(search.toLowerCase()) ||
        (d.satuan || '').toLowerCase().includes(search.toLowerCase()) ||
        (d.pic || '').toLowerCase().includes(search.toLowerCase())
    );

    const selectedIKTData = iktForUnit.find(d => d.id === evalForm.selectedIKTId);

    const openEditModal = (row: IKTEvaluasi) => {
        setSelectedItem(row);
        const seq = decodePeriode(row.kendala);
        setEditForm({
            realisasi_nilai: row.realisasi_nilai != null ? String(row.realisasi_nilai) : '',
            kendala: seq.text,
            tindak_lanjut: row.tindak_lanjut || '',
            periode_tipe: seq.tipe,
            periode_detail: seq.detail,
            monthly_values: seq.monthly,
        });
        setShowEditModal(true);
    };

    const openAddModal = () => {
        const newForm: EvalForm = {
            ...defaultEvalForm,
            eval_year: year || String(CURRENT_YEAR),
            monthly_values: Array(12).fill(''),
        };
        if (profile?.role === 'user_unit' && profile.unit_kerja_id) {
            newForm.unit_kerja_id = profile.unit_kerja_id;
        } else if (filterUnit !== 'all') {
            newForm.unit_kerja_id = filterUnit;
        }
        setEvalForm(newForm);
        setShowAddModal(true);
    };

    const handleIKTSelect = (iktId: string) => {
        if (!iktId) {
            setEvalForm(f => ({ ...f, selectedIKTId: '', realisasi_nilai: '', kendala: '', tindak_lanjut: '', monthly_values: Array(12).fill('') }));
            return;
        }
        const selected = iktForUnit.find(d => d.id === iktId);
        if (selected) {
            const seq = decodePeriode(selected.kendala);
            setEvalForm(f => ({
                ...f,
                selectedIKTId: iktId,
                realisasi_nilai: selected.realisasi_nilai != null ? String(selected.realisasi_nilai) : '',
                kendala: seq.text,
                tindak_lanjut: selected.tindak_lanjut || '',
                periode_tipe: seq.tipe || 'tahunan',
                periode_detail: seq.detail || 'Tahunan',
                monthly_values: seq.monthly,
            }));
        }
    };

    // Save realisasi (edit existing)
    const handleEditSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = {
                realisasi_nilai: editForm.realisasi_nilai ? Number(editForm.realisasi_nilai) : null,
                kendala: encodePeriode(editForm.periode_tipe, editForm.periode_detail, editForm.monthly_values, editForm.kendala),
                tindak_lanjut: editForm.tindak_lanjut || null,
            };
            if (selectedItem) {
                const result = await supabase.from('indikator_kinerja_utama').update(payload).eq('id', selectedItem.id);
                if (result.error) {
                    alert('Gagal menyimpan: ' + result.error.message);
                } else {
                    setShowEditModal(false);
                    fetchData();
                }
            }
        } catch (err) {
            console.error('Error:', err);
            alert('Terjadi kesalahan saat menyimpan data');
        } finally {
            setSaving(false);
        }
    };

    // Save from Add modal
    const handleEvalSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!evalForm.selectedIKTId) {
            alert('Silakan pilih target IKT terlebih dahulu.');
            return;
        }
        setSaving(true);
        try {
            const payload = {
                realisasi_nilai: evalForm.realisasi_nilai ? Number(evalForm.realisasi_nilai) : null,
                kendala: encodePeriode(evalForm.periode_tipe, evalForm.periode_detail, evalForm.monthly_values, evalForm.kendala),
                tindak_lanjut: evalForm.tindak_lanjut || null,
            };
            const result = await supabase.from('indikator_kinerja_utama').update(payload).eq('id', evalForm.selectedIKTId);
            if (result.error) {
                alert('Gagal menyimpan realisasi: ' + result.error.message);
                return;
            }
            setShowAddModal(false);
            setEvalForm(defaultEvalForm);
            fetchData();
        } catch (err) {
            console.error('Error:', err);
            alert('Terjadi kesalahan saat menyimpan data');
        } finally {
            setSaving(false);
        }
    };

    const handleExportPDF = () => {
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

        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('LAPORAN EVALUASI INDIKATOR KINERJA TAHUNAN', pageWidth / 2, pageHeight / 2 - 60, { align: 'center' });

        doc.setFontSize(16);
        doc.setFont('helvetica', 'normal');
        doc.text(`Tahun Target: ${year || 'Semua'}`, pageWidth / 2, pageHeight / 2, { align: 'center' });

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
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('A. Realisasi & Capaian Indikator Kinerja Tahunan per Unit Kerja', 40, 140);

        let finalY = 160;

        const byUnit = Object.entries(
            filtered.reduce<Record<string, IKTEvaluasi[]>>((acc, d) => {
                const unit = (d as any).unit_kerja?.nama_unit ?? 'Lainnya';
                if (!acc[unit]) acc[unit] = [];
                acc[unit].push(d);
                return acc;
            }, {})
        );

        byUnit.forEach(([unit, items]) => {
            if (finalY > pageHeight - 140) {
                doc.addPage();
                finalY = 70;
            }

            doc.setFontSize(10.5);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(30, 41, 59);
            doc.text(`Unit Kerja: ${unit}`, 40, finalY + 15);

            let rowIdx = 1;
            const tableData = items.map(item => {
                const targetVal = fmtVal(item.target_nilai, item.satuan);
                const realisasiVal = item.realisasi_nilai != null ? fmtVal(item.realisasi_nilai, item.satuan) : '-';
                const capaian = (item.realisasi_nilai != null && item.target_nilai != null)
                    ? `${calculateCapaian(item.realisasi_nilai, item.target_nilai).toFixed(1)}%`
                    : '-';
                const pInfo = decodePeriode(item.kendala);
                const periodLabel = `${pInfo.detail}\n(${pInfo.text || 'Tidak ada kendala'})`;
                return [
                    rowIdx++,
                    String(item.target_tahun || year || '-'),
                    item.indikator || '-',
                    targetVal,
                    realisasiVal,
                    capaian,
                    periodLabel,
                    item.pic || '-'
                ];
            });

            autoTable(doc, {
                startY: finalY + 22,
                head: [['No', 'Tahun', 'Indikator Kinerja', 'Target', 'Realisasi', 'Capaian', 'Periode & Kendala', 'PIC']],
                body: tableData,
                theme: 'grid',
                headStyles: { fillColor: rgbColor, fontSize: 8, fontStyle: 'bold' },
                styles: { fontSize: 7, cellPadding: 3 },
                columnStyles: {
                    0: { cellWidth: 20, halign: 'center' },
                    1: { cellWidth: 35, halign: 'center' },
                    2: { cellWidth: 150 },
                    3: { cellWidth: 50, halign: 'center' },
                    4: { cellWidth: 50, halign: 'center' },
                    5: { cellWidth: 50, halign: 'center' },
                    6: { cellWidth: 130 },
                    7: { cellWidth: 45, halign: 'center' }
                },
                margin: { left: 40, right: 40 },
                didDrawPage: (data) => {
                    const currentPage = doc.getCurrentPageInfo().pageNumber;
                    if (currentPage > contentPageStart) {
                        addHeader(doc, 'Laporan Evaluasi Indikator Kinerja Tahunan');
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
        doc.text('Staf Perencana / Mutu', 60, finalY + 14);
        doc.line(60, finalY + 65, 200, finalY + 65);
        doc.text('Pengelola Evaluasi IKT', 60, finalY + 78);

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

        doc.text('1. Detail Realisasi & Capaian Indikator Kinerja Tahunan (IKT)', 40, 140);
        doc.text(`${contentPageStart - 1}`, pageWidth - 40, 140, { align: 'right' });

        doc.text('2. Lembar Tanda Tangan Pengesahan Laporan', 40, 160);
        const lastPage = doc.getNumberOfPages();
        doc.text(`${lastPage - 1}`, pageWidth - 40, 160, { align: 'right' });

        addFooter(doc);
        doc.save(`Laporan_Evaluasi_IKT_${year || 'Semua'}.pdf`);
    };

    const columns: Column<IKTEvaluasi>[] = [
        { key: 'target_tahun', label: 'Tahun', className: 'w-16 text-center' },
        { key: 'unit_kerja_id', label: 'Unit', render: r => (r as any).unit_kerja?.nama_unit ?? '-' },
        { key: 'indikator', label: 'Indikator Kinerja', render: r => <span className="line-clamp-2" title={r.indikator}>{r.indikator}</span> },
        { key: 'target_nilai', label: 'Target', className: 'text-center', render: r => fmtVal(r.target_nilai, r.satuan) },
        {
            key: 'realisasi_nilai', label: 'Realisasi (Rata²)', className: 'text-center',
            render: r => r.realisasi_nilai != null
                ? <span className="font-semibold text-slate-800">{fmtVal(r.realisasi_nilai, r.satuan)}</span>
                : <span className="text-slate-400 italic text-xs">Belum diisi</span>
        },
        {
            key: 'id', label: 'Capaian (%)', className: 'text-center',
            render: r => {
                if (r.realisasi_nilai == null || r.target_nilai == null) return <span className="text-slate-400">-</span>;
                const capaian = calculateCapaian(r.realisasi_nilai, r.target_nilai);
                const ok = capaian >= 100;
                return (
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${ok ? 'bg-emerald-100 text-emerald-700' : capaian >= 75 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                        {capaian.toFixed(1)}%
                    </span>
                );
            }
        },
        {
            key: 'kendala', label: 'Periode',
            render: r => {
                const info = decodePeriode(r.kendala);
                const filledMonths = info.monthly.filter((m: string) => m !== '').length;
                return (
                    <div className="flex flex-col items-start gap-1">
                        <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full font-medium">{info.detail}</span>
                        {filledMonths > 0 && <span className="text-[10px] text-slate-500 font-semibold">{filledMonths} bulan terisi</span>}
                    </div>
                );
            }
        },
        { key: 'pic', label: 'PIC', className: 'text-center', render: r => r.pic || '-' },
    ];

    // ===== STATS & CHARTS (uses filtered data which respects year + unit filter) =====
    const totalDenganTarget = filtered.filter(d => d.target_nilai != null).length;
    const totalDenganRealisasi = filtered.filter(d => d.realisasi_nilai != null).length;
    const tercapai = filtered.filter(d => d.realisasi_nilai != null && d.target_nilai != null && calculateCapaian(d.realisasi_nilai, d.target_nilai) >= 100).length;
    const belumTercapai = Math.max(0, totalDenganRealisasi - tercapai);
    const belumDiisi = totalDenganTarget - totalDenganRealisasi;
    const rataCapaian = totalDenganRealisasi > 0
        ? filtered.filter(d => d.realisasi_nilai != null && d.target_nilai != null).reduce((sum, d) => sum + calculateCapaian(d.realisasi_nilai, d.target_nilai), 0) / totalDenganRealisasi
        : 0;

    const chartData = filtered.filter(d => d.target_nilai != null || d.realisasi_nilai != null).slice(0, 12).map(d => ({
        name: (d.indikator || '').substring(0, 20) + ((d.indikator?.length ?? 0) > 20 ? '…' : ''),
        target: d.target_nilai ?? 0,
        realisasi: d.realisasi_nilai ?? 0,
    }));

    const pieData = [
        { name: 'Tercapai (≥100%)', value: tercapai },
        { name: 'Belum Tercapai', value: belumTercapai },
        { name: 'Belum Diisi', value: Math.max(0, belumDiisi) },
    ].filter(d => d.value > 0);

    const currentPeriodeOptions = PERIODE_OPTIONS.find(p => p.value === evalForm.periode_tipe)?.details || ['Tahunan'];
    const editPeriodeOptions = PERIODE_OPTIONS.find(p => p.value === editForm.periode_tipe)?.details || ['Tahunan'];

    // Info label for selected filter unit
    const filterUnitName = filterUnit === 'all' ? 'Semua Unit Kerja' : (units.find(u => u.id === filterUnit)?.nama_unit ?? 'Unit');

    return (
        <div>
            <PageHeader
                title="Evaluasi IKT"
                subtitle="Realisasi dan evaluasi Indikator Kinerja Tahunan yang telah ditetapkan."
            />

            {/* Score Cards */}
            <div className="grid grid-cols-2 xl:grid-cols-5 gap-5 mb-8">
                <ScoreCard icon={<Target size={22} className="text-[#137fec]" />} title="Total Target IKT" value={totalDenganTarget} subtitle={`${filterUnitName} — ${year || 'Semua Tahun'}`} colorClass="bg-blue-50 border-blue-100" />
                <ScoreCard icon={<Activity size={22} className="text-amber-500" />} title="Sudah Direalisasi" value={totalDenganRealisasi} colorClass="bg-amber-50 border-amber-100" />
                <ScoreCard icon={<CheckCircle2 size={22} className="text-emerald-500" />} title="Target Tercapai" value={tercapai} colorClass="bg-emerald-50 border-emerald-100" />
                <ScoreCard icon={<AlertCircle size={22} className="text-rose-500" />} title="Belum Tercapai" value={belumTercapai} colorClass="bg-rose-50 border-rose-100" />
                <ScoreCard icon={<BarChart2 size={22} className="text-indigo-500" />} title="Rata-rata Capaian" value={`${rataCapaian.toFixed(1)}%`} colorClass="bg-indigo-50 border-indigo-100" />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden p-6">
                    <div className="flex items-center gap-2 mb-5">
                        <BarChart2 size={18} className="text-[#137fec]" />
                        <h3 className="font-bold text-slate-700">Grafik Capaian IKT — Target vs Realisasi</h3>
                        <span className="ml-auto text-[10px] text-slate-400 font-semibold uppercase">{filterUnitName} • {year || 'Semua'}</span>
                    </div>
                    <div className="w-full h-[280px]">
                        {chartData.length === 0 ? (
                            <div className="flex items-center justify-center w-full h-full text-slate-400 text-sm">Tidak ada data untuk ditampilkan</div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 32 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" interval={0} />
                                    <YAxis tick={{ fontSize: 11 }} />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="target" name="Target" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="realisasi" name="Realisasi" fill="#137fec" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden p-6">
                    <div className="flex items-center gap-2 mb-5">
                        <CheckCircle2 size={18} className="text-emerald-500" />
                        <h3 className="font-bold text-slate-700">Distribusi Capaian</h3>
                    </div>
                    <div className="w-full h-[240px]">
                        {pieData.length === 0 ? (
                            <div className="flex items-center justify-center w-full h-full text-slate-400 text-sm">Tidak ada data</div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value" label={({ name, value }: any) => `${name}: ${value}`}>
                                        {pieData.map((_: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-3 mt-2 justify-center">
                        {pieData.map((d, i) => (
                            <div key={d.name} className="flex items-center gap-1.5 text-xs text-slate-600">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}></span>
                                {d.name} ({d.value})
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Tabel */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <TopActionBar
                    filters={
                        <div className="flex flex-wrap items-center gap-3">
                            <FilterBar
                                searchValue={search}
                                onSearchChange={setSearch}
                                searchPlaceholder="Cari indikator..."
                                yearValue={year}
                                onYearChange={setYear}
                                years={availableYears}
                            />
                            {profile?.role === 'user_unit' ? (
                                <div className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold border border-slate-200">
                                    {units.find(u => u.id === filterUnit)?.nama_unit || 'Unit Anda'}
                                </div>
                            ) : (
                                <select className="form-input text-xs py-2 w-48" value={filterUnit} onChange={e => setFilterUnit(e.target.value)}>
                                    <option value="all">Semua Unit Kerja</option>
                                    {units.map(u => <option key={u.id} value={u.id}>{u.nama_unit}</option>)}
                                </select>
                            )}
                        </div>
                    }
                    actions={<>
                        <button className="btn-secondary"><Download size={15} /><span className="hidden sm:inline">Template</span></button>
                        <button className="btn-secondary"><Upload size={15} /><span className="hidden sm:inline">Import</span></button>
                        <button className="btn-secondary border-primary/20 text-primary hover:bg-primary/5" onClick={handleExportPDF}>
                            <FileText size={15} /><span className="hidden sm:inline">Laporan</span>
                        </button>
                        <button className="btn-primary" onClick={openAddModal}>
                            <Plus size={15} /><span>Input Realisasi</span>
                        </button>
                    </>}
                />
                <DataTable columns={columns} data={filtered} onEdit={openEditModal} isLoading={loading} />
            </div>

            {/* ====== MODAL EDIT REALISASI ====== */}
            {showEditModal && selectedItem && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <h3 className="text-base font-bold text-slate-800">Update Realisasi IKT</h3>
                            <button onClick={() => setShowEditModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
                        </div>
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-slate-100">
                            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-1">Indikator Kinerja</p>
                            <p className="text-sm font-semibold text-slate-800">{selectedItem.indikator}</p>
                            <div className="flex flex-wrap gap-4 mt-2">
                                <div className="bg-white/70 px-3 py-1.5 rounded-lg border border-slate-200">
                                    <p className="text-[10px] text-slate-400 uppercase">Target Kinerja ({selectedItem.target_tahun ?? '-'})</p>
                                    <p className="text-lg font-bold text-[#137fec]">{fmtVal(selectedItem.target_nilai, selectedItem.satuan)}</p>
                                </div>
                                <div className="bg-white/70 px-3 py-1.5 rounded-lg border border-slate-200">
                                    <p className="text-[10px] text-slate-400 uppercase">Baseline ({selectedItem.baseline_tahun ?? '-'})</p>
                                    <p className="text-sm font-bold text-slate-700">{fmtVal(selectedItem.baseline_nilai, selectedItem.satuan)}</p>
                                </div>
                                <div className="bg-white/70 px-3 py-1.5 rounded-lg border border-slate-200">
                                    <p className="text-[10px] text-slate-400 uppercase">PIC</p>
                                    <p className="text-sm font-bold text-slate-700">{selectedItem.pic ?? '-'}</p>
                                </div>
                            </div>
                        </div>
                        <form onSubmit={handleEditSave} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="form-label flex items-center gap-1.5"><Calendar size={13} className="text-indigo-500" /> Tipe Periode</label>
                                    <select className="form-input" value={editForm.periode_tipe} onChange={e => {
                                        const tipe = e.target.value;
                                        const details = PERIODE_OPTIONS.find(p => p.value === tipe)?.details || ['Tahunan'];
                                        setEditForm(f => ({ ...f, periode_tipe: tipe, periode_detail: details[0] }));
                                    }}>
                                        {PERIODE_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="form-label">Detail Periode</label>
                                    <select className="form-input" value={editForm.periode_detail} onChange={e => setEditForm(f => ({ ...f, periode_detail: e.target.value }))}>
                                        {editPeriodeOptions.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                                <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                                    ✍️ Pengisian Realisasi (Target: {fmtVal(selectedItem.target_nilai, selectedItem.satuan)})
                                </p>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                    {getPeriodeInputs(editForm.periode_tipe).map((inputLabel, idx) => (
                                        <div key={inputLabel} className="space-y-1 bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                                            <label className="text-[10px] font-bold text-slate-500 block truncate">{inputLabel}</label>
                                            <input type="number" step="any" className="w-full text-center text-sm font-semibold border-0 p-0 focus:ring-0 focus:outline-none bg-transparent" placeholder="-"
                                                value={editForm.monthly_values[idx] || ''}
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    const newMonthly = [...editForm.monthly_values];
                                                    newMonthly[idx] = val;
                                                    const newAvg = calculateAverage(newMonthly, editForm.periode_tipe);
                                                    setEditForm(f => ({ ...f, monthly_values: newMonthly, realisasi_nilai: newAvg > 0 ? String(newAvg) : '' }));
                                                }}
                                            />
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-500">Rataan Capaian (Realisasi):</span>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-lg font-black text-indigo-600">{editForm.realisasi_nilai ? Number(editForm.realisasi_nilai).toFixed(2).replace(/\.00$/, '') : '0'}</span>
                                        <span className="text-xs text-slate-400 font-semibold">{selectedItem.satuan ?? ''}</span>
                                    </div>
                                </div>
                                {editForm.realisasi_nilai && selectedItem.target_nilai && (
                                    <div className="mt-1 text-center">
                                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${(Number(editForm.realisasi_nilai) / Number(selectedItem.target_nilai)) * 100 >= 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                            🎯 Rata-rata Capaian vs Target: {((Number(editForm.realisasi_nilai) / Number(selectedItem.target_nilai)) * 100).toFixed(1)}%
                                        </span>
                                    </div>
                                )}
                            </div>
                            <FormInputAI label="Kendala / Masalah" placeholder="Jelaskan kendala yang dihadapi..." value={editForm.kendala} onChange={v => setEditForm(f => ({ ...f, kendala: v }))} />
                            <FormInputAI label="Tindak Lanjut / Action Plan" placeholder="Rencana tindak lanjut..." value={editForm.tindak_lanjut} onChange={v => setEditForm(f => ({ ...f, tindak_lanjut: v }))} />
                            <div className="flex justify-end space-x-2 pt-2">
                                <button type="button" className="btn-secondary" onClick={() => setShowEditModal(false)}>Batal</button>
                                <button type="submit" className="btn-primary" disabled={saving}>
                                    {saving ? <><Loader2 size={15} className="animate-spin" /><span>Menyimpan...</span></> : <><Save size={15} /><span>Simpan Realisasi</span></>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ====== MODAL TAMBAH EVALUASI ====== */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <h3 className="text-base font-bold text-slate-800">Input Realisasi IKT</h3>
                            <button onClick={() => setShowAddModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleEvalSave} className="p-6 space-y-5">

                            {/* Step 1: Pilih Unit Kerja & Tahun */}
                            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                                    <span className="w-5 h-5 rounded-full bg-[#137fec] text-white flex items-center justify-center text-[10px] font-bold">1</span>
                                    Pilih Unit Kerja &amp; Tahun
                                </p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="form-label text-xs">Unit Kerja</label>
                                        {profile?.role === 'user_unit' ? (
                                            <div className="px-3 py-2 bg-white text-slate-700 rounded-lg text-sm font-bold border border-slate-200">
                                                {units.find(u => u.id === evalForm.unit_kerja_id)?.nama_unit || 'Unit Anda'}
                                            </div>
                                        ) : (
                                            <select className="form-input" value={evalForm.unit_kerja_id} onChange={e => setEvalForm(f => ({ ...f, unit_kerja_id: e.target.value, selectedIKTId: '' }))} required>
                                                <option value="">-- Pilih Unit Kerja --</option>
                                                {units.map(u => <option key={u.id} value={u.id}>{u.nama_unit}</option>)}
                                            </select>
                                        )}
                                    </div>
                                    <div>
                                        <label className="form-label text-xs">Tahun Evaluasi</label>
                                        <select className="form-input" value={evalForm.eval_year} onChange={e => setEvalForm(f => ({ ...f, eval_year: e.target.value, selectedIKTId: '' }))}>
                                            {availableYears.map(y => <option key={y} value={String(y)}>{y}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Step 2: Pilih Target IKT */}
                            {evalForm.unit_kerja_id && (
                                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                                        <span className="w-5 h-5 rounded-full bg-[#137fec] text-white flex items-center justify-center text-[10px] font-bold">2</span>
                                        Pilih Target IKT ({iktForUnit.length} indikator ditemukan untuk {evalForm.eval_year})
                                    </p>
                                    {iktForUnit.length === 0 ? (
                                        <p className="text-sm text-slate-400 italic">Tidak ada target IKT untuk unit kerja &amp; tahun yang dipilih.</p>
                                    ) : (
                                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1 overflow-x-hidden">
                                            {iktForUnit.map(ikt => {
                                                const isSelected = evalForm.selectedIKTId === ikt.id;
                                                const hasRealisasi = ikt.realisasi_nilai != null;
                                                return (
                                                    <button key={ikt.id} type="button" onClick={() => handleIKTSelect(ikt.id)}
                                                        className={`w-full text-left p-3 rounded-lg border-2 transition-all ${isSelected ? 'border-[#137fec] bg-blue-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'}`}>
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="flex-1 min-w-0">
                                                                <p className={`text-sm font-medium ${isSelected ? 'text-[#137fec]' : 'text-slate-700'} line-clamp-2`}>{ikt.indikator}</p>
                                                                <div className="flex items-center gap-3 mt-1">
                                                                    <span className="text-xs text-slate-500">Target: <strong className="text-slate-700">{fmtVal(ikt.target_nilai, ikt.satuan)}</strong></span>
                                                                    <span className="text-xs text-slate-400">Baseline: <strong>{fmtVal(ikt.baseline_nilai, ikt.satuan)}</strong></span>
                                                                    <span className="text-xs text-slate-400">PIC: {ikt.pic ?? '-'}</span>
                                                                </div>
                                                            </div>
                                                            <div className="flex flex-col items-end gap-1">
                                                                {hasRealisasi && (
                                                                    <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">Sudah diisi: {ikt.realisasi_nilai}</span>
                                                                )}
                                                                {isSelected && (
                                                                    <span className="text-[10px] px-2 py-0.5 bg-[#137fec] text-white rounded-full font-medium">✓ Dipilih</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Step 3: Input Realisasi */}
                            {evalForm.selectedIKTId && selectedIKTData && (
                                <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/20 p-4 space-y-4">
                                    <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide flex items-center gap-1.5">
                                        <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold">3</span>
                                        Input Realisasi &amp; Evaluasi
                                    </p>

                                    <div className="grid grid-cols-3 gap-3 mb-3 bg-white p-3 rounded-lg border border-slate-200">
                                        <div>
                                            <span className="text-[10px] text-slate-400 font-bold block uppercase">Target ({selectedIKTData.target_tahun ?? '-'})</span>
                                            <span className="text-base font-bold text-slate-700">{fmtVal(selectedIKTData.target_nilai, selectedIKTData.satuan)}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-slate-400 font-bold block uppercase">Baseline ({selectedIKTData.baseline_tahun ?? '-'})</span>
                                            <span className="text-base font-bold text-slate-700">{fmtVal(selectedIKTData.baseline_nilai, selectedIKTData.satuan)}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-slate-400 font-bold block uppercase">PIC</span>
                                            <span className="text-base font-bold text-slate-700">{selectedIKTData.pic ?? '-'}</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="form-label flex items-center gap-1.5"><Calendar size={13} className="text-indigo-500" /> Tipe Periode</label>
                                            <select className="form-input" value={evalForm.periode_tipe} onChange={e => {
                                                const tipe = e.target.value;
                                                const details = PERIODE_OPTIONS.find(p => p.value === tipe)?.details || ['Tahunan'];
                                                setEvalForm(f => ({ ...f, periode_tipe: tipe, periode_detail: details[0] }));
                                            }}>
                                                {PERIODE_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="form-label">Detail Periode</label>
                                            <select className="form-input" value={evalForm.periode_detail} onChange={e => setEvalForm(f => ({ ...f, periode_detail: e.target.value }))}>
                                                {currentPeriodeOptions.map(d => <option key={d} value={d}>{d}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200">
                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                                            ✍️ Pengisian Realisasi (Target: {fmtVal(selectedIKTData.target_nilai, selectedIKTData.satuan)})
                                        </p>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                            {getPeriodeInputs(evalForm.periode_tipe).map((inputLabel, idx) => (
                                                <div key={inputLabel} className="space-y-1 bg-slate-50 p-2 rounded-lg border border-slate-200">
                                                    <label className="text-[10px] font-bold text-slate-500 block truncate">{inputLabel}</label>
                                                    <input type="number" step="any" className="w-full text-center text-sm font-semibold border-0 p-0 focus:ring-0 focus:outline-none bg-transparent" placeholder="-"
                                                        value={evalForm.monthly_values[idx] || ''}
                                                        onChange={e => {
                                                            const val = e.target.value;
                                                            const newMonthly = [...evalForm.monthly_values];
                                                            newMonthly[idx] = val;
                                                            const newAvg = calculateAverage(newMonthly, evalForm.periode_tipe);
                                                            setEvalForm(f => ({ ...f, monthly_values: newMonthly, realisasi_nilai: newAvg > 0 ? String(newAvg) : '' }));
                                                        }}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                        <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
                                            <span className="text-xs font-bold text-slate-500">Rataan Capaian (Realisasi):</span>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-lg font-black text-indigo-600">{evalForm.realisasi_nilai ? Number(evalForm.realisasi_nilai).toFixed(2).replace(/\.00$/, '') : '0'}</span>
                                                <span className="text-xs text-slate-400 font-semibold">{selectedIKTData.satuan ?? ''}</span>
                                            </div>
                                        </div>
                                        {evalForm.realisasi_nilai && selectedIKTData.target_nilai && (
                                            <div className="mt-1 text-center font-bold">
                                                <span className={`inline-block px-3 py-1 rounded-full text-xs ${(Number(evalForm.realisasi_nilai) / Number(selectedIKTData.target_nilai)) * 100 >= 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                    🎯 Rata-rata Capaian vs Target: {((Number(evalForm.realisasi_nilai) / Number(selectedIKTData.target_nilai)) * 100).toFixed(1)}%
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    <FormInputAI label="Kendala / Masalah" placeholder="Jelaskan kendala yang dihadapi (jika ada)..." value={evalForm.kendala} onChange={v => setEvalForm(f => ({ ...f, kendala: v }))} />
                                    <FormInputAI label="Tindak Lanjut / Action Plan" placeholder="Rencana tindak lanjut untuk perbaikan..." value={evalForm.tindak_lanjut} onChange={v => setEvalForm(f => ({ ...f, tindak_lanjut: v }))} />
                                </div>
                            )}

                            <div className="flex justify-end space-x-2 pt-1">
                                <button type="button" className="btn-secondary" onClick={() => setShowAddModal(false)}>Batal</button>
                                <button type="submit" className="btn-primary" disabled={saving || !evalForm.selectedIKTId}>
                                    {saving ? <><Loader2 size={15} className="animate-spin" /><span>Menyimpan...</span></> : <><Save size={15} /><span>Simpan Realisasi</span></>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
