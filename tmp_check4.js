const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://vperbqwlwupbnxvnzsrk.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwZXJicXdsd3VwYm54dm56c3JrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk2MDEwNSwiZXhwIjoyMDkxNTM2MTA1fQ.h8Y74dwcJcfAfnhtl5R7mSz_cohsvcsSlRE6DC9aNMQ'
);

async function check() {
    const { data: q1, error: err1 } = await supabase
        .from('manajemen_risiko')
        .select('*')
        .or('unit_kerja_id.eq.0eadadbf-de9e-43fe-8368-f82ca7b6be71,unit_kerja_id.eq.fed68e73-ec90-4948-aa64-3f5f77100f73');

    console.log('Manajemen Risiko for Rawat Inap:', q1?.length || 0, q1);
}

check();
