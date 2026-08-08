import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Middleware now only passes through all requests.
// Auth protection is handled client-side via useAuthGuard hook.
// This eliminates the cookie dependency that caused false redirects to /login.
export function proxy(_request: NextRequest) {
    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};
