import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Find the gym by looking for the one owned by the current user
    const gym = await prisma.gym.findUnique({
      where: { ownerId: session.user.id },
    });

    if (!gym) {
      return new NextResponse("Gym not found for the current user", { status: 404 });
    }

    // Check if a subscription already exists to prevent duplicates
    const existingSubscription = await prisma.subscription.findUnique({
      where: { gymId: gym.id }
    });

    if (existingSubscription) {
      return new NextResponse("Subscription already exists for this gym", { status: 409 });
    }

    // ✅ Create the future date (100 years approach)
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 100);

    // ✅ Create the free subscription record
    const newSubscription = await prisma.subscription.create({
      data: {
        gymId: gym.id,
        planId: 'free_plan',                           // ✅ Consistent naming
        status: 'ACTIVE',
        providerSubscriptionId: `free_${gym.id}`,      // ✅ Unique per gym
        currentPeriodStart: new Date(),
        currentPeriodEnd: futureDate,                  // ✅ 100 years approach
      },
    });

    console.log(`✅ Free plan created for gym: ${gym.id}`, newSubscription);
    
    return NextResponse.json({ 
      message: "Free plan activated successfully",
      subscriptionId: newSubscription.id 
    });

  } catch (error: unknown) {
  console.error("FREE_PLAN_ACTIVATION_ERROR", error);

  if ((error as any).code === 'P2002') {
    return new NextResponse("Subscription already exists", { status: 409 });
  }

  return new NextResponse("Internal Server Error", { status: 500 });
}

}
