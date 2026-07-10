'use client';

import React, { useEffect, useState } from 'react';
import { Sparkles, Check, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface FormInputAIProps {
    label: string;
    placeholder?: string;
    value: string;
    onChange: (val: string) => void;
    rows?: number;
}

export default function FormInputAI({ label, placeholder, value, onChange, rows = 3 }: FormInputAIProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [aiActive, setAiActive] = useState(true);
    const [activeModelName, setActiveModelName] = useState('AI Assistant');

    useEffect(() => {
        // Load global AI configuration directly from Supabase
        supabase.from('pengaturan_ai')
            .select('aktif, model_ai_terpilih')
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle()
            .then((result: any) => {
                const data = result.data;
                if (data) {
                    setAiActive(data.aktif);
                    const modelMap: Record<string, string> = {
                        openai: 'OpenAI (GPT-4o)',
                        gemini: 'Google Gemini',
                        openrouter: 'OpenRouter (GPT-4o)',
                        auto: 'Auto (Failover)',
                    };
                    setActiveModelName(modelMap[data.model_ai_terpilih] || data.model_ai_terpilih || 'AI Assistant');
                }
            });
    }, []);

    const handleAI = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const promptText = value.trim()
                ? `Konteks teks yang telah dimasukkan oleh pengguna: "${value}". Sempurnakan, detaiilkan, dan lengkapi deskripsi di atas berdasarkan kaidah manajemen risiko rumah sakit.`
                : 'Berikan rekomendasi lengkap dan awal berdasar kriteria form.';

            const response = await fetch('/api/ai/completion', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: promptText,
                    label: label,
                }),
            });

            const resJson = await response.json();

            if (!response.ok || !resJson.success) {
                throw new Error(resJson.error || resJson.detail || 'Gagal memanggil API AI.');
            }

            onChange(resJson.result);
            if (resJson.model_used) {
                setActiveModelName(resJson.model_used);
            }
        } catch (err: any) {
            console.error('Error generating AI recommendation:', err);
            setError(err.message || 'Terjadi kesalahan sistem.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full">
            <div className="flex items-center justify-between mb-1.5">
                <label className="form-label mb-0 font-medium text-slate-700 text-sm">{label}</label>
                {aiActive && (
                    <button
                        type="button"
                        onClick={handleAI}
                        disabled={isLoading}
                        className="btn-ai bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-lg text-xs py-1 px-3 flex items-center gap-1.5 shadow-sm shadow-indigo-500/10 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed select-none transition-all"
                    >
                        {isLoading ? (
                            <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        ) : (
                            <Sparkles size={12} />
                        )}
                        <span>{isLoading ? 'Menyusun...' : 'Bantuan AI'}</span>
                    </button>
                )}
            </div>

            <textarea
                rows={rows}
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                className="form-input w-full p-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-transparent text-sm text-slate-700 transition-all shadow-sm"
            />

            {error ? (
                <p className="text-[10px] text-rose-500 mt-1 flex items-center">
                    <AlertCircle size={11} className="mr-1 shrink-0" />
                    Error: {error}
                </p>
            ) : (
                aiActive && (
                    <p className="text-[10px] text-slate-400 mt-1 flex items-center">
                        <Check size={11} className="mr-1 text-emerald-500 shrink-0" />
                        AI didukung oleh {activeModelName} &middot; Teks dapat diedit sebelum disimpan
                    </p>
                )
            )}
        </div>
    );
}
