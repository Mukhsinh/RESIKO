'use client';

import React, { useState } from 'react';
import { Sparkles, Settings2, Check } from 'lucide-react';

interface FormInputAIProps {
    label: string;
    placeholder?: string;
    value: string;
    onChange: (val: string) => void;
    rows?: number;
}

const AI_MODELS = ['Gemini 1.5 Pro', 'GPT-4o', 'Claude 3.5 Sonnet', 'Gemini 1.5 Flash'];

const AI_SUGGESTIONS: Record<string, string[]> = {
    risiko: [
        'Kegagalan sistem informasi rumah sakit yang menyebabkan gangguan layanan pasien.',
        'Keterlambatan kalibrasi alat medis life support di ruang ICU/ICCU.',
        'Risiko infeksi nosokomial akibat prosedur sterilisasi yang tidak standar.',
        'Kekurangan tenaga medis spesialis pada waktu-waktu kritis.',
    ],
    mitigasi: [
        'Lakukan audit berkala setiap 3 bulan, siapkan backup sistem dan prosedur failover.',
        'Buat jadwal pemeliharaan preventif dan siapkan teknisi on-call 24 jam.',
        'Terapkan SOP sterilisasi terstandar dan lakukan pelatihan rutin bagi petugas.',
        'Rekrut tenaga pengganti dan buat perjanjian kerjasama dengan dokter mitra.',
    ],
    strategi: [
        'Meningkatkan kualitas pelayanan kesehatan yang berorientasi pada kepuasan pasien.',
        'Mewujudkan tata kelola rumah sakit yang transparan dan akuntabel.',
        'Mengoptimalkan penggunaan teknologi informasi dalam pelayanan kesehatan.',
    ],
};

function getSuggestion(label: string): string {
    const key = label.toLowerCase().includes('mitigasi') ? 'mitigasi'
        : label.toLowerCase().includes('strategi') || label.toLowerCase().includes('sasaran') ? 'strategi'
            : 'risiko';
    const arr = AI_SUGGESTIONS[key];
    return arr[Math.floor(Math.random() * arr.length)];
}

export default function FormInputAI({ label, placeholder, value, onChange, rows = 3 }: FormInputAIProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [showConfig, setShowConfig] = useState(false);
    const [model, setModel] = useState('Gemini 1.5 Pro');

    const handleAI = () => {
        setIsLoading(true);
        setTimeout(() => {
            onChange(getSuggestion(label));
            setIsLoading(false);
        }, 1200);
    };

    return (
        <div className="w-full">
            <div className="flex items-center justify-between mb-1.5">
                <label className="form-label mb-0">{label}</label>
                <div className="flex items-center space-x-1.5">
                    {showConfig && (
                        <select
                            value={model}
                            onChange={e => setModel(e.target.value)}
                            className="text-xs border border-slate-200 bg-slate-50 rounded-md px-2 py-1 text-slate-600 focus:ring-[#137fec] focus:border-[#137fec] focus:outline-none"
                        >
                            {AI_MODELS.map(m => <option key={m}>{m}</option>)}
                        </select>
                    )}
                    <button type="button" onClick={() => setShowConfig(s => !s)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                        title="Pilih Model AI">
                        <Settings2 size={13} />
                    </button>
                    <button type="button" onClick={handleAI} disabled={isLoading}
                        className="btn-ai disabled:opacity-70">
                        {isLoading
                            ? <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                            : <Sparkles size={13} />}
                        <span>{isLoading ? 'Menyusun...' : 'Bantuan AI'}</span>
                    </button>
                </div>
            </div>
            <textarea
                rows={rows}
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                className="form-input resize-none"
            />
            <p className="text-[10px] text-slate-400 mt-1 flex items-center">
                <Check size={11} className="mr-1 text-emerald-500 shrink-0" />
                AI didukung oleh {model} &middot; Teks dapat diedit sebelum disimpan
            </p>
        </div>
    );
}
