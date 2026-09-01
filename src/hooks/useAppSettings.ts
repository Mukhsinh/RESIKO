'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';

export interface AppSettings {
    nama_aplikasi: string;
    nama_rs: string;
    logo_url: string;
    footer: string;
    warna_primer: string;
    alamat?: string;
    kota?: string;
    telepon?: string;
    email?: string;
    website?: string;
    tagline?: string;
    kepala_rs?: string;
    nip_kepala?: string;
    jabatan_penandatangan_kiri?: string;
    nama_penandatangan_kiri?: string;
    tahun_mulai?: number;
    tahun_selesai?: number;
}

const CACHE_KEY = 'app_branding_settings';

export function useAppSettings(enabled: boolean = true) {
    const [settings, setSettings] = useState<AppSettings>({
        nama_aplikasi: 'ManRisk',
        nama_rs: 'Rumah Sakit',
        logo_url: '',
        footer: '© 2026 RSUD · Sistem Manajemen Risiko Terintegrasi',
        warna_primer: '#137fec',
        alamat: '',
        kota: '',
        telepon: '',
        email: '',
        website: '',
        tagline: '',
        kepala_rs: '',
        nip_kepala: '',
        jabatan_penandatangan_kiri: 'Penanggungjawab Unit',
        nama_penandatangan_kiri: 'Penanggungjawab Unit Kerja',
        tahun_mulai: 2026,
        tahun_selesai: 2029,
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

        if (!enabled) {
            setLoading(false);
            return;
        }

        // 2. Fetch fresh data from Supabase
        const fetchSettings = async () => {
            try {
                const { data, error } = await supabase
                    .from('app_settings')
                    .select('*')
                    .limit(1)
                    .maybeSingle();

                if (data && !error) {
                    const newSettings: AppSettings = {
                        nama_aplikasi: data.nama_aplikasi || 'ManRisk',
                        nama_rs: data.nama_rs || 'Rumah Sakit',
                        logo_url: data.logo_url || '',
                        footer: data.footer || '© 2026 RSUD · Sistem Manajemen Risiko Terintegrasi',
                        warna_primer: data.warna_primer || '#137fec',
                        alamat: data.alamat || '',
                        kota: data.kota || '',
                        telepon: data.telepon || '',
                        email: data.email || '',
                        website: data.website || '',
                        tagline: data.tagline || '',
                        kepala_rs: data.kepala_rs || '',
                        nip_kepala: data.nip_kepala || '',
                        jabatan_penandatangan_kiri: data.jabatan_penandatangan_kiri || 'Penanggungjawab Unit',
                        nama_penandatangan_kiri: data.nama_penandatangan_kiri || 'Penanggungjawab Unit Kerja',
                        tahun_mulai: data.tahun_mulai ? Number(data.tahun_mulai) : 2026,
                        tahun_selesai: data.tahun_selesai ? Number(data.tahun_selesai) : 2029,
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
    }, [enabled]);

    const yearsList = useMemo(() => {
        const startYr = settings.tahun_mulai || 2026;
        const endYr = settings.tahun_selesai || 2029;
        const list: number[] = [];
        for (let y = startYr; y <= endYr; y++) {
            list.push(y);
        }
        if (list.length === 0) {
            list.push(2026, 2027, 2028, 2029);
        }
        return list;
    }, [settings.tahun_mulai, settings.tahun_selesai]);

    return { settings, loading, yearsList };
}
