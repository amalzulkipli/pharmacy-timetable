import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;

  // Protect /admin/* routes
  if (pathname.startsWith('/admin')) {
    if (!isLoggedIn) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Protect state-changing API routes (POST/PUT/DELETE)
  if (pathname.startsWith('/api/')) {
    // Always allow NextAuth routes
    if (pathname.startsWith('/api/auth')) {
      return NextResponse.next();
    }

    // Always allow health check
    if (pathname === '/api/health') {
      return NextResponse.next();
    }

    // Allow GET requests on public data routes
    // SECURITY: Only schedule data is public - staff and leave data require auth
    if (req.method === 'GET') {
      const publicGetRoutes = [
        '/api/overrides', // Schedule data is meant to be publicly viewable
      ];
      const isPublicGetRoute = publicGetRoutes.some((route) =>
        pathname.startsWith(route)
      );
      if (isPublicGetRoute) {
        return NextResponse.next();
      }
    }

    // All other API requests require auth
    if (!isLoggedIn) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/admin/:path*', '/api/:path*'],
};
