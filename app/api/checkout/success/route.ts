import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import crypto from "crypto";
import { authOptions } from "../../auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import Razorpay from "razorpay";
import { SubscriptionStatus } from "@prisma/client";

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

interface RequestBody {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
  gymId: string;
  planId: string;
}

export async function POST(req: Request) {
  console.log("🚀 Checkout Success API called");
  
  try {
    // 1. Authenticate the user
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      console.error("❌ No session found");
      return new NextResponse(JSON.stringify({ message: "Unauthorized" }), { status: 401 });
    }
    const userId = session.user.id;
    console.log("✅ User authenticated:", userId);

    // 2. Parse request body
    let body: RequestBody;
    try {
      body = await req.json();
      console.log("📦 Request body received:", body);
    } catch (parseError) {
      console.error("❌ Failed to parse request body:", parseError);
      return new NextResponse(JSON.stringify({ message: "Invalid request body" }), { status: 400 });
    }

    const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature, gymId, planId } = body;

    if (!gymId || !planId || !razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) {
      console.error("❌ Missing required fields:", { gymId: !!gymId, planId: !!planId, payment_id: !!razorpay_payment_id, subscription_id: !!razorpay_subscription_id, signature: !!razorpay_signature });
      return new NextResponse(JSON.stringify({ message: "Missing required payment details" }), { status: 400 });
    }

    // 3. Verify Razorpay signature for security
    console.log("🔐 Verifying signature...");
    const generated_signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(`${razorpay_payment_id}|${razorpay_subscription_id}`)
      .digest("hex");

    if (generated_signature !== razorpay_signature) {
      console.error("❌ Signature verification failed");
      console.log("Expected:", generated_signature);
      console.log("Received:", razorpay_signature);
      return new NextResponse(JSON.stringify({ message: "Invalid payment signature" }), { status: 400 });
    }
    console.log("✅ Signature verified");
    
    // 4. Verify that the user owns the gym
    const gym = await prisma.gym.findFirst({
      where: { id: gymId, ownerId: userId },
    });

    if (!gym) {
      console.error("❌ Gym not found or permission denied:", gymId, userId);
      return new NextResponse(JSON.stringify({ message: "Gym not found or permission denied." }), { status: 404 });
    }
    console.log("✅ Gym ownership verified:", gymId);

    // 5. Fetch subscription details from Razorpay
    let subscriptionDetails;
    try {
      subscriptionDetails = await razorpay.subscriptions.fetch(razorpay_subscription_id);
      console.log("📋 Razorpay Subscription Details:", JSON.stringify(subscriptionDetails, null, 2));
    } catch (razorpayError) {
      console.error("❌ Failed to fetch subscription from Razorpay:", razorpayError);
      return new NextResponse(JSON.stringify({ message: "Could not fetch subscription details from Razorpay." }), { status: 400 });
    }

    if (!subscriptionDetails) {
      console.error("❌ No subscription details returned from Razorpay");
      return new NextResponse(JSON.stringify({ message: "Could not fetch subscription details from Razorpay." }), { status: 400 });
    }

    // ✅ More lenient status check - accept 'created' and 'active'
    const validStatuses = ['created', 'active', 'authenticated'];
    if (!validStatuses.includes(subscriptionDetails.status)) {
      console.error(`❌ Subscription in invalid state: ${subscriptionDetails.status}`);
      return new NextResponse(JSON.stringify({ 
        message: `Subscription is not ready. Current status: ${subscriptionDetails.status}. Please try again in a few moments.` 
      }), { status: 400 });
    }
    console.log(`✅ Subscription status acceptable: ${subscriptionDetails.status}`);

    // ✅ Handle missing billing dates gracefully
    let currentPeriodStart: Date;
    let currentPeriodEnd: Date;

    if (subscriptionDetails.current_start && subscriptionDetails.current_end) {
      currentPeriodStart = new Date(subscriptionDetails.current_start * 1000);
      currentPeriodEnd = new Date(subscriptionDetails.current_end * 1000);
      console.log("✅ Using Razorpay billing dates");
    } else {
      // Fallback for new subscriptions without billing dates yet
      console.log("⚠️ Missing billing dates, using fallback");
      currentPeriodStart = new Date();
      currentPeriodEnd = new Date();
      currentPeriodEnd.setDate(currentPeriodEnd.getDate() + 30); // 30 days default
    }

    console.log("📅 Billing Period:", {
      start: currentPeriodStart.toISOString(),
      end: currentPeriodEnd.toISOString()
    });

    // 6. Update the gym's subscription in the database
    console.log("💾 Updating subscription in database...");
    try {
      const updatedGym = await prisma.gym.update({
        where: { id: gymId },
        data: {
          subscription: {
            upsert: {
              create: {
                status: SubscriptionStatus.ACTIVE,
                planId: planId,
                providerSubscriptionId: razorpay_subscription_id,
                currentPeriodStart: currentPeriodStart,
                currentPeriodEnd: currentPeriodEnd,
              },
              update: {
                status: SubscriptionStatus.ACTIVE,
                planId: planId,
                providerSubscriptionId: razorpay_subscription_id,
                currentPeriodStart: currentPeriodStart,
                currentPeriodEnd: currentPeriodEnd,
              },
            },
          },
        },
        include: {
          subscription: true
        }
      });

      console.log("✅ Subscription updated successfully:", updatedGym.subscription);

      return new NextResponse(JSON.stringify({ 
        message: "Subscription activated successfully!",
        subscription: {
          planId: updatedGym.subscription?.planId,
          status: updatedGym.subscription?.status,
          currentPeriodEnd: updatedGym.subscription?.currentPeriodEnd
        }
      }), { status: 200 });

    } catch (dbError) {
      console.error("❌ Database update failed:", dbError);
      return new NextResponse(JSON.stringify({ message: "Failed to update subscription in database." }), { status: 500 });
    }

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error("❌ Checkout Success Error:", errorMessage);
    console.error("❌ Error stack:", errorStack);
    
    return new NextResponse(JSON.stringify({ 
      message: "An internal server error occurred.",
      error: errorMessage 
    }), { status: 500 });
  }
}
