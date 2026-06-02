'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ShieldAlert, Eye, EyeOff, Loader2 } from 'lucide-react';

export default function LoginPage() {
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
                        <div className="w-16 h-16 rounded-2xl bg-[#137fec] flex items-center justify-center shadow-lg shadow-blue-500/30 mb-4">
                            <ShieldAlert size={32} className="text-white" />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-800">ManRisk RS</h1>
                        <p className="text-slate-500 text-sm mt-1">Sistem Manajemen Strategi & Risiko</p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1.5">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="nama@rsud.go.id"
                                required
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#137fec]/40 focus:border-[#137fec] transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1.5">Kata Sandi</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    className="w-full px-4 py-3 pr-12 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#137fec]/40 focus:border-[#137fec] transition-all"
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
                            className="w-full py-3 bg-[#137fec] hover:bg-[#0f63ba] text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-blue-500/20 disabled:opacity-60 flex items-center justify-center space-x-2"
                        >
                            {loading ? <><Loader2 size={18} className="animate-spin" /><span>Masuk...</span></> : <span>Masuk</span>}
                        </button>
                    </form>

                    <p className="text-center text-slate-400 text-xs mt-6">
                        &copy; 2026 RSUD · Sistem Manajemen Risiko Terintegrasi
                    </p>
                </div>
            </div>
        </div>
    );

}
