-- 1. Tabel unit_kerja
CREATE TABLE IF NOT EXISTS public.unit_kerja (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nama_unit TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabel profiles (Extending auth.users)
-- Memerlukan foreign key ke auth.users (ID) dan unit_kerja (id)
CREATE TYPE role_type AS ENUM ('superadmin', 'user_unit');

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    email TEXT,
    role role_type NOT NULL DEFAULT 'user_unit',
    unit_kerja_id UUID REFERENCES public.unit_kerja(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Function untuk Auto insert profile saat user register via auth
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. Tabel manajemen_risiko
CREATE TABLE IF NOT EXISTS public.manajemen_risiko (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    unit_kerja_id UUID REFERENCES public.unit_kerja(id) ON DELETE CASCADE,
    tahun INTEGER NOT NULL,
    identifikasi_risiko TEXT NOT NULL,
    probabilitas INTEGER CHECK (probabilitas >= 1 AND probabilitas <= 5),
    dampak INTEGER CHECK (dampak >= 1 AND dampak <= 5),
    skor_risiko INTEGER GENERATED ALWAYS AS (probabilitas * dampak) STORED,
    mitigasi TEXT,
    status TEXT DEFAULT 'Open',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Tabel manajemen_strategi
CREATE TABLE IF NOT EXISTS public.manajemen_strategi (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    unit_kerja_id UUID REFERENCES public.unit_kerja(id) ON DELETE CASCADE,
    tahun INTEGER NOT NULL,
    sasaran_strategis TEXT NOT NULL,
    kpi TEXT NOT NULL,
    target TEXT NOT NULL,
    realisasi TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Tabel tahun_anggaran
CREATE TABLE IF NOT EXISTS public.tahun_anggaran (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tahun INTEGER NOT NULL UNIQUE,
    keterangan TEXT,
    aktif BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Tabel pengaturan_ai
CREATE TABLE IF NOT EXISTS public.pengaturan_ai (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    model_ai_terpilih TEXT NOT NULL DEFAULT 'gemini-1.5-pro',
    konfigurasi_tambahan JSONB DEFAULT '{}'::jsonb,
    aktif BOOLEAN DEFAULT true,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Tabel swot_inventarisasi
CREATE TABLE IF NOT EXISTS public.swot_inventarisasi (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    unit_kerja_id UUID REFERENCES public.unit_kerja(id) ON DELETE CASCADE,
    tahun INTEGER NOT NULL,
    kategori TEXT NOT NULL,
    deskripsi TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =================================================================================
-- ENABLE ROW LEVEL SECURITY
-- =================================================================================
ALTER TABLE public.unit_kerja ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manajemen_risiko ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manajemen_strategi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tahun_anggaran ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pengaturan_ai ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swot_inventarisasi ENABLE ROW LEVEL SECURITY;

-- =================================================================================
-- RLS POLICIES
-- =================================================================================

-- POLICY: SUPERADMIN AKSES SEMUA DATA
-- ---------------------------------------------------------------------------------
CREATE POLICY superadmin_all_unit_kerja ON public.unit_kerja 
FOR ALL TO authenticated USING ( (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superadmin' );

CREATE POLICY superadmin_all_profiles ON public.profiles 
FOR ALL TO authenticated USING ( (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superadmin' );

CREATE POLICY superadmin_all_manajemen_risiko ON public.manajemen_risiko 
FOR ALL TO authenticated USING ( (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superadmin' );

CREATE POLICY superadmin_all_manajemen_strategi ON public.manajemen_strategi 
FOR ALL TO authenticated USING ( (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superadmin' );

CREATE POLICY superadmin_all_tahun_anggaran ON public.tahun_anggaran 
FOR ALL TO authenticated USING ( (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superadmin' );

CREATE POLICY superadmin_all_pengaturan_ai ON public.pengaturan_ai 
FOR ALL TO authenticated USING ( (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superadmin' );

CREATE POLICY superadmin_all_swot_inventarisasi ON public.swot_inventarisasi
FOR ALL TO authenticated USING ( (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superadmin' );

-- POLICY: USER_UNIT AKSES HANYA DATA MILIK UNIT KERJANYA
-- ---------------------------------------------------------------------------------
-- Unit kerja: bisa dilihat (mungkin diperlukan untuk fetching dropdown)
CREATE POLICY user_unit_view_unit_kerja ON public.unit_kerja 
FOR SELECT TO authenticated USING (true);

-- Tahun anggaran: bisa dilihat oleh semua user
CREATE POLICY user_unit_view_tahun_anggaran ON public.tahun_anggaran 
FOR SELECT TO authenticated USING (true);

-- Pengaturan AI: user biasa bisa membaca pengaturan AI asalkan aktif
CREATE POLICY user_unit_view_pengaturan_ai ON public.pengaturan_ai 
FOR SELECT TO authenticated USING (aktif = true);

-- Profiles: bisa melihat profilnya sendiri atau profil di unitnya
CREATE POLICY user_unit_view_profiles ON public.profiles 
FOR SELECT TO authenticated USING ( id = auth.uid() OR unit_kerja_id = (SELECT unit_kerja_id FROM public.profiles WHERE id = auth.uid()) );

-- Manajemen Risiko: SELECT, INSERT, UPDATE hanya pada unitnya
CREATE POLICY user_unit_select_risiko ON public.manajemen_risiko 
FOR SELECT TO authenticated USING ( unit_kerja_id = (SELECT unit_kerja_id FROM public.profiles WHERE id = auth.uid()) );

CREATE POLICY user_unit_insert_risiko ON public.manajemen_risiko 
FOR INSERT TO authenticated WITH CHECK ( unit_kerja_id = (SELECT unit_kerja_id FROM public.profiles WHERE id = auth.uid()) );

CREATE POLICY user_unit_update_risiko ON public.manajemen_risiko 
FOR UPDATE TO authenticated USING ( unit_kerja_id = (SELECT unit_kerja_id FROM public.profiles WHERE id = auth.uid()) )
WITH CHECK ( unit_kerja_id = (SELECT unit_kerja_id FROM public.profiles WHERE id = auth.uid()) );

-- Manajemen Strategi: SELECT, INSERT, UPDATE hanya pada unitnya
CREATE POLICY user_unit_select_strategi ON public.manajemen_strategi 
FOR SELECT TO authenticated USING ( unit_kerja_id = (SELECT unit_kerja_id FROM public.profiles WHERE id = auth.uid()) );

CREATE POLICY user_unit_insert_strategi ON public.manajemen_strategi 
FOR INSERT TO authenticated WITH CHECK ( unit_kerja_id = (SELECT unit_kerja_id FROM public.profiles WHERE id = auth.uid()) );

CREATE POLICY user_unit_update_strategi ON public.manajemen_strategi 
FOR UPDATE TO authenticated USING ( unit_kerja_id = (SELECT unit_kerja_id FROM public.profiles WHERE id = auth.uid()) )
WITH CHECK ( unit_kerja_id = (SELECT unit_kerja_id FROM public.profiles WHERE id = auth.uid()) );

-- SWOT Inventarisasi: SELECT, INSERT, UPDATE, DELETE hanya pada unitnya
CREATE POLICY user_unit_select_swot_inventarisasi ON public.swot_inventarisasi 
FOR SELECT TO authenticated USING ( unit_kerja_id = (SELECT unit_kerja_id FROM public.profiles WHERE id = auth.uid()) );

CREATE POLICY user_unit_insert_swot_inventarisasi ON public.swot_inventarisasi 
FOR INSERT TO authenticated WITH CHECK ( unit_kerja_id = (SELECT unit_kerja_id FROM public.profiles WHERE id = auth.uid()) );

CREATE POLICY user_unit_update_swot_inventarisasi ON public.swot_inventarisasi 
FOR UPDATE TO authenticated USING ( unit_kerja_id = (SELECT unit_kerja_id FROM public.profiles WHERE id = auth.uid()) )
WITH CHECK ( unit_kerja_id = (SELECT unit_kerja_id FROM public.profiles WHERE id = auth.uid()) );

CREATE POLICY user_unit_delete_swot_inventarisasi ON public.swot_inventarisasi 
FOR DELETE TO authenticated USING ( unit_kerja_id = (SELECT unit_kerja_id FROM public.profiles WHERE id = auth.uid()) );

-- 8. Tabel app_settings
CREATE TABLE IF NOT EXISTS public.app_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nama_aplikasi TEXT DEFAULT 'ManRisk RS',
    nama_rs TEXT,
    alamat TEXT,
    kota TEXT,
    telepon TEXT,
    email TEXT,
    website TEXT,
    logo_url TEXT,
    warna_primer TEXT DEFAULT '#2563EB',
    tagline TEXT,
    kepala_rs TEXT,
    nip_kepala TEXT,
    footer TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY superadmin_all_app_settings ON public.app_settings 
FOR ALL TO authenticated USING ( (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superadmin' );

CREATE POLICY view_app_settings ON public.app_settings 
FOR SELECT TO authenticated USING (true);
