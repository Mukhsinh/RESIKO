'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function AppFooter() {
    const [footerText, setFooterText] = useState('');

    useEffect(() => {
        supabase.from('app_settings').select('footer').limit(1).single()
            .then(({ data }: { data: any }) => {
                if (data && data.footer) {
                    setFooterText(data.footer);
                }
            });
    }, []);

    if (!footerText) return null;

    return (
        <footer className="mt-auto py-4 px-6 border-t border-slate-100/50 bg-slate-50 text-center">
            <p className="text-xs text-slate-500 italic">
                {footerText}
            </p>
        </footer>
    );
}
