import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ManRisk RS - Manajemen Strategi & Risiko Rumah Sakit',
  description: 'Sistem Manajemen Strategi dan Risiko terintegrasi untuk Rumah Sakit berbasis Supabase.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
