'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader, ScoreCard } from '@/components/SharedUI';
import { CheckCircle2, AlertTriangle, Activity, Clock, Plus, Download, FileText, X, Save, Loader2 } from 'lucide-react';
import { exportToExcel, type ExcelColumn } from '@/lib/excelUtils';

const CURRENT_YEAR = new Date().getFullYear();

interface MonitoringData {
    id: string;
    risk_input_id: string;
    tanggal_monitoring: string;
    status_risiko?: string;
    tingkat_probabilitas?: number;
    tingkat_dampak?: number;
    nilai_risiko?: number;
    tindakan_mitigasi?: string;
    progress_mitigasi?: number;
    evaluasi?: string;
    status?: string;
    risk_inputs?: {
        id: string;
        nama_risiko?: string;
        identifikasi_deskripsi?: string;
        kode_risiko?: string;
        nama_unit_kerja_id?: string;
    };
}

interface WorkUnit { id: string; nama_unit: string; }

interface RisikoItem {
    id: string;
    kode_risiko?: string;
    identifikasi_deskripsi?: string;
    nama_risiko?: string;
    nama_unit_kerja_id?: string;
}

const EMPTY_FORM = {
    unit_kerja_id: '',
    risk_input_id: '',
    tanggal_monitoring: new Date().toISOString().split('T')[0],
    status_risiko: 'Aktif',
    tingkat_probabilitas: 1,
    tingkat_dampak: 1,
    tindakan_mitigasi: '',
    progress_mitigasi: 0,
    evaluasi: '',
    status: 'Monitoring'
};

function StatusBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
    const pct = total > 0 ? (count / total) * 100 : 0;
    return (
        <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 w-28 shrink-0">{label}</span>
            <div className="flex-1 bg-slate-100 rounded-full h-2">
                <div className={`${color} h-2 rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-semibold text-slate-600 w-10 text-right">{count}</span>
        </div>
    );
}

export default function MonitoringRisikoPage() {
    const [data, setData] = useState<MonitoringData[]>([]);
    const [year, setYear] = useState(String(CURRENT_YEAR));
    const [loading, setLoading] = useState(true);

    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ ...EMPTY_FORM });
    const [units, setUnits] = useState<WorkUnit[]>([]);
    const [risikoList, setRisikoList] = useState<RisikoItem[]>([]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        let query = supabase
            .from('monitoring_evaluasi_risiko')
            .select('*, risk_inputs(id, identifikasi_deskripsi, nama_risiko, kode_risiko, nama_unit_kerja_id)')
            .order('tanggal_monitoring', { ascending: false });

        if (year) {
            const yearStart = `${year}-01-01`;
            const yearEnd = `${year}-12-31`;
            query = query.gte('tanggal_monitoring', yearStart).lte('tanggal_monitoring', yearEnd);
        }

        const { data: rows } = await query;
        setData((rows as MonitoringData[]) ?? []);
        setLoading(false);
    }, [year]);

    useEffect(() => {
        fetchData();
        supabase.from('unit_kerja').select('id, nama_unit').then(({ data }: { data: any }) => setUnits((data ?? []) as WorkUnit[]));
        supabase.from('risk_inputs').select('id, nama_risiko, identifikasi_deskripsi, kode_risiko, nama_unit_kerja_id').then(({ data }: { data: any }) => setRisikoList((data ?? []) as RisikoItem[]));
    }, [fetchData]);

    const statuses = ['Aktif', 'Monitoring', 'Mitigasi', 'Selesai'];
    const statusColors: Record<string, string> = {
        'Aktif': 'bg-rose-400', 'Monitoring': 'bg-amber-400', 'Mitigasi': 'bg-[#137fec]', 'Selesai': 'bg-emerald-400',
    };
    const badgeColors: Record<string, string> = {
        'Aktif': 'badge-red', 'Monitoring': 'badge-amber', 'Mitigasi': 'badge-blue', 'Selesai': 'badge-green',
    };

    const aktif = data.filter(d => d.status === 'Aktif').length;
    const monitoring = data.filter(d => d.status === 'Monitoring').length;
    const mitigasi = data.filter(d => d.status === 'Mitigasi').length;
    const selesai = data.filter(d => d.status === 'Selesai').length;

    const filteredRisiko = risikoList.filter(r => !form.unit_kerja_id || r.nama_unit_kerja_id === form.unit_kerja_id);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const nilai_risiko = Number(form.tingkat_probabilitas) * Number(form.tingkat_dampak);
            const { error } = await supabase.from('monitoring_evaluasi_risiko').insert({
                risk_input_id: form.risk_input_id,
                tanggal_monitoring: form.tanggal_monitoring,
                status_risiko: form.status_risiko,
                tingkat_probabilitas: Number(form.tingkat_probabilitas),
                tingkat_dampak: Number(form.tingkat_dampak),
                nilai_risiko,
                tindakan_mitigasi: form.tindakan_mitigasi,
                progress_mitigasi: Number(form.progress_mitigasi),
                evaluasi: form.evaluasi,
                status: form.status
            });

            if (error) {
                alert('Gagal menyimpan data: ' + error.message);
            } else {
                setShowModal(false);
                setForm({ ...EMPTY_FORM });
                fetchData();
            }
        } catch (err) {
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const handleDownloadExcel = () => {
        const columns: ExcelColumn[] = [
            { header: 'ID', key: 'id', width: 10 },
            { header: 'Risiko', key: 'risiko', width: 40 },
            { header: 'Tanggal', key: 'tanggal_monitoring', width: 15 },
            { header: 'Status Risiko', key: 'status_risiko', width: 15 },
            { header: 'Nilai Risiko', key: 'nilai_risiko', width: 15 },
            { header: 'Status Monitoring', key: 'status', width: 15 },
        ];
        const exportData = data.map(d => ({
            id: d.id,
            risiko: d.risk_inputs?.identifikasi_deskripsi || d.risk_inputs?.kode_risiko || '-',
            tanggal_monitoring: d.tanggal_monitoring,
            status_risiko: d.status_risiko,
            nilai_risiko: d.nilai_risiko,
            status: d.status
        }));
        exportToExcel('Data_Monitoring_Risiko.xlsx', exportData, columns);
    };

    const handleExportPDF = () => {
        window.print();
    };

    return (
        <div className="print-container">
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    .no-print { display: none !important; }
                    .print-only { display: block !important; }
                    .print-container { padding: 20px; font-family: sans-serif; }
                    .print-header { border-bottom: 2px solid #000; margin-bottom: 20px; padding-bottom: 10px; }
                    .print-footer { margin-top: 30px; font-size: 10px; text-align: center; color: #666; border-top: 1px solid #ccc; padding-top: 10px; position: fixed; bottom: 0; width: 100%; }
                }
                .print-only { display: none; }
            `}} />

            <div className="print-only print-header">
                <h1 style={{ fontSize: '24px', fontWeight: 'bold', textAlign: 'center', margin: '0' }}>LAPORAN MONITORING RISIKO</h1>
                <p style={{ textAlign: 'center', margin: '5px 0 0 0', color: '#555' }}>Kop Surat Instansi / Pengaturan Aplikasi</p>
            </div>

            <PageHeader
                title="Monitoring Status Risiko"
                subtitle="Pantau perkembangan status penanganan seluruh risiko yang diidentifikasi."
                actions={
                    <div className="flex gap-2 items-center no-print">
                        <select className="form-input w-28" value={year} onChange={e => setYear(e.target.value)}>
                            {[CURRENT_YEAR + 1, CURRENT_YEAR, CURRENT_YEAR - 1].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <button className="btn-secondary flex items-center gap-2" onClick={handleExportPDF}>
                            <FileText size={15} /> PDF
                        </button>
                        <button className="btn-secondary flex items-center gap-2" onClick={handleDownloadExcel}>
                            <Download size={15} /> Excel
                        </button>
                        <button className="btn-primary flex items-center gap-2" onClick={() => setShowModal(true)}>
                            <Plus size={15} /> Tambah Data
                        </button>
                    </div>
                }
            />

            <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 mb-8 no-print">
                <ScoreCard icon={<AlertTriangle size={22} className="text-rose-500" />} title="Aktif" value={aktif} colorClass="bg-rose-50 border-rose-100" />
                <ScoreCard icon={<Clock size={22} className="text-amber-500" />} title="Monitoring" value={monitoring} colorClass="bg-amber-50 border-amber-100" />
                <ScoreCard icon={<Activity size={22} className="text-[#137fec]" />} title="Mitigasi" value={mitigasi} colorClass="bg-blue-50 border-blue-100" />
                <ScoreCard icon={<CheckCircle2 size={22} className="text-emerald-500" />} title="Selesai" value={selesai} colorClass="bg-emerald-50 border-emerald-100" />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Status Overview */}
                <div className="card">
                    <h3 className="text-sm font-bold text-slate-700 mb-5">Distribusi Status Risiko</h3>
                    {loading ? (
                        <div className="flex items-center justify-center py-8 text-slate-400">
                            <div className="animate-spin w-5 h-5 border-2 border-slate-200 border-t-[#137fec] rounded-full mr-2" />
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {statuses.map(s => (
                                <StatusBar key={s} label={s} count={data.filter(d => d.status === s).length} total={data.length} color={statusColors[s]} />
                            ))}
                            <div className="pt-3 border-t border-slate-100 flex justify-between text-xs text-slate-500">
                                <span>Total: {data.length} risiko</span>
                                <span>Penyelesaian: {data.length ? `${Math.round(selesai * 100 / data.length)}%` : '0%'}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Risk List with status */}
                <div className="card">
                    <h3 className="text-sm font-bold text-slate-700 mb-5">Daftar Risiko Aktif</h3>
                    {loading ? (
                        <div className="flex items-center justify-center py-8 text-slate-400">
                            <div className="animate-spin w-5 h-5 border-2 border-slate-200 border-t-[#137fec] rounded-full mr-2" />
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                            {data.filter(d => d.status !== 'Selesai').map(r => (
                                <div key={r.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <span className={`${statusColors[r.status || 'Aktif'] ?? 'bg-slate-300'} w-2 h-2 rounded-full mt-1.5 shrink-0`} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-slate-700 line-clamp-2">{r.risk_inputs?.nama_risiko || r.risk_inputs?.identifikasi_deskripsi || '-'}</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">{r.risk_inputs?.kode_risiko || ''} · {r.tanggal_monitoring}</p>
                                    </div>
                                    <div className="text-right flex flex-col gap-1 shrink-0">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeColors[r.status || 'Aktif'] ?? 'badge-gray'}`}>{r.status || 'Aktif'}</span>
                                        <span className="text-[10px] text-slate-400">Skor: {r.nilai_risiko || '-'}</span>
                                    </div>
                                </div>
                            ))}
                            {data.filter(d => d.status !== 'Selesai').length === 0 && (
                                <p className="text-slate-400 text-sm text-center py-6">Semua risiko telah ditangani 🎉</p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="print-only print-footer">
                <p>Dicetak melalui Sistem Aplikasi ManRisk pada {new Date().toLocaleString()}</p>
            </div>

            {/* Modal Tambah Data */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 no-print">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center p-5 border-b border-slate-100">
                            <h2 className="font-bold text-slate-800">Tambah Data Monitoring</h2>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleSave} className="p-5 space-y-4 text-sm">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="form-label">Unit Kerja</label>
                                    <select className="form-input w-full" value={form.unit_kerja_id} onChange={e => setForm(f => ({ ...f, unit_kerja_id: e.target.value, risk_input_id: '' }))} required>
                                        <option value="">-- Pilih Unit --</option>
                                        {units.map(u => <option key={u.id} value={u.id}>{u.nama_unit}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="form-label">Risiko Terkait</label>
                                    <select className="form-input w-full" value={form.risk_input_id} onChange={e => setForm(f => ({ ...f, risk_input_id: e.target.value }))} required>
                                        <option value="">-- Pilih Risiko --</option>
                                        {filteredRisiko.map(r => (
                                            <option key={r.id} value={r.id}>
                                                {r.kode_risiko ? `[${r.kode_risiko}] ` : ''}{r.nama_risiko || r.identifikasi_deskripsi || 'Tanpa Nama'}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="form-label">Tanggal Monitoring</label>
                                    <input type="date" className="form-input w-full" value={form.tanggal_monitoring} onChange={e => setForm(f => ({ ...f, tanggal_monitoring: e.target.value }))} required />
                                </div>
                                <div>
                                    <label className="form-label">Status Risiko Saat Ini</label>
                                    <select className="form-input w-full" value={form.status_risiko} onChange={e => setForm(f => ({ ...f, status_risiko: e.target.value }))}>
                                        <option value="Aktif">Aktif</option>
                                        <option value="Menurun">Menurun</option>
                                        <option value="Meningkat">Meningkat</option>
                                        <option value="Dapat Ditoleransi">Dapat Ditoleransi</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="form-label">Tingkat Probabilitas (1-5)</label>
                                    <input type="number" min="1" max="5" className="form-input w-full" value={form.tingkat_probabilitas} onChange={e => setForm(f => ({ ...f, tingkat_probabilitas: Number(e.target.value) }))} required />
                                </div>
                                <div>
                                    <label className="form-label">Tingkat Dampak (1-5)</label>
                                    <input type="number" min="1" max="5" className="form-input w-full" value={form.tingkat_dampak} onChange={e => setForm(f => ({ ...f, tingkat_dampak: Number(e.target.value) }))} required />
                                </div>
                            </div>

                            <div>
                                <label className="form-label">Tindakan Mitigasi</label>
                                <textarea className="form-input w-full" rows={2} value={form.tindakan_mitigasi} onChange={e => setForm(f => ({ ...f, tindakan_mitigasi: e.target.value }))} placeholder="Langkah mitigasi yang telah dilakukan..."></textarea>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="form-label">Progress Mitigasi (%)</label>
                                    <input type="number" min="0" max="100" className="form-input w-full" value={form.progress_mitigasi} onChange={e => setForm(f => ({ ...f, progress_mitigasi: Number(e.target.value) }))} required />
                                </div>
                                <div>
                                    <label className="form-label">Status Monitoring</label>
                                    <select className="form-input w-full" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                                        <option value="Aktif">Aktif</option>
                                        <option value="Monitoring">Monitoring</option>
                                        <option value="Mitigasi">Mitigasi</option>
                                        <option value="Selesai">Selesai</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="form-label">Evaluasi / Hasil Monitoring</label>
                                <textarea className="form-input w-full" rows={2} value={form.evaluasi} onChange={e => setForm(f => ({ ...f, evaluasi: e.target.value }))} placeholder="Kesimpulan hasil pemantauan risiko..."></textarea>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Batal</button>
                                <button type="submit" disabled={saving || !form.risk_input_id} className="btn-primary flex items-center gap-2">
                                    {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                                    Simpan Data
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
