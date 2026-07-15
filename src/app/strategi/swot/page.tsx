'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/SharedUI';
import FormInputAI from '@/components/FormInputAI';
import { Layers, Zap, Target, Shield, AlertTriangle, Save, Loader2, Plus, Trash2, CheckCircle2, Edit, RotateCw } from 'lucide-react';
import { useUserProfile } from '@/hooks/useUserProfile';

const CURRENT_YEAR = new Date().getFullYear();

interface SwotItem {
    id?: string;
    deskripsi: string;
    bobot: number;
    ranking: number;
    isEditing?: boolean;
}

type SwotCategory = 'kekuatan' | 'kelemahan' | 'peluang' | 'ancaman';

export default function SWOTPage() {
    const { profile } = useUserProfile();
    const [units, setUnits] = useState<{ id: string; nama_unit: string }[]>([]);
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
        supabase.from('unit_kerja').select('id, nama_unit').order('nama_unit').then(({ data: u, error }: { data: any; error: any }) => {
            if (error) {
                console.error('Error fetching units:', error);
                return;
            }
            setUnits(u ?? []);
            if (u && u.length) {
                if (profile?.role === 'user_unit' && profile.unit_kerja_id) {
                    const matchedUnit = u.find((unit: any) => unit.id === profile.unit_kerja_id);
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
                            ranking: item.ranking || 1,
                            isEditing: false
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
            [cat]: [...prev[cat], { deskripsi: '', bobot: 0, ranking: 1, isEditing: true }]
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
                                {units.find(u => u.id === unitId)?.nama_unit || 'Unit Kerja Anda'}
                            </div>
                        ) : (
                            <select className="form-input w-52" value={unitId} onChange={e => setUnitId(e.target.value)}>
                                {units.map(u => <option key={u.id} value={u.id}>{u.nama_unit}</option>)}
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
                                    <div className="space-y-3">
                                        {form[q.key as SwotCategory].map((item, index) => {
                                            const isEditing = item.isEditing ?? false;

                                            if (!isEditing) {
                                                return (
                                                    <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between bg-white px-4 py-3 rounded-lg border border-slate-200/80 shadow-sm gap-3 transition-all hover:border-slate-300">
                                                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                                            <span className="text-xs font-bold text-slate-400 bg-slate-100 w-5 h-5 flex items-center justify-center rounded-full shrink-0 mt-0.5">{index + 1}</span>
                                                            <p className="text-sm font-semibold text-slate-700 break-words leading-relaxed whitespace-pre-wrap">{item.deskripsi}</p>
                                                        </div>
                                                        <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0">
                                                            <div className="flex gap-4 text-xs font-bold text-slate-600">
                                                                <div className="text-center">
                                                                    <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Bobot</span>
                                                                    <span className="text-slate-700">{item.bobot}</span>
                                                                </div>
                                                                <div className="text-center">
                                                                    <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Ranking</span>
                                                                    <span className="text-slate-700">{item.ranking}</span>
                                                                </div>
                                                                <div className="text-center">
                                                                    <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Skor</span>
                                                                    <span className="text-indigo-600 font-extrabold">{(item.bobot * item.ranking).toFixed(2)}</span>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 border-l border-slate-100 pl-3">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => updateItem(q.key as SwotCategory, index, 'isEditing', true)}
                                                                    className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                                                    title="Edit Item"
                                                                >
                                                                    <Edit size={14} />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeItem(q.key as SwotCategory, index)}
                                                                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                                                    title="Hapus Item"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div key={index} className="bg-white p-4 rounded-lg shadow-sm border border-indigo-200 bg-indigo-50/5 relative">
                                                    <div className="flex items-start gap-2.5 mb-3">
                                                        <span className="text-xs font-bold text-white bg-[#137fec] w-5 h-5 flex items-center justify-center rounded-full shrink-0 mt-1">{index + 1}</span>
                                                        <div className="flex-1 min-w-0">
                                                            <FormInputAI
                                                                label={`Inventarisasi ${q.label}`}
                                                                placeholder={q.placeholder}
                                                                value={item.deskripsi}
                                                                onChange={v => updateItem(q.key as SwotCategory, index, 'deskripsi', v)}
                                                                rows={2}
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 items-end">
                                                        <div>
                                                            <label className="form-label mb-1 text-[10px] uppercase font-bold text-slate-400">Bobot (0-100)</label>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max="100"
                                                                step="0.01"
                                                                className="form-input text-xs py-1.5"
                                                                value={item.bobot || ''}
                                                                onChange={e => updateItem(q.key as SwotCategory, index, 'bobot', parseFloat(e.target.value) || 0)}
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="form-label mb-1 text-[10px] uppercase font-bold text-slate-400">Ranking (1-5)</label>
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                max="5"
                                                                className="form-input text-xs py-1.5"
                                                                value={item.ranking || ''}
                                                                onChange={e => updateItem(q.key as SwotCategory, index, 'ranking', parseInt(e.target.value) || 1)}
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="form-label mb-1 text-[10px] uppercase font-bold text-slate-400">Skor</label>
                                                            <div className="form-input text-xs py-1.5 bg-slate-50 text-slate-500 font-bold flex items-center">
                                                                {((item.bobot || 0) * (item.ranking || 1)).toFixed(2)}
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    if (!item.id) {
                                                                        removeItem(q.key as SwotCategory, index);
                                                                    } else {
                                                                        updateItem(q.key as SwotCategory, index, 'isEditing', false);
                                                                    }
                                                                }}
                                                                className="btn-secondary py-1.5 text-[11px] flex-1"
                                                                title="Batal"
                                                            >
                                                                Batal
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => updateItem(q.key as SwotCategory, index, 'isEditing', false)}
                                                                className="btn-primary py-1.5 text-[11px] flex-1 bg-indigo-600 hover:bg-indigo-700"
                                                                title="Selesai"
                                                                disabled={!item.deskripsi.trim()}
                                                            >
                                                                Selesai
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
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
