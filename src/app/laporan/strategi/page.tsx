'use client';

import React, { useEffect, useState } from 'react';
import { supabase, type ManajemenStrategi } from '@/lib/supabase';
import { PageHeader, ScoreCard } from '@/components/SharedUI';
import { BarChart2, Target, CheckCircle2, TrendingUp, Download, FileText, AlertTriangle, ChevronDown, BookOpen, Compass, Map as MapIcon, Layers, Activity, Users, BrainCircuit, ListChecks } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { useAppSettings } from '@/hooks/useAppSettings';
import { useUserProfile } from '@/hooks/useUserProfile';

const CURRENT_YEAR = new Date().getFullYear();

interface RealisasiData {
    tipe: string;
    inputs: string[];
    rata_rata: number;
}

interface StrategicObjItem {
    id: string;
    title: string;
    perspective: 'financial' | 'customer' | 'internal' | 'learning';
    source: 'tows' | 'cascading';
    unit: string;
}

const deserializeRealisasi = (val: string | null | undefined): RealisasiData & { rawText: string } => {
    const def = { tipe: 'tahunan', inputs: [''], rata_rata: 0, rawText: val || '' };
    if (!val) return def;
    try {
        const p = JSON.parse(val);
        if (p && typeof p === 'object' && p.tipe) {
            return { tipe: p.tipe, inputs: p.inputs || [''], rata_rata: p.rata_rata || 0, rawText: String(p.rata_rata || '') };
        }
    } catch {
        const num = parseFloat(val);
        return { tipe: 'tahunan', inputs: [val], rata_rata: isNaN(num) ? 0 : num, rawText: val };
    }
    return def;
};

const getDisplayRealisasi = (val: string | null | undefined): string => {
    const d = deserializeRealisasi(val);
    if (d.rata_rata) return String(d.rata_rata);
    return d.rawText || '-';
};

const getNumericRealisasi = (val: string | null | undefined): number => {
    const d = deserializeRealisasi(val);
    if (d.rata_rata) return d.rata_rata;
    const num = parseFloat(d.rawText);
    return isNaN(num) ? 0 : num;
};

