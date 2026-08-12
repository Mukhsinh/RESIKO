const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://vperbqwlwupbnxvnzsrk.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwZXJicXdsd3VwYm54dm56c3JrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk2MDEwNSwiZXhwIjoyMDkxNTM2MTA1fQ.h8Y74dwcJcfAfnhtl5R7mSz_cohsvcsSlRE6DC9aNMQ'
);

async function check() {
    const { data: q, error: e } = await supabase.from('manajemen_risiko').select('id, unit_kerja_id');
    const ids = Array.from(new Set(q?.map(x => x.unit_kerja_id) || []));
    console.log('unique unit_kerja_ids in manajemen_risiko:', ids);

    const { data: u1 } = await supabase.from('unit_kerja').select('id, nama_unit').in('id', ids);
    console.log('in unit_kerja:', u1);

    const { data: u2 } = await supabase.from('master_work_units').select('id, name').in('id', ids);
    console.log('in master_work_units:', u2);
}

check();
