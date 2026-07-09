'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader, FilterBar, TopActionBar } from '@/components/SharedUI';
import DataTable, { type Column } from '@/components/DataTable';
import { Download, FileText, Filter, Eye, X, Loader2 } from 'lucide-react';

/* ─── Types ─── */
interface RiskRegisterRow {
    id: string;
    unit_kerja_id?: string;
    tahun: number;
    kode_risiko?: string;
    identifikasi_risiko: string;
    probabilitas?: number;
    dampak?: number;
    skor_risiko?: number;
    mitigasi?: string;
    rencana_penanganan?: string;
    p_residual?: number;
    d_residual?: number;
    status: string;
    created_at: string;
    unit_kerja?: { id: string; nama_unit: string };
}

interface WorkUnit { id: string; nama_unit: string; }

/* ─── Helpers ─── */
function StatusBadge({ status }: { status: string }) {
    const map: Record<string, string> = {
        Open: 'badge-red', Monitoring: 'badge-amber', 'Mitigasi Berjalan': 'badge-blue', Closed: 'badge-green',
    };
    return <span className={map[status] ?? 'badge-gray'}>{status}</span>;
}

function RiskScoreBadge({ score }: { score: number }) {
    if (score >= 15) return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">Sangat Tinggi ({score})</span>;
    if (score >= 10) return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">Tinggi ({score})</span>;
    if (score >= 5) return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">Sedang ({score})</span>;
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">Rendah ({score})</span>;
}

/* ─── View Modal ─── */
function ViewModal({ row, onClose }: { row: RiskRegisterRow; onClose: () => void }) {
    const skor = row.skor_risiko ?? (row.probabilitas ?? 0) * (row.dampak ?? 0);
    const p_res = row.p_residual ?? Math.ceil((row.probabilitas ?? 0) * 0.5);
    const d_res = row.d_residual ?? Math.ceil((row.dampak ?? 0) * 0.8);
    const skor_res = p_res * d_res;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl my-8">
                <div className="flex justify-between items-center p-6 border-b border-slate-100">
                    <h2 className="font-bold text-slate-800 text-lg">Detail Risk Register</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"><X size={18} /></button>
                </div>
                <div className="p-6 space-y-4 text-sm">
                    <div className="grid grid-cols-2 gap-4">
                        <div><span className="text-xs text-slate-400">Unit Kerja</span><p className="font-semibold mt-0.5">{row.unit_kerja?.nama_unit ?? '-'}</p></div>
                        <div><span className="text-xs text-slate-400">Tahun</span><p className="font-semibold mt-0.5">{row.tahun}</p></div>
                        {row.kode_risiko && <div><span className="text-xs text-slate-400">Kode Risiko</span><p className="font-mono font-semibold mt-0.5">{row.kode_risiko}</p></div>}
                        <div><span className="text-xs text-slate-400">Status</span><div className="mt-1"><StatusBadge status={row.status} /></div></div>
                    </div>
                    <div><span className="text-xs text-slate-400">Pernyataan Risiko</span><p className="font-medium mt-0.5 leading-relaxed">{row.identifikasi_risiko}</p></div>

                    <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                            <p className="text-xs text-slate-500">Inherent</p>
                            <p className="text-2xl font-extrabold text-rose-600 mt-1">{skor}</p>
                            <p className="text-xs text-slate-400">P:{row.probabilitas} × D:{row.dampak}</p>
                        </div>
                        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                            <p className="text-xs text-slate-500">Residual</p>
                            <p className="text-2xl font-extrabold text-emerald-600 mt-1">{skor_res}</p>
                            <p className="text-xs text-slate-400">P:{p_res} × D:{d_res}</p>
                        </div>
                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                            <p className="text-xs text-slate-500">Reduksi</p>
                            <p className="text-2xl font-extrabold text-blue-600 mt-1">
                                {skor > 0 ? Math.round((1 - skor_res / skor) * 100) : 0}%
                            </p>
                        </div>
                    </div>

                    {row.mitigasi && <div><span className="text-xs text-slate-400">Mitigasi</span><p className="mt-0.5 text-slate-600 leading-relaxed">{row.mitigasi}</p></div>}
                    {row.rencana_penanganan && <div><span className="text-xs text-slate-400">Rencana Penanganan</span><p className="mt-0.5 text-slate-600 leading-relaxed">{row.rencana_penanganan}</p></div>}
                </div>
                <div className="flex justify-end px-6 pb-6"><button onClick={onClose} className="btn-secondary">Tutup</button></div>
            </div>
        </div>
    );
}

