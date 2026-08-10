'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAppSettings } from '@/hooks/useAppSettings';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PageHeader, ScoreCard, FilterBar, TopActionBar } from '@/components/SharedUI';
import DataTable, { type Column } from '@/components/DataTable';
import {
    FileText, AlertTriangle, ShieldAlert, CheckCircle2,
    Eye, Trash2, X, Save, Loader2, Settings, Bell, BellOff, Download
} from 'lucide-react';

/* ─── Types ─── */
interface EWSAlert {
    id: string;
    unit_kerja_id?: string;
    kri_id?: string;
    nama_threshold: string;
    parameter: string;
    nilai_batas: number;
    satuan?: string;
    level: string;
    is_active: boolean;
    created_at: string;
    // joined
    unit_kerja?: { id: string; nama_unit: string };
    key_risk_indicators?: { id: string; nama_kri: string; nilai_aktual?: number; batas_atas?: number; satuan?: string };
    // computed
    nilai_aktual?: number;
    is_breached?: boolean;
}

interface KRIItem {
    id: string;
    nama_kri: string;
    nilai_aktual?: number;
    batas_atas?: number;
    batas_bawah?: number;
    satuan?: string;
    unit_kerja_id?: string;
    unit_kerja?: { id: string; nama_unit: string };
}

interface WorkUnit { id: string; nama_unit: string; }

/* ─── Empty Form ─── */
const EMPTY_THRESHOLD = {
    unit_kerja_id: '',
    kri_id: '',
    nama_threshold: '',
    parameter: '',
    nilai_batas: 0,
    satuan: '',
    level: 'Warning',
    is_active: true,
};

