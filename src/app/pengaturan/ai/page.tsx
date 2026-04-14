'use client';

import React, { useEffect, useState } from 'react';
import { supabase, type PengaturanAI } from '@/lib/supabase';
import { Brain, Save, Loader2, CheckCircle2, Sparkles, Key, Cpu } from 'lucide-react';

const AI_MODELS = [
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', provider: 'Google DeepMind', desc: 'Model paling kuat dari Google, ideal untuk analisis kompleks.' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', provider: 'Google DeepMind', desc: 'Lebih cepat dari Pro, bagus untuk respons real-time.' },
    { value: 'gpt-4o', label: 'GPT-4o', provider: 'OpenAI', desc: 'Model multimodal terbaru dari OpenAI.' },
    { value: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet', provider: 'Anthropic', desc: 'Terbaik untuk penulisan dan analisis dokumen panjang.' },
];

export default function PengaturanAIPage() {
    const [config, setConfig] = useState<PengaturanAI | null>(null);
    const [model, setModel] = useState('gemini-1.5-pro');
    const [apiKey, setApiKey] = useState('');
    const [prompt, setPrompt] = useState('');
    const [active, setActive] = useState(true);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        supabase.from('pengaturan_ai').select('*').limit(1).single().then(({ data }) => {
            if (data) {
                const d = data as PengaturanAI;
                setConfig(d);
                setModel(d.model_ai_terpilih ?? 'gemini-1.5-pro');
                const extra = d.konfigurasi_tambahan as Record<string, string>;
                setApiKey(extra?.api_key ?? '');
                setPrompt(extra?.system_prompt ?? '');
                setActive(d.aktif);
            }
            setLoading(false);
        });
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        const payload = {
            model_ai_terpilih: model,
            konfigurasi_tambahan: { api_key: apiKey, system_prompt: prompt },
            aktif: active,
            updated_at: new Date().toISOString(),
        };
        if (config?.id) {
            await supabase.from('pengaturan_ai').update(payload).eq('id', config.id);
        } else {
            await supabase.from('pengaturan_ai').insert(payload);
        }
        setSaving(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    const selectedModel = AI_MODELS.find(m => m.value === model);

    return (
        <div>
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-md shadow-indigo-500/30">
                        <Brain size={22} className="text-white" />
                    </div>
                    Pengaturan AI
                </h1>
                <p className="text-sm text-slate-500 mt-1 ml-14">Konfigurasi model AI yang digunakan untuk bantuan pengisian form dan rekomendasi otomatis.</p>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20 text-slate-400">
                    <div className="animate-spin w-6 h-6 border-2 border-slate-200 border-t-[#137fec] rounded-full mr-3" />
                    <span className="text-sm">Memuat konfigurasi...</span>
                </div>
            ) : (
                <form onSubmit={handleSave} className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                    {/* Left: Model Selection */}
                    <div className="xl:col-span-2 space-y-5">
                        {/* Active Toggle */}
                        <div className="card flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
                                    <Sparkles size={20} className="text-violet-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-slate-700">Aktifkan Bantuan AI</p>
                                    <p className="text-xs text-slate-400">Tampilkan tombol AI pada seluruh form input data</p>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={active} onChange={e => setActive(e.target.checked)} />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
                            </label>
                        </div>

                        {/* Model Selection Grid */}
                        <div className="card">
                            <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2"><Cpu size={16} className="text-[#137fec]" /> Pilih Model AI</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {AI_MODELS.map(m => (
                                    <button
                                        key={m.value}
                                        type="button"
                                        onClick={() => setModel(m.value)}
                                        className={`flex flex-col items-start text-left p-4 rounded-xl border-2 transition-all duration-200
                      ${model === m.value
                                                ? 'border-violet-500 bg-violet-50'
                                                : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'}`}
                                    >
                                        <div className="flex items-center justify-between w-full mb-2">
                                            <span className="text-sm font-semibold text-slate-800">{m.label}</span>
                                            {model === m.value && <CheckCircle2 size={16} className="text-violet-600 shrink-0" />}
                                        </div>
                                        <span className="text-[10px] font-medium text-violet-600 bg-violet-100 px-2 py-0.5 rounded-full mb-2">{m.provider}</span>
                                        <p className="text-xs text-slate-400">{m.desc}</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* API Key */}
                        <div className="card">
                            <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2"><Key size={16} className="text-amber-500" /> API Key (Opsional)</h3>
                            <p className="text-xs text-slate-400 mb-3">Masukkan API key jika menggunakan model berbayar. Kosongkan jika menggunakan konfigurasi default server.</p>
                            <input
                                type="password"
                                className="form-input"
                                value={apiKey}
                                onChange={e => setApiKey(e.target.value)}
                                placeholder="sk-... atau AIza..."
                            />
                        </div>

                        {/* System Prompt */}
                        <div className="card">
                            <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2"><Brain size={16} className="text-indigo-500" /> System Prompt / Instruksi Dasar</h3>
                            <p className="text-xs text-slate-400 mb-3">Instruks yang secara otomatis dikirim ke AI sebelum permintaan pengguna. Gunakan untuk menyesuaikan respons AI dengan konteks rumah sakit.</p>
                            <textarea
                                rows={5}
                                className="form-input resize-none"
                                value={prompt}
                                onChange={e => setPrompt(e.target.value)}
                                placeholder="Contoh: Kamu adalah asisten manajemen risiko rumah sakit yang profesional. Berikan rekomendasi berdasarkan standar SNARS/KARS..."
                            />
                        </div>
                    </div>

                    {/* Right: Status & Save */}
                    <div className="space-y-5">
                        {/* Current Config */}
                        <div className="card">
                            <h3 className="text-sm font-bold text-slate-700 mb-4">Status Konfigurasi</h3>
                            <div className="space-y-3">
                                <InfoRow label="Model Aktif" value={selectedModel?.label ?? model} />
                                <InfoRow label="Provider" value={selectedModel?.provider ?? '-'} />
                                <InfoRow label="Status AI" value={active ? '✅ Aktif' : '⛔ Nonaktif'} />
                                <InfoRow label="API Key" value={apiKey ? '🔑 Dikonfigurasi' : '–'} />
                            </div>
                        </div>

                        {/* AI Preview */}
                        <div className="card bg-gradient-to-br from-violet-50 to-indigo-50 border-violet-100">
                            <div className="flex items-center space-x-3 mb-3">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                                    <Sparkles size={15} className="text-white" />
                                </div>
                                <p className="text-sm font-bold text-violet-800">Pratinjau Tombol AI</p>
                            </div>
                            <p className="text-xs text-violet-600 mb-3">Tombol ini akan muncul di semua form input data:</p>
                            <button type="button" className="btn-ai pointer-events-none w-full justify-center">
                                <Sparkles size={13} />
                                <span>Bantuan AI ({selectedModel?.label})</span>
                            </button>
                        </div>

                        {/* Save Button */}
                        <button type="submit" disabled={saving}
                            className="w-full py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-indigo-500/30 flex items-center justify-center space-x-2 disabled:opacity-60">
                            {saving
                                ? <><Loader2 size={16} className="animate-spin" /><span>Menyimpan...</span></>
                                : saved
                                    ? <><CheckCircle2 size={16} /><span>Tersimpan!</span></>
                                    : <><Save size={16} /><span>Simpan Konfigurasi</span></>}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between text-sm border-b border-slate-50 pb-2.5 last:border-0 last:pb-0">
            <span className="text-slate-500 text-xs">{label}</span>
            <span className="text-slate-700 font-medium text-xs">{value}</span>
        </div>
    );
}
