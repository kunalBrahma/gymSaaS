// app/api/register/route.ts
import bcrypt from "bcrypt";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { sendVerificationEmail } from "@/lib/mail";
import { v4 as uuidv4 } from 'uuid';

// Make sure you have uuid installed: npm install uuid && npm install --save-dev @types/uuid
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, password } = body;

    // ... (your existing validation and user check logic) ...
    if (!name || !email || !password) {
      return new NextResponse("Missing fields", { status: 400 });
    }
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return new NextResponse("User already exists", { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        hashedPassword,
        // emailVerified is null by default, which is what we want
      },
    });

    // Generate a verification token
    const verificationToken = uuidv4();
    const tokenExpires = new Date(new Date().getTime() + 3600 * 1000); // 1 hour

    await prisma.emailVerificationToken.create({
      data: {
        identifier: email,
        token: verificationToken,
        expires: tokenExpires,
      },
    });

    // Send the verification email
    await sendVerificationEmail(email, verificationToken);

    return NextResponse.json({ message: "Confirmation email sent. Please check your inbox." }, { status: 201 });

  } catch (error) {
    console.error("REGISTRATION_ERROR", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}