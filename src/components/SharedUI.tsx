'use client';

import React from 'react';

interface ScoreCardProps {
    icon: React.ReactNode;
    title: string;
    value: string | number;
    subtitle?: string;
    colorClass: string;
}

export function ScoreCard({ icon, title, value, subtitle, colorClass }: ScoreCardProps) {
    return (
        <div className="score-card">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center border shrink-0 ${colorClass}`}>
                {icon}
            </div>
            <div>
                <p className="text-xs font-semibold text-slate-500">{title}</p>
                <h3 className="text-2xl font-bold text-slate-800 my-0.5">{value}</h3>
                {subtitle && <p className="text-xs text-slate-400 font-medium">{subtitle}</p>}
            </div>
        </div>
    );
}

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
                <h1 className="text-2xl font-bold text-slate-800 tracking-tight">{title}</h1>
                {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
            </div>
            {actions && <div className="flex items-center space-x-2 flex-wrap gap-2">{actions}</div>}
        </div>
    );
}

interface FilterBarProps {
    searchValue: string;
    onSearchChange: (val: string) => void;
    searchPlaceholder?: string;
    yearValue?: string;
    onYearChange?: (val: string) => void;
    years?: number[];
    extraFilters?: React.ReactNode;
}

const currentYear = new Date().getFullYear();
const defaultYears = Array.from({ length: 12 }, (_, i) => currentYear - 2 + i); // e.g. 2024 to 2035 if currentYear is 2026

export function FilterBar({
    searchValue, onSearchChange, searchPlaceholder,
    yearValue, onYearChange, years = defaultYears, extraFilters
}: FilterBarProps) {
    return (
        <div className="flex flex-wrap items-center gap-2.5">
            {/* Search */}
            <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
                <input
                    type="text"
                    value={searchValue}
                    onChange={e => onSearchChange(e.target.value)}
                    placeholder={searchPlaceholder ?? 'Cari data...'}
                    className="pl-9 pr-4 h-[38px] bg-slate-50 border border-slate-200 rounded-lg text-xs w-48 focus:outline-none focus:ring-2 focus:ring-[#137fec]/40 focus:border-transparent transition-all"
                />
            </div>

            {/* Year filter */}
            {onYearChange && (
                <select
                    value={yearValue}
                    onChange={e => onYearChange(e.target.value)}
                    className="filter-select w-28"
                >
                    <option value="">Semua Tahun</option>
                    {years.map(y => <option key={y} value={String(y)}>{y}</option>)}
                </select>
            )}

            {extraFilters}
        </div>
    );
}

interface TopActionBarProps {
    filters: React.ReactNode;
    actions: React.ReactNode;
}

export function TopActionBar({ filters, actions }: TopActionBarProps) {
    return (
        <div className="p-5 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            {filters}
            <div className="flex items-center space-x-2 flex-wrap gap-2">{actions}</div>
        </div>
    );
}
