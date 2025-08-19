import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route"; // Corrected auth import path
import prisma from "@/lib/prisma"; // Corrected prisma import

/**
 * Defines the expected shape of the request body for better type safety.
 */
interface RequestBody {
  gymId: string;
}

/**
 * API route to handle the selection of the free plan for a gym.
 * It updates the gym's record in the database according to the provided schema.
 */
export async function POST(req: Request) {
  try {
    // 1. Authenticate the user
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new NextResponse(
        JSON.stringify({ message: "Unauthorized" }),
        { status: 401 }
      );
    }
    const userId = session.user.id;

    // 2. Parse the request body to get the gymId
    const { gymId } = (await req.json()) as RequestBody;

    if (!gymId) {
      return new NextResponse(
        JSON.stringify({ message: "Gym ID is required" }),
        { status: 400 }
      );
    }

    // 3. Verify that the user owns the gym they are trying to update
    const gym = await prisma.gym.findFirst({
      where: {
        id: gymId,
        ownerId: userId, 
      },
    });

    if (!gym) {
      return new NextResponse(
        JSON.stringify({ message: "Gym not found or you do not have permission to update it." }),
        { status: 404 }
      );
    }

    // For the free plan, set the end date far into the future.
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 100);

    // 4. Update the gym's related subscription
    // This uses a nested write (upsert) to create or update the subscription.
    await prisma.gym.update({
      where: {
        id: gymId,
      },
      data: {
        subscription: {
          upsert: {
            // If a subscription for the gym doesn't exist, create it
            create: {
              status: "ACTIVE",
              planId: "free_plan", 
              providerSubscriptionId: `free_${gymId}`, 
              currentPeriodStart: new Date(),
              currentPeriodEnd: futureDate,
            },
            // If a subscription already exists, update it
            update: {
              status: "ACTIVE",
              planId: "free_plan",
              providerSubscriptionId: `free_${gymId}`,
              currentPeriodStart: new Date(),
              currentPeriodEnd: futureDate,
              // Assuming you might have a razorpaySubscriptionId field to clear
              // If not, you can remove the next line.
              // razorpaySubscriptionId: null, 
            },
          },
        },
      },
    });

    // 5. Return a success response
    return new NextResponse(
      JSON.stringify({ message: "Successfully selected free plan." }),
      { status: 200 }
    );

  } catch (error) {
    console.error("Error selecting free plan:", error);
    return new NextResponse(
      JSON.stringify({ message: "An internal server error occurred." }),
      { status: 500 }
    );
  }
}
