import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';

export const metadata: Metadata = {
  title: 'ManRisk RS - Manajemen Strategi & Risiko Rumah Sakit',
  description: 'Sistem Manajemen Strategi dan Risiko terintegrasi untuk Rumah Sakit berbasis Supabase.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
