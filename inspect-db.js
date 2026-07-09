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

async function inspectSchema() {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`;
    const headers = {
        'apikey': process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY}`,
        'Accept': 'application/openapi+json'
    };

    try {
        const res = await fetch(url, { headers });
        console.log('Status:', res.status);
        const text = await res.text();
        console.log('Raw Response length:', text.length);
        if (text.length < 500) {
            console.log('Raw text:', text);
        } else {
            // Save it to a file
            fs.writeFileSync('openapi-response.json', text);
            console.log('Saved response to openapi-response.json');

            const schema = JSON.parse(text);
            const tableKeys = Object.keys(schema.definitions || {});
            console.log('Available definitions in schema:', tableKeys);

            const targetTables = ['rencana_strategis', 'indikator_kinerja_utama', 'sasaran_strategi', 'rkt', 'profiles', 'unit_kerja'];
            targetTables.forEach(t => {
                const match = tableKeys.find(k => k.toLowerCase() === t.toLowerCase());
                if (match) {
                    console.log(`\nTable ${match} properties:`, Object.keys(schema.definitions[match].properties || {}));
                } else {
                    console.log(`\nTable ${t} not found in OpenAPI definitions`);
                }
            });
        }
    } catch (err) {
        console.error('Error:', err);
    }
}

inspectSchema();
