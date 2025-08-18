// app/api/auth/reset-password/route.ts
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { z } from "zod";

const resetSchema = z.object({
  password: z.string().min(8),
  token: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validation = resetSchema.safeParse(body);

    if (!validation.success) {
      return new NextResponse("Invalid input", { status: 400 });
    }

    const { password, token } = validation.data;

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!resetToken || new Date(resetToken.expires) < new Date()) {
      return new NextResponse("Invalid or expired token", { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await prisma.user.update({
      where: { email: resetToken.email },
      data: { hashedPassword },
    });

    // Delete the token after use
    await prisma.passwordResetToken.delete({ where: { id: resetToken.id } });

    return NextResponse.json({ message: "Password has been reset successfully." });

  } catch (error) {
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}