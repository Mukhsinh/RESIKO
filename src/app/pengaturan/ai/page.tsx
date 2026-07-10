'use client';

import React, { useEffect, useState } from 'react';
import { supabase, type PengaturanAI } from '@/lib/supabase';
import { Brain, Save, Loader2, CheckCircle2, Sparkles, Key, Cpu, ShieldAlert, BookOpen } from 'lucide-react';

const AI_OPTIONS = [
    { value: 'openai', label: 'OpenAI (GPT-4o)', provider: 'OpenAI', desc: 'Menggunakan API resmi OpenAI GPT-4o untuk respons analitis cepat.' },
    { value: 'gemini', label: 'Google Gemini', provider: 'Google DeepMind', desc: 'Menggunakan API Google Gemini 1.5 untuk analisis data terstruktur.' },
    { value: 'openrouter', label: 'OpenRouter (GPT-4o)', provider: 'OpenRouter', desc: 'Menggunakan router multi-model OpenAI GPT-4o via API OpenRouter.' },
    { value: 'auto', label: 'Auto (Failover)', provider: 'Multi-Provider', desc: 'Mulai dari OpenAI. Jika kuota habis, berpindah otomatis ke Gemini, lalu OpenRouter.' },
];

export default function PengaturanAIPage() {
    const [config, setConfig] = useState<PengaturanAI | null>(null);
    const [model, setModel] = useState('openai');
    const [active, setActive] = useState(true);

    // API Keys
    const [openaiKey, setOpenaiKey] = useState('');
    const [geminiKey, setGeminiKey] = useState('');
    const [openrouterKey, setOpenrouterKey] = useState('');
    const [systemPrompt, setSystemPrompt] = useState('Kamu adalah asisten manajemen risiko rumah sakit yang profesional. Berikan saran yang logis, hemat biaya, dan realistis untuk mitigasi risiko.');

    // Grounding Contexts
    const [jangkarData, setJangkarData] = useState('');
    const [kunciPintuKeluar, setKunciPintuKeluar] = useState('');
    const [spesifikasiOutput, setSpesifikasiOutput] = useState('');
    const [temaLokus, setTemaLokus] = useState('');
    const [sumberInformasi, setSumberInformasi] = useState('');
    const [unitKerja, setUnitKerja] = useState('');
    const [organisasi, setOrganisasi] = useState('');

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        supabase.from('pengaturan_ai').select('*').limit(1).single().then(({ data, error }: { data: any; error: any }) => {
            if (data) {
                const d = data as PengaturanAI;
                setConfig(d);
                setModel(d.model_ai_terpilih ?? 'openai');
                setActive(d.aktif);
                const extra = d.konfigurasi_tambahan as Record<string, string>;
                if (extra) {
                    setOpenaiKey(extra.openai_key || '');
                    setGeminiKey(extra.gemini_key || '');
                    setOpenrouterKey(extra.openrouter_key || '');
                    setSystemPrompt(extra.system_prompt || '');
                    setJangkarData(extra.jangkar_data || '');
                    setKunciPintuKeluar(extra.kunci_pintu_keluar || '');
                    setSpesifikasiOutput(extra.spesifikasi_output || '');
                    setTemaLokus(extra.tema_lokus || '');
                    setSumberInformasi(extra.sumber_informasi || '');
                    setUnitKerja(extra.unit_kerja || '');
                    setOrganisasi(extra.organisasi || '');
                }
            } else if (error && error.code !== 'PGRST116') {
                console.error("Gagal memuat pengaturan:", error);
            }
            setLoading(false);
        });
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        const payload = {
            model_ai_terpilih: model,
            konfigurasi_tambahan: {
                openai_key: openaiKey,
                gemini_key: geminiKey,
                openrouter_key: openrouterKey,
                system_prompt: systemPrompt,
                jangkar_data: jangkarData,
                kunci_pintu_keluar: kunciPintuKeluar,
                spesifikasi_output: spesifikasiOutput,
                tema_lokus: temaLokus,
                sumber_informasi: sumberInformasi,
                unit_kerja: unitKerja,
                organisasi: organisasi
            },
            aktif: active,
            updated_at: new Date().toISOString(),
        };

        let errObj = null;
        if (config?.id) {
            const { error } = await supabase.from('pengaturan_ai').update(payload).eq('id', config.id);
            errObj = error;
        } else {
            const { data, error } = await supabase.from('pengaturan_ai').insert(payload).select().single();
            if (data) setConfig(data as PengaturanAI);
            errObj = error;
        }

        if (errObj) {
            console.error("Gagal menyimpan:", errObj);
            alert("Gagal menyimpan pengaturan: " + errObj.message);
        } else {
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        }
        setSaving(false);
    };

    const selectedOption = AI_OPTIONS.find(m => m.value === model) || AI_OPTIONS[0];

    return (
        <div>
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-md shadow-indigo-500/30">
                        <Brain size={22} className="text-white" />
                    </div>
                    Pengaturan AI
                </h1>
                <p className="text-sm text-slate-500 mt-1 ml-14">
                    Konfigurasi model AI, API keys, dan parameter konteks grounding untuk saran mitigasi yang akurat.
                </p>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20 text-slate-400">
                    <div className="animate-spin w-6 h-6 border-2 border-slate-200 border-t-[#137fec] rounded-full mr-3" />
                    <span className="text-sm">Memuat konfigurasi...</span>
                </div>
            ) : (
                <form onSubmit={handleSave} className="grid grid-cols-1 xl:grid-cols-3 gap-6 animate-fadeIn">

                    {/* Left & Center: Configuration Options */}
                    <div className="xl:col-span-2 space-y-6">

                        {/* Toggle Active status */}
                        <div className="card flex items-center justify-between p-5 bg-white border border-slate-100 rounded-2xl shadow-sm">
                            <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
                                    <Sparkles size={20} className="text-violet-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-slate-700">Aktifkan Fitur Bantuan AI</p>
                                    <p className="text-xs text-slate-400">Tampilkan tombol AI pada form input di seluruh module</p>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={active} onChange={e => setActive(e.target.checked)} />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
                            </label>
                        </div>

                        {/* Model Selection */}
                        <div className="card p-6 bg-white border border-slate-100 rounded-2xl shadow-sm">
                            <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                                <Cpu size={16} className="text-indigo-500" /> Pilih Provider AI
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {AI_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => setModel(opt.value)}
                                        className={`flex flex-col items-start text-left p-4 rounded-xl border-2 transition-all duration-200
                                            ${model === opt.value
                                                ? 'border-violet-500 bg-violet-50'
                                                : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'}`}
                                    >
                                        <div className="flex items-center justify-between w-full mb-1">
                                            <span className="text-sm font-semibold text-slate-800">{opt.label}</span>
                                            {model === opt.value && <CheckCircle2 size={16} className="text-violet-600 shrink-0" />}
                                        </div>
                                        <span className="text-[10px] font-medium text-violet-600 bg-violet-100 px-2 py-0.5 rounded-full mb-2">
                                            {opt.provider}
                                        </span>
                                        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{opt.desc}</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* API Keys Configuration */}
                        <div className="card p-6 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-4">
                            <h3 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                                <Key size={16} className="text-amber-500" /> Konfigurasi API Keys
                            </h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-semibold text-slate-600 block mb-1">OpenAI API Key</label>
                                    <input
                                        type="password"
                                        className="form-input w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-violet-600"
                                        value={openaiKey}
                                        onChange={e => setOpenaiKey(e.target.value)}
                                        placeholder="sk-proj-..."
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-600 block mb-1">Gemini API Key</label>
                                    <input
                                        type="password"
                                        className="form-input w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-violet-600"
                                        value={geminiKey}
                                        onChange={e => setGeminiKey(e.target.value)}
                                        placeholder="AIzaSy..."
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-600 block mb-1">OpenRouter API Key</label>
                                    <input
                                        type="password"
                                        className="form-input w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-violet-600"
                                        value={openrouterKey}
                                        onChange={e => setOpenrouterKey(e.target.value)}
                                        placeholder="sk-or-v1-..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Grounding Context */}
                        <div className="card p-6 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-4">
                            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                <BookOpen size={16} className="text-teal-500" /> Pengaturan Konteks Grounding & Batasan AI
                            </h3>
                            <p className="text-xs text-slate-400 mb-3">
                                Berikan rincian konteks agar asisten AI dapat memformulasikan rekomendasi yang presisi dan menghindari halusinasi.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-semibold text-slate-600 block mb-1">Jangkar Data (Grounding / Acuan Dokumen)</label>
                                        <textarea
                                            rows={3}
                                            className="form-input w-full px-3 py-2 border border-slate-200 rounded-lg text-xs resize-none focus:outline-none"
                                            value={jangkarData}
                                            onChange={e => setJangkarData(e.target.value)}
                                            placeholder="Contoh: Lampiran Standar Akreditasi KARS v1.2, Kebijakan Keselamatan Pasien RS..."
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-slate-600 block mb-1">Kunci Pintu Keluar (Constraint / Batasan Solusi)</label>
                                        <textarea
                                            rows={3}
                                            className="form-input w-full px-3 py-2 border border-slate-200 rounded-lg text-xs resize-none focus:outline-none"
                                            value={kunciPintuKeluar}
                                            onChange={e => setKunciPintuKeluar(e.target.value)}
                                            placeholder="Contoh: Solusi harus berbiaya rendah, tidak boleh merekrut staf baru, durasi pengerjaan < 3 bulan..."
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-slate-600 block mb-1">Spesifikasi Output (Format Keluaran)</label>
                                        <textarea
                                            rows={3}
                                            className="form-input w-full px-3 py-2 border border-slate-200 rounded-lg text-xs resize-none focus:outline-none"
                                            value={spesifikasiOutput}
                                            onChange={e => setSpesifikasiOutput(e.target.value)}
                                            placeholder="Contoh: Berupa poin terstruktur, menggunakan bahasa Indonesia baku, diawali dengan verba tindakan..."
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-semibold text-slate-600 block mb-1">Tema dan Lokus Pembahasan (Ruang Lingkup)</label>
                                        <textarea
                                            rows={2}
                                            className="form-input w-full px-3 py-2 border border-slate-200 rounded-lg text-xs resize-none focus:outline-none"
                                            value={temaLokus}
                                            onChange={e => setTemaLokus(e.target.value)}
                                            placeholder="Contoh: Mutu pelayanan medis dan keselamatan pasien di Instalasi Gawat Darurat (IGD)..."
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-slate-600 block mb-1">Sumber Informasi / Referensi Utama</label>
                                        <textarea
                                            rows={2}
                                            className="form-input w-full px-3 py-2 border border-slate-200 rounded-lg text-xs resize-none focus:outline-none"
                                            value={sumberInformasi}
                                            onChange={e => setSumberInformasi(e.target.value)}
                                            placeholder="Contoh: data insiden keselamatan pasien 2025, standar WHO Patient Safety..."
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-slate-600 block mb-1">Unit Kerja Sasaran</label>
                                        <input
                                            type="text"
                                            className="form-input w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none"
                                            value={unitKerja}
                                            onChange={e => setUnitKerja(e.target.value)}
                                            placeholder="Contoh: Instalasi ICU, Farmasi, Keperawatan..."
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-slate-600 block mb-1">Organisasi dan Nilai Inti</label>
                                        <input
                                            type="text"
                                            className="form-input w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none"
                                            value={organisasi}
                                            onChange={e => setOrganisasi(e.target.value)}
                                            placeholder="Contoh: Rumah Sakit Umum Antigravity, Nilai: EMPATI..."
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* System Prompt / Base Instruction */}
                        <div className="card p-6 bg-white border border-slate-100 rounded-2xl shadow-sm">
                            <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                                <Brain size={16} className="text-violet-500" /> Instruksi Dasar Sistem (System Prompt)
                            </h3>
                            <textarea
                                rows={4}
                                className="form-input w-full px-3 py-2 border border-slate-200 rounded-lg text-xs resize-none focus:outline-none"
                                value={systemPrompt}
                                onChange={e => setSystemPrompt(e.target.value)}
                                placeholder="Masukkan system prompt umum..."
                            />
                        </div>
                    </div>

                    {/* Right: Sidebar & Save Button */}
                    <div className="space-y-6">

                        {/* Configuration Status Card */}
                        <div className="card p-5 bg-white border border-slate-100 rounded-2xl shadow-sm">
                            <h3 className="text-sm font-bold text-slate-700 mb-4">Status Konfigurasi</h3>
                            <div className="space-y-3">
                                <InfoRow label="Model Aktif" value={selectedOption.label} />
                                <InfoRow label="Provider Utama" value={selectedOption.provider} />
                                <InfoRow label="Status Fitur AI" value={active ? '✅ Aktif' : '⛔ Nonaktif'} />
                                <InfoRow label="OpenAI Key" value={openaiKey ? '🔑 Terpasang' : '–'} />
                                <InfoRow label="Gemini Key" value={geminiKey ? '🔑 Terpasang' : '–'} />
                                <InfoRow label="OpenRouter Key" value={openrouterKey ? '🔑 Terpasang' : '–'} />
                            </div>
                        </div>

                        {/* Info / Safety Guard Alert */}
                        <div className="card p-5 bg-gradient-to-br from-amber-50 to-orange-50 border-amber-100 rounded-2xl shadow-sm">
                            <div className="flex items-center space-x-3 mb-3 text-amber-800">
                                <ShieldAlert size={18} />
                                <p className="text-xs font-bold">Catatan Failover Otomatis</p>
                            </div>
                            <p className="text-[11px] text-amber-700 leading-relaxed">
                                Mode Auto akan memprioritaskan API OpenAI. Jika terjadi <strong>limit kuota (error 429)</strong> atau response error lainnya, sistem secara cerdas akan mengalihkan request secara realtime ke Gemini, lalu ke OpenRouter sebagai fallback terakhir.
                            </p>
                        </div>

                        {/* Preview / Simulated AI trigger */}
                        <div className="card p-5 bg-violet-50/50 border-violet-100 rounded-2xl shadow-sm">
                            <div className="flex items-center space-x-3 mb-3 text-violet-800">
                                <Sparkles size={16} />
                                <p className="text-xs font-bold">Pratinjau Tombol Bantuan</p>
                            </div>
                            <button type="button" className="btn-ai pointer-events-none w-full justify-center text-xs py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-lg flex items-center gap-1.5 shadow-sm">
                                <Sparkles size={12} />
                                <span>Bantuan AI ({selectedOption.value === 'auto' ? 'Auto' : selectedOption.provider})</span>
                            </button>
                        </div>

                        {/* Submit Save */}
                        <button type="submit" disabled={saving}
                            className="w-full py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold rounded-xl text-sm transition-all shadow-md shadow-indigo-500/20 flex items-center justify-center space-x-2 disabled:opacity-60">
                            {saving ? (
                                <><Loader2 size={16} className="animate-spin" /><span>Menyimpan...</span></>
                            ) : saved ? (
                                <><CheckCircle2 size={16} /><span>Tersimpan!</span></>
                            ) : (
                                <><Save size={16} /><span>Simpan Konfigurasi</span></>
                            )}
                        </button>

                    </div>
                </form>
            )}
        </div>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between text-xs border-b border-slate-50 pb-2.5 last:border-0 last:pb-0">
            <span className="text-slate-500">{label}</span>
            <span className="text-slate-700 font-semibold">{value}</span>
        </div>
    );
}