/* ─── Main Page ─── */
export default function RiskRegisterPage() {
    const [rows, setRows] = useState<RiskRegisterRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState(false);
    const [search, setSearch] = useState('');
    const [year, setYear] = useState(String(new Date().getFullYear()));
    const [unitFilter, setUnitFilter] = useState('');
    const [units, setUnits] = useState<WorkUnit[]>([]);
    const [viewRow, setViewRow] = useState<RiskRegisterRow | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            let q = supabase
                .from('manajemen_risiko')
                .select('*, unit_kerja(id, nama_unit)')
                .order('skor_risiko', { ascending: false });
            if (year) q = q.eq('tahun', Number(year));
            const { data, error } = await q;
            if (error) { console.error('Error fetching risk register:', error); setRows([]); }
            else setRows((data as RiskRegisterRow[]) ?? []);
        } catch (e) { console.error(e); setRows([]); }
        finally { setLoading(false); }
    }, [year]);

    useEffect(() => { fetchData(); }, [fetchData]);

    useEffect(() => {
        supabase.from('unit_kerja').select('id, nama_unit').then(({ data }: { data: any }) => setUnits((data ?? []) as WorkUnit[]));
    }, []);

    const filtered = rows.filter(d => {
        const matchSearch = d.identifikasi_risiko.toLowerCase().includes(search.toLowerCase()) ||
            (d.kode_risiko || '').toLowerCase().includes(search.toLowerCase());
        const matchUnit = unitFilter ? d.unit_kerja_id === unitFilter : true;
        return matchSearch && matchUnit;
    });

    const handleUnduhLaporan = async () => {
        setDownloading(true);
        try {
            const { data: settings } = await supabase.from('app_settings').select('*').limit(1).single();
            const namaRs = settings?.nama_rs ?? 'Rumah Sakit';
            const alamat = settings?.alamat ?? '';
            const kota = settings?.kota ?? '';
            const telepon = settings?.telepon ?? '';
            const email = settings?.email ?? '';
            const website = settings?.website ?? '';
            const kepala = settings?.kepala_rs ?? '';
            const nip = settings?.nip_kepala ?? '';
            const footerText = settings?.footer ?? '';
            const tgl = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

            const rows_html = filtered.map((r, i) => {
                const skor = r.skor_risiko ?? (r.probabilitas ?? 0) * (r.dampak ?? 0);
                const p_res = r.p_residual ?? Math.ceil((r.probabilitas ?? 0) * 0.5);
                const d_res = r.d_residual ?? Math.ceil((r.dampak ?? 0) * 0.8);
                const skor_res = p_res * d_res;
                const unit_name = (r as any).unit_kerja?.nama_unit ?? '-';
                const skorColor = skor >= 15 ? '#dc2626' : skor >= 10 ? '#ea580c' : skor >= 5 ? '#d97706' : '#16a34a';
                const skor_res_color = skor_res >= 10 ? '#ea580c' : skor_res >= 5 ? '#d97706' : '#16a34a';
                const STATUS_COLOR: Record<string, string> = {
                    Open: '#dc2626', Monitoring: '#d97706', 'Mitigasi Berjalan': '#2563eb', Closed: '#16a34a'
                };
                return `<tr>
                    <td style="text-align:center">${i + 1}</td>
                    <td>${r.tahun}</td>
                    <td>${unit_name}</td>
                    <td style="font-family:monospace">${r.kode_risiko ?? '-'}</td>
                    <td>${r.identifikasi_risiko}</td>
                    <td style="text-align:center">${r.probabilitas ?? '-'}</td>
                    <td style="text-align:center">${r.dampak ?? '-'}</td>
                    <td style="text-align:center;color:${skorColor};font-weight:bold">${skor}</td>
                    <td style="text-align:center">${p_res}</td>
                    <td style="text-align:center">${d_res}</td>
                    <td style="text-align:center;color:${skor_res_color};font-weight:bold">${skor_res}</td>
                    <td style="text-align:center">${r.mitigasi ?? '-'}</td>
                    <td style="text-align:center;color:${STATUS_COLOR[r.status] ?? '#64748b'};font-weight:600">${r.status}</td>
                </tr>`;
            }).join('');

            const html = `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8">
            <title>Risk Register - ${namaRs}</title>
            <style>
              @page { size: A4 landscape; margin: 15mm; }
              * { box-sizing: border-box; }
              body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; margin: 0; color: #1e293b; }
              .kop { display: flex; align-items: center; gap: 16px; padding-bottom: 12px; border-bottom: 4px double #1e3a5f; margin-bottom: 16px; }
              .kop-logo { width: 72px; height: 72px; background: #1e3a5f; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-size: 28px; font-weight: bold; flex-shrink: 0; }
              .kop-text .label { font-size: 8px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
              .kop-text .rs-name { font-size: 18px; font-weight: 900; color: #1e3a5f; margin: 2px 0; }
              .kop-text .rs-info { font-size: 9px; color: #475569; }
              h3 { text-align: center; font-size: 14px; margin: 16px 0 4px; color: #1e3a5f; text-transform: uppercase; letter-spacing: 1px; }
              .sub { text-align: center; font-size: 9px; color: #64748b; margin-bottom: 16px; }
              table { width: 100%; border-collapse: collapse; font-size: 9px; }
              thead th { background: #1e3a5f; color: white; padding: 6px 8px; text-align: left; font-size: 9px; }
              tbody td { padding: 5px 7px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
              tbody tr:nth-child(even) td { background: #f8fafc; }
              tbody tr:hover td { background: #eff6ff; }
              .footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #cbd5e1; display: flex; justify-content: space-between; align-items: flex-end; }
              .footer-left { font-size: 8px; color: #94a3b8; max-width: 60%; }
              .ttd { text-align: center; font-size: 9px; }
              .ttd-name { border-top: 1px solid #334155; padding-top: 4px; margin-top: 50px; font-weight: bold; }
            </style></head><body>
            <div class="kop">
              <div class="kop-logo">${namaRs.charAt(0) || 'R'}</div>
              <div class="kop-text">
                <p class="label">Sistem Manajemen Risiko</p>
                <p class="rs-name">${namaRs}</p>
                <p class="rs-info">${alamat}${kota ? ', ' + kota : ''}</p>
                <p class="rs-info">${[telepon, email, website].filter(Boolean).join(' | ')}</p>
              </div>
            </div>
            <h3>LAPORAN RISK REGISTER</h3>
            <p class="sub">Tahun: ${year} &nbsp;|&nbsp; Dicetak: ${tgl} &nbsp;|&nbsp; Total ${filtered.length} Data</p>
            <table>
              <thead><tr>
                <th style="width:28px">No</th><th>Tahun</th><th>Unit Kerja / Pemilik Risiko</th>
                <th>Kode</th><th style="min-width:160px">Pernyataan Risiko</th>
                <th style="text-align:center">P Inh</th><th style="text-align:center">D Inh</th>
                <th style="text-align:center">Inherent</th>
                <th style="text-align:center">P Res</th><th style="text-align:center">D Res</th>
                <th style="text-align:center">Residual</th>
                <th style="min-width:120px">Rencana Mitigasi</th><th>Status</th>
              </tr></thead>
              <tbody>${rows_html}</tbody>
            </table>
            <div class="footer">
              <div class="footer-left">${footerText}</div>
              <div class="ttd">
                <p>${kota}, ${tgl}</p>
                <div class="ttd-name">${kepala}</div>
                ${nip ? `<p>NIP. ${nip}</p>` : ''}
              </div>
            </div>
            </body></html>`;

            const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Risk_Register_${namaRs.replace(/\s+/g, '_')}_${year}.html`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error(e);
            alert('Gagal mengunduh laporan');
        } finally {
            setDownloading(false);
        }
    };

    // Extensive columns for a full Register view — using unique keys per column
    const columns: Column<RiskRegisterRow>[] = [
        { key: 'tahun', label: 'Tahun', className: 'w-16' },
        { key: 'unit_kerja_id', label: 'Unit / Pemilik Risiko', render: r => (r as any).unit_kerja?.nama_unit ?? '-' },
        {
            key: 'identifikasi_risiko', label: 'Pernyataan Risiko', className: 'min-w-[200px]',
            render: r => (
                <div>
                    {r.kode_risiko && <span className="text-xs font-mono text-slate-400 block">{r.kode_risiko}</span>}
                    <span className="line-clamp-3">{r.identifikasi_risiko}</span>
                </div>
            )
        },
        { key: 'probabilitas', label: 'P Inh', className: 'text-center text-slate-500', render: r => String(r.probabilitas ?? '-') },
        { key: 'dampak', label: 'D Inh', className: 'text-center text-slate-500', render: r => String(r.dampak ?? '-') },
        {
            key: 'skor_risiko', label: 'Inherent', className: 'text-center',
            render: r => <RiskScoreBadge score={r.skor_risiko ?? (r.probabilitas ?? 0) * (r.dampak ?? 0)} />
        },
        {
            key: 'mitigasi', label: 'Rencana Mitigasi', className: 'min-w-[200px]',
            render: r => <span className="line-clamp-2 text-slate-600 italic text-xs">{r.mitigasi ?? 'Belum ada mitigasi'}</span>
        },
        {
            key: 'p_residual', label: 'P Res', className: 'text-center text-emerald-600',
            render: r => String(r.p_residual ?? Math.ceil((r.probabilitas ?? 0) * 0.5))
        },
        {
            key: 'd_residual', label: 'D Res', className: 'text-center text-emerald-600',
            render: r => String(r.d_residual ?? Math.ceil((r.dampak ?? 0) * 0.8))
        },
        {
            key: 'rencana_penanganan', label: 'Residual', className: 'text-center',
            render: r => {
                const res = (r.p_residual ?? Math.ceil((r.probabilitas ?? 0) * 0.5)) * (r.d_residual ?? Math.ceil((r.dampak ?? 0) * 0.8));
                return <RiskScoreBadge score={res} />;
            }
        },
        { key: 'status', label: 'Status', render: r => <StatusBadge status={r.status} /> },
        {
            key: 'actions', label: 'Aksi', render: r => (
                <div className="flex gap-1 justify-center">
                    <button title="Lihat detail" className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded" onClick={() => setViewRow(r)}><Eye size={15} /></button>
                </div>
            )
        },
    ];

    return (
        <div>
            {viewRow && <ViewModal row={viewRow} onClose={() => setViewRow(null)} />}

            <PageHeader title="Risk Register (Daftar Risiko)" subtitle="Kumpulan komprehensif seluruh data profil risiko terintegrasi." />

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-8">
                <TopActionBar
                    filters={
                        <div className="flex flex-wrap gap-3 items-center">
                            <FilterBar
                                searchValue={search} onSearchChange={setSearch} searchPlaceholder="Cari risk register..."
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
                            <button className="btn-secondary flex items-center gap-2" onClick={() => alert('Fitur advanced filter')}>
                                <Filter size={15} /><span className="hidden sm:inline">Filter Lanjutan</span>
                            </button>
                            <button
                                className="btn-primary flex items-center gap-2"
                                onClick={handleUnduhLaporan}
                                disabled={downloading}
                            >
                                {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                                <span>Unduh Laporan</span>
                            </button>
                        </>
                    }
                />

                {/* Wrap in horizontal scroll for large tables */}
                <div className="w-full overflow-x-auto">
                    <DataTable columns={columns} data={filtered} isLoading={loading} />
                </div>
            </div>

            <div className="text-right text-sm text-slate-500 mt-4 mr-2">
                Menampilkan {filtered.length} dari {rows.length} baris Risk Register · Tahun {year}
            </div>
        </div>
    );
}
