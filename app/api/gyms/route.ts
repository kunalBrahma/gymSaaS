import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { gym: true }, 
    });

    if (existingUser?.gym) {
      return new NextResponse("User already has a gym", { status: 400 });
    }

    const body = await req.json();
    const { name, address, description } = body;

    if (!name || !address) {
      return new NextResponse("Name and address are required", { status: 400 });
    }
    
    // The relationship is created here in a single step.
    // We no longer need a transaction or a separate user.update call.
    const newGym = await prisma.gym.create({
      data: {
        name,
        address,
        description,
        // This 'connect' operation correctly sets the ownerId on the Gym table
        owner: {
          connect: { id: session.user.id },
        },
      },
    });

    return NextResponse.json(newGym, { status: 201 });

  } catch (error) {
    console.error("GYM_CREATION_ERROR", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}