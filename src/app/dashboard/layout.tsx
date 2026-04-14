'use client';

import { useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { supabase } from '@/lib/supabase';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const [userName, setUserName] = useState<string>('');
    const [userRole, setUserRole] = useState<string>('');

    useEffect(() => {
        const fetchUserProfile = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            
            if (user) {
                const { data: profile } = await supabase
                    .from('user_profiles')
                    .select('full_name, role')
                    .eq('id', user.id)
                    .single();
                
                if (profile) {
                    setUserName(profile.full_name || user.email || 'User');
                    setUserRole(profile.role || 'user');
                }
            }
        };

        fetchUserProfile();
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.href = '/login';
    };

    return (
        <div className="flex min-h-screen bg-slate-50">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0">
                {/* Top Bar */}
                <header className="sticky top-0 z-20 bg-white border-b border-slate-100 px-6 py-3.5 flex items-center justify-between shadow-sm">
                    <div className="ml-10 md:ml-0">
                        <h2 className="text-base font-semibold text-slate-700">Sistem Manajemen Rumah Sakit</h2>
                        <p className="text-xs text-slate-400">Selamat Datang di ManRisk RS</p>
                    </div>
                    <div className="flex items-center space-x-3">
                        <span className="text-xs bg-[#137fec]/10 text-[#137fec] font-semibold px-3 py-1.5 rounded-full border border-[#137fec]/20">
                            Tahun 2026
                        </span>
                        {userName && (
                            <div className="flex items-center space-x-2 px-3 py-1.5 bg-slate-50 rounded-full border border-slate-200">
                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#137fec] to-indigo-500 flex items-center justify-center text-white text-[10px] font-bold">
                                    {userName.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-xs font-semibold text-slate-700">{userName}</span>
                                    <span className="text-[10px] text-slate-400 capitalize">{userRole}</span>
                                </div>
                            </div>
                        )}
                        <button 
                            onClick={handleLogout}
                            className="flex items-center space-x-1.5 text-xs bg-rose-50 text-rose-600 font-medium px-3 py-1.5 rounded-full hover:bg-rose-100 transition-colors"
                        >
                            <LogOut size={14} />
                            <span>Logout</span>
                        </button>
                    </div>
                </header>
                {/* Page Content */}
                <div className="flex-1 p-6 md:p-8 overflow-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}
