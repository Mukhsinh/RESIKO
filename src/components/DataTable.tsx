'use client';

import React from 'react';
import { Eye, Edit, Trash2 } from 'lucide-react';

export interface Column<T> {
    key: keyof T | 'actions';
    label: string;
    render?: (row: T) => React.ReactNode;
    className?: string;
}

interface DataTableProps<T> {
    columns: Column<T>[];
    data: T[];
    onView?: (row: T) => void;
    onEdit?: (row: T) => void;
    onDelete?: (row: T) => void;
    isLoading?: boolean;
}

export default function DataTable<T extends { id: string }>({
    columns, data, onView, onEdit, onDelete, isLoading
}: DataTableProps<T>) {
    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-16 text-slate-400">
                <div className="animate-spin w-6 h-6 border-2 border-slate-200 border-t-[#137fec] rounded-full mr-3" />
                <span className="text-sm">Memuat data...</span>
            </div>
        );
    }

    if (data.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <div className="text-4xl mb-3">📋</div>
                <p className="text-sm font-medium">Belum ada data</p>
                <p className="text-xs text-slate-300 mt-1">Mulai dengan menambahkan data baru</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="data-table">
                <thead>
                    <tr>
                        {columns.map(col => (
                            <th key={String(col.key)} className={col.className}>{col.label}</th>
                        ))}
                        {(onView || onEdit || onDelete) && (
                            <th className="text-center w-32">Aksi</th>
                        )}
                    </tr>
                </thead>
                <tbody>
                    {data.map(row => (
                        <tr key={row.id}>
                            {columns.map(col => (
                                <td key={String(col.key)}>
                                    {col.render ? col.render(row) : String((row as Record<string, unknown>)[String(col.key)] ?? '-')}
                                </td>
                            ))}
                            {(onView || onEdit || onDelete) && (
                                <td>
                                    <div className="flex items-center justify-center space-x-1.5">
                                        {onView && (
                                            <button title="Lihat" className="action-btn-view" onClick={() => onView(row)}>
                                                <Eye size={15} />
                                            </button>
                                        )}
                                        {onEdit && (
                                            <button title="Edit" className="action-btn-edit" onClick={() => onEdit(row)}>
                                                <Edit size={15} />
                                            </button>
                                        )}
                                        {onDelete && (
                                            <button title="Hapus" className="action-btn-delete" onClick={() => onDelete(row)}>
                                                <Trash2 size={15} />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
