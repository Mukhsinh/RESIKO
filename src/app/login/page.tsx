'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ShieldAlert, Eye, EyeOff, Loader2, MessageCircle } from 'lucide-react';
import { useAppSettings } from '@/hooks/useAppSettings';

export default function LoginPage() {
    const { settings, loading: settingsLoading } = useAppSettings();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            setError(error.message === 'Invalid login credentials'
                ? 'Email atau kata sandi tidak valid.'
                : error.message);
            setLoading(false);
        } else {
            window.location.href = '/dashboard';
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 relative overflow-hidden">
            {/* Background decorative orbs */}
            <div className="absolute top-1/4 -left-40 w-96 h-96 bg-[#137fec]/5 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-1/4 -right-40 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 w-full max-w-md px-4">
                {/* Card */}
                <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-2xl shadow-slate-200/50">
                    {/* Logo */}
                    <div className="flex flex-col items-center mb-8">
                        {settings?.logo_url ? (
                            <div className="w-20 h-20 rounded-2xl bg-white flex items-center justify-center p-2 shadow-lg shadow-blue-500/10 mb-4 border border-slate-100 overflow-hidden">
                                <img src={settings.logo_url} alt="Logo" className="max-w-full max-h-full object-contain" />
                            </div>
                        ) : (
                            <div className="w-20 h-20 rounded-2xl bg-[#137fec] flex items-center justify-center shadow-lg shadow-blue-500/30 mb-4">
                                <ShieldAlert size={32} className="text-white" />
                            </div>
                        )}
                        <h1 className="text-2xl font-black text-slate-800 text-center leading-tight">
                            {settings?.nama_rs || 'RSUD Bendan'}
                        </h1>
                        <p className="text-[#137fec] font-extrabold text-xs mt-2 uppercase tracking-[0.3em]">
                            {settings?.nama_aplikasi || 'PINTAR MR'}
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-600 mb-1.5">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="nama@rsud.go.id"
                                required
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#137fec]/40 focus:border-[#137fec] transition-all shadow-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-600 mb-1.5">Kata Sandi</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    className="w-full px-4 py-3 pr-12 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#137fec]/40 focus:border-[#137fec] transition-all shadow-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#137fec]"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="flex items-center space-x-2 px-4 py-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-sm">
                                <span>⚠️</span><span>{error}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 bg-[#137fec] hover:bg-[#0f63ba] text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-blue-500/20 disabled:opacity-60 flex items-center justify-center space-x-2 active:scale-95"
                        >
                            {loading ? <><Loader2 size={18} className="animate-spin" /><span>Memverifikasi...</span></> : <span>Masuk ke Dashboard</span>}
                        </button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col items-center">
                        <p className="text-slate-400 text-[11px] mb-3 font-medium italic">Butuh bantuan akses?</p>
                        <a
                            href="https://wa.me/6285726112001?text=Halo%20Admin%2C%20saya%20butuh%20bantuan%20untuk%20login%20PINTAR%20MR"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center space-x-2 px-6 py-2.5 bg-emerald-50 text-emerald-600 rounded-full text-xs font-black hover:bg-emerald-600 hover:text-white transition-all duration-300 border border-emerald-200/50 shadow-sm"
                        >
                            <MessageCircle size={14} />
                            <span>Hubungi Admin via WhatsApp</span>
                        </a>
                    </div>

                    <p className="text-center text-slate-400 text-[9px] mt-8 px-4 leading-relaxed font-semibold uppercase tracking-widest opacity-60">
                        Pintar-MR@2026. Mukhsin Hadi. All right Reserved
                    </p>
                </div>
            </div>
        </div>
    );
}