/* ─── Threshold Modal ─── */
function ThresholdModal({ onClose, onSave, units, kriList, saving }: {
    onClose: () => void;
    onSave: (data: typeof EMPTY_THRESHOLD) => void;
    units: WorkUnit[];
    kriList: KRIItem[];
    saving: boolean;
}) {
    const [form, setForm] = useState({ ...EMPTY_THRESHOLD });
    const f = (k: keyof typeof form, v: string | number | boolean) => setForm(prev => ({ ...prev, [k]: v }));

    const handleKRISelect = (id: string) => {
        f('kri_id', id);
        const kri = kriList.find(k => k.id === id);
        if (kri) {
            f('nama_threshold', `Threshold: ${kri.nama_kri}`);
            f('nilai_batas', kri.batas_atas ?? 0);
            f('satuan', kri.satuan ?? '');
            if (!form.unit_kerja_id && kri.unit_kerja_id) f('unit_kerja_id', kri.unit_kerja_id);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl my-8">
                <div className="flex justify-between items-center p-6 border-b border-slate-100">
                    <div>
                        <h2 className="font-bold text-slate-800 text-lg">Atur Ambang Batas (Threshold)</h2>
                        <p className="text-xs text-slate-500 mt-0.5">Tetapkan batas peringatan dini untuk KRI</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"><X size={18} /></button>
                </div>

                <div className="p-6 space-y-5 text-sm">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="form-label">Unit Kerja</label>
                            <select className="form-input w-full" value={form.unit_kerja_id} onChange={e => f('unit_kerja_id', e.target.value)}>
                                <option value="">-- Semua Unit --</option>
                                {units.map(u => <option key={u.id} value={u.id}>{u.nama_unit}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="form-label">Level Peringatan</label>
                            <select className="form-input w-full" value={form.level} onChange={e => f('level', e.target.value)}>
                                <option>Critical</option>
                                <option>Warning</option>
                                <option>Notice</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="form-label">KRI Referensi (dari evaluasi risiko)</label>
                        <select className="form-input w-full" value={form.kri_id} onChange={e => handleKRISelect(e.target.value)}>
                            <option value="">-- Pilih KRI --</option>
                            {kriList.map(k => (
                                <option key={k.id} value={k.id}>
                                    [{k.unit_kerja?.nama_unit ?? 'All'}] {k.nama_kri} (Batas: {k.batas_atas ?? '-'} {k.satuan ?? ''})
                                </option>
                            ))}
                        </select>
                        {form.kri_id && kriList.find(k => k.id === form.kri_id) && (
                            <div className="mt-2 p-3 bg-indigo-50 rounded-lg text-xs text-indigo-700">
                                KRI Terpilih — Batas Atas: <strong>{kriList.find(k => k.id === form.kri_id)?.batas_atas}</strong> · Nilai Aktual: <strong>{kriList.find(k => k.id === form.kri_id)?.nilai_aktual}</strong>
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="form-label">Nama Threshold *</label>
                        <input type="text" className="form-input w-full" value={form.nama_threshold} onChange={e => f('nama_threshold', e.target.value)} placeholder="e.g. Batas Insiden Bulanan" required />
                    </div>

                    <div>
                        <label className="form-label">Parameter yang Dipantau *</label>
                        <input type="text" className="form-input w-full" value={form.parameter} onChange={e => f('parameter', e.target.value)} placeholder="e.g. Jumlah insiden per bulan" required />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="form-label">Nilai Batas *</label>
                            <input type="number" className="form-input w-full" value={form.nilai_batas} onChange={e => f('nilai_batas', Number(e.target.value))} />
                        </div>
                        <div>
                            <label className="form-label">Satuan</label>
                            <input type="text" className="form-input w-full" value={form.satuan} onChange={e => f('satuan', e.target.value)} placeholder="e.g. kasus, %, event" />
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => f('is_active', e.target.checked)} className="w-4 h-4 rounded" />
                        <label htmlFor="is_active" className="text-sm text-slate-700">Threshold aktif (monitoring berjalan)</label>
                    </div>
                </div>

                <div className="flex justify-end gap-3 px-6 pb-6">
                    <button onClick={onClose} className="btn-secondary">Batal</button>
                    <button
                        onClick={() => onSave(form)}
                        className="btn-primary flex items-center gap-2"
                        disabled={saving || !form.nama_threshold || !form.parameter}
                    >
                        {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                        Simpan Threshold
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─── View Modal ─── */
function ViewModal({ row, onClose }: { row: EWSAlert; onClose: () => void }) {
    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-8">
                <div className="flex justify-between items-center p-6 border-b border-slate-100">
                    <h2 className="font-bold text-slate-800 text-lg">Detail Threshold EWS</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"><X size={18} /></button>
                </div>
                <div className="p-6 space-y-4 text-sm">
                    <div className="grid grid-cols-2 gap-4">
                        <div><span className="text-xs text-slate-400">Unit Kerja</span><p className="font-semibold mt-0.5">{row.unit_kerja?.nama_unit ?? 'Semua Unit'}</p></div>
                        <div><span className="text-xs text-slate-400">Level</span>
                            <p className={`font-bold mt-0.5 ${row.level === 'Critical' ? 'text-rose-600' : row.level === 'Warning' ? 'text-amber-600' : 'text-blue-600'}`}>{row.level}</p>
                        </div>
                        <div className="col-span-2"><span className="text-xs text-slate-400">Nama Threshold</span><p className="font-semibold mt-0.5 text-base">{row.nama_threshold}</p></div>
                        <div className="col-span-2"><span className="text-xs text-slate-400">Parameter Dipantau</span><p className="mt-0.5 text-slate-600">{row.parameter}</p></div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="bg-slate-50 rounded-xl p-3">
                            <p className="text-xs text-slate-500">Nilai Batas</p>
                            <p className="text-2xl font-bold text-slate-700 mt-1">{row.nilai_batas}<span className="text-xs font-normal ml-1">{row.satuan}</span></p>
                        </div>
                        <div className={`rounded-xl p-3 ${row.is_breached ? 'bg-rose-50' : 'bg-emerald-50'}`}>
                            <p className="text-xs text-slate-500">Nilai Aktual KRI</p>
                            <p className={`text-2xl font-bold mt-1 ${row.is_breached ? 'text-rose-600' : 'text-emerald-600'}`}>
                                {row.key_risk_indicators?.nilai_aktual ?? '-'}
                            </p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3">
                            <p className="text-xs text-slate-500">Status</p>
                            <p className={`text-sm font-bold mt-2 ${row.is_active ? 'text-emerald-600' : 'text-slate-400'}`}>{row.is_active ? 'Aktif' : 'Non-aktif'}</p>
                        </div>
                    </div>
                    {row.is_breached && (
                        <div className="p-3 bg-rose-100 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-700 text-sm font-semibold">
                            <AlertTriangle size={18} />
                            Nilai KRI melebihi ambang batas! Diperlukan tindakan segera.
                        </div>
                    )}
                </div>
                <div className="flex justify-end px-6 pb-6"><button onClick={onClose} className="btn-secondary">Tutup</button></div>
            </div>
        </div>
    );
}

/* ─── Main Page ─── */
export default function EarlyWarningSystemPage() {
    const { settings } = useAppSettings();
    const [rows, setRows] = useState<EWSAlert[]>([]);
    const [kriList, setKriList] = useState<KRIItem[]>([]);
    const [units, setUnits] = useState<WorkUnit[]>([]);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState('');
    const [year, setYear] = useState(String(new Date().getFullYear()));
    const [unitFilter, setUnitFilter] = useState('');
    const [showThresholdModal, setShowThresholdModal] = useState(false);
    const [viewRow, setViewRow] = useState<EWSAlert | null>(null);

    const handleExportPDF = async () => {
        setDownloading(true);
        try {
            const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();

            const hexToRgb = (hex: string): [number, number, number] => {
                const h = hex.replace('#', '');
                if (h.length !== 6) return [19, 127, 236];
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
                    if (i === 1) continue;
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
            doc.text('LAPORAN EARLY WARNING SYSTEM', pageWidth / 2, pageHeight / 2 - 60, { align: 'center' });
            doc.setFontSize(16);
            doc.setFont('helvetica', 'normal');
            doc.text(`Tahun: ${year || 'Semua'}`, pageWidth / 2, pageHeight / 2, { align: 'center' });
            doc.setFontSize(12);
            doc.text((settings?.nama_rs || 'RUMAH SAKIT').toUpperCase(), pageWidth / 2, pageHeight / 2 + 50, { align: 'center' });

            doc.addPage();
            let tocPageNum = doc.getCurrentPageInfo().pageNumber;
            doc.addPage();
            let contentPageStart = doc.getCurrentPageInfo().pageNumber;

            drawKopSurat(doc);

            doc.setTextColor(30, 41, 59);
            doc.setFontSize(13);
            doc.setFont('helvetica', 'bold');
            doc.text('A. Daftar Threshold & Indikator Early Warning System', 40, 140);

            let finalY = 160;
            let rowIdx = 1;

            const tableData = filtered.map(r => {
                const unit_name = r.unit_kerja?.nama_unit ?? 'Semua Unit';
                const aktual = r.nilai_aktual !== undefined ? `${r.nilai_aktual} ${r.satuan ?? ''}` : '-';
                const batas = `${r.nilai_batas} ${r.satuan ?? ''}`;
                const statusMonitor = r.is_active ? 'Aktif' : 'Non-aktif';
                const statusBreached = r.is_breached ? 'MELEBIHI AMBANG' : 'NORMAL';

                return [
                    rowIdx++,
                    unit_name,
                    r.nama_threshold,
                    r.parameter,
                    batas,
                    aktual,
                    r.level,
                    `${statusMonitor} (${statusBreached})`
                ];
            });

            autoTable(doc, {
                startY: finalY,
                head: [['No', 'Unit', 'Nama Threshold', 'Parameter', 'Batas', 'Aktual', 'Level', 'Status']],
                body: tableData,
                theme: 'grid',
                headStyles: { fillColor: rgbColor, fontSize: 8, fontStyle: 'bold' },
                styles: { fontSize: 8, cellPadding: 4 },
                columnStyles: {
                    0: { cellWidth: 20, halign: 'center' },
                    1: { cellWidth: 70 },
                    2: { cellWidth: 90 },
                    3: { cellWidth: 100 },
                    4: { cellWidth: 50, halign: 'center' },
                    5: { cellWidth: 50, halign: 'center' },
                    6: { cellWidth: 50, halign: 'center' },
                    7: { cellWidth: 85, halign: 'center' }
                },
                margin: { left: 40, right: 40 },
                didDrawPage: () => {
                    const currentPage = doc.getCurrentPageInfo().pageNumber;
                    if (currentPage > contentPageStart) {
                        addHeader(doc, 'Laporan Early Warning System');
                    }
                }
            });

            finalY = (doc as any).lastAutoTable.finalY + 20;

            // TOC
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
            doc.text('1. Threshold & Indikator Early Warning System', 40, 140);
            doc.text(`${contentPageStart - 1}`, pageWidth - 40, 140, { align: 'right' });

            doc.text('2. Lembar Tanda Tangan Pengesahan Laporan', 40, 160);
            const lastPage = doc.getNumberOfPages();
            doc.text(`${lastPage - 1}`, pageWidth - 40, 160, { align: 'right' });

            // Signature block on last page
            doc.setPage(lastPage);
            if (finalY > pageHeight - 150) {
                doc.addPage();
                finalY = 70;
            } else {
                finalY += 15;
            }

            const tgl = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
            const kota = settings?.kota || 'Kota';

            doc.setFontSize(9.5);
            doc.setTextColor(51, 65, 85);
            doc.setFont('helvetica', 'normal');
            doc.text('Disiapkan oleh,', 60, finalY);
            doc.text('Pengelola Manajemen Risiko', 60, finalY + 14);
            doc.line(60, finalY + 65, 200, finalY + 65);

            doc.text(`${kota}, ${tgl}`, pageWidth - 200, finalY);
            doc.text('Disetujui oleh,', pageWidth - 200, finalY + 14);
            doc.setFont('helvetica', 'bold');
            doc.text(settings?.kepala_rs || 'Pimpinan Rumah Sakit', pageWidth - 200, finalY + 28);
            doc.line(pageWidth - 200, finalY + 65, pageWidth - 60, finalY + 65);
            doc.setFont('helvetica', 'normal');
            doc.text(`NIP: ${settings?.nip_kepala || '-'}`, pageWidth - 200, finalY + 78);

            addFooter(doc);
            doc.save(`Laporan_Early_Warning_${year || 'Semua'}.pdf`);
        } catch (e) {
            console.error(e);
            alert('Gagal mengunduh laporan PDF');
        } finally {
            setDownloading(false);
        }
    };

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('ews_thresholds')
                .select('*, unit_kerja(id, nama_unit), key_risk_indicators(id, nama_kri, nilai_aktual, batas_atas, satuan)')
                .order('created_at', { ascending: false });
            if (error) { console.error('Error fetching EWS:', error); setRows([]); }
            else {
                const enriched = ((data ?? []) as EWSAlert[]).map(r => {
                    const aktual = r.key_risk_indicators?.nilai_aktual ?? null;
                    return {
                        ...r,
                        nilai_aktual: aktual ?? undefined,
                        is_breached: aktual !== null ? aktual > r.nilai_batas : false,
                    };
                });
                setRows(enriched);
            }
        } catch (e) { console.error(e); setRows([]); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    useEffect(() => {
        supabase.from('unit_kerja').select('id, nama_unit').then(({ data }: { data: any }) => setUnits((data ?? []) as WorkUnit[]));
        supabase.from('key_risk_indicators')
            .select('id, nama_kri, nilai_aktual, batas_atas, batas_bawah, satuan, unit_kerja_id, unit_kerja(id, nama_unit)')
            .then(({ data }: { data: any }) => setKriList((data ?? []) as unknown as KRIItem[]));
    }, []);

    const filtered = rows.filter(d => {
        const matchSearch = (d.nama_threshold || '').toLowerCase().includes(search.toLowerCase()) ||
            (d.parameter || '').toLowerCase().includes(search.toLowerCase());
        const matchUnit = unitFilter ? d.unit_kerja_id === unitFilter : true;
        return matchSearch && matchUnit;
    });

    const stats = {
        total: filtered.length,
        critical: filtered.filter(d => d.is_breached && d.level === 'Critical').length,
        warning: filtered.filter(d => d.is_breached && d.level !== 'Critical').length,
        normal: filtered.filter(d => !d.is_breached).length,
    };

    const handleSaveThreshold = async (form: typeof EMPTY_THRESHOLD) => {
        setSaving(true);
        try {
            const payload = {
                unit_kerja_id: form.unit_kerja_id || null,
                kri_id: form.kri_id || null,
                nama_threshold: form.nama_threshold,
                parameter: form.parameter,
                nilai_batas: Number(form.nilai_batas),
                satuan: form.satuan || null,
                level: form.level,
                is_active: form.is_active,
                updated_at: new Date().toISOString(),
            };
            const { error } = await supabase.from('ews_thresholds').insert(payload);
            if (error) { console.error(error); alert('Gagal menyimpan threshold: ' + error.message); }
            else { setShowThresholdModal(false); fetchData(); }
        } catch (e) { console.error(e); }
        finally { setSaving(false); }
    };

    const handleDelete = async (row: EWSAlert) => {
        if (!confirm(`Hapus threshold "${row.nama_threshold}"?`)) return;
        const { error } = await supabase.from('ews_thresholds').delete().eq('id', row.id);
        if (error) alert('Gagal menghapus: ' + error.message);
        else fetchData();
    };

    const LEVEL_BADGE: Record<string, string> = {
        Critical: 'badge-red',
        Warning: 'badge-amber',
        Notice: 'badge-blue',
    };

    const columns: Column<EWSAlert>[] = [
        { key: 'unit_kerja_id', label: 'Unit Deteksi', render: r => (r as any).unit_kerja?.nama_unit ?? 'Semua Unit' },
        {
            key: 'nama_threshold', label: 'Parameter Threshold', className: 'max-w-md font-medium',
            render: r => (
                <div>
                    <p className="font-semibold text-slate-800">{r.nama_threshold}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{r.parameter}</p>
                </div>
            )
        },
        {
            key: 'nilai_batas', label: 'Batas / Aktual', className: 'text-center',
            render: r => (
                <div>
                    <p className="text-slate-600">Batas: <strong>{r.nilai_batas} {r.satuan ?? ''}</strong></p>
                    {r.nilai_aktual !== undefined && (
                        <p className={r.is_breached ? 'text-rose-600 font-bold' : 'text-emerald-600'}>
                            Aktual: {r.nilai_aktual} {r.satuan ?? ''}
                        </p>
                    )}
                </div>
            )
        },
        {
            key: 'level', label: 'Level', className: 'text-center',
            render: r => <span className={LEVEL_BADGE[r.level] ?? 'badge-gray'}>{r.level}</span>
        },
        {
            key: 'is_active', label: 'Status Monitor', className: 'text-center',
            render: r => r.is_active
                ? <span className="badge-green">Aktif</span>
                : <span className="badge-gray">Non-aktif</span>
        },
        {
            key: 'actions', label: 'Aksi', render: r => (
                <div className="flex gap-1 items-center justify-center">
                    {r.is_breached && (
                        <span title="Nilai melebihi batas!" className="p-1.5 text-rose-500 animate-pulse">
                            <Bell size={15} />
                        </span>
                    )}
                    {!r.is_breached && (
                        <span title="Normal" className="p-1.5 text-slate-300">
                            <BellOff size={15} />
                        </span>
                    )}
                    <button title="Lihat detail" className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded" onClick={() => setViewRow(r)}><Eye size={15} /></button>
                    <button title="Hapus" className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded" onClick={() => handleDelete(r)}><Trash2 size={15} /></button>
                </div>
            )
        },
    ];

    const breachedCount = filtered.filter(r => r.is_breached).length;

    return (
        <div>
            {showThresholdModal && (
                <ThresholdModal
                    onClose={() => setShowThresholdModal(false)}
                    onSave={handleSaveThreshold}
                    units={units}
                    kriList={kriList}
                    saving={saving}
                />
            )}
            {viewRow && <ViewModal row={viewRow} onClose={() => setViewRow(null)} />}

            <PageHeader title="Early Warning System" subtitle="Sistem deteksi dini untuk indikasi anomali dan mitigasi prediktif." />

            <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
                <ScoreCard icon={<ShieldAlert size={22} className="text-slate-500" />} title="Total Threshold" value={stats.total} colorClass="bg-slate-50 border-slate-100" />
                <ScoreCard icon={<AlertTriangle size={22} className="text-rose-500" />} title="Sinyal Kritis" value={stats.critical} colorClass="bg-rose-50 border-rose-100" />
                <ScoreCard icon={<AlertTriangle size={22} className="text-amber-500" />} title="Peringatan" value={stats.warning} colorClass="bg-amber-50 border-amber-100" />
                <ScoreCard icon={<CheckCircle2 size={22} className="text-emerald-500" />} title="Sistem Normal" value={stats.normal} colorClass="bg-emerald-50 border-emerald-100" />
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-8">
                {breachedCount > 0 && (
                    <div className="p-4 bg-rose-50 border-b border-rose-200 text-rose-800 text-sm flex items-center gap-2 font-medium animate-pulse">
                        <AlertTriangle size={18} />
                        🚨 PERINGATAN: {breachedCount} threshold melebihi batas ambang! Segera lakukan tindakan penanganan.
                    </div>
                )}
                {breachedCount === 0 && rows.length > 0 && (
                    <div className="p-4 bg-orange-50 border-b border-orange-100 text-orange-800 text-sm flex items-center gap-2">
                        <AlertTriangle size={18} /> Live Monitoring Active: Semua threshold dalam batas normal.
                    </div>
                )}
                <TopActionBar
                    filters={
                        <div className="flex flex-wrap gap-3 items-center">
                            <FilterBar
                                searchValue={search} onSearchChange={setSearch} searchPlaceholder="Cari threshold..."
                                yearValue={year} onYearChange={setYear}
                            />
                            <select className="form-select text-sm h-9" value={unitFilter} onChange={e => setUnitFilter(e.target.value)}>
                                <option value="">Semua Unit</option>
                                {units.map(u => <option key={u.id} value={u.id}>{u.nama_unit}</option>)}
                            </select>
                        </div>
                    }
                    actions={
                        <>
                            <button className="btn-secondary" onClick={handleExportPDF} disabled={downloading}>
                                {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                                <span className="hidden sm:inline">Laporan</span>
                            </button>
                            <button className="btn-primary" onClick={() => setShowThresholdModal(true)}><Settings size={15} /><span>Set Threshold</span></button>
                        </>
                    }
                />
                <DataTable columns={columns} data={filtered} isLoading={loading} />
                <div className="px-6 py-3 border-t border-slate-50 text-xs text-slate-400">
                    {filtered.length} threshold terdaftar · {breachedCount} melebihi batas
                </div>
            </div>
        </div>
    );
}
