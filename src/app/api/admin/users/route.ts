import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

export async function POST(req: Request) {
    try {
        const { email, password, role, unit_kerja_id } = await req.json();

        if (!email || !password) {
            return NextResponse.json({ error: 'Email dan password harus diisi' }, { status: 400 });
        }

        // Create the user in Auth
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
        });

        if (authError) {
            return NextResponse.json({ error: authError.message }, { status: 400 });
        }

        if (authData.user) {
            // Map role: admin -> superadmin, manager -> user_unit
            const dbRole = role === 'admin' ? 'superadmin' : (role === 'manager' ? 'user_unit' : role);

            // Upsert the profile with chosen role and unit
            const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
                id: authData.user.id,
                email: email,
                role: dbRole,
                unit_kerja_id: unit_kerja_id || null,
            });

            if (profileError) {
                // Rollback: delete created user from auth to prevent dangling user logins on failure
                await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
                return NextResponse.json({ error: `Gagal memperbarui profil: ${profileError.message}` }, { status: 400 });
            }
        }

        return NextResponse.json({ success: true, user: authData.user });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Terjadi kesalahan pada server' }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const { id, email, password, role, unit_kerja_id } = await req.json();

        if (!id) {
            return NextResponse.json({ error: 'ID Pengguna harus diisi' }, { status: 400 });
        }

        // 1. Update Auth attributes if provided
        const authUpdates: any = {};
        if (email) authUpdates.email = email;
        if (password) authUpdates.password = password;

        if (Object.keys(authUpdates).length > 0) {
            const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, authUpdates);
            if (authError) {
                return NextResponse.json({ error: authError.message }, { status: 400 });
            }
        }

        // 2. Update Profile table attributes
        const dbRole = role === 'admin' ? 'superadmin' : (role === 'manager' ? 'user_unit' : role);
        const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
            id: id,
            email: email,
            role: dbRole,
            unit_kerja_id: unit_kerja_id || null,
        });

        if (profileError) {
            return NextResponse.json({ error: profileError.message }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Terjadi kesalahan pada server' }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'ID Pengguna harus diisi' }, { status: 400 });
        }

        // Delete user from auth (which will cascade delete profiles if key config is on)
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);

        if (authError) {
            return NextResponse.json({ error: authError.message }, { status: 400 });
        }

        // Explicitly delete profile as well just in case cascade is not configured
        await supabaseAdmin.from('profiles').delete().eq('id', id);

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Terjadi kesalahan pada server' }, { status: 500 });
    }
}
