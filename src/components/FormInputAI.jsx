import React, { useState } from 'react';
import { Sparkles, Edit2, Check, Settings2, Save } from 'lucide-react';

export default function FormInputAI({
    label = "Mitigasi Risiko",
    placeholder = "Masukkan deskripsi mitigasi...",
    value,
    onChange
}) {
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [showAiConfig, setShowAiConfig] = useState(false);
    const [selectedModel, setSelectedModel] = useState('Gemini 1.5 Pro');

    // Simulasi Rekomendasi AI
    const handleAskAI = () => {
        setIsAiLoading(true);
        setTimeout(() => {
            onChange("Contoh Bantuan AI: Lakukan pemeliharaan berkala setiap 3 bulan dan sediakan sumber daya cadangan (UPS).");
            setIsAiLoading(false);
        }, 1500);
    };

    return (
        <div className="w-full mb-6">
            <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold text-slate-700">{label}</label>

                {/* Tombol Aksi AI di atas textarea */}
                <div className="flex items-center space-x-2">
                    {showAiConfig && (
                        <select
                            value={selectedModel}
                            onChange={(e) => setSelectedModel(e.target.value)}
                            className="text-xs border-slate-200 bg-slate-50 text-slate-600 rounded-md py-1 h-7 px-2 focus:ring-[#0891B2] focus:border-[#0891B2]"
                        >
                            <option value="Gemini 1.5 Pro">Gemini 1.5 Pro</option>
                            <option value="GPT-4o">GPT-4o</option>
                            <option value="Claude 3.5 Sonnet">Claude 3.5 Sonnet</option>
                        </select>
                    )}

                    <button
                        type="button"
                        onClick={() => setShowAiConfig(!showAiConfig)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                        title="Pengaturan Mode AI"
                    >
                        <Settings2 size={14} />
                    </button>

                    <button
                        type="button"
                        onClick={handleAskAI}
                        disabled={isAiLoading}
                        className="flex items-center space-x-1.5 px-3 py-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-md shadow-md shadow-indigo-500/30 transition-all font-medium text-xs disabled:opacity-75"
                    >
                        {isAiLoading ? (
                            <span className="animate-spin w-3 h-3 border-2 border-white/50 border-t-white rounded-full"></span>
                        ) : (
                            <Sparkles size={14} />
                        )}
                        <span>{isAiLoading ? 'Menyusun...' : 'Bantuan AI'}</span>
                    </button>
                </div>
            </div>

            {/* Input Textarea */}
            <div className="relative group">
                <textarea
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    rows={4}
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0891B2]/50 focus:border-transparent text-sm text-slate-700 transition-all shadow-sm"
                />

                {/* Floating Indicator */}
                {value && (
                    <div className="absolute bottom-3 right-3 text-[#0891B2] opacity-0 group-hover:opacity-100 transition-opacity">
                        <Edit2 size={14} />
                    </div>
                )}
            </div>

            {/* Footer Info */}
            <p className="text-[11px] text-slate-400 mt-1.5 flex items-center">
                <Check size={12} className="mr-1 text-emerald-500" />
                Bantuan AI didukung oleh {selectedModel} (Dikelola di Pengaturan AI)
            </p>
        </div>
    );
}

// Simulasi Form Halaman
export function FormWrapper() {
    const [mitigasi, setMitigasi] = useState('');

    return (
        <div className="max-w-2xl bg-white p-8 rounded-2xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100">
            <h2 className="text-xl font-bold text-slate-800 mb-6 border-b border-slate-100 pb-4">Identifikasi Risiko Baru</h2>

            <div className="mb-4">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Identifikasi Risiko</label>
                <input type="text" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" placeholder="Contoh: Keterlambatan jadwal piket..." />
            </div>

            <FormInputAI
                label="Strategi Mitigasi"
                value={mitigasi}
                onChange={setMitigasi}
                placeholder="Bisa diketik manual, atau gunakan Bantuan AI untuk men-generate otomatis..."
            />

            <div className="flex justify-end mt-8">
                <button className="px-6 py-2 bg-[#0891B2] hover:bg-cyan-700 text-white rounded-xl shadow-md shadow-cyan-500/30 flex items-center space-x-2 font-medium">
                    <Save size={16} />
                    <span>Simpan Data</span>
                </button>
            </div>
        </div>
    );
}
