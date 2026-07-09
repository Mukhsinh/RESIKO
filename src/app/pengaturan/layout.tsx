'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUserProfile } from '@/hooks/useUserProfile';
import Sidebar from '@/components/Sidebar';
import AppFooter from '@/components/AppFooter';
import AppHeader from '@/components/AppHeader';

export default function SubLayout({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useUserProfile();
  const router = useRouter();

  useEffect(() => {
    if (!loading && profile && profile.role === 'user_unit') {
      router.replace('/dashboard');
    }
  }, [profile, loading, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
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
