import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Fetch the user and include their related gym data
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        gym: true, // Include the full gym object
      },
    });

    const hasCreatedGym = !!user?.gym;
    
    // THE FIX: Return both the status and the gym's ID if it exists.
    return NextResponse.json({
      hasCreatedGym,
      gymId: user?.gym?.id || null,
    });

  } catch (error) {
    console.error("ONBOARDING_STATUS_ERROR", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
