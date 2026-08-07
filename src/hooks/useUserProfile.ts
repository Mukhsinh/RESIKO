'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface UserProfile {
    id: string;
    email: string;
    full_name: string;
    role: string;
    unit_kerja_id: string | null;
    unit_kerja_name?: string;
}

// Module-level Singletons to prevent concurrent calls to supabase.auth.getUser()
let cachedProfile: UserProfile | null = null;
let profileLoading = true;
let fetchPromise: Promise<UserProfile | null> | null = null;
const listeners = new Set<(state: { profile: UserProfile | null; loading: boolean }) => void>();

function notifyListeners() {
    listeners.forEach(listener => listener({ profile: cachedProfile, loading: profileLoading }));
}

async function fetchProfileData(): Promise<UserProfile | null> {
    try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError) {
            const errMsg = (userError.message || '').toLowerCase();
            if (errMsg.includes('refresh token') || userError.status === 400 || userError.name === 'AuthApiError') {
                console.warn('Invalid refresh token detected. Purging stale auth token...');
                cachedProfile = null;
                if (typeof window !== 'undefined') {
                    localStorage.removeItem('user_profile_cache');
                    document.cookie = 'sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
                }
            }
        }

        if (user) {
            const { data: profileData, error } = await supabase
                .from('profiles')
                .select('id, role, unit_kerja_id')
                .eq('id', user.id)
                .single();

            if (profileData && !error) {
                let unitName = 'Semua Unit';
                if (profileData.unit_kerja_id) {
                    const { data: unit } = await supabase
                        .from('unit_kerja')
                        .select('nama_unit')
                        .eq('id', profileData.unit_kerja_id)
                        .single();
                    if (unit) unitName = unit.nama_unit;
                }

                const newProfile: UserProfile = {
                    id: user.id,
                    email: user.email || '',
                    full_name: user.email || 'User',
                    role: profileData.role || 'user',
                    unit_kerja_id: profileData.unit_kerja_id,
                    unit_kerja_name: unitName
                };

                cachedProfile = newProfile;
                profileLoading = false;
                if (typeof window !== 'undefined') {
                    localStorage.setItem('user_profile_cache', JSON.stringify(newProfile));
                }
                notifyListeners();
                return newProfile;
            }
        }
        profileLoading = false;
        notifyListeners();
        return null;
    } catch (e: any) {
        const errMsg = (e?.message || '').toLowerCase();
        if (errMsg.includes('refresh token')) {
            cachedProfile = null;
            if (typeof window !== 'undefined') {
                localStorage.removeItem('user_profile_cache');
                document.cookie = 'sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
            }
        }
        profileLoading = false;
        notifyListeners();
        return null;
    }
}

export function useUserProfile() {
    const [state, setState] = useState(() => ({
        profile: cachedProfile,
        loading: profileLoading
    }));

    useEffect(() => {
        // Hydrate from localStorage first if cachedProfile isn't already set
        if (!cachedProfile) {
            try {
                const saved = localStorage.getItem('user_profile_cache');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    cachedProfile = parsed;
                    profileLoading = false;
                    setState({ profile: parsed, loading: false });
                }
            } catch (e) {
                console.error('Failed to parse cached profile', e);
            }
        }

        const listener = (newState: { profile: UserProfile | null; loading: boolean }) => {
            setState(newState);
        };
        listeners.add(listener);

        // Initiate the fetch only once
        if (!fetchPromise) {
            fetchPromise = fetchProfileData();
        } else if (!profileLoading) {
            // If already complete, sync state
            setState({ profile: cachedProfile, loading: false });
        }

        return () => {
            listeners.delete(listener);
        };
    }, []);

    return { profile: state.profile, loading: state.loading };
}

