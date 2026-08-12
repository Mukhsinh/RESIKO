const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://vperbqwlwupbnxvnzsrk.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwZXJicXdsd3VwYm54dm56c3JrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk2MDEwNSwiZXhwIjoyMDkxNTM2MTA1fQ.h8Y74dwcJcfAfnhtl5R7mSz_cohsvcsSlRE6DC9aNMQ'
);

async function check() {
    const { data: p } = await supabase.from('profiles').select('*').in('unit_kerja_id', [
        '29b65571-39d1-45b2-ad1c-10c83e9b922f',
        '79dbb36a-a7f8-41be-a56e-dd4f7c367375'
    ]);
    console.log('Profiles for Keuangan:', p);


    const { data: pAll } = await supabase.from('profiles').select('email, role, unit_kerja_id');
    console.log('All Profiles:', pAll);
}
check();
