const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://vperbqwlwupbnxvnzsrk.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwZXJicXdsd3VwYm54dm56c3JrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk2MDEwNSwiZXhwIjoyMDkxNTM2MTA1fQ.h8Y74dwcJcfAfnhtl5R7mSz_cohsvcsSlRE6DC9aNMQ'
);

async function check() {
    const { data: q1, error: err1 } = await supabase
        .from('unit_kerja')
        .select('*')
        .eq('id', '29b65571-39d1-45b2-ad1c-10c83e9b922f');

    console.log('In unit_kerja:', q1);

    const { data: q2 } = await supabase
        .from('master_work_units')
        .select('*')
        .eq('id', '29b65571-39d1-45b2-ad1c-10c83e9b922f');

    console.log('In master_work_units:', q2);
}

check();
