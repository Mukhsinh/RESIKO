'use client';

import React from 'react';
import { LogOut, Bell, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAppSettings } from '@/hooks/useAppSettings';
import { useUserProfile } from '@/hooks/useUserProfile';

export default function AppHeader() {
    const { settings } = useAppSettings();
    const { profile } = useUserProfile();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.href = '/login';
    };

    return (
        <header className="sticky top-0 z-20 bg-[#137fec] px-6 py-4 flex items-center justify-between shadow-xl shadow-blue-500/10 transition-colors duration-500">
            <div className="ml-10 md:ml-0 flex items-center space-x-5">
                <div className="flex flex-col">
                    <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-2">
                            <div className="w-2 h-6 bg-white/20 rounded-full hidden md:block"></div>
                            <h2 className="text-sm font-black text-white uppercase tracking-wider">
                                {settings.nama_aplikasi}
                            </h2>
                        </div>
                        <span className="h-4 w-[1px] bg-white/30 hidden md:block"></span>
                        <p className="text-[10px] text-blue-100 font-bold uppercase tracking-[0.2em] hidden md:block">
                            {settings.nama_rs} · Sistem Manajemen Strategi & Risiko
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex items-center space-x-4">
                <div className="hidden xl:flex items-center bg-white/10 rounded-full px-4 py-2 text-white border border-white/20 mr-2 focus-within:bg-white/20 transition-all">
                    <Search size={14} className="text-blue-100 mr-2" />
                    <input
                        type="text"
                        placeholder="Cari data..."
                        className="bg-transparent border-none outline-none text-xs placeholder:text-blue-100/50 w-32 focus:w-48 transition-all duration-300"
                    />
                </div>

                <button className="p-2 rounded-xl bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-colors relative group">
                    <Bell size={18} className="group-hover:scale-110 transition-transform" />
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-yellow-400 rounded-full border-2 border-[#137fec] animate-pulse"></span>
                </button>

                <div className="h-8 w-[1px] bg-white/20 mx-1"></div>

                {profile && (
                    <div className="flex items-center space-x-3 pl-1">
                        <div className="flex flex-col items-end hidden sm:flex">
                            <span className="text-xs font-bold text-white leading-none mb-1">{profile.full_name}</span>
                            <span className="text-[9px] text-blue-100 font-bold uppercase tracking-wider bg-white/10 px-2 py-0.5 rounded-full border border-white/10">{profile.role}</span>
                        </div>
                        <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-[#137fec] text-xs font-black shadow-lg shadow-black/10 border border-white/20 hover:scale-105 transition-transform cursor-pointer">
                            {profile.full_name.charAt(0).toUpperCase()}
                        </div>
                    </div>
                )}

                <button
                    onClick={handleLogout}
                    className="flex items-center justify-center w-9 h-9 bg-rose-500/20 text-rose-100 rounded-xl hover:bg-rose-500 hover:text-white transition-all duration-300 border border-rose-500/20 group"
                    title="Logout"
                >
                    <LogOut size={18} className="group-hover:translate-x-0.5 transition-transform" />
                </button>
            </div>
        </header>
    );
}
