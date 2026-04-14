-- Create tahun_anggaran table
CREATE TABLE IF NOT EXISTS public.tahun_anggaran (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tahun INTEGER NOT NULL UNIQUE,
    keterangan TEXT,
    aktif BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.tahun_anggaran ENABLE ROW LEVEL SECURITY;

-- Superadmin policy
CREATE POLICY superadmin_all_tahun_anggaran ON public.tahun_anggaran 
FOR ALL TO authenticated USING ( (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superadmin' );

-- User unit policy (read only)
CREATE POLICY user_unit_view_tahun_anggaran ON public.tahun_anggaran 
FOR SELECT TO authenticated USING (true);

-- Insert default data
INSERT INTO public.tahun_anggaran (tahun, keterangan, aktif) VALUES
(2024, 'Tahun Anggaran 2024', false),
(2025, 'Tahun Anggaran 2025', false),
(2026, 'Tahun Anggaran 2026', true)
ON CONFLICT (tahun) DO NOTHING;
