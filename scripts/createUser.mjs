import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf-8');
const supabaseUrl = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1]?.trim();
const supabaseKey = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim();
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const email = 'mukhsin9@gmail.com';
    const password = 'Jlamprang233!!';

    console.log(`Signing up user: ${email}...`);
    // Sign up user
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
    });

    if (authError) {
        console.error('Sign up error:', authError.message);
        process.exit(1);
    }

    const user = authData?.user;
    if (!user) {
        console.error('No user returned.');
        process.exit(1);
    }

    console.log(`User created with ID: ${user.id}`);

    console.log('Inserting into profiles...');
    const { error: profileError } = await supabase.from('profiles').upsert({
        id: user.id,
        email: user.email,
        role: 'superadmin',
    });

    if (profileError) {
        console.error('Profile insert error:', profileError.message);
    } else {
        console.log('Successfully set as superadmin.');
    }
}

main();