function AchievementBadge({ target, realisasi }: { target: string; realisasi: string }) {
    const t = parseFloat(target);
    const r = getNumericRealisasi(realisasi);
    const displayVal = getDisplayRealisasi(realisasi);

    if (isNaN(t) || t === 0 || displayVal === '-') {
        return <span className="text-xs text-slate-400 font-medium">N/A</span>;
    }

    const pct = (r / t) * 100;
    const colorClass = pct >= 100
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : pct >= 70
            ? 'bg-amber-50 text-amber-700 border-amber-200'
            : 'bg-rose-50 text-rose-700 border-rose-200';
    const statusText = pct >= 100 ? 'Tercapai' : pct >= 70 ? 'Waspada' : 'Belum';

    return (
        <div className="flex items-center gap-2">
            <div className="flex-1 bg-slate-100 rounded-full h-2 min-w-[60px] overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-emerald-500' : pct >= 70 ? 'bg-amber-500' : 'bg-rose-500'}`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                />
            </div>
            <span className="text-xs font-bold text-slate-700 shrink-0">{pct.toFixed(0)}%</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${colorClass} shrink-0`}>
                {statusText}
            </span>
        </div>
    );
}

export default function LaporanStrategiPage() {
    const { profile, isManager, validUnitIds, isMatchUnit } = useUserProfile();
    const { settings } = useAppSettings();

    const [data, setData] = useState<ManajemenStrategi[]>([]);
    const [swotData, setSwotData] = useState<any[]>([]);
    const [renstraData, setRenstraData] = useState<any[]>([]);
    const [rktData, setRktData] = useState<any[]>([]);
    const [iktData, setIktData] = useState<any[]>([]);
    const [cascadingData, setCascadingData] = useState<any[]>([]);
    const [towsData, setTowsData] = useState<any[]>([]);
    const [visiData, setVisiData] = useState<{ visi: string; misi_items: string[] }>({ visi: '', misi_items: [] });
    const [units, setUnits] = useState<{ id: string; nama_unit: string }[]>([]);
    const [unitFilter, setUnitFilter] = useState('');
    const [year, setYear] = useState(String(CURRENT_YEAR));
    const [loading, setLoading] = useState(true);
    const [showReportDropdown, setShowReportDropdown] = useState(false);
    const [activeTab, setActiveTab] = useState<'renstra' | 'kpi' | 'swot_kartesius' | 'strategic_map'>('renstra');

    useEffect(() => {
        if ((profile?.role === 'user_unit' || isManager) && profile?.unit_kerja_id) {
            setUnitFilter(profile.unit_kerja_id);
        }
    }, [profile, isManager]);

    useEffect(() => {
        supabase.from('unit_kerja').select('id, nama_unit').order('nama_unit').then(({ data: u, error }) => {
            if (!error && u) {
                setUnits(u);
            }
        });
    }, []);

    useEffect(() => {
        setLoading(true);
        const fetchData = async () => {
            try {
                // Fetch manajemen_strategi (Monitoring KPI)
                let q = supabase.from('manajemen_strategi').select('*, unit_kerja(id, nama_unit)').order('unit_kerja_id');
                if (year) q = q.eq('tahun', Number(year));
                const { data: rows, error } = await q;
                setData(!error && rows ? (rows as ManajemenStrategi[]) : []);

                // Fetch SWOT inventarisasi
                let sq = supabase.from('swot_inventarisasi').select('*, unit_kerja(id, nama_unit)').order('unit_kerja_id');
                if (year) sq = sq.eq('tahun', Number(year));
                const { data: sRows } = await sq;
                setSwotData(sRows ?? []);

                // Fetch Renstra RS (Linked to Misi RS)
                const { data: renRows } = await supabase.from('rencana_strategis').select('*, misi_items(id, nomor, isi_misi)').order('created_at', { ascending: false });
                setRenstraData(renRows ?? []);

                // Fetch RKT
                let rktQ = supabase.from('rkt').select('*, unit_kerja(id, nama_unit), rencana_strategis(nama_rencana)').order('unit_kerja_id');
                if (year) rktQ = rktQ.eq('tahun', Number(year));
                const { data: rktRows } = await rktQ;
                setRktData(rktRows ?? []);

                // Fetch IKT (Indikator Kinerja Utama)
                let iktQ = supabase.from('indikator_kinerja_utama').select('*, unit_kerja(id, nama_unit)').order('unit_kerja_id');
                const { data: iktRows } = await iktQ;
                setIktData(iktRows ?? []);

                // Fetch Cascading KPI
                let cascQ = supabase.from('cascading_kpi').select('*, unit_kerja(id, nama_unit)').order('unit_kerja_id');
                if (year) cascQ = cascQ.eq('tahun', Number(year));
                const { data: cascRows } = await cascQ;
                setCascadingData(cascRows ?? []);

                // Fetch TOWS
                let towsQ = supabase.from('swot_tows_strategi').select('*, unit_kerja(id, nama_unit)').order('unit_kerja_id');
                if (year) towsQ = towsQ.eq('tahun', Number(year));
                const { data: towsRows } = await towsQ;
                setTowsData(towsRows ?? []);

                // Fetch Visi & Misi
                const { data: vmRows } = await supabase.from('visi_misi').select('*').eq('tahun', Number(year)).order('created_at', { ascending: false }).limit(1);
                const vmRow = vmRows && vmRows.length > 0 ? vmRows[0] : null;
                if (vmRow) {
                    const { data: mRows } = await supabase.from('misi_items').select('*').eq('visi_misi_id', vmRow.id).order('nomor');
                    setVisiData({
                        visi: vmRow.visi || '',
                        misi_items: (mRows ?? []).map((m: any) => m.isi_misi || m.deskripsi || '')
                    });
                } else {
                    setVisiData({ visi: '', misi_items: [] });
                }

            } catch (err) {
                console.error('Error fetching laporan strategi:', err);
                setData([]); setSwotData([]); setRenstraData([]); setRktData([]); setIktData([]); setCascadingData([]); setTowsData([]); setVisiData({ visi: '', misi_items: [] });
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [year]);

    const checkMatch = (uId?: string, uObj?: any) => {
        if (isManager) return isMatchUnit(uId, uObj);
        if (!unitFilter) return true;
        return uId === unitFilter || uObj?.id === unitFilter;
    };

    const filteredData = data.filter(d => checkMatch(d.unit_kerja_id, d.unit_kerja));
    const filteredSwot = swotData.filter(s => checkMatch(s.unit_kerja_id, s.unit_kerja));
    const filteredRenstra = renstraData; // Renstra RS applies globally across RS
    const filteredRkt = rktData.filter(r => checkMatch(r.unit_kerja_id, r.unit_kerja));
    const filteredIkt = iktData.filter(r => checkMatch(r.unit_kerja_id, r.unit_kerja));
    const filteredCascading = cascadingData.filter(c => checkMatch(c.unit_kerja_id, c.unit_kerja));
    const filteredTows = towsData.filter(t => checkMatch(t.unit_kerja_id, t.unit_kerja));

    // Compute Diagram Kartesius SWOT per unit
    const kartesiusUnits = Object.entries(
        filteredSwot.reduce<Record<string, { name: string; swots: any[] }>>((acc, s) => {
            const uId = s.unit_kerja_id || (s.unit_kerja as any)?.id || 'unknown';
            const uName = (s.unit_kerja as any)?.nama_unit || 'Lainnya';
            if (!acc[uId]) acc[uId] = { name: uName, swots: [] };
            acc[uId].swots.push(s);
            return acc;
        }, {})
    );

    const kartesiusRows = kartesiusUnits.map(([uId, item], idx) => {
        const sumSkor = (kat: string) => item.swots
            .filter((s: any) => s.kategori === kat)
            .reduce((sum: number, curr: any) => sum + (Number(curr.skor) || ((Number(curr.bobot) || 0) * (Number(curr.ranking) || 1))), 0);

        const totalK = sumSkor('Kekuatan');
        const totalW = sumSkor('Kelemahan');
        const totalP = sumSkor('Peluang');
        const totalT = sumSkor('Tantangan');

        const x = Number((totalK - totalW).toFixed(2));
        const y = Number((totalP - totalT).toFixed(2));

        let kuadran = "Kuadran I";
        let rekom = "Agresif / Pertumbuhan";
        if (x >= 0 && y >= 0) { kuadran = "Kuadran I"; rekom = "Agresif / Pertumbuhan"; }
        else if (x < 0 && y >= 0) { kuadran = "Kuadran II"; rekom = "Diversifikasi"; }
        else if (x < 0 && y < 0) { kuadran = "Kuadran III"; rekom = "Defensif / Bertahan"; }
        else { kuadran = "Kuadran IV"; rekom = "Turnaround / Pembenahan"; }

        return {
            no: idx + 1,
            unit: item.name,
            totalK, totalW, x,
            totalP, totalT, y,
            kuadran, rekom
        };
    });

    const mapPerspective = (p: string | null | undefined): 'financial' | 'customer' | 'internal' | 'learning' => {
        if (!p) return 'financial';
        const val = p.toLowerCase().trim();
        if (val.includes('pelanggan') || val === 'customer') return 'customer';
        if (val.includes('proses') || val === 'internal') return 'internal';
        if (val.includes('pembelajaran') || val.includes('pertumbuhan') || val === 'learning') return 'learning';
        return 'financial';
    };

    const strategicObjectives = React.useMemo<StrategicObjItem[]>(() => {
        const uniqueMap = new Map<string, any>();
        filteredTows.forEach(t => {
            if (t.sasaran_strategi && t.implementasi) {
                const p = mapPerspective(t.implementasi);
                const k = `${p}-${t.sasaran_strategi}`;
                if (!uniqueMap.has(k)) {
                    uniqueMap.set(k, {
                        id: `T-${uniqueMap.size + 1}`,
                        title: t.sasaran_strategi,
                        perspective: p,
                        source: 'tows',
                        unit: (t.unit_kerja as any)?.nama_unit || 'Lainnya'
                    });
                }
            }
        });
        filteredCascading.forEach(c => {
            if (c.sasaran_strategis && c.perspektif) {
                const p = mapPerspective(c.perspektif);
                const k = `${p}-${c.sasaran_strategis}`;
                if (!uniqueMap.has(k)) {
                    uniqueMap.set(k, {
                        id: `C-${uniqueMap.size + 1}`,
                        title: c.sasaran_strategis,
                        perspective: p,
                        source: 'cascading',
                        unit: (c.unit_kerja as any)?.nama_unit || 'Lainnya'
                    });
                }
            }
        });
        return Array.from(uniqueMap.values());
    }, [filteredTows, filteredCascading]);

    const achieved = filteredData.filter(d => {
        const t = parseFloat(d.target);
        const r = getNumericRealisasi(d.realisasi);
        return !isNaN(t) && !isNaN(r) && t > 0 && r >= t;
    }).length;

    const avgAchievement = filteredData.length ? (filteredData.reduce((s, d) => {
        const t = parseFloat(d.target);
        const r = getNumericRealisasi(d.realisasi);
        return s + (isNaN(t) || isNaN(r) || t === 0 ? 0 : (r / t) * 100);
    }, 0) / filteredData.length) : 0;

    const byUnit = Object.entries(
        filteredData.reduce<Record<string, ManajemenStrategi[]>>((acc, d) => {
            const unit = (d.unit_kerja as { nama_unit: string })?.nama_unit ?? 'Lainnya';
            if (!acc[unit]) acc[unit] = [];
            acc[unit].push(d);
            return acc;
        }, {})
    );

    const handleExportExcel = () => {
        const selectedUnitObj = units.find(u => u.id === unitFilter);
        const unitLabel = selectedUnitObj ? selectedUnitObj.nama_unit : 'Semua Unit Kerja';

        let globalIndex = 1;
        const iktRows = filteredData.map(d => {
            const t = parseFloat(d.target);
            const r = getNumericRealisasi(d.realisasi);
            const pct = !isNaN(t) && t > 0 ? ((r / t) * 100).toFixed(1) + '%' : '0%';
            const status = !isNaN(t) && t > 0 && r >= t ? 'Tercapai' : (r / t >= 0.7 ? 'Waspada' : 'Belum Tercapai');
            const des = deserializeRealisasi(d.realisasi);

            return {
                'No': globalIndex++,
                'Tahun': d.tahun,
                'Unit Kerja': (d.unit_kerja as any)?.nama_unit || 'Lainnya',
                'Sasaran Strategis': d.sasaran_strategis,
                'KPI / Indikator': d.kpi,
                'Periode Realisasi': des.tipe.toUpperCase(),
                'Target': d.target,
                'Realisasi': getDisplayRealisasi(d.realisasi),
                'Capaian (%)': pct,
                'Status Capaian': status
            };
        });

        let swotIndex = 1;
        const swotRows = filteredSwot.map(s => ({
            'No': swotIndex++,
            'Tahun': s.tahun,
            'Unit Kerja': (s.unit_kerja as any)?.nama_unit || 'Lainnya',
            'Kategori': s.kategori,
            'Deskripsi Faktor': s.deskripsi,
            'Bobot': s.bobot || 0,
            'Ranking': s.ranking || 1,
            'Skor Total': ((s.bobot || 0) * (s.ranking || 1)).toFixed(2)
        }));

        let renIdx = 1;
        const renstraRows = filteredRenstra.map(r => ({
            'No': renIdx++,
            'Unit Kerja': (r.unit_kerja as any)?.nama_unit || 'Rumah Sakit (RS)',
            'Nama Rencana Strategis': r.nama_rencana || '-',
            'Deskripsi': r.deskripsi || '-',
            'Periode Mulai': r.periode_mulai || '-',
            'Periode Selesai': r.periode_selesai || '-',
            'Status': r.status || '-',
        }));

        let rktIdx = 1;
        const rktRows = filteredRkt.map(r => ({
            'No': rktIdx++,
            'Tahun': r.tahun,
            'Unit Kerja': (r.unit_kerja as any)?.nama_unit || 'Lainnya',
            'Program': r.program || '-',
            'Kegiatan': r.kegiatan || '-',
            'Anggaran': r.anggaran || '-',
            'Sumber Dana': r.sumber_dana || '-',
            'PIC': r.pic || '-',
        }));

        let cascIdx = 1;
        const cascRows = filteredCascading.map(c => ({
            'No': cascIdx++,
            'Unit Kerja': (c.unit_kerja as any)?.nama_unit || 'Lainnya',
            'Sasaran Strategis': c.sasaran_strategis || '-',
            'Perspektif': c.perspektif || '-',
            'KPI': c.kpi || '-',
            'Target': c.target || '-',
            'Bobot (%)': c.bobot || '-',
        }));

        let towsIdx = 1;
        const towsRows = filteredTows.map(t => ({
            'No': towsIdx++,
            'Tahun': t.tahun,
            'Unit Kerja': (t.unit_kerja as any)?.nama_unit || 'Lainnya',
            'Tipe Strategi': t.tipe_strategi || '-',
            'Alternatif Strategi': t.strategi || '-',
            'Sasaran Strategi': t.sasaran_strategi || '-',
            'Perspektif BSC': t.implementasi || '-',
            'Penanggung Jawab (PIC)': t.penanggungjawab || '-'
        }));

        let kartIdx = 1;
        const kartesiusExcelRows = kartesiusRows.map(k => ({
            'No': kartIdx++,
            'Unit Kerja': k.unit,
            'Total Kekuatan (S)': k.totalK,
            'Total Kelemahan (W)': k.totalW,
            'Skor Internal (X)': k.x,
            'Total Peluang (O)': k.totalP,
            'Total Tantangan (T)': k.totalT,
            'Skor Eksternal (Y)': k.y,
            'Posisi Kuadran': k.kuadran,
            'Rekomendasi Strategi': k.rekom
        }));

        const visiRows = [
            { 'Kategori': 'Pernyataan Visi', 'Detail': visiData.visi || 'Belum diatur' },
            ...visiData.misi_items.map((m, i) => ({ 'Kategori': `Misi ${i + 1}`, 'Detail': m }))
        ];

        const summaryRows = [
            { 'Metrik Evaluasi': 'Tahun Anggaran', 'Nilai / Keterangan': year },
            { 'Metrik Evaluasi': 'Unit Kerja Filter', 'Nilai / Keterangan': unitLabel },
            { 'Metrik Evaluasi': 'Visi Organisasi', 'Nilai / Keterangan': visiData.visi ? 'Terisi' : 'Default' },
            { 'Metrik Evaluasi': 'Jumlah Pernyataan Misi', 'Nilai / Keterangan': visiData.misi_items.length },
            { 'Metrik Evaluasi': 'Data Renstra (Sasaran Strategis)', 'Nilai / Keterangan': filteredRenstra.length },
            { 'Metrik Evaluasi': 'Data RKT (Program & Kegiatan)', 'Nilai / Keterangan': filteredRkt.length },
            { 'Metrik Evaluasi': 'Data Indikator Kinerja Utama (IKT)', 'Nilai / Keterangan': filteredIkt.length },
            { 'Metrik Evaluasi': 'Total Monitoring KPI', 'Nilai / Keterangan': filteredData.length },
            { 'Metrik Evaluasi': 'KPI Tercapai (>=100%)', 'Nilai / Keterangan': achieved },
            { 'Metrik Evaluasi': 'KPI Belum Tercapai', 'Nilai / Keterangan': filteredData.length - achieved },
            { 'Metrik Evaluasi': 'Rata-rata Capaian (%)', 'Nilai / Keterangan': `${avgAchievement.toFixed(1)}%` },
            { 'Metrik Evaluasi': 'Total Cascading KPI', 'Nilai / Keterangan': filteredCascading.length },
            { 'Metrik Evaluasi': 'Total Inventarisasi SWOT', 'Nilai / Keterangan': filteredSwot.length },
            { 'Metrik Evaluasi': 'Total Unit Kartesius SWOT', 'Nilai / Keterangan': kartesiusRows.length },
            { 'Metrik Evaluasi': 'Total Alternatif Strategi TOWS', 'Nilai / Keterangan': filteredTows.length },
        ];

        const mapExcelRows = strategicObjectives.map((o, idx) => ({
            'No': idx + 1,
            'Unit Kerja': o.unit,
            'Perspektif BSC': o.perspective === 'financial' ? 'Keuangan' : o.perspective === 'customer' ? 'Pelanggan' : o.perspective === 'internal' ? 'Proses Bisnis' : 'Pembelajaran & Pertumbuhan',
            'Sasaran Strategis': o.title,
            'Sumber Rujukan': o.source === 'tows' ? 'TOWS Matrix' : 'Cascading KPI'
        }));

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Ringkasan Eksekutif');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(visiRows), 'Visi & Misi');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(renstraRows.length > 0 ? renstraRows : [{ 'Keterangan': 'Tidak ada data' }]), 'Renstra');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rktRows.length > 0 ? rktRows : [{ 'Keterangan': 'Tidak ada data' }]), 'RKT');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(iktRows.length > 0 ? iktRows : [{ 'Keterangan': 'Tidak ada data' }]), 'Monitoring & Evaluasi KPI');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cascRows.length > 0 ? cascRows : [{ 'Keterangan': 'Tidak ada data' }]), 'Cascading KPI');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(swotRows.length > 0 ? swotRows : [{ 'Keterangan': 'Tidak ada data' }]), 'Analisis SWOT');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(kartesiusExcelRows.length > 0 ? kartesiusExcelRows : [{ 'Keterangan': 'Tidak ada data' }]), 'Kartesius SWOT');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(towsRows.length > 0 ? towsRows : [{ 'Keterangan': 'Tidak ada data' }]), 'Matriks TOWS');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mapExcelRows.length > 0 ? mapExcelRows : [{ 'Keterangan': 'Tidak ada data' }]), 'Strategic Map');

        const cleanUnit = unitLabel.replace(/[^a-zA-Z0-9]/g, '_');
        XLSX.writeFile(wb, `Laporan_Manajemen_Strategis_${year}_${cleanUnit}.xlsx`);
    };

    const handleExportPDF = () => {
        const doc = new jsPDF('p', 'pt', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        const selectedUnitObj = units.find(u => u.id === unitFilter);
        const unitLabel = selectedUnitObj ? selectedUnitObj.nama_unit : 'Semua Unit Kerja';

        const hexToRgb = (hex: string): [number, number, number] => {
            const def: [number, number, number] = [19, 127, 236];
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

        // --- PAGE 1: COVER PAGE ---
        doc.setFillColor(rgbColor[0], rgbColor[1], rgbColor[2]);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');
        doc.setTextColor(255, 255, 255);

        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('LAPORAN MANAJEMEN STRATEGIS TERPADU', pageWidth / 2, pageHeight / 2 - 60, { align: 'center' });

        doc.setFontSize(14);
        doc.setFont('helvetica', 'normal');
        doc.text('Rekapitulasi Renstra, RKT, IKT, Evaluasi & Analisis SWOT', pageWidth / 2, pageHeight / 2 - 30, { align: 'center' });

        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text(`Tahun Anggaran: ${year} | Unit: ${unitLabel}`, pageWidth / 2, pageHeight / 2 + 10, { align: 'center' });

        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.text((settings?.nama_rs || 'RUMAH SAKIT').toUpperCase(), pageWidth / 2, pageHeight / 2 + 60, { align: 'center' });

        // --- PAGE 2: TABLE OF CONTENTS (TOC) ---
        doc.addPage();
        let tocPageNum = doc.getCurrentPageInfo().pageNumber;

        // --- PAGE 3: EXECUTIVE SUMMARY & PROFILE ---
        doc.addPage();
        let pSummary = doc.getCurrentPageInfo().pageNumber;
        drawKopSurat(doc);

        doc.setTextColor(30, 41, 59);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('A. Ringkasan Eksekutif & Profil Strategis RS', 40, 140);

        // Visi Misi Box
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(40, 155, pageWidth - 80, 85, 6, 6, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(40, 155, pageWidth - 80, 85, 6, 6, 'S');

        doc.setTextColor(30, 41, 59); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
        doc.text('Visi Rumah Sakit:', 52, 172);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(51, 65, 85);
        doc.text((settings as any)?.visi || 'Menjadi Rumah Sakit Pilihan Utama dengan Layanan Berkualitas dan Terpercaya.', 52, 186);

        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(30, 41, 59);
        doc.text('Misi Rumah Sakit:', 52, 204);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(51, 65, 85);
        const misiTxt = (settings as any)?.misi || 'Memberikan pelayanan kesehatan secara profesional, bermutu, dan mengutamakan keselamatan pasien.';
        const wrappedMisi = doc.splitTextToSize(misiTxt, pageWidth - 104);
        doc.text(wrappedMisi, 52, 218);

        // Metric Scorecards
        const metrics = [
            { label: 'Total Indikator (KPI)', val: filteredData.length, color: [239, 246, 255] as [number, number, number], textCol: [30, 64, 175] as [number, number, number] },
            { label: 'KPI Tercapai (>=100%)', val: achieved, color: [236, 253, 245] as [number, number, number], textCol: [6, 95, 70] as [number, number, number] },
            { label: 'KPI Belum Tercapai', val: filteredData.length - achieved, color: [255, 251, 235] as [number, number, number], textCol: [146, 64, 14] as [number, number, number] },
            { label: 'Rata-rata Capaian', val: `${avgAchievement.toFixed(1)}%`, color: [245, 243, 255] as [number, number, number], textCol: [91, 33, 182] as [number, number, number] },
        ];

        const boxW = (pageWidth - 80 - 30) / 4;
        const boxY = 255;
        metrics.forEach((m, idx) => {
            const bx = 40 + idx * (boxW + 10);
            doc.setFillColor(m.color[0], m.color[1], m.color[2]);
            doc.roundedRect(bx, boxY, boxW, 45, 6, 6, 'F');
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(bx, boxY, boxW, 45, 6, 6, 'S');

            doc.setFontSize(7.5); doc.setFont('helvetica', 'bold');
            doc.setTextColor(m.textCol[0], m.textCol[1], m.textCol[2]);
            doc.text(m.label, bx + boxW / 2, boxY + 16, { align: 'center' });

            doc.setFontSize(13); doc.setFont('helvetica', 'bold');
            doc.text(String(m.val), bx + boxW / 2, boxY + 36, { align: 'center' });
        });

        // --- SECTION B: RENSTRA & RKT ---
        doc.addPage();
        let pRenstraRkt = doc.getCurrentPageInfo().pageNumber;
        addHeader(doc, 'Renstra & RKT');

        doc.setTextColor(30, 41, 59);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('B. Rencana Strategis (Renstra) & Rencana Kerja Tahunan (RKT)', 40, 75);

        let renY = 95;
        doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 41, 59);
        doc.text('1. Matrix Rencana Strategis (Renstra 5 Tahunan)', 40, renY);

        let renIdx = 1;
        const renstraTableData = filteredRenstra.map(r => [
            renIdx++,
            (r.unit_kerja as any)?.nama_unit || 'Rumah Sakit (RS)',
            r.nama_rencana || '-',
            r.deskripsi || '-',
            `${r.periode_mulai || '-'} - ${r.periode_selesai || '-'}`,
            r.status || '-'
        ]);

        if (renstraTableData.length === 0) {
            renstraTableData.push(['-', '-', 'Belum ada data Rencana Strategis', '-', '-', '-']);
        }

        autoTable(doc, {
            startY: renY + 8,
            head: [['No', 'Unit Kerja', 'Nama Rencana Strategis', 'Deskripsi Uraian', 'Periode', 'Status']],
            body: renstraTableData,
            theme: 'grid',
            headStyles: { fillColor: rgbColor, fontSize: 8, fontStyle: 'bold' },
            styles: { fontSize: 7.5, cellPadding: 4 },
            columnStyles: {
                0: { cellWidth: 25, halign: 'center' },
                1: { cellWidth: 90 },
                2: { cellWidth: 140 },
                3: { cellWidth: 160 },
                4: { cellWidth: 60, halign: 'center' },
                5: { cellWidth: 40, halign: 'center' }
            },
            margin: { left: 40, right: 40 },
            didDrawPage: () => { addHeader(doc, 'Renstra & RKT'); }
        });

        renY = (doc as any).lastAutoTable.finalY + 20;

        if (renY > pageHeight - 120) {
            doc.addPage();
            renY = 70;
        }

        doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 41, 59);
        doc.text('2. Rencana Kerja Tahunan (RKT)', 40, renY);

        let rktIdx = 1;
        const rktTableData = filteredRkt.map(r => [
            rktIdx++,
            (r.unit_kerja as any)?.nama_unit || 'Lainnya',
            r.program || '-',
            r.kegiatan || '-',
            r.anggaran || '-',
            r.sumber_dana || '-',
            r.pic || '-'
        ]);

        if (rktTableData.length === 0) {
            rktTableData.push(['-', '-', 'Belum ada data RKT', '-', '-', '-', '-']);
        }

        autoTable(doc, {
            startY: renY + 8,
            head: [['No', 'Unit Kerja', 'Program Utama', 'Kegiatan Operational', 'Anggaran', 'Sumber Dana', 'PIC']],
            body: rktTableData,
            theme: 'grid',
            headStyles: { fillColor: rgbColor, fontSize: 8, fontStyle: 'bold' },
            styles: { fontSize: 7.5, cellPadding: 4 },
            columnStyles: {
                0: { cellWidth: 25, halign: 'center' },
                1: { cellWidth: 80 },
                2: { cellWidth: 120 },
                3: { cellWidth: 130 },
                4: { cellWidth: 60 },
                5: { cellWidth: 50, halign: 'center' },
                6: { cellWidth: 50 }
            },
            margin: { left: 40, right: 40 },
            didDrawPage: () => { addHeader(doc, 'Renstra & RKT'); }
        });

        // --- SECTION C: CAPAIAN IKT & EVALUASI PER UNIT ---
        doc.addPage();
        let pIKT = doc.getCurrentPageInfo().pageNumber;
        addHeader(doc, 'Laporan Realisasi Strategi');

        doc.setTextColor(30, 41, 59);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('C. Detail Capaian IKT & Monitoring Evaluasi KPI', 40, 75);

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
            const tableData = items.map(item => {
                const des = deserializeRealisasi(item.realisasi);
                const t = parseFloat(item.target);
                const r = getNumericRealisasi(item.realisasi);
                const pct = !isNaN(t) && t > 0 ? ((r / t) * 100).toFixed(0) + '%' : '0%';
                const status = !isNaN(t) && t > 0 && r >= t ? 'Tercapai' : (r / t >= 0.7 ? 'Waspada' : 'Belum');

                return [
                    rowIdx++,
                    item.sasaran_strategis,
                    item.kpi,
                    des.tipe.toUpperCase(),
                    item.target,
                    getDisplayRealisasi(item.realisasi),
                    pct,
                    status
                ];
            });

            autoTable(doc, {
                startY: finalY + 22,
                head: [['No', 'Sasaran Strategis', 'KPI / Indikator', 'Periode', 'Target', 'Realisasi', 'Capaian', 'Status']],
                body: tableData,
                theme: 'grid',
                headStyles: { fillColor: rgbColor, fontSize: 8, fontStyle: 'bold' },
                styles: { fontSize: 8, cellPadding: 4 },
                columnStyles: {
                    0: { cellWidth: 25, halign: 'center' },
                    1: { cellWidth: 140 },
                    2: { cellWidth: 120 },
                    3: { cellWidth: 50, halign: 'center' },
                    4: { cellWidth: 45, halign: 'center' },
                    5: { cellWidth: 50, halign: 'center' },
                    6: { cellWidth: 45, halign: 'center' },
                    7: { cellWidth: 50, halign: 'center' },
                },
                margin: { left: 40, right: 40 },
                didDrawPage: () => {
                    addHeader(doc, 'Laporan Realisasi Strategi');
                }
            });
            finalY = (doc as any).lastAutoTable.finalY + 20;
        });

        // --- SECTION D: CASCADING KPI ---
        doc.addPage();
        let pCascade = doc.getCurrentPageInfo().pageNumber;
        addHeader(doc, 'Cascading KPI');

        doc.setTextColor(30, 41, 59);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('D. Rekapitulasi Cascading KPI & Penjabaran Sasaran Strategis', 40, 75);

        {
            let cIdx = 1;
            const cascTableData = filteredCascading.map(c => [
                cIdx++,
                (c.unit_kerja as any)?.nama_unit || 'Lainnya',
                c.sasaran_strategis || '-',
                c.perspektif || '-',
                c.kpi || '-',
                c.target || '-',
                c.bobot ? `${c.bobot}%` : '-'
            ]);

            if (cascTableData.length === 0) {
                cascTableData.push(['-', '-', 'Belum ada data cascading KPI', '-', '-', '-', '-']);
            }

            autoTable(doc, {
                startY: 95,
                head: [['No', 'Unit Kerja', 'Sasaran Strategis', 'Perspektif', 'KPI', 'Target', 'Bobot']],
                body: cascTableData,
                theme: 'grid',
                headStyles: { fillColor: rgbColor, fontSize: 8, fontStyle: 'bold' },
                styles: { fontSize: 7.5, cellPadding: 4 },
                columnStyles: {
                    0: { cellWidth: 25, halign: 'center' },
                    1: { cellWidth: 80 },
                    2: { cellWidth: 130 },
                    3: { cellWidth: 65, halign: 'center' },
                    4: { cellWidth: 110 },
                    5: { cellWidth: 50, halign: 'center' },
                    6: { cellWidth: 45, halign: 'center' },
                },
                margin: { left: 40, right: 40 },
                didDrawPage: () => { addHeader(doc, 'Cascading KPI'); }
            });
        }

        // --- SECTION E: ANALISIS SWOT ---
        doc.addPage();
        let pSWOT = doc.getCurrentPageInfo().pageNumber;
        addHeader(doc, 'Analisis SWOT Strategis');

        doc.setTextColor(30, 41, 59);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('E. Inventarisasi & Evaluasi Faktor SWOT', 40, 75);

        let swotY = 95;
        const categories = [
            { key: 'Kekuatan', label: '1. FAKTOR KEKUATAN (STRENGTHS)' },
            { key: 'Kelemahan', label: '2. FAKTOR KELEMAHAN (WEAKNESSES)' },
            { key: 'Peluang', label: '3. FAKTOR PELUANG (OPPORTUNITIES)' },
            { key: 'Tantangan', label: '4. FAKTOR ANCAMAN / TANTANGAN (THREATS)' },
        ];

        categories.forEach(cat => {
            if (swotY > pageHeight - 120) {
                doc.addPage();
                swotY = 70;
            }

            doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 41, 59);
            doc.text(cat.label, 40, swotY + 15);

            const items = filteredSwot.filter(s => s.kategori === cat.key);
            let rIdx = 1;
            const sTableData = items.map(s => [
                rIdx++,
                (s.unit_kerja as any)?.nama_unit || 'Lainnya',
                s.deskripsi || '-',
                (s.bobot || 0).toFixed(1),
                (s.ranking || 1).toFixed(1),
                ((s.bobot || 0) * (s.ranking || 1)).toFixed(1)
            ]);

            if (sTableData.length === 0) {
                sTableData.push(['-', '-', 'Belum ada data faktor inventarisasi', '-', '-', '-']);
            }

            autoTable(doc, {
                startY: swotY + 22,
                head: [['No', 'Unit Kerja', 'Deskripsi Uraian Faktor', 'Bobot', 'Ranking', 'Skor']],
                body: sTableData,
                theme: 'grid',
                headStyles: { fillColor: rgbColor, fontSize: 8, fontStyle: 'bold' },
                styles: { fontSize: 8, cellPadding: 4 },
                columnStyles: {
                    0: { cellWidth: 25, halign: 'center' },
                    1: { cellWidth: 100 },
                    2: { cellWidth: 240 },
                    3: { cellWidth: 50, halign: 'center' },
                    4: { cellWidth: 50, halign: 'center' },
                    5: { cellWidth: 50, halign: 'center' }
                },
                margin: { left: 40, right: 40 },
                didDrawPage: () => {
                    addHeader(doc, 'Analisis SWOT Strategis');
                }
            });
            swotY = (doc as any).lastAutoTable.finalY + 20;
        });

        // --- SECTION F: KARTESIUS SWOT ---
        doc.addPage();
        let pKartesius = doc.getCurrentPageInfo().pageNumber;
        addHeader(doc, 'Kartesius SWOT');

        doc.setTextColor(30, 41, 59);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('F. Tabulasi & Pemetaan Diagram Kartesius SWOT', 40, 75);

        // Draw Visual Diagram Kartesius Box
        const chartX = 140;
        const chartY = 90;
        const chartW = 315;
        const chartH = 170;
        const centerX = chartX + chartW / 2;
        const centerY = chartY + chartH / 2;

        // Background
        doc.setFillColor(248, 250, 252);
        doc.rect(chartX, chartY, chartW, chartH, 'F');
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(1);
        doc.rect(chartX, chartY, chartW, chartH, 'S');

        // Axes
        doc.setDrawColor(71, 85, 105);
        doc.setLineWidth(1.5);
        doc.line(chartX, centerY, chartX + chartW, centerY); // X axis
        doc.line(centerX, chartY, centerX, chartY + chartH); // Y axis

        // Labels for Quadrants
        doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(148, 163, 184);
        doc.text('KUADRAN I (Agresif)', chartX + chartW - 10, chartY + 14, { align: 'right' });
        doc.text('KUADRAN II (Diversifikasi)', chartX + 10, chartY + 14, { align: 'left' });
        doc.text('KUADRAN III (Defensif)', chartX + 10, chartY + chartH - 10, { align: 'left' });
        doc.text('KUADRAN IV (Turnaround)', chartX + chartW - 10, chartY + chartH - 10, { align: 'right' });

        // Axis Labels
        doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139);
        doc.text('Faktor Internal (+X Kekuatan / -X Kelemahan)', centerX, chartY + chartH + 12, { align: 'center' });

        // Plot unit points
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

        const kartTableData = kartesiusRows.map(k => [
            k.no,
            k.unit,
            k.x.toFixed(2),
            k.y.toFixed(2),
            k.kuadran,
            k.rekom
        ]);

        if (kartTableData.length === 0) {
            kartTableData.push(['-', 'Belum ada data evaluasi kartesius', '-', '-', '-', '-']);
        }

        autoTable(doc, {
            startY: chartY + chartH + 25,
            head: [['No', 'Unit Kerja', 'Skor Internal (X)', 'Skor Eksternal (Y)', 'Posisi Kuadran', 'Rekomendasi Strategi']],
            body: kartTableData,
            theme: 'grid',
            headStyles: { fillColor: rgbColor, fontSize: 8, fontStyle: 'bold' },
            styles: { fontSize: 8, cellPadding: 5 },
            columnStyles: {
                0: { cellWidth: 30, halign: 'center' },
                1: { cellWidth: 140 },
                2: { cellWidth: 80, halign: 'center' },
                3: { cellWidth: 80, halign: 'center' },
                4: { cellWidth: 75, halign: 'center' },
                5: { cellWidth: 110 }
            },
            margin: { left: 40, right: 40 },
            didDrawPage: () => { addHeader(doc, 'Kartesius SWOT'); }
        });

        // --- SECTION G: MATRIKS TOWS ---
        doc.addPage();
        let pTOWS = doc.getCurrentPageInfo().pageNumber;
        addHeader(doc, 'Matriks TOWS');

        doc.setTextColor(30, 41, 59);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('G. Rumusan Alternatif Strategi Matriks TOWS', 40, 75);

        let towsIdx = 1;
        const towsTableData = filteredTows.map(t => [
            towsIdx++,
            (t.unit_kerja as any)?.nama_unit || 'Lainnya',
            t.tipe_strategi || '-',
            t.strategi || '-',
            t.sasaran_strategi || '-',
            t.implementasi || '-',
            t.penanggungjawab || '-'
        ]);

        if (towsTableData.length === 0) {
            towsTableData.push(['-', '-', 'Belum ada alternatif strategi TOWS', '-', '-', '-', '-']);
        }

        autoTable(doc, {
            startY: 95,
            head: [['No', 'Unit Kerja', 'Kategori', 'Alternatif Strategi', 'Sasaran Strategi', 'Perspektif BSC', 'PIC']],
            body: towsTableData,
            theme: 'grid',
            headStyles: { fillColor: rgbColor, fontSize: 8, fontStyle: 'bold' },
            styles: { fontSize: 7.5, cellPadding: 4 },
            columnStyles: {
                0: { cellWidth: 25, halign: 'center' },
                1: { cellWidth: 75 },
                2: { cellWidth: 50, halign: 'center' },
                3: { cellWidth: 130 },
                4: { cellWidth: 115 },
                5: { cellWidth: 60, halign: 'center' },
                6: { cellWidth: 60 }
            },
            margin: { left: 40, right: 40 },
            didDrawPage: () => { addHeader(doc, 'Matriks TOWS'); }
        });

        // --- SECTION H: STRATEGIC MAP (PETA STRATEGI BSC) ---
        doc.addPage();
        let pMap = doc.getCurrentPageInfo().pageNumber;
        addHeader(doc, 'Peta Strategi (Strategic Map)');

        doc.setTextColor(30, 41, 59);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('H. Peta Strategi (Strategic Map) 4 Perspektif BSC', 40, 75);

        const bscPerspectives = [
            { key: 'financial', label: '1. Perspektif Keuangan (Financial)' },
            { key: 'customer', label: '2. Perspektif Pelanggan (Customer)' },
            { key: 'internal', label: '3. Perspektif Proses Bisnis Internal' },
            { key: 'learning', label: '4. Perspektif Pembelajaran & Pertumbuhan' },
        ];

        let mapY = 95;
        bscPerspectives.forEach(p => {
            if (mapY > pageHeight - 120) {
                doc.addPage();
                mapY = 70;
            }
            doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 41, 59);
            doc.text(p.label, 40, mapY + 15);

            const items = strategicObjectives.filter(o => o.perspective === p.key);
            let sIdx = 1;
            const mapTableData = items.map(o => [
                sIdx++,
                o.unit,
                o.title,
                o.source === 'tows' ? 'TOWS Matrix' : 'Cascading KPI'
            ]);

            if (mapTableData.length === 0) {
                mapTableData.push(['-', '-', 'Belum ada sasaran strategis di perspektif ini', '-']);
            }

            autoTable(doc, {
                startY: mapY + 22,
                head: [['No', 'Unit Kerja', 'Sasaran Strategis', 'Sumber Rujukan']],
                body: mapTableData,
                theme: 'grid',
                headStyles: { fillColor: rgbColor, fontSize: 8, fontStyle: 'bold' },
                styles: { fontSize: 8, cellPadding: 4 },
                columnStyles: {
                    0: { cellWidth: 25, halign: 'center' },
                    1: { cellWidth: 110 },
                    2: { cellWidth: 280 },
                    3: { cellWidth: 100, halign: 'center' }
                },
                margin: { left: 40, right: 40 },
                didDrawPage: () => { addHeader(doc, 'Peta Strategi (Strategic Map)'); }
            });
            mapY = (doc as any).lastAutoTable.finalY + 20;
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
        doc.text('DAFTAR ISI LAPORAN STRATEGIS', 40, 95);

        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(1);
        doc.line(40, 107, pageWidth - 40, 107);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');

        const tocItems = [
            { label: 'A. Ringkasan Eksekutif & Profil Visi-Misi RS', page: pSummary },
            { label: 'B. Rencana Strategis (Renstra 5 Tahunan) & RKT', page: pRenstraRkt },
            { label: 'C. Detail Capaian IKT & Monitoring Evaluasi KPI', page: pIKT },
            { label: 'D. Rekapitulasi Cascading KPI & Sasaran Strategis', page: pCascade },
            { label: 'E. Inventarisasi & Evaluasi Faktor SWOT', page: pSWOT },
            { label: 'F. Tabulasi Posisi Diagram Kartesius SWOT', page: pKartesius },
            { label: 'G. Rumusan Alternatif Strategi Matriks TOWS', page: pTOWS },
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
        doc.save(`Laporan_Manajemen_Strategis_${year}_${cleanUnit}.pdf`);
    };

    return (
        <div>
            <PageHeader
                title="Laporan Realisasi Strategi"
                subtitle="Rekap capaian KPI dan realisasi sasaran strategis per unit kerja."
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
                                            className="w-full text-left px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-[#137fec] flex items-center gap-3 transition-colors"
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
                                                <Download size={16} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800">Laporan Terpadu (Excel)</p>
                                                <p className="text-[10px] text-slate-400 font-normal">Multi-sheet workbook (.xlsx)</p>
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
                <ScoreCard icon={<Target size={22} className="text-[#137fec]" />} title="Total KPI" value={filteredData.length} colorClass="bg-blue-50 border-blue-100" />
                <ScoreCard icon={<CheckCircle2 size={22} className="text-emerald-500" />} title="KPI Tercapai" value={achieved} colorClass="bg-emerald-50 border-emerald-100" />
                <ScoreCard icon={<BarChart2 size={22} className="text-amber-500" />} title="Belum Tercapai" value={filteredData.length - achieved} colorClass="bg-amber-50 border-amber-100" />
                <ScoreCard icon={<TrendingUp size={22} className="text-violet-500" />} title="Rata-rata Capaian" value={`${avgAchievement.toFixed(1)}%`} colorClass="bg-violet-50 border-violet-100" />
            </div>

            {/* Tab Navigation */}
            <div className="flex items-center gap-2 border-b border-slate-200 mb-6 overflow-x-auto pb-1">
                <button
                    onClick={() => setActiveTab('renstra')}
                    className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'renstra'
                        ? 'bg-[#137fec] text-white shadow-md shadow-blue-500/20'
                        : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                        }`}
                >
                    <BookOpen size={15} />
                    <span>Renstra RS &amp; RKT</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === 'renstra' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        {filteredRenstra.length}
                    </span>
                </button>

                <button
                    onClick={() => setActiveTab('kpi')}
                    className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'kpi'
                        ? 'bg-[#137fec] text-white shadow-md shadow-blue-500/20'
                        : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                        }`}
                >
                    <Target size={15} />
                    <span>Monitoring Realisasi KPI</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === 'kpi' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        {filteredData.length}
                    </span>
                </button>

                <button
                    onClick={() => setActiveTab('swot_kartesius')}
                    className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'swot_kartesius'
                        ? 'bg-[#137fec] text-white shadow-md shadow-blue-500/20'
                        : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                        }`}
                >
                    <Compass size={15} />
                    <span>Analisis SWOT &amp; Kartesius</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === 'swot_kartesius' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        {kartesiusRows.length}
                    </span>
                </button>

                <button
                    onClick={() => setActiveTab('strategic_map')}
                    className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'strategic_map'
                        ? 'bg-[#137fec] text-white shadow-md shadow-blue-500/20'
                        : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                        }`}
                >
                    <MapIcon size={15} />
                    <span>Strategic Map (BSC)</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === 'strategic_map' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        {strategicObjectives.length}
                    </span>
                </button>
            </div>

            {loading ? (
                <div className="card flex items-center justify-center py-16 text-slate-400">
                    <div className="animate-spin w-5 h-5 border-2 border-slate-200 border-t-[#137fec] rounded-full mr-2" />
                    <span className="text-sm">Memuat laporan...</span>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* TAB 1: RENSTRA RS & RKT */}
                    {activeTab === 'renstra' && (
                        <div className="space-y-6">
                            {/* Renstra RS Table */}
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 overflow-hidden">
                                <div className="flex items-center justify-between mb-5 border-b border-slate-100 pb-3">
                                    <div>
                                        <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                                            <BookOpen size={18} className="text-[#137fec]" />
                                            Rencana Strategis Rumah Sakit (Renstra 5 Tahunan)
                                        </h3>
                                        <p className="text-xs text-slate-400 mt-0.5">Program strategis utama yang selaras dengan Visi &amp; Misi RS</p>
                                    </div>
                                    <span className="text-xs font-bold text-[#137fec] bg-blue-50 px-3 py-1 rounded-lg border border-blue-100">
                                        {filteredRenstra.length} Program Renstra
                                    </span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/70 uppercase tracking-wider text-[10px]">
                                                <th className="py-2.5 px-3 text-center font-bold w-10">No</th>
                                                <th className="py-2.5 px-3 text-left font-bold w-24">Kode</th>
                                                <th className="py-2.5 px-3 text-left font-bold">Misi RS Terkait</th>
                                                <th className="py-2.5 px-3 text-left font-bold">Nama Rencana Strategis</th>
                                                <th className="py-2.5 px-3 text-center font-bold w-28">Periode</th>
                                                <th className="py-2.5 px-3 text-left font-bold">Target &amp; Indikator Kinerja</th>
                                                <th className="py-2.5 px-3 text-center font-bold w-24">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredRenstra.length === 0 ? (
                                                <tr>
                                                    <td colSpan={7} className="py-8 text-center text-slate-400">Belum ada data Rencana Strategis RS.</td>
                                                </tr>
                                            ) : (
                                                filteredRenstra.map((r, idx) => (
                                                    <tr key={r.id || idx} className="hover:bg-slate-50/60 transition-colors">
                                                        <td className="py-3 px-3 text-center font-semibold text-slate-400">{idx + 1}</td>
                                                        <td className="py-3 px-3 font-bold text-slate-700">{r.kode || '-'}</td>
                                                        <td className="py-3 px-3 text-slate-600 max-w-xs">
                                                            {r.misi_items ? (
                                                                <span className="bg-emerald-50 text-emerald-700 font-medium px-2 py-0.5 rounded border border-emerald-100 text-[11px] block">
                                                                    Misi {r.misi_items.nomor}: {r.misi_items.isi_misi}
                                                                </span>
                                                            ) : '-'}
                                                        </td>
                                                        <td className="py-3 px-3 text-slate-800 font-bold max-w-sm">
                                                            <div>{r.nama_rencana}</div>
                                                            {r.deskripsi && <div className="text-[11px] font-normal text-slate-500 mt-0.5 line-clamp-2">{r.deskripsi}</div>}
                                                        </td>
                                                        <td className="py-3 px-3 text-center text-slate-600 font-semibold">
                                                            {r.periode_mulai && r.periode_selesai
                                                                ? `${new Date(r.periode_mulai).getFullYear()} - ${new Date(r.periode_selesai).getFullYear()}`
                                                                : '-'}
                                                        </td>
                                                        <td className="py-3 px-3 text-slate-700">
                                                            <div className="font-semibold">{r.indikator_kinerja || '-'}</div>
                                                            {r.target && <div className="text-[11px] text-[#137fec] font-bold mt-0.5">Target: {r.target}</div>}
                                                        </td>
                                                        <td className="py-3 px-3 text-center">
                                                            <span className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[10px] ${r.status === 'Aktif' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'
                                                                }`}>
                                                                {r.status || 'Draft'}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* RKT Table */}
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 overflow-hidden">
                                <div className="flex items-center justify-between mb-5 border-b border-slate-100 pb-3">
                                    <div>
                                        <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                                            <ListChecks size={18} className="text-emerald-600" />
                                            Rencana Kerja Tahunan (RKT)
                                        </h3>
                                        <p className="text-xs text-slate-400 mt-0.5">Penjabaran kegiatan operasional dan alokasi anggaran tahunan per unit kerja</p>
                                    </div>
                                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100">
                                        {filteredRkt.length} Kegiatan RKT
                                    </span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/70 uppercase tracking-wider text-[10px]">
                                                <th className="py-2.5 px-3 text-center font-bold w-10">No</th>
                                                <th className="py-2.5 px-3 text-left font-bold w-36">Unit Kerja</th>
                                                <th className="py-2.5 px-3 text-left font-bold">Program Utama</th>
                                                <th className="py-2.5 px-3 text-left font-bold">Kegiatan Operasional</th>
                                                <th className="py-2.5 px-3 text-right font-bold w-28">Anggaran</th>
                                                <th className="py-2.5 px-3 text-center font-bold w-24">Sumber Dana</th>
                                                <th className="py-2.5 px-3 text-left font-bold w-28">PIC</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredRkt.length === 0 ? (
                                                <tr>
                                                    <td colSpan={7} className="py-8 text-center text-slate-400">Belum ada data RKT untuk filter ini.</td>
                                                </tr>
                                            ) : (
                                                filteredRkt.map((r, idx) => (
                                                    <tr key={r.id || idx} className="hover:bg-slate-50/60 transition-colors">
                                                        <td className="py-3 px-3 text-center font-semibold text-slate-400">{idx + 1}</td>
                                                        <td className="py-3 px-3 font-semibold text-slate-700">{(r.unit_kerja as any)?.nama_unit || 'Lainnya'}</td>
                                                        <td className="py-3 px-3 text-slate-800 font-bold">{r.program || '-'}</td>
                                                        <td className="py-3 px-3 text-slate-700">{r.kegiatan || '-'}</td>
                                                        <td className="py-3 px-3 text-right font-bold text-emerald-700">{r.anggaran || '-'}</td>
                                                        <td className="py-3 px-3 text-center">
                                                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold text-[10px]">
                                                                {r.sumber_dana || '-'}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-3 text-slate-600 font-medium">{r.pic || '-'}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 2: MONITORING REALISASI KPI */}
                    {activeTab === 'kpi' && (
                        byUnit.length === 0 ? (
                            <div className="card text-center py-16"><p className="text-slate-400">Belum ada data KPI untuk filter ini.</p></div>
                        ) : (
                            <div className="space-y-6">
                                {byUnit.map(([unit, items]) => {
                                    const unitAchieved = items.filter(d => {
                                        const t = parseFloat(d.target);
                                        const r = getNumericRealisasi(d.realisasi);
                                        return !isNaN(t) && !isNaN(r) && t > 0 && r >= t;
                                    }).length;

                                    return (
                                        <div key={unit} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 overflow-hidden">
                                            <div className="flex items-center justify-between mb-5 border-b border-slate-100 pb-3">
                                                <h3 className="font-bold text-slate-800 text-base">{unit}</h3>
                                                <span className="text-xs font-bold text-[#137fec] bg-blue-50 px-3 py-1 rounded-lg border border-blue-100">
                                                    {unitAchieved} dari {items.length} KPI Tercapai
                                                </span>
                                            </div>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-xs">
                                                    <thead>
                                                        <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/70 uppercase tracking-wider text-[10px]">
                                                            <th className="py-2.5 px-3 text-center font-bold w-10">No</th>
                                                            <th className="py-2.5 px-3 text-left font-bold">Sasaran Strategis</th>
                                                            <th className="py-2.5 px-3 text-left font-bold">KPI / Indikator Kinerja</th>
                                                            <th className="py-2.5 px-3 text-center font-bold w-24">Periode</th>
                                                            <th className="py-2.5 px-3 text-center font-bold w-20">Target</th>
                                                            <th className="py-2.5 px-3 text-center font-bold w-24">Realisasi</th>
                                                            <th className="py-2.5 px-3 text-left font-bold w-48">Tingkat Capaian</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {items.map((item, idx) => {
                                                            const des = deserializeRealisasi(item.realisasi);
                                                            return (
                                                                <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                                                                    <td className="py-3 px-3 text-center font-semibold text-slate-400">{idx + 1}</td>
                                                                    <td className="py-3 px-3 text-slate-700 font-medium max-w-xs">{item.sasaran_strategis}</td>
                                                                    <td className="py-3 px-3 text-slate-800 font-semibold">{item.kpi}</td>
                                                                    <td className="py-3 px-3 text-center">
                                                                        <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-bold uppercase text-[10px]">
                                                                            {des.tipe}
                                                                        </span>
                                                                    </td>
                                                                    <td className="py-3 px-3 text-center font-bold text-slate-700">{item.target}</td>
                                                                    <td className="py-3 px-3 text-center font-extrabold text-[#137fec]">
                                                                        {getDisplayRealisasi(item.realisasi)}
                                                                    </td>
                                                                    <td className="py-3 px-3">
                                                                        <AchievementBadge target={item.target} realisasi={item.realisasi} />
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )
                    )}

                    {/* TAB 3: SWOT & KARTESIUS */}
                    {activeTab === 'swot_kartesius' && (
                        <div className="space-y-6">
                            {/* Kartesius SWOT Summary */}
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 overflow-hidden">
                                <div className="flex items-center justify-between mb-5 border-b border-slate-100 pb-3">
                                    <div>
                                        <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                                            <Compass size={18} className="text-amber-500" />
                                            Diagram Kartesius SWOT per Unit Kerja
                                        </h3>
                                        <p className="text-xs text-slate-400 mt-0.5">Penentuan posisi kuadran dan arah rekomendasi strategi berdasarkan evaluasi internal (X) dan eksternal (Y)</p>
                                    </div>
                                    <span className="text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-lg border border-amber-100">
                                        {kartesiusRows.length} Unit Ter-evaluasi
                                    </span>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/70 uppercase tracking-wider text-[10px]">
                                                <th className="py-2.5 px-3 text-center font-bold w-10">No</th>
                                                <th className="py-2.5 px-3 text-left font-bold">Unit Kerja</th>
                                                <th className="py-2.5 px-3 text-center font-bold w-24">Skor (X) Internal</th>
                                                <th className="py-2.5 px-3 text-center font-bold w-24">Skor (Y) Eksternal</th>
                                                <th className="py-2.5 px-3 text-center font-bold w-32">Posisi Kuadran</th>
                                                <th className="py-2.5 px-3 text-left font-bold">Rekomendasi Strategi</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {kartesiusRows.length === 0 ? (
                                                <tr>
                                                    <td colSpan={6} className="py-8 text-center text-slate-400">Belum ada data evaluasi kartesius SWOT.</td>
                                                </tr>
                                            ) : (
                                                kartesiusRows.map(k => (
                                                    <tr key={k.no} className="hover:bg-slate-50/60 transition-colors">
                                                        <td className="py-3 px-3 text-center font-semibold text-slate-400">{k.no}</td>
                                                        <td className="py-3 px-3 font-bold text-slate-800">{k.unit}</td>
                                                        <td className="py-3 px-3 text-center font-extrabold text-[#137fec]">{k.x}</td>
                                                        <td className="py-3 px-3 text-center font-extrabold text-indigo-600">{k.y}</td>
                                                        <td className="py-3 px-3 text-center font-bold text-slate-700">{k.kuadran}</td>
                                                        <td className="py-3 px-3">
                                                            <span className={`inline-block px-2.5 py-1 rounded-full font-bold text-[11px] border ${k.kuadran === 'Kuadran I' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                                k.kuadran === 'Kuadran II' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                                    k.kuadran === 'Kuadran III' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                                        'bg-rose-50 text-rose-700 border-rose-200'
                                                                }`}>
                                                                {k.rekom}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Inventory SWOT Factors Table */}
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 overflow-hidden">
                                <div className="flex items-center justify-between mb-5 border-b border-slate-100 pb-3">
                                    <div>
                                        <h3 className="font-bold text-slate-800 text-base">Inventarisasi &amp; Evaluasi Faktor SWOT</h3>
                                        <p className="text-xs text-slate-400 mt-0.5">Detail bobot, ranking, dan skor faktor Kekuatan, Kelemahan, Peluang, dan Tantangan</p>
                                    </div>
                                    <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-lg">
                                        {filteredSwot.length} Faktor SWOT
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {['Kekuatan', 'Kelemahan', 'Peluang', 'Tantangan'].map(cat => {
                                        const items = filteredSwot.filter(s => s.kategori === cat);
                                        return (
                                            <div key={cat} className="border border-slate-200 rounded-xl p-4 bg-slate-50/40">
                                                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 mb-3 flex items-center justify-between">
                                                    <span>Faktor {cat}</span>
                                                    <span className="bg-slate-200 text-slate-700 text-[10px] px-2 py-0.5 rounded-full">{items.length} items</span>
                                                </h4>
                                                <div className="space-y-2">
                                                    {items.length === 0 ? (
                                                        <p className="text-xs text-slate-400 italic">Belum ada faktor {cat.toLowerCase()}.</p>
                                                    ) : (
                                                        items.map((s, i) => (
                                                            <div key={s.id || i} className="bg-white p-2.5 rounded-lg border border-slate-100 text-xs flex items-center justify-between">
                                                                <div className="max-w-[70%]">
                                                                    <p className="font-medium text-slate-800 line-clamp-2">{s.deskripsi}</p>
                                                                    <p className="text-[10px] text-slate-400 mt-0.5">{(s.unit_kerja as any)?.nama_unit || 'Lainnya'}</p>
                                                                </div>
                                                                <div className="text-right">
                                                                    <span className="font-bold text-slate-700 block">Skor: {((s.bobot || 0) * (s.ranking || 1)).toFixed(1)}</span>
                                                                    <span className="text-[10px] text-slate-400">B: {s.bobot || 0} | R: {s.ranking || 1}</span>
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 4: STRATEGIC MAP */}
                    {activeTab === 'strategic_map' && (
                        <div className="space-y-6">
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 overflow-hidden">
                                <div className="flex items-center justify-between mb-5 border-b border-slate-100 pb-3">
                                    <div>
                                        <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                                            <MapIcon size={18} className="text-purple-600" />
                                            Peta Strategi (Strategic Map 4 Perspektif BSC)
                                        </h3>
                                        <p className="text-xs text-slate-400 mt-0.5">Pemetaan sasaran strategis lintas perspektif Balanced Scorecard (Keuangan, Pelanggan, Internal, Pembelajaran)</p>
                                    </div>
                                    <span className="text-xs font-bold text-purple-600 bg-purple-50 px-3 py-1 rounded-lg border border-purple-100">
                                        {strategicObjectives.length} Sasaran Strategis
                                    </span>
                                </div>

                                <div className="space-y-4">
                                    {[
                                        { key: 'financial', label: '1. Perspektif Keuangan (Financial)', color: 'border-emerald-200 bg-emerald-50/40 text-emerald-800' },
                                        { key: 'customer', label: '2. Perspektif Pelanggan (Customer)', color: 'border-blue-200 bg-blue-50/40 text-blue-800' },
                                        { key: 'internal', label: '3. Perspektif Proses Bisnis Internal', color: 'border-amber-200 bg-amber-50/40 text-amber-800' },
                                        { key: 'learning', label: '4. Perspektif Pembelajaran & Pertumbuhan', color: 'border-purple-200 bg-purple-50/40 text-purple-800' }
                                    ].map(p => {
                                        const objs = strategicObjectives.filter(o => o.perspective === p.key);
                                        return (
                                            <div key={p.key} className={`border rounded-xl p-4 ${p.color}`}>
                                                <h4 className="font-bold text-xs uppercase tracking-wider mb-3 flex items-center justify-between">
                                                    <span>{p.label}</span>
                                                    <span className="bg-white/80 text-slate-700 text-[10px] px-2 py-0.5 rounded-full font-bold">{objs.length} Sasaran</span>
                                                </h4>
                                                {objs.length === 0 ? (
                                                    <p className="text-xs opacity-60 italic">Belum ada sasaran strategis pada perspektif ini.</p>
                                                ) : (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                        {objs.map((o, idx) => (
                                                            <div key={o.id || idx} className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-sm">
                                                                <p className="font-bold text-xs text-slate-800">{o.title}</p>
                                                                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-400 font-semibold">
                                                                    <span>{o.unit}</span>
                                                                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 uppercase">{o.source}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
