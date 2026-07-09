const fs = require('fs');
const path = require('path');

// Custom parse env.local
const envPath = path.resolve(__dirname, '.env.local');
const envData = fs.readFileSync(envPath, 'utf8');
envData.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (match) {
        const key = match[1];
        let value = match[2].trim();
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
        process.env[key] = value;
    }
});

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY);

async function inspectData() {
    try {
        const { data: units } = await supabase.from('unit_kerja').select('*');
        const { data: mUnits } = await supabase.from('master_work_units').select('*');
        const { data: profiles } = await supabase.from('profiles').select('*');

        console.log('--- unit_kerja ---');
        console.log(units);
        console.log('--- master_work_units ---');
        console.log(mUnits);
        console.log('--- profiles ---');
        console.log(profiles);
    } catch (err) {
        console.error(err);
    }
}

inspectData();
