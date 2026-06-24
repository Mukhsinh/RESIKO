import Sidebar from '@/components/Sidebar';
import AppFooter from '@/components/AppFooter';
import AppHeader from '@/components/AppHeader';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <AppHeader />
                {/* Page Content */}
                <div className="flex-1 p-6 md:p-8 overflow-y-auto">
                    {children}
                    <AppFooter />
                </div>
            </main>
        </div>
    );
}
