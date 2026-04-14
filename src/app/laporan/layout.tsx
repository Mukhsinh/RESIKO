import Sidebar from '@/components/Sidebar';

export default function SubLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-screen bg-slate-50">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0">
                <header className="sticky top-0 z-20 bg-white border-b border-slate-100 px-6 py-3.5 flex items-center justify-between shadow-sm">
                    <div className="ml-10 md:ml-0">
                        <h2 className="text-base font-semibold text-slate-700">Sistem Manajemen Rumah Sakit</h2>
                        <p className="text-xs text-slate-400">ManRisk RS</p>
                    </div>
                    <span className="text-xs bg-[#137fec]/10 text-[#137fec] font-semibold px-3 py-1.5 rounded-full border border-[#137fec]/20">
                        Tahun {new Date().getFullYear()}
                    </span>
                </header>
                <div className="flex-1 p-6 md:p-8 overflow-auto">{children}</div>
            </main>
        </div>
    );
}
