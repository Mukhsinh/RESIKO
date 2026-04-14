'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/SharedUI';
import { Eye, Target, Save, Loader2, Plus, Pencil, Trash2, CheckCircle2, GripVertical, X } from 'lucide-react';
import FormInputAI from '@/components/FormInputAI';

interface MisiItem {
    id?: string;
    nomor: number;
    isi_misi: string;
    visi_misi_id?: string;
    isNew?: boolean;
    isEditing?: boolean;
}

interface VisiMisiData {
    id?: string;
    tahun: number;
    visi: string;
    misi: string;
    status?: string;
}

const CURRENT_YEAR = new Date().getFullYear();

export default function VisiMisiPage() {
    const [year, setYear] = useState(String(CURRENT_YEAR));
    const [visi, setVisi] = useState('');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [existingId, setExistingId] = useState<string | null>(null);

    // Misi items state
    const [misiItems, setMisiItems] = useState<MisiItem[]>([]);
    const [loadingMisi, setLoadingMisi] = useState(false);
    const [editingMisi, setEditingMisi] = useState<MisiItem | null>(null);
    const [editMisiText, setEditMisiText] = useState('');
    const [showMisiModal, setShowMisiModal] = useState(false);
    const [savingMisi, setSavingMisi] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const fetchMisiItems = useCallback(async (vmId: string) => {
        setLoadingMisi(true);
        try {
            const { data, error } = await supabase
                .from('misi_items')
                .select('*')
                .eq('visi_misi_id', vmId)
                .order('nomor', { ascending: true });
            if (!error && data) {
                setMisiItems(data as MisiItem[]);
            } else {
                setMisiItems([]);
            }
        } catch {
            setMisiItems([]);
        } finally {
            setLoadingMisi(false);
        }
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const { data, error } = await supabase
                    .from('visi_misi')
                    .select('*')
                    .eq('tahun', Number(year))
                    .maybeSingle();

                if (error) {
                    console.error('Error fetching visi misi:', error);
                    setVisi('');
                    setExistingId(null);
                    setMisiItems([]);
                    return;
                }

                if (data) {
                    setVisi(data.visi ?? '');
                    setExistingId(data.id);
                    await fetchMisiItems(data.id);
                } else {
                    setVisi('');
                    setExistingId(null);
                    setMisiItems([]);
                }
            } catch (err) {
                console.error('Error:', err);
                setVisi('');
                setExistingId(null);
                setMisiItems([]);
            }
        };
        fetchData();
    }, [year, fetchMisiItems]);

    // Get or create visi_misi record for current year, returns the id
    const getOrCreateVisiMisi = async (withVisiUpdate: boolean): Promise<string> => {
        if (existingId) {
            if (withVisiUpdate) {
                const { error } = await supabase.from('visi_misi').update({ visi }).eq('id', existingId);
                if (error) throw error;
            }
            return existingId;
        }
        // Double-check: maybe it was created just now from another flow
        const { data: check } = await supabase
            .from('visi_misi')
            .select('id')
            .eq('tahun', Number(year))
            .is('unit_kerja_id', null)
            .maybeSingle();
        if (check?.id) {
            setExistingId(check.id);
            if (withVisiUpdate) {
                await supabase.from('visi_misi').update({ visi }).eq('id', check.id);
            }
            return check.id;
        }
        // Create fresh record
        const { data, error } = await supabase
            .from('visi_misi')
            .insert({ tahun: Number(year), visi: visi || '' })
            .select('id')
            .single();
        if (error) throw error;
        setExistingId(data.id);
        return data.id;
    };

    // Save visi (create or update visi_misi record)
    const handleSaveVisi = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const vmId = await getOrCreateVisiMisi(true);
            await fetchMisiItems(vmId);
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Terjadi kesalahan';
            alert('Gagal menyimpan visi: ' + msg);
        } finally {
            setSaving(false);
        }
    };

    // Open modal to add new misi
    const openAddMisi = async () => {
        if (!existingId) {
            setSaving(true);
            try {
                await getOrCreateVisiMisi(false);
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : 'Terjadi kesalahan';
                alert('Gagal membuat record: ' + msg);
                setSaving(false);
                return;
            } finally {
                setSaving(false);
            }
        }
        setEditingMisi({ nomor: misiItems.length + 1, isi_misi: '' });
        setEditMisiText('');
        setShowMisiModal(true);
    };

    // Open modal to edit existing misi
    const openEditMisi = (item: MisiItem) => {
        setEditingMisi(item);
        setEditMisiText(item.isi_misi);
        setShowMisiModal(true);
    };

    // Save misi item
    const handleSaveMisi = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editMisiText.trim()) return;
        setSavingMisi(true);
        try {
            const vmId = existingId;
            if (!vmId) throw new Error('Belum ada visi_misi record');

            if (editingMisi?.id) {
                // Update existing
                const { error } = await supabase
                    .from('misi_items')
                    .update({ isi_misi: editMisiText.trim(), updated_at: new Date().toISOString() })
                    .eq('id', editingMisi.id);
                if (error) throw error;
            } else {
                // Insert new
                const { error } = await supabase
                    .from('misi_items')
                    .insert({ visi_misi_id: vmId, nomor: misiItems.length + 1, isi_misi: editMisiText.trim() });
                if (error) throw error;
            }
            await fetchMisiItems(vmId);
            setShowMisiModal(false);
            setEditingMisi(null);
            setEditMisiText('');
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Terjadi kesalahan';
            alert('Gagal menyimpan misi: ' + msg);
        } finally {
            setSavingMisi(false);
        }
    };

    // Delete misi item
    const handleDeleteMisi = async (item: MisiItem) => {
        if (!item.id) return;
        if (!confirm(`Hapus misi "${item.isi_misi.slice(0, 60)}"?`)) return;
        setDeletingId(item.id);
        try {
            const { error } = await supabase.from('misi_items').delete().eq('id', item.id);
            if (error) throw error;
            // Re-number remaining items
            const updated = misiItems.filter(m => m.id !== item.id).map((m, i) => ({ ...m, nomor: i + 1 }));
            // Update nomor in DB
            for (const m of updated) {
                if (m.id) {
                    await supabase.from('misi_items').update({ nomor: m.nomor }).eq('id', m.id);
                }
            }
            if (existingId) await fetchMisiItems(existingId);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Terjadi kesalahan';
            alert('Gagal menghapus misi: ' + msg);
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div>
            <PageHeader
                title="Visi & Misi"
                subtitle="Tetapkan visi dan misi strategis organisasi."
                actions={
                    <div className="flex gap-3 items-center flex-wrap">
                        <select className="form-input w-32" value={year} onChange={e => setYear(e.target.value)}>
                            {[CURRENT_YEAR + 1, CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                }
            />

            {/* Info Cards */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
                {[
                    { icon: <Eye size={22} className="text-[#137fec]" />, label: 'Visi', bg: 'bg-blue-50 border-blue-100', desc: 'Gambaran masa depan yang ingin dicapai organisasi' },
                    { icon: <Target size={22} className="text-emerald-500" />, label: 'Misi', bg: 'bg-emerald-50 border-emerald-100', desc: 'Langkah nyata untuk mewujudkan visi organisasi' },
                ].map(item => (
                    <div key={item.label} className={`card border ${item.bg} flex items-start gap-4`}>
                        <div className="p-3 rounded-xl bg-white shadow-sm">{item.icon}</div>
                        <div>
                            <p className="font-semibold text-slate-700 text-sm">{item.label}</p>
                            <p className="text-xs text-slate-500 mt-1">{item.desc}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Visi Section */}
            <form onSubmit={handleSaveVisi} className="space-y-6 mb-6">
                <div className="card">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-1.5 h-6 rounded-full bg-[#137fec]" />
                        <h3 className="font-bold text-slate-700">Pernyataan Visi</h3>
                    </div>
                    <FormInputAI
                        label="Visi Organisasi"
                        placeholder="Contoh: Menjadi rumah sakit terpercaya dan unggul dalam pelayanan kesehatan di tingkat regional pada tahun 2030..."
                        value={visi}
                        onChange={v => setVisi(v)}
                    />
                </div>

                <div className="flex justify-end">
                    <button type="submit" className="btn-primary gap-2" disabled={saving}>
                        {saving ? <><Loader2 size={16} className="animate-spin" /><span>Menyimpan...</span></> :
                            saved ? <><CheckCircle2 size={16} /><span>Tersimpan!</span></> :
                                <><Save size={16} /><span>Simpan Visi</span></>}
                    </button>
                </div>
            </form>

            {/* Misi Section */}
            <div className="card">
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-6 rounded-full bg-emerald-500" />
                        <h3 className="font-bold text-slate-700">Pernyataan Misi</h3>
                        <span className="ml-1 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                            {misiItems.length} misi
                        </span>
                    </div>
                    <button
                        type="button"
                        className="btn-primary text-sm gap-1.5"
                        onClick={openAddMisi}
                    >
                        <Plus size={15} />
                        <span>Tambah Misi</span>
                    </button>
                </div>

                {loadingMisi ? (
                    <div className="flex items-center justify-center py-10 text-slate-400">
                        <Loader2 size={20} className="animate-spin mr-2" />
                        <span className="text-sm">Memuat data misi...</span>
                    </div>
                ) : misiItems.length === 0 ? (
                    <div className="text-center py-10">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                            <Target size={24} className="text-emerald-400" />
                        </div>
                        <p className="text-slate-500 text-sm font-medium">Belum ada pernyataan misi</p>
                        <p className="text-slate-400 text-xs mt-1">Klik &quot;Tambah Misi&quot; untuk menambahkan misi pertama</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {misiItems.map((item, idx) => (
                            <div
                                key={item.id ?? idx}
                                className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/40 transition-all group"
                            >
                                <div className="flex items-center gap-2 flex-shrink-0 pt-0.5">
                                    <GripVertical size={14} className="text-slate-300 group-hover:text-slate-400" />
                                    <span className="w-7 h-7 rounded-full bg-emerald-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                                        {item.nomor}
                                    </span>
                                </div>
                                <p className="flex-1 text-slate-700 text-sm leading-relaxed pt-0.5">{item.isi_misi}</p>
                                <div className="flex gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        type="button"
                                        title="Edit misi"
                                        className="p-1.5 rounded-lg hover:bg-blue-100 hover:text-blue-600 text-slate-400 transition-colors"
                                        onClick={() => openEditMisi(item)}
                                    >
                                        <Pencil size={14} />
                                    </button>
                                    <button
                                        type="button"
                                        title="Hapus misi"
                                        className="p-1.5 rounded-lg hover:bg-red-100 hover:text-red-600 text-slate-400 transition-colors"
                                        onClick={() => handleDeleteMisi(item)}
                                        disabled={deletingId === item.id}
                                    >
                                        {deletingId === item.id
                                            ? <Loader2 size={14} className="animate-spin" />
                                            : <Trash2 size={14} />
                                        }
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Misi Modal */}
            {showMisiModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <h3 className="text-base font-bold text-slate-800">
                                {editingMisi?.id ? 'Edit Pernyataan Misi' : 'Tambah Pernyataan Misi'}
                            </h3>
                            <button onClick={() => setShowMisiModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleSaveMisi} className="p-6 space-y-4">
                            <div>
                                <label className="form-label">
                                    Misi {editingMisi?.id ? `#${editingMisi.nomor}` : `#${misiItems.length + 1}`}
                                </label>
                                <textarea
                                    className="form-input min-h-[120px] resize-y"
                                    placeholder="Contoh: Memberikan pelayanan kesehatan yang bermutu dan terjangkau kepada seluruh lapisan masyarakat..."
                                    value={editMisiText}
                                    onChange={e => setEditMisiText(e.target.value)}
                                    required
                                    autoFocus
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-1">
                                <button type="button" className="btn-secondary" onClick={() => setShowMisiModal(false)}>
                                    Batal
                                </button>
                                <button type="submit" className="btn-primary" disabled={savingMisi || !editMisiText.trim()}>
                                    {savingMisi ? <><Loader2 size={15} className="animate-spin" /><span>Menyimpan...</span></> : <><Save size={15} /><span>Simpan Misi</span></>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
