CREATE TABLE IF NOT EXISTS public.swot_tows_strategi (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    unit_kerja_id UUID REFERENCES public.unit_kerja(id) ON DELETE CASCADE,
    tahun INTEGER NOT NULL,
    tipe_strategi TEXT NOT NULL,
    strategi TEXT NOT NULL,
    implementasi TEXT,
    penanggungjawab TEXT,
    anggaran NUMERIC(15, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.swot_tows_strategi ENABLE ROW LEVEL SECURITY;

CREATE POLICY superadmin_all_swot_tows_strategi ON public.swot_tows_strategi
FOR ALL TO authenticated USING ( (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superadmin' );

CREATE POLICY user_unit_select_swot_tows_strategi ON public.swot_tows_strategi
FOR SELECT TO authenticated USING ( unit_kerja_id = (SELECT unit_kerja_id FROM public.profiles WHERE id = auth.uid()) );

CREATE POLICY user_unit_insert_swot_tows_strategi ON public.swot_tows_strategi
FOR INSERT TO authenticated WITH CHECK ( unit_kerja_id = (SELECT unit_kerja_id FROM public.profiles WHERE id = auth.uid()) );

CREATE POLICY user_unit_update_swot_tows_strategi ON public.swot_tows_strategi
FOR UPDATE TO authenticated USING ( unit_kerja_id = (SELECT unit_kerja_id FROM public.profiles WHERE id = auth.uid()) )
WITH CHECK ( unit_kerja_id = (SELECT unit_kerja_id FROM public.profiles WHERE id = auth.uid()) );

CREATE POLICY user_unit_delete_swot_tows_strategi ON public.swot_tows_strategi
FOR DELETE TO authenticated USING ( unit_kerja_id = (SELECT unit_kerja_id FROM public.profiles WHERE id = auth.uid()) );
