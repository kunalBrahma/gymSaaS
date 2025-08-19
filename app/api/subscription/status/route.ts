// app/api/subscription/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getSubscriptionStatusReadOnly } from "@/lib/subscription";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const gymId = req.nextUrl.searchParams.get('gymId');
    if (!gymId) {
      return NextResponse.json({ error: "Gym ID required" }, { status: 400 });
    }

    // Verify user owns this gym
    const gym = await prisma.gym.findFirst({
      where: { id: gymId, ownerId: session.user.id }
    });

    if (!gym) {
      return NextResponse.json({ error: "Gym not found" }, { status: 404 });
    }

    // Get subscription status (read-only to avoid race conditions)
    const status = await getSubscriptionStatusReadOnly(gymId);
    
    return NextResponse.json(status);

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ Error getting subscription status:", errorMessage);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
