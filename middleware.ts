// middleware.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import prisma from './lib/prisma';

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const { pathname } = req.nextUrl;

  // If the user is not logged in, redirect them to the login page
  if (!token) {
    // To prevent redirect loops, allow the user to access the login page
    if (pathname !== '/login') {
        return NextResponse.redirect(new URL('/login', req.url));
    }
    return NextResponse.next();
  }

  // If the user is logged in, check if they have completed setup
  const user = await prisma.user.findUnique({
    where: { id: token.id as string },
    // --- THIS IS THE FIX ---
    // Instead of selecting a column, we select the relationship itself.
    select: { gym: true },
  });

  // Check if the gym relationship exists
  const hasCompletedSetup = !!user?.gym;

  // If the user tries to access the setup page but has already completed it,
  // redirect them to the dashboard.
  if (hasCompletedSetup && pathname.startsWith('/setup')) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  // If the user tries to access the dashboard but has NOT completed setup,
  // force them to the setup page.
  if (!hasCompletedSetup && pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/setup', req.url));
  }

  // If none of the above conditions are met, let them proceed.
  return NextResponse.next();
}

// This config specifies which routes the middleware should run on.
export const config = {
  matcher: [
    '/dashboard/:path*', // Protect the dashboard and all its sub-pages
    '/setup/:path*',      // Protect the setup page
  ],
};