'use client';
import { PageHeader, ScoreCard } from '@/components/SharedUI';
import { FileBarChart2, Download } from 'lucide-react';

export default function LaporanPage() {
    return (
        <div>
            <PageHeader title="Laporan" subtitle="Ekspor laporan manajemen strategi dan risiko dalam format Excel atau PDF."
                actions={<button className="btn-primary"><Download size={15} /><span>Ekspor Laporan</span></button>} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {[
                    { title: 'Laporan Risiko', icon: '🛡️', desc: 'Rangkuman identifikasi dan analisis risiko per unit kerja dan tahun.' },
                    { title: 'Laporan Strategi', icon: '🎯', desc: 'Capaian sasaran strategis dan KPI unit kerja per tahun anggaran.' },
                    { title: 'Laporan Eksekutif', icon: '📈', desc: 'Dashboard ringkas untuk pimpinan dengan highlight risiko & KPI.' },
                ].map(l => (
                    <div key={l.title} className="card hover:-translate-y-1 hover:shadow-md transition-all duration-300 cursor-pointer">
                        <div className="text-4xl mb-4">{l.icon}</div>
                        <h3 className="text-sm font-bold text-slate-800 mb-2">{l.title}</h3>
                        <p className="text-xs text-slate-400 mb-4">{l.desc}</p>
                        <div className="flex items-center gap-2">
                            <button className="btn-secondary text-xs py-1.5"><Download size={13} /><span>Excel</span></button>
                            <button className="btn-secondary text-xs py-1.5"><Download size={13} /><span>PDF</span></button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
