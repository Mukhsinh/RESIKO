const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://vperbqwlwupbnxvnzsrk.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwZXJicXdsd3VwYm54dm56c3JrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk2MDEwNSwiZXhwIjoyMDkxNTM2MTA1fQ.h8Y74dwcJcfAfnhtl5R7mSz_cohsvcsSlRE6DC9aNMQ'
);

async function check() {
    const { data, error } = await supabase
        .from('manajemen_risiko')
        .select('*, unit_kerja!inner(id, nama_unit)')
        .ilike('unit_kerja.nama_unit', '%rawat inap%');

    console.log('Manajemen Risiko for Rawat Inap by substring:', data?.length, data);

    const { data: all_mr } = await supabase.from('manajemen_risiko').select('id, unit_kerja_id');
    const uniqueUnitKerjaIds = Array.from(new Set(all_mr?.map(r => r.unit_kerja_id) || []));

    const { data: unitInfo } = await supabase.from('unit_kerja').select('id, nama_unit').in('id', uniqueUnitKerjaIds);
    console.log('Unique units in manajemen_risiko:', unitInfo);

}

check();
