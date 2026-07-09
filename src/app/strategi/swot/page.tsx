'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/SharedUI';
import FormInputAI from '@/components/FormInputAI';
import { Layers, Zap, Target, Shield, AlertTriangle, Save, Loader2, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { useUserProfile } from '@/hooks/useUserProfile';

const CURRENT_YEAR = new Date().getFullYear();

interface SwotItem {
    id?: string;
    deskripsi: string;
    bobot: number;
    ranking: number;
}

type SwotCategory = 'kekuatan' | 'kelemahan' | 'peluang' | 'ancaman';

export default function SWOTPage() {
    const { profile } = useUserProfile();
    const [units, setUnits] = useState<{ id: string; name: string }[]>([]);
    const [unitId, setUnitId] = useState('');
    const [year, setYear] = useState(String(CURRENT_YEAR));

    const [form, setForm] = useState<Record<SwotCategory, SwotItem[]>>({
        kekuatan: [],
        kelemahan: [],
        peluang: [],
        ancaman: []
    });

    const [savingCat, setSavingCat] = useState<SwotCategory | null>(null);
    const [savedCat, setSavedCat] = useState<SwotCategory | null>(null);

    useEffect(() => {
        supabase.from('master_work_units').select('id, name').then(({ data: u, error }: { data: any; error: any }) => {
            if (error) {
                console.error('Error fetching units:', error);
                return;
            }
            setUnits(u ?? []);
            if (u && u.length) {
                if (profile?.role === 'user_unit' && profile.unit_kerja_name) {
                    const matchedUnit = u.find((unit: any) => unit.name.toLowerCase() === profile.unit_kerja_name?.toLowerCase());
                    if (matchedUnit) {
                        setUnitId(matchedUnit.id);
                        return;
                    }
                }
                setUnitId(u[0].id);
            }
        });
    }, [profile]);

    useEffect(() => {
        if (!unitId) return;
        const fetchData = async () => {
            try {
                const { data, error } = await supabase
                    .from('swot_inventarisasi')
                    .select('*')
                    .eq('unit_kerja_id', unitId)
                    .eq('tahun', Number(year));

                if (error) {
                    console.error('Error fetching SWOT data:', error);
                    setForm({ kekuatan: [], kelemahan: [], peluang: [], ancaman: [] });
                    return;
                }

                if (data && data.length > 0) {
                    const grouped: Record<SwotCategory, SwotItem[]> = {
                        kekuatan: [],
                        kelemahan: [],
                        peluang: [],
                        ancaman: []
                    };
                    data.forEach((item: any) => {
                        const key = item.kategori === 'Kekuatan' ? 'kekuatan' :
                            item.kategori === 'Kelemahan' ? 'kelemahan' :
                                item.kategori === 'Peluang' ? 'peluang' : 'ancaman';
                        grouped[key].push({
                            id: item.id,
                            deskripsi: item.deskripsi,
                            bobot: item.bobot || 0,
                            ranking: item.ranking || 1
                        });
                    });
                    setForm(grouped);
                } else {
                    setForm({ kekuatan: [], kelemahan: [], peluang: [], ancaman: [] });
                }
            } catch (err) {
                console.error('Error:', err);
                setForm({ kekuatan: [], kelemahan: [], peluang: [], ancaman: [] });
            }
        };
        fetchData();
    }, [unitId, year]);

    const handleSaveCategory = async (cat: SwotCategory, dbCat: string) => {
        setSavingCat(cat);
        try {
            const { error: deleteError } = await supabase
                .from('swot_inventarisasi')
                .delete()
                .eq('unit_kerja_id', unitId)
                .eq('tahun', Number(year))
                .eq('kategori', dbCat);

            if (deleteError) {
                console.error('Error deleting old SWOT data:', deleteError);
            }

            const items = form[cat].filter(s => s.deskripsi.trim()).map(item => ({
                unit_kerja_id: unitId,
                tahun: Number(year),
                kategori: dbCat,
                deskripsi: item.deskripsi.trim(),
                bobot: item.bobot,
                ranking: item.ranking,
                skor: item.bobot * item.ranking
            }));

            if (items.length > 0) {
                const { error: insertError } = await supabase.from('swot_inventarisasi').insert(items);
                if (insertError) throw insertError;
            }

            setSavedCat(cat);
            setTimeout(() => setSavedCat(null), 2500);
        } catch (err: any) {
            console.error('Error:', err);
            alert('Gagal menyimpan data: ' + err.message);
        } finally {
            setSavingCat(null);
        }
    };

    const addItem = (cat: SwotCategory) => {
        setForm(prev => ({
            ...prev,
            [cat]: [...prev[cat], { deskripsi: '', bobot: 0, ranking: 1 }]
        }));
    };

    const removeItem = (cat: SwotCategory, index: number) => {
        setForm(prev => {
            const newItems = [...prev[cat]];
            newItems.splice(index, 1);
            return { ...prev, [cat]: newItems };
        });
    };

    const updateItem = (cat: SwotCategory, index: number, field: keyof SwotItem, value: any) => {
        setForm(prev => {
            const newItems = [...prev[cat]];
            newItems[index] = { ...newItems[index], [field]: value };
            return { ...prev, [cat]: newItems };
        });
    };

    const quadrants = [
        { key: 'kekuatan', dbCat: 'Kekuatan', label: 'Kekuatan (Strengths)', icon: <Zap size={20} className="text-emerald-500" />, color: 'border-emerald-200 bg-emerald-50/50', bar: 'bg-emerald-500', placeholder: 'Keunggulan internal...contoh: SDM ahli' },
        { key: 'kelemahan', dbCat: 'Kelemahan', label: 'Kelemahan (Weaknesses)', icon: <AlertTriangle size={20} className="text-rose-500" />, color: 'border-rose-200 bg-rose-50/50', bar: 'bg-rose-500', placeholder: 'Kekurangan internal...contoh: Fasilitas kurang' },
        { key: 'peluang', dbCat: 'Peluang', label: 'Peluang (Opportunities)', icon: <Target size={20} className="text-[#137fec]" />, color: 'border-blue-200 bg-blue-50/50', bar: 'bg-[#137fec]', placeholder: 'Faktor eksternal...contoh: Kebijakan baru' },
        { key: 'ancaman', dbCat: 'Tantangan', label: 'Ancaman (Threats)', icon: <Shield size={20} className="text-amber-500" />, color: 'border-amber-200 bg-amber-50/50', bar: 'bg-amber-500', placeholder: 'Faktor eksternal...contoh: Kompetitor baru' },
    ] as const;

    return (
        <div className="pb-12">
            <PageHeader
                title="Analisis SWOT"
                subtitle="Identifikasi faktor internal & eksternal beserta bobot dan ranking untuk diagram kartesius."
                actions={
                    <div className="flex gap-3 flex-wrap">
                        {profile?.role === 'user_unit' ? (
                            <div className="form-input w-52 bg-slate-100 text-slate-600 cursor-not-allowed">
                                {units.find(u => u.id === unitId)?.name || 'Unit Kerja Anda'}
                            </div>
                        ) : (
                            <select className="form-input w-52" value={unitId} onChange={e => setUnitId(e.target.value)}>
                                {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </select>
                        )}
                        <select className="form-input w-32" value={year} onChange={e => setYear(e.target.value)}>
                            {[CURRENT_YEAR + 1, CURRENT_YEAR, CURRENT_YEAR - 1].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                }
            />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {quadrants.map(q => {
                    const totalBobot = form[q.key as SwotCategory].reduce((acc, curr) => acc + (Number(curr.bobot) || 0), 0);
                    return (
                        <div key={q.key} className={`card border ${q.color} flex flex-col justify-center gap-1 py-3 px-4`}>
                            <div className="flex items-center gap-3">
                                {q.icon}<span className="text-sm font-semibold text-slate-700">{q.label.split(' ')[0]}</span>
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                                <span className={totalBobot > 100 ? 'text-rose-500 font-bold' : ''}>Total Bobot: {totalBobot} / 100</span>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
                {quadrants.map(q => {
                    const totalBobot = form[q.key as SwotCategory].reduce((acc, curr) => acc + (Number(curr.bobot) || 0), 0);
                    return (
                        <div key={q.key} className={`card border-2 ${q.color} flex flex-col`}>
                            <div className={`w-full h-1 ${q.bar} rounded-full mb-4`} />
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    {q.icon}
                                    <h3 className="font-bold text-slate-700 text-sm">{q.label}</h3>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => addItem(q.key as SwotCategory)}
                                    className="btn-secondary text-xs py-1.5 px-3"
                                >
                                    <Plus size={14} className="mr-1" /> Tambah Uraian
                                </button>
                            </div>

                            {totalBobot > 100 && (
                                <div className="mb-3 px-3 py-2 bg-rose-100 text-rose-700 text-xs rounded-md border border-rose-200 flex items-center gap-2">
                                    <AlertTriangle size={14} /> Total bobot melebihi batas maksimal 100!
                                </div>
                            )}

                            <div className="flex flex-col gap-4 flex-1">
                                {form[q.key as SwotCategory].length === 0 ? (
                                    <div className="text-center py-6 text-slate-400 text-sm border-2 border-dashed rounded-lg border-slate-200">
                                        Belum ada data. Klik Tambah Uraian untuk memasukkan item.
                                    </div>
                                ) : (
                                    form[q.key as SwotCategory].map((item, index) => (
                                        <div key={index} className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 relative group">
                                            <button
                                                type="button"
                                                onClick={() => removeItem(q.key as SwotCategory, index)}
                                                className="absolute -top-2 -right-2 bg-rose-100 text-rose-600 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-200 z-10 shadow-sm"
                                                title="Hapus uraian ini"
                                            >
                                                <Trash2 size={14} />
                                            </button>

                                            <FormInputAI
                                                label="Uraian"
                                                placeholder={q.placeholder}
                                                value={item.deskripsi}
                                                onChange={v => updateItem(q.key as SwotCategory, index, 'deskripsi', v)}
                                                rows={2}
                                            />

                                            <div className="grid grid-cols-3 gap-3 mt-4">
                                                <div>
                                                    <label className="form-label mb-1 text-xs">Bobot (0-100)</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        step="0.01"
                                                        className="form-input text-sm"
                                                        value={item.bobot || ''}
                                                        onChange={e => updateItem(q.key as SwotCategory, index, 'bobot', parseFloat(e.target.value) || 0)}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="form-label mb-1 text-xs">Ranking (1-5)</label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max="5"
                                                        className="form-input text-sm"
                                                        value={item.ranking || ''}
                                                        onChange={e => updateItem(q.key as SwotCategory, index, 'ranking', parseInt(e.target.value) || 1)}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="form-label mb-1 text-xs">Skor</label>
                                                    <div className="form-input text-sm bg-slate-50 text-slate-500 flex items-center">
                                                        {((item.bobot || 0) * (item.ranking || 1)).toFixed(2)}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Save button per category */}
                            <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                                <button
                                    type="button"
                                    onClick={() => handleSaveCategory(q.key as SwotCategory, q.dbCat)}
                                    className="btn-primary text-sm py-2 px-4 shadow-sm"
                                    disabled={savingCat === q.key || form[q.key as SwotCategory].length === 0}
                                >
                                    {savingCat === q.key ? <><Loader2 size={16} className="animate-spin mr-1.5" />Menyimpan...</> :
                                        savedCat === q.key ? <><CheckCircle2 size={16} className="mr-1.5" />Tersimpan!</> :
                                            <><Save size={16} className="mr-1.5" />Simpan {q.label.split(' ')[0]}</>}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
