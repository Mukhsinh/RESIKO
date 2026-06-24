-- Migration to add missing columns to app_settings table
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS nama_aplikasi TEXT DEFAULT 'ManRisk RS';
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS footer TEXT;
