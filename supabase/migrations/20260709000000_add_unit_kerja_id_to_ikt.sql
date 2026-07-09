-- Migration: Add unit_kerja_id to indikator_kinerja_utama
ALTER TABLE public.indikator_kinerja_utama 
ADD COLUMN IF NOT EXISTS unit_kerja_id UUID REFERENCES public.unit_kerja(id) ON DELETE SET NULL;

-- Enable RLS and setup policies
ALTER TABLE public.indikator_kinerja_utama ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS superadmin_all_ikt ON public.indikator_kinerja_utama;
CREATE POLICY superadmin_all_ikt ON public.indikator_kinerja_utama
FOR ALL TO authenticated USING ( (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superadmin' );

DROP POLICY IF EXISTS user_unit_select_ikt ON public.indikator_kinerja_utama;
CREATE POLICY user_unit_select_ikt ON public.indikator_kinerja_utama
FOR SELECT TO authenticated USING ( unit_kerja_id = (SELECT unit_kerja_id FROM public.profiles WHERE id = auth.uid()) );

DROP POLICY IF EXISTS user_unit_insert_ikt ON public.indikator_kinerja_utama;
CREATE POLICY user_unit_insert_ikt ON public.indikator_kinerja_utama
FOR INSERT TO authenticated WITH CHECK ( unit_kerja_id = (SELECT unit_kerja_id FROM public.profiles WHERE id = auth.uid()) );

DROP POLICY IF EXISTS user_unit_update_ikt ON public.indikator_kinerja_utama;
CREATE POLICY user_unit_update_ikt ON public.indikator_kinerja_utama
FOR UPDATE TO authenticated USING ( unit_kerja_id = (SELECT unit_kerja_id FROM public.profiles WHERE id = auth.uid()) )
WITH CHECK ( unit_kerja_id = (SELECT unit_kerja_id FROM public.profiles WHERE id = auth.uid()) );

DROP POLICY IF EXISTS user_unit_delete_ikt ON public.indikator_kinerja_utama;
CREATE POLICY user_unit_delete_ikt ON public.indikator_kinerja_utama
FOR DELETE TO authenticated USING ( unit_kerja_id = (SELECT unit_kerja_id FROM public.profiles WHERE id = auth.uid()) );
