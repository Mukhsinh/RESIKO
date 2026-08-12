const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://vperbqwlwupbnxvnzsrk.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwZXJicXdsd3VwYm54dm56c3JrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk2MDEwNSwiZXhwIjoyMDkxNTM2MTA1fQ.h8Y74dwcJcfAfnhtl5R7mSz_cohsvcsSlRE6DC9aNMQ'
);

async function check() {
    const { data: all_ri } = await supabase.from('risk_inputs').select('id, nama_unit_kerja_id');
    const uniqueUnitKerjaIds = Array.from(new Set(all_ri?.map(r => r.nama_unit_kerja_id) || []));

    const { data: unitInfo } = await supabase.from('unit_kerja').select('id, nama_unit').in('id', uniqueUnitKerjaIds);
    console.log('Unique units in risk_inputs (unit_kerja):', unitInfo);

    const { data: mwuInfo } = await supabase.from('master_work_units').select('id, name').in('id', uniqueUnitKerjaIds);
    console.log('Unique units in risk_inputs (master_work_units):', mwuInfo);
}

check();
