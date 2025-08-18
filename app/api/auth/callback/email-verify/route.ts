// app/api/auth/callback/email-verify/route.ts
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const email = searchParams.get("email");

  if (!token || !email) {
    return NextResponse.redirect(new URL('/auth-error?error=MissingToken', process.env.NEXTAUTH_URL));
  }

  const verificationToken = await prisma.emailVerificationToken.findFirst({
    where: {
      identifier: email,
      token: token,
    },
  });

  if (!verificationToken) {
    return NextResponse.redirect(new URL('/auth-error?error=InvalidToken', process.env.NEXTAUTH_URL));
  }

  if (new Date(verificationToken.expires) < new Date()) {
    return NextResponse.redirect(new URL('/auth-error?error=ExpiredToken', process.env.NEXTAUTH_URL));
  }

  // Mark the user's email as verified
  await prisma.user.update({
    where: { email: email },
    data: { emailVerified: new Date() },
  });

  // Delete the token so it can't be used again
  await prisma.emailVerificationToken.delete({
    where: { id: verificationToken.id },
  });

  // Redirect to a success page or the login page
  return NextResponse.redirect(new URL('/login?verified=true', process.env.NEXTAUTH_URL));
}