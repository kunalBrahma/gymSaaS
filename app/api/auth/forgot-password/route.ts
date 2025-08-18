// app/api/auth/forgot-password/route.ts
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from 'uuid';
// You'll need a mail utility like the one we made for verification
import { sendPasswordResetEmail } from "@/lib/mail";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email) {
      return new NextResponse("Email is required", { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Still return a success message to prevent email enumeration
      return NextResponse.json({ message: "If an account with this email exists, a reset link has been sent." });
    }

    const token = uuidv4();
    const expires = new Date(new Date().getTime() + 3600 * 1000); // 1 hour

    await prisma.passwordResetToken.create({
      data: { email, token, expires },
    });

    await sendPasswordResetEmail(email, token);

    return NextResponse.json({ message: "If an account with this email exists, a reset link has been sent." });

  } catch (error) {
   
    console.error("FORGOT_PASSWORD_ERROR:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}