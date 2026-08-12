const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://vperbqwlwupbnxvnzsrk.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwZXJicXdsd3VwYm54dm56c3JrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk2MDEwNSwiZXhwIjoyMDkxNTM2MTA1fQ.h8Y74dwcJcfAfnhtl5R7mSz_cohsvcsSlRE6DC9aNMQ'
);

async function check() {
    const { data: profiles, error: err4 } = await supabase.from('profiles').select('*').ilike('email', 'ranap@ bendanrs.com').maybeSingle();
    let ranapUser = null;
    const { data: allProfiles } = await supabase.from('profiles').select('*');
    if (allProfiles) {
        ranapUser = allProfiles.find(p => p.email && p.email.includes('ranap'));
    }

    console.log('Ranap User:', ranapUser);

    if (ranapUser && ranapUser.unit_kerja_id) {
        const { data: uk } = await supabase.from('unit_kerja').select('*').eq('id', ranapUser.unit_kerja_id);
        const { data: mwu } = await supabase.from('master_work_units').select('*').eq('id', ranapUser.unit_kerja_id);
        console.log('Unit Kerja for user:', uk);
        console.log('Master Work Units for user:', mwu);
    }

    const { data, error } = await supabase
        .from('manajemen_risiko')
        .select('id, unit_kerja_id, nama_unit_kerja, identifikasi_risiko')
        .limit(10);

    console.log('Manajemen Risiko:', data);
    console.log('Error:', error);

    const { data: uks } = await supabase.from('unit_kerja').select('*').ilike('nama_unit', '%rawat inap%');
    console.log('Unit kerja match:', uks);

    const { data: mwus } = await supabase.from('master_work_units').select('*').ilike('name', '%rawat inap%');
    console.log('Master work unit match:', mwus);
}

check();
