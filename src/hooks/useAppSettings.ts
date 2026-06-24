'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface AppSettings {
    nama_aplikasi: string;
    nama_rs: string;
    logo_url: string;
    footer: string;
    warna_primer: string;
}

const CACHE_KEY = 'app_branding_settings';

export function useAppSettings() {
    const [settings, setSettings] = useState<AppSettings>({
        nama_aplikasi: 'ManRisk',
        nama_rs: 'Rumah Sakit',
        logo_url: '',
        footer: '© 2026 RSUD · Sistem Manajemen Risiko Terintegrasi',
        warna_primer: '#137fec',
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // 1. Initial hydration from localStorage
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            try {
                setSettings(JSON.parse(cached));
            } catch (e) {
                console.error('Failed to parse cached settings', e);
            }
        }

        // 2. Fetch fresh data from Supabase
        const fetchSettings = async () => {
            try {
                const { data, error } = await supabase
                    .from('app_settings')
                    .select('nama_aplikasi, nama_rs, logo_url, footer, warna_primer')
                    .limit(1)
                    .single();

                if (data && !error) {
                    const newSettings: AppSettings = {
                        nama_aplikasi: data.nama_aplikasi || 'ManRisk',
                        nama_rs: data.nama_rs || 'Rumah Sakit',
                        logo_url: data.logo_url || '',
                        footer: data.footer || '© 2026 RSUD · Sistem Manajemen Risiko Terintegrasi',
                        warna_primer: data.warna_primer || '#137fec',
                    };
                    setSettings(newSettings);
                    localStorage.setItem(CACHE_KEY, JSON.stringify(newSettings));
                }
            } catch (e) {
                console.error('Error fetching app settings', e);
            } finally {
                setLoading(false);
            }
        };

        fetchSettings();
    }, []);

    return { settings, loading };
}
