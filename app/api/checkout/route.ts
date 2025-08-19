import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import Razorpay from "razorpay";

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { gym: true },
    });

    if (!user || !user.gym) {
      return new NextResponse("User or gym not found", { status: 404 });
    }

    const { planId } = await req.json();
    if (!planId) {
      return new NextResponse("Plan ID is required", { status: 400 });
    }
    
    // Create a subscription in Razorpay
    const subscription = await razorpay.subscriptions.create({
      plan_id: planId,
      total_count: 12, // Example: for a 1-year plan. Leave blank for indefinite.
      quantity: 1,
      // CRITICAL: This links the Razorpay subscription to your internal gym ID
      notes: {
        gymId: user.gym.id,
      },
    });

    // Return the subscription ID which is used by the frontend to open the checkout
    return NextResponse.json({
      subscriptionId: subscription.id,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    });

  } catch (error: any) {
    console.error("RAZORPAY_CHECKOUT_ERROR:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
