const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://vperbqwlwupbnxvnzsrk.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwZXJicXdsd3VwYm54dm56c3JrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk2MDEwNSwiZXhwIjoyMDkxNTM2MTA1fQ.h8Y74dwcJcfAfnhtl5R7mSz_cohsvcsSlRE6DC9aNMQ'
);

async function check() {
    const { data, error } = await supabase.rpc('execute_sql', {
        query: `SELECT enum_range(NULL::role_type);`
    });
    console.log('Enum range:', data, error);
}

check();
