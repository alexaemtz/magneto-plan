import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/** base64url → UTF-8 string (Edge-runtime safe, no Buffer) */
function b64url(s: string): string {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
}

/**
 * Verify JWT claims without signature (no Admin SDK needed in Edge).
 * Real data security is enforced by Firestore Security Rules.
 */
function isValidToken(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;

    const payload = JSON.parse(b64url(parts[1]));
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const now = Math.floor(Date.now() / 1000);

    return (
      payload.aud === projectId &&
      payload.iss === `https://securetoken.google.com/${projectId}` &&
      typeof payload.exp === 'number' &&
      payload.exp > now
    );
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuthPage = pathname.startsWith('/login');
  const rawToken = request.cookies.get('fb-auth-token')?.value;
  const authenticated = !!rawToken && isValidToken(rawToken);

  if (!isAuthPage && !authenticated) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (isAuthPage && authenticated) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};
