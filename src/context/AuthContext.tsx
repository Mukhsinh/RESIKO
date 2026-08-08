'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, purgeAuthStorage } from '@/lib/supabase';

export interface UserProfile {
    id: string;
    email: string;
    full_name: string;
    role: string;
    unit_kerja_id: string | null;
    unit_kerja_name?: string;
}

interface AuthContextType {
    session: Session | null;
    user: User | null;
    profile: UserProfile | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    logout: () => Promise<void>;
    refreshProfile: () => Promise<void>;
}

const PROFILE_CACHE_KEY = 'manrisk_user_profile_cache';

const AuthContext = createContext<AuthContextType>({
    session: null,
    user: null,
    profile: null,
    isAuthenticated: false,
    isLoading: true,
    logout: async () => { },
    refreshProfile: async () => { },
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(() => {
        if (typeof window !== 'undefined') {
            try {
                const saved = localStorage.getItem(PROFILE_CACHE_KEY);
                if (saved) return JSON.parse(saved);
            } catch { }
        }
        return null;
    });
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const initDone = useRef(false);

    const resetAuthState = useCallback(() => {
        setSession(null);
        setUser(null);
        setProfile(null);
        purgeAuthStorage();
        try { localStorage.removeItem(PROFILE_CACHE_KEY); } catch { }
    }, []);

    const loadProfileData = useCallback(async (userId: string, email: string): Promise<UserProfile | null> => {
        try {
            const { data: profileData, error: pErr } = await supabase
                .from('profiles')
                .select('id, role, unit_kerja_id')
                .eq('id', userId)
                .maybeSingle();

            if (pErr) console.warn('Profile fetch warning:', pErr.message);

            let unitName = 'Semua Unit';
            if (profileData?.unit_kerja_id) {
                const { data: unit } = await supabase
                    .from('unit_kerja')
                    .select('nama_unit')
                    .eq('id', profileData.unit_kerja_id)
                    .maybeSingle();
                if (unit) unitName = unit.nama_unit;
            }

            const newProfile: UserProfile = {
                id: userId,
                email: email,
                full_name: email || 'User',
                role: profileData?.role || 'user',
                unit_kerja_id: profileData?.unit_kerja_id || null,
                unit_kerja_name: unitName,
            };

            setProfile(newProfile);
            try {
                localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(newProfile));
            } catch { }
            return newProfile;
        } catch (err) {
            console.warn('Error loading user profile:', err);
            return null;
        }
    }, []);

    const refreshProfile = useCallback(async () => {
        if (user) {
            await loadProfileData(user.id, user.email || '');
        }
    }, [user, loadProfileData]);

    const logout = useCallback(async () => {
        resetAuthState();
        try {
            // Stop auto-refresh before signing out
            supabase.auth.stopAutoRefresh();
            await supabase.auth.signOut();
        } catch {
            // Safe fallback
        }
        if (typeof window !== 'undefined') {
            window.location.href = '/login';
        }
    }, [resetAuthState]);

    useEffect(() => {
        // Prevent double-init in React StrictMode
        if (initDone.current) return;
        initDone.current = true;

        let mounted = true;
        let subscription: { unsubscribe: () => void } | null = null;

        const initializeAuth = async () => {
            try {
                // 1. Fetch current session (which handles refresh token once if expired)
                const { data: { session: initialSession }, error } = await supabase.auth.getSession();

                if (!mounted) return;

                if (error) {
                    const is429 = error.status === 429
                        || error.message?.includes('rate limit')
                        || error.message?.includes('Request rate limit reached');

                    if (is429) {
                        // Rate limited - the stored refresh token is causing loops.
                        // Purge it directly from localStorage (don't call signOut which also hits API).
                        console.warn('Auth rate limited (429). Purging stale session from localStorage.');
                        resetAuthState();
                        setIsLoading(false);
                        return;
                    }

                    console.warn('Auth session error:', error.message);
                }

                if (initialSession) {
                    const isExpired = initialSession.expires_at
                        ? (initialSession.expires_at * 1000 < Date.now())
                        : true;

                    if (isExpired) {
                        console.warn('[AUTH] Stored session has expired and refresh failed. Purging and logging out.');
                        resetAuthState();
                    } else {
                        setSession(initialSession);
                        setUser(initialSession.user);
                        loadProfileData(initialSession.user.id, initialSession.user.email || '');

                        // Session is confirmed valid - NOW enable automatic token refresh
                        supabase.auth.startAutoRefresh();
                    }
                } else {
                    // No session exists, ensure storage is clean of invalid auth entries
                    resetAuthState();
                }
                setIsLoading(false);

                // 2. Register the state listener ONLY AFTER getSession is completely finished.
                // This guarantees we don't start parallel tokens refresh processes during initialization.
                const { data: { subscription: sub } } = supabase.auth.onAuthStateChange(
                    async (event, currentSession) => {
                        if (!mounted) return;

                        if (event === 'SIGNED_OUT' || !currentSession) {
                            supabase.auth.stopAutoRefresh();
                            resetAuthState();
                            setIsLoading(false);
                        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
                            setSession(currentSession);
                            setUser(currentSession.user);
                            if (currentSession.user) {
                                loadProfileData(currentSession.user.id, currentSession.user.email || '');
                            }
                            // Ensure auto-refresh is running after successful sign-in
                            supabase.auth.startAutoRefresh();
                            setIsLoading(false);
                        }
                    }
                );
                subscription = sub;

            } catch (err) {
                console.warn('Auth initialization failed:', err);
                if (mounted) {
                    // On any unexpected error, purge and reset gracefully
                    purgeAuthStorage();
                    setSession(null);
                    setUser(null);
                    setIsLoading(false);
                }
            }
        };

        initializeAuth();

        return () => {
            mounted = false;
            if (subscription) {
                subscription.unsubscribe();
            }
        };
    }, [loadProfileData]);

    const value = useMemo(() => ({
        session,
        user,
        profile,
        isAuthenticated: !!session && !!user,
        isLoading,
        logout,
        refreshProfile,
    }), [session, user, profile, isLoading, logout, refreshProfile]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
