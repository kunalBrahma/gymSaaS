// app/api/gyms/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const { name, address } = body;

    if (!name) {
      return new NextResponse("Gym name is required", { status: 400 });
    }

    // Check if user already has a gym
    const existingUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { gym: true },
    });

    if (existingUser?.gym) {
      return new NextResponse("User already has a gym", { status: 400 });
    }

    const gym = await prisma.gym.create({
      data: {
        name,
        address,
        ownerId: session.user.id,
      },
    });

    return NextResponse.json(gym, { status: 201 });

  } catch (error) {
    console.error("GYM_CREATION_ERROR", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}