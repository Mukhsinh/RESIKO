'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/SharedUI';
import FormInputAI from '@/components/FormInputAI';
import { FolderOpen, Save, Loader2, Plus, Trash2, CheckCircle2, Edit, FileText } from 'lucide-react';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useAppSettings } from '@/hooks/useAppSettings';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const CURRENT_YEAR = new Date().getFullYear();

const BSC_PERSPEKTIF = [
    { value: 'Keuangan', label: 'Keuangan', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    { value: 'Pelanggan', label: 'Pelanggan', badge: 'bg-blue-100 text-blue-700 border-blue-200' },
    { value: 'Proses Bisnis Internal', label: 'Proses Bisnis Internal', badge: 'bg-amber-100 text-amber-700 border-amber-200' },
    { value: 'Pembelajaran dan Pertumbuhan', label: 'Pembelajaran dan Pertumbuhan', badge: 'bg-purple-100 text-purple-700 border-purple-200' },
];

interface TowsItem {
    id?: string;
    strategi: string;
    sasaran_strategi: string;
    penanggungjawab: string;
    implementasi: string; // Stores BSC perspective
    isEditing?: boolean;
}

type TowsCategory = 'SO' | 'WO' | 'ST' | 'WT';

export default function TOWSPage() {
    const { profile } = useUserProfile();
    const { settings } = useAppSettings();
    const [units, setUnits] = useState<{ id: string; nama_unit: string }[]>([]);
    const [unitId, setUnitId] = useState('');
    const [year, setYear] = useState(String(CURRENT_YEAR));

    const [form, setForm] = useState<Record<TowsCategory, TowsItem[]>>({
        SO: [], WO: [], ST: [], WT: []
    });

    const [savingCat, setSavingCat] = useState<TowsCategory | null>(null);
    const [savedCat, setSavedCat] = useState<TowsCategory | null>(null);

    useEffect(() => {
        supabase.from('unit_kerja').select('id, nama_unit').order('nama_unit').then(({ data: u, error }: { data: any; error: any }) => {
            if (error) { console.error('Error fetching units:', error); return; }
            setUnits(u ?? []);
            if (u && u.length) {
                if (profile?.role === 'user_unit' && profile.unit_kerja_id) {
                    const matched = u.find((unit: any) => unit.id === profile.unit_kerja_id);
                    if (matched) { setUnitId(matched.id); return; }
                }
                setUnitId(u[0].id);
            }
        });
    }, [profile]);

    useEffect(() => {
        if (!unitId) return;
        const fetchData = async () => {
            try {
                const { data, error } = await supabase
                    .from('swot_tows_strategi').select('*')
                    .eq('unit_kerja_id', unitId).eq('tahun', Number(year));
                if (error) { setForm({ SO: [], WO: [], ST: [], WT: [] }); return; }
                if (data && data.length > 0) {
                    const grouped: Record<TowsCategory, TowsItem[]> = { SO: [], WO: [], ST: [], WT: [] };
                    data.forEach((item: any) => {
                        if (item.tipe_strategi && grouped[item.tipe_strategi as TowsCategory]) {
                            grouped[item.tipe_strategi as TowsCategory].push({
                                id: item.id, strategi: item.strategi || '',
                                sasaran_strategi: item.sasaran_strategi || '',
                                penanggungjawab: item.penanggungjawab || '',
                                implementasi: item.implementasi || 'Keuangan',
                                isEditing: false
                            });
                        }
                    });
                    setForm(grouped);
                } else { setForm({ SO: [], WO: [], ST: [], WT: [] }); }
            } catch { setForm({ SO: [], WO: [], ST: [], WT: [] }); }
        };
        fetchData();
    }, [unitId, year]);

    const handleSaveCategory = async (cat: TowsCategory) => {
        setSavingCat(cat);
        try {
            await supabase.from('swot_tows_strategi').delete()
                .eq('unit_kerja_id', unitId).eq('tahun', Number(year)).eq('tipe_strategi', cat);

            const items = form[cat].filter(s => s.strategi.trim() || s.sasaran_strategi.trim()).map(item => ({
                unit_kerja_id: unitId, tahun: Number(year), tipe_strategi: cat,
                strategi: item.strategi.trim(), sasaran_strategi: item.sasaran_strategi.trim(),
                penanggungjawab: item.penanggungjawab.trim(), implementasi: item.implementasi || 'Keuangan'
            }));

            if (items.length > 0) {
                const { error: insertError } = await supabase.from('swot_tows_strategi').insert(items);
                if (insertError) throw insertError;
            }

            const { data: freshData } = await supabase.from('swot_tows_strategi').select('*')
                .eq('unit_kerja_id', unitId).eq('tahun', Number(year)).eq('tipe_strategi', cat);

            if (freshData) {
                setForm(prev => ({
                    ...prev,
                    [cat]: freshData.map((item: any) => ({
                        id: item.id, strategi: item.strategi || '',
                        sasaran_strategi: item.sasaran_strategi || '',
                        penanggungjawab: item.penanggungjawab || '',
                        implementasi: item.implementasi || 'Keuangan',
                        isEditing: false
                    }))
                }));
            }
            setSavedCat(cat); setTimeout(() => setSavedCat(null), 2500);
        } catch (err: any) {
            alert('Gagal menyimpan data: ' + err.message);
        } finally { setSavingCat(null); }
    };

    const addItem = (cat: TowsCategory) => {
        setForm(prev => ({
            ...prev,
            [cat]: [...prev[cat], { strategi: '', sasaran_strategi: '', penanggungjawab: '', implementasi: 'Keuangan', isEditing: true }]
        }));
    };

    const removeItem = (cat: TowsCategory, index: number) => {
        setForm(prev => { const n = [...prev[cat]]; n.splice(index, 1); return { ...prev, [cat]: n }; });
    };

    const updateItem = (cat: TowsCategory, index: number, field: keyof TowsItem, value: any) => {
        setForm(prev => { const n = [...prev[cat]]; n[index] = { ...n[index], [field]: value }; return { ...prev, [cat]: n }; });
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

        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('LAPORAN MATRIKS TOWS', pageWidth / 2, pageHeight / 2 - 60, { align: 'center' });

        doc.setFontSize(16);
        doc.setFont('helvetica', 'normal');
        doc.text(`Tahun: ${year || 'Semua'}`, pageWidth / 2, pageHeight / 2, { align: 'center' });

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
        doc.text('A. Identifikasi Alternatif Strategi TOWS', 40, 140);

        let finalY = 160;

        const tableCats = [
            { key: 'SO', label: '1. STRATEGI S-O (Strength - Opportunity)', desc: 'Gunakan Kekuatan untuk meraih Peluang' },
            { key: 'WO', label: '2. STRATEGI W-O (Weakness - Opportunity)', desc: 'Atasi Kelemahan dengan memanfaatkan Peluang' },
            { key: 'ST', label: '3. STRATEGI S-T (Strength - Threat)', desc: 'Gunakan Kekuatan untuk menghadapi Ancaman' },
            { key: 'WT', label: '4. STRATEGI W-T (Weakness - Threat)', desc: 'Minimalkan Kelemahan dan hindari Ancaman' },
        ] as const;

        tableCats.forEach((catInfo) => {
            if (finalY > pageHeight - 155) {
                doc.addPage();
                finalY = 70;
            }

            doc.setFontSize(10.5);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(30, 41, 59);
            doc.text(catInfo.label, 40, finalY + 15);

            doc.setFontSize(8);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(100, 116, 139);
            doc.text(catInfo.desc, 40, finalY + 27);

            let rowIdx = 1;
            const items = form[catInfo.key as TowsCategory];
            const tableData = items.map(item => [
                rowIdx++,
                item.strategi || '-',
                item.sasaran_strategi || '-',
                item.implementasi || '-',
                item.penanggungjawab || '-'
            ]);

            if (tableData.length === 0) {
                tableData.push(['-', 'Belum ada alternatif strategi yang dirumuskan', '-', '-', '-']);
            }

            autoTable(doc, {
                startY: finalY + 34,
                head: [['No', 'Alternatif Strategi', 'Sasaran Strategi', 'Perspektif BSC / Implementasi', 'Penanggung Jawab (PIC)']],
                body: tableData,
                theme: 'grid',
                headStyles: { fillColor: rgbColor, fontSize: 8, fontStyle: 'bold' },
                styles: { fontSize: 8, cellPadding: 4 },
                columnStyles: {
                    0: { cellWidth: 30, halign: 'center' },
                    1: { cellWidth: 155 },
                    2: { cellWidth: 140 },
                    3: { cellWidth: 110, halign: 'center' },
                    4: { cellWidth: 80 }
                },
                margin: { left: 40, right: 40 },
                didDrawPage: (data) => {
                    const currentPage = doc.getCurrentPageInfo().pageNumber;
                    if (currentPage > contentPageStart) {
                        addHeader(doc, 'Laporan Matriks TOWS');
                    }
                }
            });
            finalY = (doc as any).lastAutoTable.finalY + 20;
        });

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

        doc.text('1. Rumusan Alternatif Strategi Matriks TOWS', 40, 140);
        doc.text(`${contentPageStart - 1}`, pageWidth - 40, 140, { align: 'right' });

        doc.text('2. Lembar Tanda Tangan Pengesahan Laporan', 40, 160);
        const lastPage = doc.getNumberOfPages();
        doc.text(`${lastPage - 1}`, pageWidth - 40, 160, { align: 'right' });

        // Go to last page for signature block
        doc.setPage(lastPage);
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
        doc.text(settings?.jabatan_penandatangan_kiri || 'Penanggungjawab Unit', 60, finalY + 14);
        doc.line(60, finalY + 65, 200, finalY + 65);
        doc.text(settings?.nama_penandatangan_kiri || '............................', 60, finalY + 78);

        doc.text('Disetujui oleh,', pageWidth - 200, finalY);
        doc.setFont('helvetica', 'bold');
        doc.text(settings?.kepala_rs || 'Direktur RS', pageWidth - 200, finalY + 14);
        doc.line(pageWidth - 200, finalY + 65, pageWidth - 60, finalY + 65);
        doc.setFont('helvetica', 'normal');
        doc.text(`NIP: ${settings?.nip_kepala || '-'}`, pageWidth - 200, finalY + 78);

        addFooter(doc);
        doc.save(`Laporan_TOWS_${year || 'Semua'}.pdf`);
    };

    const getPerspektifBadge = (val: string) => BSC_PERSPEKTIF.find(p => p.value === val)?.badge || 'bg-slate-100 text-slate-600 border-slate-200';

    const cells = [
        { key: 'SO', label: 'Strategi S-O', desc: 'Gunakan Kekuatan untuk meraih Peluang', colorClass: 'border-l-4 border-l-emerald-400', labelBg: 'bg-emerald-50 text-emerald-700', accentColor: 'text-emerald-600' },
        { key: 'WO', label: 'Strategi W-O', desc: 'Atasi Kelemahan dengan memanfaatkan Peluang', colorClass: 'border-l-4 border-l-[#137fec]', labelBg: 'bg-blue-50 text-blue-700', accentColor: 'text-blue-600' },
        { key: 'ST', label: 'Strategi S-T', desc: 'Gunakan Kekuatan untuk menghadapi Ancaman', colorClass: 'border-l-4 border-l-amber-400', labelBg: 'bg-amber-50 text-amber-700', accentColor: 'text-amber-600' },
        { key: 'WT', label: 'Strategi W-T', desc: 'Minimalkan Kelemahan dan hindari Ancaman', colorClass: 'border-l-4 border-l-rose-400', labelBg: 'bg-rose-50 text-rose-700', accentColor: 'text-rose-600' },
    ] as const;

    return (
        <div className="pb-12">
            <PageHeader
                title="Matriks TOWS"
                subtitle="Rumuskan strategi, sasaran strategi, dan penanggungjawab berdasarkan kombinasi faktor SWOT."
                actions={
                    <div className="flex gap-3 flex-wrap">
                        <button type="button" onClick={handleExportPDF} className="btn-secondary border-primary/20 text-primary hover:bg-primary/5 flex items-center gap-1.5 py-2 px-3 text-sm">
                            <FileText size={15} /> Laporan
                        </button>
                        {profile?.role === 'user_unit' ? (
                            <div className="form-input w-52 bg-slate-100 text-slate-600 cursor-not-allowed">
                                {units.find(u => u.id === unitId)?.nama_unit || 'Unit Kerja Anda'}
                            </div>
                        ) : (
                            <select className="form-input w-52" value={unitId} onChange={e => setUnitId(e.target.value)}>
                                {units.map(u => <option key={u.id} value={u.id}>{u.nama_unit}</option>)}
                            </select>
                        )}
                        <select className="form-input w-32" value={year} onChange={e => setYear(e.target.value)}>
                            {[CURRENT_YEAR + 1, CURRENT_YEAR, CURRENT_YEAR - 1].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                }
            />

            <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                    { label: 'Internal: Kekuatan (S) + Kelemahan (W)', color: 'bg-slate-100 text-slate-600' },
                    { label: 'Eksternal: Peluang (O) + Ancaman (T)', color: 'bg-slate-100 text-slate-600' },
                ].map(item => (
                    <div key={item.label} className={`text-center text-xs font-semibold py-2 rounded-xl ${item.color}`}>{item.label}</div>
                ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
                {cells.map(cell => (
                    <div key={cell.key} className={`card ${cell.colorClass} flex flex-col`}>
                        <div className="flex items-center justify-between xl:flex-col xl:items-start xl:gap-2 mb-4 sm:flex-row">
                            <div className="mb-1">
                                <span className={`text-xs font-bold px-3 py-1 rounded-full ${cell.labelBg}`}>{cell.label}</span>
                                <p className="text-xs text-slate-500 mt-2">{cell.desc}</p>
                            </div>
                            <button type="button" onClick={() => addItem(cell.key as TowsCategory)} className="btn-secondary text-xs py-1.5 px-3 self-start shrink-0">
                                <Plus size={14} className="mr-1" /> Tambah Strategi
                            </button>
                        </div>

                        <div className="flex flex-col gap-3 flex-1">
                            {form[cell.key as TowsCategory].length === 0 ? (
                                <div className="text-center py-6 text-slate-400 text-sm border-2 border-dashed rounded-lg border-slate-200">
                                    Belum ada strategi. Klik Tambah Strategi untuk memasukkan data.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {form[cell.key as TowsCategory].map((item, index) => {
                                        const isEditing = item.isEditing ?? false;

                                        if (!isEditing) {
                                            return (
                                                <div key={index} className="bg-white px-4 py-3 rounded-lg border border-slate-200/80 shadow-sm transition-all hover:border-slate-300">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                                            <span className="text-xs font-bold text-slate-400 bg-slate-100 w-5 h-5 flex items-center justify-center rounded-full shrink-0 mt-0.5">{index + 1}</span>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-sm font-semibold text-slate-700 break-words leading-relaxed whitespace-pre-wrap">{item.strategi}</p>
                                                                {item.sasaran_strategi && (
                                                                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                                                                        <span className="font-bold text-slate-400 uppercase text-[9px] tracking-wider">Sasaran:</span>{' '}
                                                                        {item.sasaran_strategi}
                                                                    </p>
                                                                )}
                                                                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                                                    {item.implementasi && (
                                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getPerspektifBadge(item.implementasi)}`}>
                                                                            BSC: {item.implementasi}
                                                                        </span>
                                                                    )}
                                                                    {item.penanggungjawab && (
                                                                        <span className="text-xs text-slate-500">
                                                                            <span className="font-bold text-slate-400 uppercase text-[9px] tracking-wider">PIC:</span>{' '}
                                                                            <span className={`font-semibold ${cell.accentColor}`}>{item.penanggungjawab}</span>
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            <button type="button" onClick={() => updateItem(cell.key as TowsCategory, index, 'isEditing', true)} className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="Edit"><Edit size={14} /></button>
                                                            <button type="button" onClick={() => removeItem(cell.key as TowsCategory, index)} className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors" title="Hapus"><Trash2 size={14} /></button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div key={index} className="bg-white p-4 rounded-lg shadow-sm border border-indigo-200 relative">
                                                <div className="flex items-start gap-2.5 mb-3">
                                                    <span className="text-xs font-bold text-white bg-[#137fec] w-5 h-5 flex items-center justify-center rounded-full shrink-0 mt-1">{index + 1}</span>
                                                    <div className="flex-1 min-w-0">
                                                        <FormInputAI label={`Rumusan Strategi ${cell.key}`} placeholder={`Contoh rumusan strategi...`} value={item.strategi} onChange={v => updateItem(cell.key as TowsCategory, index, 'strategi', v)} rows={2} />
                                                    </div>
                                                </div>

                                                <div className="mt-3">
                                                    <label className="form-label mb-1 text-xs">Sasaran Strategi</label>
                                                    <textarea rows={2} className="form-input text-sm resize-none" placeholder="Contoh sasaran strategi..." value={item.sasaran_strategi} onChange={e => updateItem(cell.key as TowsCategory, index, 'sasaran_strategi', e.target.value)} />
                                                </div>

                                                <div className="mt-3">
                                                    <label className="form-label mb-1 text-xs">Perspektif BSC</label>
                                                    <select className="form-input text-sm" value={item.implementasi || 'Keuangan'} onChange={e => updateItem(cell.key as TowsCategory, index, 'implementasi', e.target.value)}>
                                                        {BSC_PERSPEKTIF.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                                                    </select>
                                                </div>

                                                <div className="mt-3">
                                                    <label className="form-label mb-1 text-xs">Penanggungjawab</label>
                                                    <input type="text" className="form-input text-sm" placeholder="PIC / Bidang penanggungjawab..." value={item.penanggungjawab} onChange={e => updateItem(cell.key as TowsCategory, index, 'penanggungjawab', e.target.value)} />
                                                </div>

                                                <div className="flex gap-1.5 mt-3 justify-end">
                                                    <button type="button" onClick={() => { if (!item.id) { removeItem(cell.key as TowsCategory, index); } else { updateItem(cell.key as TowsCategory, index, 'isEditing', false); } }} className="btn-secondary py-1.5 text-[11px] px-3">Batal</button>
                                                    <button type="button" onClick={() => updateItem(cell.key as TowsCategory, index, 'isEditing', false)} className="btn-primary py-1.5 text-[11px] px-3 bg-indigo-600 hover:bg-indigo-700" disabled={!item.strategi.trim()}>Selesai</button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                            <button type="button" onClick={() => handleSaveCategory(cell.key as TowsCategory)} className="btn-primary text-sm py-2 px-4 shadow-sm" disabled={savingCat === cell.key || form[cell.key as TowsCategory].length === 0}>
                                {savingCat === cell.key ? <><Loader2 size={16} className="animate-spin mr-1.5" />Menyimpan...</> :
                                    savedCat === cell.key ? <><CheckCircle2 size={16} className="mr-1.5" />Tersimpan!</> :
                                        <><Save size={16} className="mr-1.5" />Simpan {cell.key}</>}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
