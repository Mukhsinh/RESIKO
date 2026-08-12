const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://vperbqwlwupbnxvnzsrk.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwZXJicXdsd3VwYm54dm56c3JrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk2MDEwNSwiZXhwIjoyMDkxNTM2MTA1fQ.h8Y74dwcJcfAfnhtl5R7mSz_cohsvcsSlRE6DC9aNMQ'
);

async function check() {
    const q = supabase
        .from('manajemen_risiko')
        .select('*, unit_kerja(id, nama_unit)')
        .order('created_at', { ascending: false })
        .in('unit_kerja_id', ['0eadadbf-de9e-43fe-8368-f82ca7b6be71']);

    const { data, error } = await q;
    console.log('first query err:', error, 'data:', data?.length);

    const q2 = supabase
        .from('manajemen_risiko')
        .select('*, unit_kerja(id, nama_unit)')
        .order('created_at', { ascending: false })
        .in('unit_kerja_id', ['0eadadbf-de9e-43fe-8368-f82ca7b6be71', 'another']);

    const { data: d2, error: e2 } = await q2;
    console.log('second query err:', e2);
}

check();
