import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const adminApp = getApps()[0] ?? initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });

async function isValidToken(token: string): Promise<boolean> {
  try {
    await getAuth(adminApp).verifyIdToken(token);
    return true;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuthPage = pathname.startsWith('/login');
  const rawToken = request.cookies.get('fb-auth-token')?.value;
  const authenticated = !!rawToken && (await isValidToken(rawToken));

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
