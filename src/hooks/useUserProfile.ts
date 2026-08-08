'use client';

import { useAuth } from '@/context/AuthContext';
export type { UserProfile } from '@/context/AuthContext';

/**
 * Hook to access user profile from centralized AuthContext.
 * Zero redundant API calls or network requests.
 */
export function useUserProfile() {
    const { profile, isLoading, refreshProfile } = useAuth();
    return { profile, loading: isLoading, refreshProfile };
}
