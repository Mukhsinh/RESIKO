-- Create swot_inventarisasi table
CREATE TABLE IF NOT EXISTS public.swot_inventarisasi (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    unit_kerja_id UUID REFERENCES public.unit_kerja(id) ON DELETE CASCADE,
    tahun INTEGER NOT NULL,
    kategori TEXT NOT NULL,
    deskripsi TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.swot_inventarisasi ENABLE ROW LEVEL SECURITY;

-- Superadmin policy
CREATE POLICY superadmin_all_swot_inventarisasi ON public.swot_inventarisasi
FOR ALL TO authenticated USING ( (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superadmin' );

-- User unit policies
CREATE POLICY user_unit_select_swot_inventarisasi ON public.swot_inventarisasi
FOR SELECT TO authenticated USING ( unit_kerja_id = (SELECT unit_kerja_id FROM public.profiles WHERE id = auth.uid()) );

CREATE POLICY user_unit_insert_swot_inventarisasi ON public.swot_inventarisasi
FOR INSERT TO authenticated WITH CHECK ( unit_kerja_id = (SELECT unit_kerja_id FROM public.profiles WHERE id = auth.uid()) );

CREATE POLICY user_unit_update_swot_inventarisasi ON public.swot_inventarisasi
FOR UPDATE TO authenticated USING ( unit_kerja_id = (SELECT unit_kerja_id FROM public.profiles WHERE id = auth.uid()) )
WITH CHECK ( unit_kerja_id = (SELECT unit_kerja_id FROM public.profiles WHERE id = auth.uid()) );

CREATE POLICY user_unit_delete_swot_inventarisasi ON public.swot_inventarisasi
FOR DELETE TO authenticated USING ( unit_kerja_id = (SELECT unit_kerja_id FROM public.profiles WHERE id = auth.uid()) );
