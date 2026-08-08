'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

/**
 * Client-side auth guard consuming centralized AuthContext.
 * Redirects to /login only after auth initialization completes and user is confirmed unauthenticated.
 */
export function useAuthGuard() {
    const { isAuthenticated, isLoading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
        }
    }, [isAuthenticated, isLoading, router, pathname]);

    return { authenticated: isAuthenticated, loading: isLoading };
}
