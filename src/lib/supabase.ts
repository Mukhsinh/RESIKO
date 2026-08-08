import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Extract project ref from URL for localStorage key management
const projectRef = supabaseUrl.replace('https://', '').split('.')[0];
const SUPABASE_AUTH_KEY = `sb-${projectRef}-auth-token`;

// Centralized Singleton and Promise caching survival logic across HMR/component reload cycles
const globalObject = globalThis as any;

const adjustSessionExpiry = async (response: Response): Promise<Response> => {
    if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
        try {
            const clonedResponse = response.clone();
            const data = await clonedResponse.json();
            let modified = false;

            const adjustObj = (obj: any) => {
                if (obj && typeof obj === 'object') {
                    if (typeof obj.expires_in === 'number' && typeof obj.expires_at === 'number') {
                        const localNow = Math.floor(Date.now() / 1000);
                        obj.expires_at = localNow + obj.expires_in;
                        modified = true;
                    }
                    if (obj.session && typeof obj.session === 'object') {
                        adjustObj(obj.session);
                    }
                }
            };

            adjustObj(data);

            if (modified) {
                return new Response(JSON.stringify(data), {
                    status: response.status,
                    statusText: response.statusText,
                    headers: new Headers(response.headers),
                });
            }
        } catch (e) {
            // Fallthrough to fallback response
        }
    }
    return response;
};

const authFetchInterceptor = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : (input instanceof URL ? input.href : input.url);

    // Only intercept token refresh requests
    if (url.includes('/auth/v1/token') && url.includes('grant_type=refresh_token')) {
        console.log('[AUTH NETWORK] Intercepting token refresh HTTP request');

        if (globalObject.activeRefreshPromise) {
            console.log('[AUTH NETWORK] Refresh already in flight. Merging call to share existing request.');
            const response = await globalObject.activeRefreshPromise;
            return response.clone();
        }

        // Shared fetch promise execution with exponential backoff on retry (max 3 attempts)
        globalObject.activeRefreshPromise = (async () => {
            let attempt = 0;
            const maxAttempts = 3;
            let delay = 1000;

            while (attempt < maxAttempts) {
                try {
                    attempt++;
                    console.log(`[AUTH NETWORK] Dispatching /token refresh request (attempt ${attempt}/${maxAttempts})`);

                    // Clone request if it's an instance of Request to prevent body stream reuse errors
                    const req = (input instanceof Request) ? input.clone() : input;
                    const res = await fetch(req, init);

                    // If rate-limited (429), execute backoff if more attempts remain
                    if (res.status === 429) {
                        console.warn(`[AUTH NETWORK] Server returned 429 Too Many Requests (attempt ${attempt})`);
                        if (attempt < maxAttempts) {
                            console.log(`[AUTH NETWORK] Backoff: waiting ${delay}ms before retrying...`);
                            await new Promise(resolve => setTimeout(resolve, delay));
                            delay *= 2;
                            continue;
                        }
                    }

                    return adjustSessionExpiry(res);
                } catch (err) {
                    console.error(`[AUTH NETWORK] Connection failure during refresh (attempt ${attempt}):`, err);
                    if (attempt >= maxAttempts) {
                        throw err;
                    }
                    await new Promise(resolve => setTimeout(resolve, delay));
                    delay *= 2;
                }
            }
            throw new Error('Max attempts exhausted for token refresh.');
        })();

        const activePromiseInstance = globalObject.activeRefreshPromise;
        try {
            const response = await activePromiseInstance;
            return response.clone();
        } finally {
            setTimeout(() => {
                if (globalObject.activeRefreshPromise === activePromiseInstance) {
                    globalObject.activeRefreshPromise = null;
                    console.log('[AUTH NETWORK] Cleared active refresh promise cache after cooldown.');
                }
            }, 2000);
            console.log('[AUTH NETWORK] Token refresh sequence resolved.');
        }
    }

    const res = await fetch(input, init);
    if (url.includes('/auth/v1/')) {
        return adjustSessionExpiry(res);
    }
    return res;
};

// Centralized Singleton instance logic to survive HMR/component reload cycles

if (!globalObject.supabaseClientInstance) {
    console.log('[AUTH] Instantiating main Supabase client singleton');
    globalObject.supabaseClientInstance = createBrowserClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true,
        },
        global: {
            fetch: authFetchInterceptor,
        },
    });
}

export const supabase: SupabaseClient = globalObject.supabaseClientInstance;

/**
 * Directly purge the Supabase auth token from localStorage.
 * Use this instead of supabase.auth.signOut() when the server is rate-limiting (429),
 * because signOut() itself makes an API call that would also get rate-limited.
 */
export function purgeAuthStorage() {
    try {
        // 1. Clear known Supabase localStorage keys
        localStorage.removeItem(SUPABASE_AUTH_KEY);

        // Loop and remove any other keys starting with sb- or containing supabase
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('sb-') || key.toLowerCase().includes('supabase'))) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(k => {
            try { localStorage.removeItem(k); } catch { }
        });

        // 2. Clear cookies (both root path and domain specific)
        if (typeof document !== 'undefined') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i];
                const eqPos = cookie.indexOf('=');
                const name = eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim();

                if (name.startsWith('sb-') || name.toLowerCase().includes('supabase')) {
                    // Set cookie expiration to past date to delete it
                    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;

                    if (typeof window !== 'undefined') {
                        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`;

                        const domainParts = window.location.hostname.split('.');
                        if (domainParts.length > 1) {
                            const parentDomain = domainParts.slice(-2).join('.');
                            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${parentDomain};`;
                        }
                    }
                }
            }
        }
    } catch (e) {
        console.error('Failed to purge auth storage:', e);
    }
}

export type UserRole = 'superadmin' | 'user_unit';

export interface Profile {
    id: string;
    email: string;
    role: UserRole;
    unit_kerja_id: string | null;
    created_at: string;
}

export interface UnitKerja {
    id: string;
    nama_unit: string;
    created_at: string;
}

export interface TahunAnggaran {
    id: string;
    tahun: number;
    keterangan: string;
    aktif: boolean;
    created_at: string;
}

export interface ManajemenRisiko {
    id: string;
    unit_kerja_id: string;
    tahun: number;
    identifikasi_risiko: string;
    probabilitas: number;
    dampak: number;
    skor_risiko: number;
    mitigasi: string | null;
    status: string;
    created_at: string;
    unit_kerja?: UnitKerja;
}

export interface ManajemenStrategi {
    id: string;
    unit_kerja_id: string;
    tahun: number;
    sasaran_strategis: string;
    kpi: string;
    target: string;
    realisasi: string;
    created_at: string;
    unit_kerja?: UnitKerja;
}

export interface PengaturanAI {
    id: string;
    model_ai_terpilih: string;
    konfigurasi_tambahan: Record<string, unknown>;
    aktif: boolean;
    updated_at: string;
}
