import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const isBrowser = typeof window !== 'undefined';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: isBrowser ? {
            getItem: (key) => {
                const match = document.cookie.match(new RegExp('(^| )' + key + '=([^;]+)'));
                return match ? decodeURIComponent(match[2]) : null;
            },
            setItem: (key, value) => {
                document.cookie = `${key}=${encodeURIComponent(value)}; path=/; max-age=31536000; SameSite=Lax`;
            },
            removeItem: (key) => {
                document.cookie = `${key}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
            }
        } : undefined,
        storageKey: 'sb-access-token',
    }
});

export type UserRole = 'superadmin' | 'user_unit';

export interface Profile {
    id: string;
    email: string;
    role: UserRole;
    unit_kerja_id: string | null;
    created_at: string;
}

export interface UnitKerja {
    id: string;
    nama_unit: string;
    created_at: string;
}

export interface TahunAnggaran {
    id: string;
    tahun: number;
    keterangan: string;
    aktif: boolean;
    created_at: string;
}

export interface ManajemenRisiko {
    id: string;
    unit_kerja_id: string;
    tahun: number;
    identifikasi_risiko: string;
    probabilitas: number;
    dampak: number;
    skor_risiko: number;
    mitigasi: string | null;
    status: string;
    created_at: string;
    unit_kerja?: UnitKerja;
}

export interface ManajemenStrategi {
    id: string;
    unit_kerja_id: string;
    tahun: number;
    sasaran_strategis: string;
    kpi: string;
    target: string;
    realisasi: string;
    created_at: string;
    unit_kerja?: UnitKerja;
}

export interface PengaturanAI {
    id: string;
    model_ai_terpilih: string;
    konfigurasi_tambahan: Record<string, unknown>;
    aktif: boolean;
    updated_at: string;
}
