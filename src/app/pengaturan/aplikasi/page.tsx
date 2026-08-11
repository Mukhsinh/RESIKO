'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Save, Loader2, Building2, Phone, Mail, Globe, MapPin, User, Tag, AlignLeft } from 'lucide-react';

interface AppSettings {
    id?: string;
    nama_aplikasi: string;
    nama_rs: string;
    alamat: string;
    kota: string;
    telepon: string;
    email: string;
    website: string;
    logo_url: string;
    warna_primer: string;
    tagline: string;
    kepala_rs: string;
    nip_kepala: string;
    footer: string;
    jabatan_penandatangan_kiri: string;
    nama_penandatangan_kiri: string;
}

const DEFAULT: AppSettings = {
    nama_aplikasi: '',
    nama_rs: '',
    alamat: '',
    kota: '',
    telepon: '',
    email: '',
    website: '',
    logo_url: '',
    warna_primer: '#2563EB',
    tagline: '',
    kepala_rs: '',
    nip_kepala: '',
    footer: '',
    jabatan_penandatangan_kiri: 'Penanggungjawab Unit',
    nama_penandatangan_kiri: 'Penanggungjawab Unit Kerja',
};

export default function PengaturanAplikasiPage() {
    const [form, setForm] = useState<AppSettings>(DEFAULT);
    const [settingId, setSettingId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        supabase.from('app_settings').select('*').limit(1).maybeSingle().then(({ data }: { data: any }) => {
            if (data) {
                setSettingId(data.id);
                setForm({
                    nama_aplikasi: data.nama_aplikasi ?? '',
                    nama_rs: data.nama_rs ?? '',
                    alamat: data.alamat ?? '',
                    kota: data.kota ?? '',
                    telepon: data.telepon ?? '',
                    email: data.email ?? '',
                    website: data.website ?? '',
                    logo_url: data.logo_url ?? '',
                    warna_primer: data.warna_primer ?? '#2563EB',
                    tagline: data.tagline ?? '',
                    kepala_rs: data.kepala_rs ?? '',
                    nip_kepala: data.nip_kepala ?? '',
                    footer: data.footer ?? '',
                    jabatan_penandatangan_kiri: data.jabatan_penandatangan_kiri || 'Penanggungjawab Unit',
                    nama_penandatangan_kiri: data.nama_penandatangan_kiri || 'Penanggungjawab Unit Kerja',
                });
            }
            setLoading(false);
        });
    }, []);

    const f = (k: keyof AppSettings, v: string) => setForm(prev => ({ ...prev, [k]: v }));

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = e.target?.result as string;
            f('logo_url', base64);
        };
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = { ...form };
            let error;
            if (settingId) {
                ({ error } = await supabase.from('app_settings').update(payload).eq('id', settingId));
            } else {
                const res = await supabase.from('app_settings').insert(payload).select().single();
                error = res.error;
                if (!error && res.data) setSettingId(res.data.id);
            }
            if (error) { alert('Gagal menyimpan: ' + error.message); }
            else {
                localStorage.removeItem('app_settings_cache'); // Force refresh cache
                setSaved(true);
                setTimeout(() => setSaved(false), 3000);
            }
        } finally { setSaving(false); }
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-64">
            <Loader2 className="animate-spin text-blue-600" size={32} />
        </div>
    );

    return (
        <div className="max-w-3xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-800">Pengaturan Aplikasi</h1>
                <p className="text-sm text-slate-500 mt-1">Konfigurasi informasi rumah sakit yang digunakan pada kop surat laporan dan tampilan aplikasi.</p>
            </div>

            <div className="space-y-6">
                {/* Identitas RS */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                    <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-5 flex items-center gap-2">
                        <Building2 size={16} className="text-blue-500" /> Identitas Aplikasi & Instansi
                    </h2>
                    <div className="space-y-4">
                        <div>
                            <label className="form-label font-semibold text-blue-600">Nama Aplikasi *</label>
                            <input type="text" className="form-input w-full border-blue-100 focus:border-blue-400" value={form.nama_aplikasi} onChange={e => f('nama_aplikasi', e.target.value)} placeholder="e.g. ManRisk RS" />
                            <p className="text-[10px] text-slate-400 mt-1 italic">Nama ini akan muncul di halaman login dan bagian atas sidebar.</p>
                        </div>
                        <div className="pt-2 border-t border-slate-50">
                            <label className="form-label">Nama Rumah Sakit / Instansi *</label>
                            <input type="text" className="form-input w-full" value={form.nama_rs} onChange={e => f('nama_rs', e.target.value)} placeholder="e.g. RSUD dr. Soetomo" />
                        </div>
                        <div>
                            <label className="form-label">Tagline / Motto</label>
                            <input type="text" className="form-input w-full" value={form.tagline} onChange={e => f('tagline', e.target.value)} placeholder="e.g. Melayani dengan Hati" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="form-label flex items-center gap-1"><MapPin size={12} /> Kota</label>
                                <input type="text" className="form-input w-full" value={form.kota} onChange={e => f('kota', e.target.value)} placeholder="e.g. Surabaya" />
                            </div>
                            <div>
                                <label className="form-label flex items-center gap-1"><Phone size={12} /> Telepon</label>
                                <input type="text" className="form-input w-full" value={form.telepon} onChange={e => f('telepon', e.target.value)} placeholder="e.g. (031) 5501234" />
                            </div>
                        </div>
                        <div>
                            <label className="form-label flex items-center gap-1"><MapPin size={12} /> Alamat</label>
                            <textarea className="form-input w-full h-16 resize-none" value={form.alamat} onChange={e => f('alamat', e.target.value)} placeholder="Jl. Prof. Dr. Moestopo No.6-8" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="form-label flex items-center gap-1"><Mail size={12} /> Email</label>
                                <input type="email" className="form-input w-full" value={form.email} onChange={e => f('email', e.target.value)} placeholder="info@rsud.go.id" />
                            </div>
                            <div>
                                <label className="form-label flex items-center gap-1"><Globe size={12} /> Website</label>
                                <input type="url" className="form-input w-full" value={form.website} onChange={e => f('website', e.target.value)} placeholder="https://rsud.go.id" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Pejabat Penandatangan */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                    <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-5 flex items-center gap-2">
                        <User size={16} className="text-indigo-500" /> Pejabat Penandatangan Laporan
                    </h2>
                    <div className="space-y-4">
                        <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-100">
                            <p className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                Penandatangan Sebelah Kiri (Pembuat / Penanggungjawab Laporan)
                            </p>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="form-label">Jabatan Penandatangan Kiri *</label>
                                    <input
                                        type="text"
                                        className="form-input w-full bg-white"
                                        value={form.jabatan_penandatangan_kiri}
                                        onChange={e => f('jabatan_penandatangan_kiri', e.target.value)}
                                        placeholder="Penanggungjawab Unit"
                                    />
                                    <p className="text-[10px] text-slate-400 mt-1">Default: &quot;Penanggungjawab Unit&quot;</p>
                                </div>
                                <div>
                                    <label className="form-label">Nama / Keterangan Penandatangan Kiri</label>
                                    <input
                                        type="text"
                                        className="form-input w-full bg-white"
                                        value={form.nama_penandatangan_kiri}
                                        onChange={e => f('nama_penandatangan_kiri', e.target.value)}
                                        placeholder="Penanggungjawab Unit Kerja"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-100">
                            <p className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                Penandatangan Sebelah Kanan (Atasan / Direksi Pimpinan RS)
                            </p>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="form-label">Nama Kepala / Direktur RS *</label>
                                    <input
                                        type="text"
                                        className="form-input w-full bg-white"
                                        value={form.kepala_rs}
                                        onChange={e => f('kepala_rs', e.target.value)}
                                        placeholder="dr. Ahmad Santoso, Sp.B, M.Kes"
                                    />
                                </div>
                                <div>
                                    <label className="form-label">NIP / NIK Kepala RS *</label>
                                    <input
                                        type="text"
                                        className="form-input w-full bg-white"
                                        value={form.nip_kepala}
                                        onChange={e => f('nip_kepala', e.target.value)}
                                        placeholder="196501011990031001"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Laporan */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                    <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-5 flex items-center gap-2">
                        <AlignLeft size={16} className="text-emerald-500" /> Footer Laporan
                    </h2>
                    <div>
                        <label className="form-label">Teks Footer (ditampilkan di bagian bawah setiap halaman laporan)</label>
                        <textarea
                            className="form-input w-full h-24 resize-none"
                            value={form.footer}
                            onChange={e => f('footer', e.target.value)}
                            placeholder="e.g. Dokumen ini bersifat rahasia dan hanya untuk keperluan internal. Dilarang memperbanyak tanpa izin."
                        />
                        <p className="text-xs text-slate-400 mt-1">Footer akan muncul di seluruh laporan PDF/Excel yang diunduh dari aplikasi.</p>
                    </div>
                </div>

                {/* Tampilan */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                    <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-5 flex items-center gap-2">
                        <Tag size={16} className="text-rose-400" /> Tampilan & Branding
                    </h2>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="form-label">Warna Primer Aplikasi</label>
                            <div className="flex items-center gap-3">
                                <input type="color" className="h-10 w-16 rounded-lg border border-slate-200 cursor-pointer" value={form.warna_primer} onChange={e => f('warna_primer', e.target.value)} />
                                <input type="text" className="form-input flex-1" value={form.warna_primer} onChange={e => f('warna_primer', e.target.value)} placeholder="#2563EB" />
                            </div>
                        </div>
                        <div>
                            <label className="form-label">Upload Logo Rumah Sakit</label>
                            <input type="file" accept="image/png, image/jpeg, image/jpg" className="form-input w-full p-1.5" onChange={handleLogoUpload} />
                            {form.logo_url && (
                                <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
                                    <img src={form.logo_url} alt="Logo Preview" className="h-10 object-contain rounded" onError={e => (e.currentTarget.style.display = 'none')} />
                                    <button onClick={() => f('logo_url', '')} className="text-rose-500 hover:underline">Hapus Logo</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Preview Kop Surat */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                    <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-5">Preview Kop Surat Laporan</h2>
                    <div className="border-2 border-slate-200 rounded-xl overflow-hidden">
                        <div className="bg-white p-5 border-b-4 border-double" style={{ borderColor: form.warna_primer }}>
                            <div className="flex items-center gap-4">
                                {form.logo_url && (
                                    <img src={form.logo_url} alt="Logo" className="h-16 w-16 object-contain" onError={e => (e.currentTarget.style.display = 'none')} />
                                )}
                                {!form.logo_url && (
                                    <div className="h-16 w-16 rounded-xl flex items-center justify-center text-white text-2xl font-bold" style={{ backgroundColor: form.warna_primer }}>
                                        {form.nama_rs?.charAt(0) || 'RS'}
                                    </div>
                                )}
                                <div>
                                    <p className="text-xs text-slate-500 uppercase tracking-wider">Sistem Manajemen Risiko</p>
                                    <h3 className="text-xl font-extrabold text-slate-800 leading-tight">{form.nama_rs || 'Nama Rumah Sakit'}</h3>
                                    <p className="text-sm text-slate-500 mt-0.5">{form.alamat}{form.kota ? `, ${form.kota}` : ''}</p>
                                    <p className="text-xs text-slate-400 mt-0.5">{[form.telepon, form.email, form.website].filter(Boolean).join(' | ')}</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-slate-50 px-5 py-2 text-xs text-slate-500 italic text-center">
                            {form.footer || 'Footer laporan akan tampil di sini...'}
                        </div>
                    </div>
                </div>

                {/* Action */}
                <div className="flex justify-end pb-8">
                    <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 px-8 py-2.5">
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        {saved ? '✓ Tersimpan!' : 'Simpan Pengaturan'}
                    </button>
                </div>
            </div>
        </div>
    );
}
