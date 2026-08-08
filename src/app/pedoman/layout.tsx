'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import Sidebar from '@/components/Sidebar';
import AppFooter from '@/components/AppFooter';
import AppHeader from '@/components/AppHeader';
import { Loader2 } from 'lucide-react';

export default function SubLayout({ children }: { children: React.ReactNode }) {
  const { authenticated, loading: authLoading } = useAuthGuard();
  const { profile, loading: profileLoading } = useUserProfile();
  const router = useRouter();

  useEffect(() => {
    if (!profileLoading && profile && profile.role === 'user_unit') {
      router.replace('/dashboard');
    }
  }, [profile, profileLoading, router]);

  if (authLoading || !authenticated || profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-[#137fec]" />
          <p className="text-sm text-slate-400 font-medium">Memuat...</p>
        </div>
      </div>
    );
  }

  if (profile && profile.role === 'user_unit') {
    return null;
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader />
        <div className="flex-1 p-6 md:p-8 overflow-y-auto">
          {children}
          <AppFooter />
        </div>
      </main>
    </div>
  );
}
