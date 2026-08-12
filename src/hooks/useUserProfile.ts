'use client';

import { useMemo, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
export type { UserProfile } from '@/context/AuthContext';

/**
 * Hook to access user profile from centralized AuthContext.
 * Zero redundant API calls or network requests.
 * Includes helper role checks for clean component logic.
 */
export function useUserProfile() {
    const { profile, isLoading, refreshProfile } = useAuth();

    const role = profile?.role?.toLowerCase();
    const isAdmin = role === 'admin' || role === 'superadmin';
    const isAuditor = role === 'auditor';
    const isManager = role === 'manager' || role === 'user_unit' || role === 'manajer' || (!!profile?.unit_kerja_id && !isAdmin && !isAuditor);

    const validUnitIds = useMemo(() => {
        const ids: string[] = [];
        if (profile?.unit_kerja_id) ids.push(profile.unit_kerja_id);
        if (profile?.master_work_unit_id && !ids.includes(profile.master_work_unit_id)) {
            ids.push(profile.master_work_unit_id);
        }
        if (profile?.all_unit_ids) {
            profile.all_unit_ids.forEach(id => {
                if (id && !ids.includes(id)) ids.push(id);
            });
        }
        return ids;
    }, [profile]);

    const isMatchUnit = useCallback((uId?: string, uObj?: any) => {
        if (!isManager) return true;
        if (validUnitIds.length === 0 && !profile?.unit_kerja_name) return true;

        // 1. Direct ID match
        if (uId && validUnitIds.includes(uId)) return true;
        if (uObj?.id && validUnitIds.includes(uObj.id)) return true;

        // 2. Name-based match (exact or substring)
        if (profile?.unit_kerja_name) {
            const pName = profile.unit_kerja_name.toLowerCase().replace(/^(instalasi|unit|ruang|pelayanan)\s+/i, '').trim();
            const targetName = (uObj?.nama_unit || uObj?.name || uObj?.nama_unit_kerja || (typeof uObj === 'string' ? uObj : '')).toLowerCase().trim();

            if (pName && targetName) {
                if (targetName === pName || targetName.includes(pName) || pName.includes(targetName)) {
                    return true;
                }
            }
        }
        return false;
    }, [isManager, validUnitIds, profile]);

    return {
        profile,
        loading: isLoading,
        refreshProfile,
        isAdmin,
        isManager,
        isAuditor,
        role,
        validUnitIds,
        isMatchUnit,
    };
}

