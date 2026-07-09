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

export function useUserProfile() {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    // Load cached profile from localStorage AFTER hydration
    useEffect(() => {
        try {
            const saved = localStorage.getItem('user_profile_cache');
            if (saved) {
                setProfile(JSON.parse(saved));
            }
        } catch (e) {
            console.error('Failed to parse cached profile', e);
        }
    }, []);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
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

                        setProfile(newProfile);
                        localStorage.setItem('user_profile_cache', JSON.stringify(newProfile));
                    }
                }
            } catch (e) {
                console.error('Error fetching user profile', e);
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, []);

    return { profile, loading };
}
