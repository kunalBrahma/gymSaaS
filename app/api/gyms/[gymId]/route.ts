import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

// NEW: This function handles FETCHING a specific gym's details
export async function GET(
  req: Request,
  { params }: { params: { gymId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { gymId } = params;

    const gym = await prisma.gym.findUnique({
      where: { id: gymId },
    });

    // Authorization check: ensure the gym belongs to the logged-in user
    if (!gym || gym.ownerId !== session.user.id) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    return NextResponse.json(gym);
  } catch (error) {
    console.error("GYM_FETCH_ERROR", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

// This is your existing function for UPDATING a gym
export async function PUT(
  req: Request,
  { params }: { params: { gymId: string } }
) {
  // ... your existing PUT logic is correct and does not need to change ...
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { gymId } = params;
    const body = await req.json();
    const { name, address, description } = body;

    if (!name || !address) {
      return new NextResponse("Name and address are required", { status: 400 });
    }

    const gymToUpdate = await prisma.gym.findUnique({ where: { id: gymId } });

    if (!gymToUpdate || gymToUpdate.ownerId !== session.user.id) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const updatedGym = await prisma.gym.update({
      where: { id: gymId },
      data: { name, address, description },
    });

    return NextResponse.json(updatedGym);
  } catch (error) {
    console.error("GYM_UPDATE_ERROR", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}