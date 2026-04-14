ALTER TABLE public.swot_tows_strategi ADD COLUMN IF NOT EXISTS sasaran_strategi TEXT;
ALTER TABLE public.cascading_kpi ADD COLUMN IF NOT EXISTS nilai NUMERIC;
ALTER TABLE public.cascading_kpi ADD COLUMN IF NOT EXISTS range_nilai TEXT;
ALTER TABLE public.cascading_kpi ADD COLUMN IF NOT EXISTS kriteria_nilai TEXT;
