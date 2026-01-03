import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Protect all /admin/* routes
  if (pathname.startsWith('/admin')) {
    const authCookie = request.cookies.get('pharmacy-admin-auth')

    if (!authCookie || authCookie.value !== 'true') {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('from', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/admin/:path*'
}
