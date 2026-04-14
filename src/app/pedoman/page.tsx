'use client';
import { PageHeader } from '@/components/SharedUI';
import { BookOpen } from 'lucide-react';

export default function PedomanPage() {
    const guides = [
        { title: 'Panduan Manajemen Risiko', desc: 'Standar ISO 31000:2018 & SNARS untuk pengelolaan risiko rumah sakit.', icon: '📘' },
        { title: 'Panduan Manajemen Strategi', desc: 'Metodologi penyusunan Renstra dan cascading KPI berbasis BSC.', icon: '🎯' },
        { title: 'Template Identifikasi Risiko', desc: 'Template standar pengisian form identifikasi dan penilaian risiko.', icon: '📋' },
        { title: 'Panduan Import Data (Excel)', desc: 'Cara menggunakan fitur unduh template dan import data massal.', icon: '📊' },
        { title: 'Panduan Pengaturan AI', desc: 'Cara mengkonfigurasi model AI dan menggunakan fitur bantuan AI.', icon: '🤖' },
        { title: 'Manual Pengguna Lengkap', desc: 'Panduan lengkap penggunaan aplikasi ManRisk RS dari awal hingga akhir.', icon: '📖' },
    ];

    return (
        <div>
            <PageHeader title="Buku Pedoman" subtitle="Kumpulan panduan, standar, dan referensi penggunaan sistem ManRisk RS." />
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {guides.map(g => (
                    <div key={g.title} className="card hover:-translate-y-1 hover:shadow-md transition-all duration-300 cursor-pointer">
                        <div className="text-3xl mb-4">{g.icon}</div>
                        <h3 className="text-sm font-bold text-slate-800 mb-2">{g.title}</h3>
                        <p className="text-xs text-slate-400">{g.desc}</p>
                        <button className="mt-4 text-xs font-medium text-[#137fec] hover:text-[#0f63ba] flex items-center gap-1">
                            <BookOpen size={13} /> Buka Panduan
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
