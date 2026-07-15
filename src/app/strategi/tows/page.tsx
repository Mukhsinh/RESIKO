'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/SharedUI';
import FormInputAI from '@/components/FormInputAI';
import { FolderOpen, Save, Loader2, Plus, Trash2, CheckCircle2, Edit } from 'lucide-react';
import { useUserProfile } from '@/hooks/useUserProfile';

const CURRENT_YEAR = new Date().getFullYear();

interface TowsItem {
    id?: string;
    strategi: string;
    sasaran_strategi: string;
    penanggungjawab: string;
    isEditing?: boolean;
}

type TowsCategory = 'SO' | 'WO' | 'ST' | 'WT';

export default function TOWSPage() {
    const { profile } = useUserProfile();
    const [units, setUnits] = useState<{ id: string; nama_unit: string }[]>([]);
    const [unitId, setUnitId] = useState('');
    const [year, setYear] = useState(String(CURRENT_YEAR));

    const [form, setForm] = useState<Record<TowsCategory, TowsItem[]>>({
        SO: [],
        WO: [],
        ST: [],
        WT: []
    });

    const [savingCat, setSavingCat] = useState<TowsCategory | null>(null);
    const [savedCat, setSavedCat] = useState<TowsCategory | null>(null);

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
                    .from('swot_tows_strategi')
                    .select('*')
                    .eq('unit_kerja_id', unitId)
                    .eq('tahun', Number(year));

                if (error) {
                    console.error('Error fetching TOWS data:', error);
                    setForm({ SO: [], WO: [], ST: [], WT: [] });
                    return;
                }

                if (data && data.length > 0) {
                    const grouped: Record<TowsCategory, TowsItem[]> = {
                        SO: [],
                        WO: [],
                        ST: [],
                        WT: []
                    };
                    data.forEach((item: any) => {
                        if (item.tipe_strategi && grouped[item.tipe_strategi as TowsCategory]) {
                            grouped[item.tipe_strategi as TowsCategory].push({
                                id: item.id,
                                strategi: item.strategi || '',
                                sasaran_strategi: item.sasaran_strategi || '',
                                penanggungjawab: item.penanggungjawab || '',
                                isEditing: false
                            });
                        }
                    });
                    setForm(grouped);
                } else {
                    setForm({ SO: [], WO: [], ST: [], WT: [] });
                }
            } catch (err) {
                console.error('Error catch:', err);
                setForm({ SO: [], WO: [], ST: [], WT: [] });
            }
        };
        fetchData();
    }, [unitId, year]);

    const handleSaveCategory = async (cat: TowsCategory) => {
        setSavingCat(cat);
        try {
            const { error: deleteError } = await supabase
                .from('swot_tows_strategi')
                .delete()
                .eq('unit_kerja_id', unitId)
                .eq('tahun', Number(year))
                .eq('tipe_strategi', cat);

            if (deleteError) {
                console.error('Error deleting old TOWS data:', deleteError);
            }

            const items = form[cat].filter(s => s.strategi.trim() || s.sasaran_strategi.trim()).map(item => ({
                unit_kerja_id: unitId,
                tahun: Number(year),
                tipe_strategi: cat,
                strategi: item.strategi.trim(),
                sasaran_strategi: item.sasaran_strategi.trim(),
                penanggungjawab: item.penanggungjawab.trim()
            }));

            if (items.length > 0) {
                const { error: insertError } = await supabase.from('swot_tows_strategi').insert(items);
                if (insertError) throw insertError;
            }

            // Re-fetch to get server-generated IDs
            const { data: freshData } = await supabase
                .from('swot_tows_strategi')
                .select('*')
                .eq('unit_kerja_id', unitId)
                .eq('tahun', Number(year))
                .eq('tipe_strategi', cat);

            if (freshData) {
                setForm(prev => ({
                    ...prev,
                    [cat]: freshData.map((item: any) => ({
                        id: item.id,
                        strategi: item.strategi || '',
                        sasaran_strategi: item.sasaran_strategi || '',
                        penanggungjawab: item.penanggungjawab || '',
                        isEditing: false
                    }))
                }));
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

    const addItem = (cat: TowsCategory) => {
        setForm(prev => ({
            ...prev,
            [cat]: [...prev[cat], { strategi: '', sasaran_strategi: '', penanggungjawab: '', isEditing: true }]
        }));
    };

    const removeItem = (cat: TowsCategory, index: number) => {
        setForm(prev => {
            const newItems = [...prev[cat]];
            newItems.splice(index, 1);
            return { ...prev, [cat]: newItems };
        });
    };

    const updateItem = (cat: TowsCategory, index: number, field: keyof TowsItem, value: any) => {
        setForm(prev => {
            const newItems = [...prev[cat]];
            newItems[index] = { ...newItems[index], [field]: value };
            return { ...prev, [cat]: newItems };
        });
    };

    const cells = [
        { key: 'SO', label: 'Strategi S-O', desc: 'Gunakan Kekuatan untuk meraih Peluang', colorClass: 'border-l-4 border-l-emerald-400', labelBg: 'bg-emerald-50 text-emerald-700', accentColor: 'text-emerald-600' },
        { key: 'WO', label: 'Strategi W-O', desc: 'Atasi Kelemahan dengan memanfaatkan Peluang', colorClass: 'border-l-4 border-l-[#137fec]', labelBg: 'bg-blue-50 text-blue-700', accentColor: 'text-blue-600' },
        { key: 'ST', label: 'Strategi S-T', desc: 'Gunakan Kekuatan untuk menghadapi Ancaman', colorClass: 'border-l-4 border-l-amber-400', labelBg: 'bg-amber-50 text-amber-700', accentColor: 'text-amber-600' },
        { key: 'WT', label: 'Strategi W-T', desc: 'Minimalkan Kelemahan dan hindari Ancaman', colorClass: 'border-l-4 border-l-rose-400', labelBg: 'bg-rose-50 text-rose-700', accentColor: 'text-rose-600' },
    ] as const;

    return (
        <div className="pb-12">
            <PageHeader
                title="Matriks TOWS"
                subtitle="Rumuskan strategi, sasaran strategi, dan penanggungjawab berdasarkan kombinasi faktor SWOT."
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

            {/* Matrix header */}
            <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                    { label: 'Internal: Kekuatan (S) + Kelemahan (W)', color: 'bg-slate-100 text-slate-600' },
                    { label: 'Eksternal: Peluang (O) + Ancaman (T)', color: 'bg-slate-100 text-slate-600' },
                ].map(item => (
                    <div key={item.label} className={`text-center text-xs font-semibold py-2 rounded-xl ${item.color}`}>{item.label}</div>
                ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
                {cells.map(cell => (
                    <div key={cell.key} className={`card ${cell.colorClass} flex flex-col`}>
                        <div className="flex items-center justify-between xl:flex-col xl:items-start xl:gap-2 mb-4 sm:flex-row">
                            <div className="mb-1">
                                <span className={`text-xs font-bold px-3 py-1 rounded-full ${cell.labelBg}`}>{cell.label}</span>
                                <p className="text-xs text-slate-500 mt-2">{cell.desc}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => addItem(cell.key as TowsCategory)}
                                className="btn-secondary text-xs py-1.5 px-3 self-start shrink-0"
                            >
                                <Plus size={14} className="mr-1" /> Tambah Strategi
                            </button>
                        </div>

                        <div className="flex flex-col gap-3 flex-1">
                            {form[cell.key as TowsCategory].length === 0 ? (
                                <div className="text-center py-6 text-slate-400 text-sm border-2 border-dashed rounded-lg border-slate-200">
                                    Belum ada strategi. Klik Tambah Strategi untuk memasukkan data.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {form[cell.key as TowsCategory].map((item, index) => {
                                        const isEditing = item.isEditing ?? false;

                                        if (!isEditing) {
                                            return (
                                                <div key={index} className="bg-white px-4 py-3 rounded-lg border border-slate-200/80 shadow-sm transition-all hover:border-slate-300">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                                            <span className="text-xs font-bold text-slate-400 bg-slate-100 w-5 h-5 flex items-center justify-center rounded-full shrink-0 mt-0.5">{index + 1}</span>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-sm font-semibold text-slate-700 break-words leading-relaxed whitespace-pre-wrap">{item.strategi}</p>
                                                                {item.sasaran_strategi && (
                                                                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                                                                        <span className="font-bold text-slate-400 uppercase text-[9px] tracking-wider">Sasaran:</span>{' '}
                                                                        {item.sasaran_strategi}
                                                                    </p>
                                                                )}
                                                                {item.penanggungjawab && (
                                                                    <p className="text-xs text-slate-500 mt-1">
                                                                        <span className="font-bold text-slate-400 uppercase text-[9px] tracking-wider">PIC:</span>{' '}
                                                                        <span className={`font-semibold ${cell.accentColor}`}>{item.penanggungjawab}</span>
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            <button
                                                                type="button"
                                                                onClick={() => updateItem(cell.key as TowsCategory, index, 'isEditing', true)}
                                                                className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                                                title="Edit"
                                                            >
                                                                <Edit size={14} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => removeItem(cell.key as TowsCategory, index)}
                                                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                                                title="Hapus"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div key={index} className="bg-white p-4 rounded-lg shadow-sm border border-indigo-200 relative">
                                                <div className="flex items-start gap-2.5 mb-3">
                                                    <span className="text-xs font-bold text-white bg-[#137fec] w-5 h-5 flex items-center justify-center rounded-full shrink-0 mt-1">{index + 1}</span>
                                                    <div className="flex-1 min-w-0">
                                                        <FormInputAI
                                                            label={`Rumusan Strategi ${cell.key}`}
                                                            placeholder={`Contoh rumusan strategi...`}
                                                            value={item.strategi}
                                                            onChange={v => updateItem(cell.key as TowsCategory, index, 'strategi', v)}
                                                            rows={2}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="mt-3">
                                                    <label className="form-label mb-1 text-xs">Sasaran Strategi</label>
                                                    <textarea
                                                        rows={2}
                                                        className="form-input text-sm resize-none"
                                                        placeholder="Contoh sasaran strategi..."
                                                        value={item.sasaran_strategi}
                                                        onChange={e => updateItem(cell.key as TowsCategory, index, 'sasaran_strategi', e.target.value)}
                                                    />
                                                </div>

                                                <div className="mt-3">
                                                    <label className="form-label mb-1 text-xs">Penanggungjawab</label>
                                                    <input
                                                        type="text"
                                                        className="form-input text-sm"
                                                        placeholder="PIC / Bidang penanggungjawab..."
                                                        value={item.penanggungjawab}
                                                        onChange={e => updateItem(cell.key as TowsCategory, index, 'penanggungjawab', e.target.value)}
                                                    />
                                                </div>

                                                <div className="flex gap-1.5 mt-3 justify-end">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (!item.id) {
                                                                removeItem(cell.key as TowsCategory, index);
                                                            } else {
                                                                updateItem(cell.key as TowsCategory, index, 'isEditing', false);
                                                            }
                                                        }}
                                                        className="btn-secondary py-1.5 text-[11px] px-3"
                                                    >
                                                        Batal
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => updateItem(cell.key as TowsCategory, index, 'isEditing', false)}
                                                        className="btn-primary py-1.5 text-[11px] px-3 bg-indigo-600 hover:bg-indigo-700"
                                                        disabled={!item.strategi.trim()}
                                                    >
                                                        Selesai
                                                    </button>
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
                                onClick={() => handleSaveCategory(cell.key as TowsCategory)}
                                className="btn-primary text-sm py-2 px-4 shadow-sm"
                                disabled={savingCat === cell.key || form[cell.key as TowsCategory].length === 0}
                            >
                                {savingCat === cell.key ? <><Loader2 size={16} className="animate-spin mr-1.5" />Menyimpan...</> :
                                    savedCat === cell.key ? <><CheckCircle2 size={16} className="mr-1.5" />Tersimpan!</> :
                                        <><Save size={16} className="mr-1.5" />Simpan {cell.key}</>}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
