import React from 'react';

// Sebagai contoh struktur menggunakan Next.js / React
export default function WelcomeScreen() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 relative overflow-hidden">
            {/* Background Ornaments (Dynamic) */}
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-[#0F172A]/5 to-[#0891B2]/5 z-0" />

            {/* Glassmorphism Card */}
            <div className="z-10 bg-white/70 backdrop-blur-md border border-white/20 p-10 py-16 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] max-w-4xl w-full mx-4">

                <div className="flex flex-col items-center justify-center mb-12 text-center">
                    {/* Logo Placeholder */}
                    <div className="w-16 h-16 bg-gradient-to-tr from-[#0F172A] to-[#0891B2] rounded-xl shadow-lg mb-6 flex items-center justify-center">
                        <span className="text-white font-bold text-2xl tracking-tighter">RS</span>
                    </div>
                    <h1 className="text-4xl font-extrabold text-slate-800 tracking-tight">Manajemen Rumah Sakit</h1>
                    <p className="text-slate-500 mt-3 text-lg max-w-xl">
                        Sistem Informasi Strategi dan Resiko Terpadu. Silakan pilih modul untuk mengelola atau melihat data.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Tombol Manajemen Strategi */}
                    <button
                        type="button"
                        className="group relative flex flex-col items-center justify-center p-12 bg-white rounded-2xl shadow-sm border border-slate-200 hover:shadow-xl hover:border-[#0891B2]/50 transition-all duration-300 transform hover:-translate-y-2 overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#0891B2]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                        {/* Mengganti Lucide Icon dengan SVG agar dapat berjalan mandiri (Target Icon) */}
                        <div className="relative w-28 h-28 rounded-full bg-sky-50 flex items-center justify-center mb-6 group-hover:bg-[#0891B2] transition-colors duration-500 shadow-inner">
                            <svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#0891B2] group-hover:text-white transition-colors duration-500">
                                <circle cx="12" cy="12" r="10"></circle>
                                <circle cx="12" cy="12" r="6"></circle>
                                <circle cx="12" cy="12" r="2"></circle>
                            </svg>
                        </div>

                        <h2 className="text-2xl font-bold text-slate-800 mb-2">Manajemen Strategi</h2>
                        <p className="text-slate-500 text-sm text-center">Kelola, pantau KPI, dan sasaran strategis di tiap departemen/unit kerja.</p>
                    </button>

                    {/* Tombol Manajemen Resiko */}
                    <button
                        type="button"
                        className="group relative flex flex-col items-center justify-center p-12 bg-white rounded-2xl shadow-sm border border-slate-200 hover:shadow-xl hover:border-[#0F172A]/50 transition-all duration-300 transform hover:-translate-y-2 overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#0F172A]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                        {/* Shield/Alert Icon */}
                        <div className="relative w-28 h-28 rounded-full bg-slate-100 flex items-center justify-center mb-6 group-hover:bg-[#0F172A] transition-colors duration-500 shadow-inner">
                            <svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#0F172A] group-hover:text-white transition-colors duration-500">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                                <line x1="12" y1="8" x2="12" y2="12"></line>
                                <line x1="12" y1="16" x2="12.01" y2="16"></line>
                            </svg>
                        </div>

                        <h2 className="text-2xl font-bold text-slate-800 mb-2">Manajemen Resiko</h2>
                        <p className="text-slate-500 text-sm text-center">Identifikasi resiko, ukur dampak, dan mitigasi resiko operasional harian.</p>
                    </button>
                </div>
            </div>
        </div>
    );
}
