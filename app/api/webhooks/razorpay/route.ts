import { NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error("Razorpay webhook secret is not set.");
    return new NextResponse("Webhook secret not configured", { status: 500 });
  }

  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature");

    if (!signature) {
      return new NextResponse("Signature missing", { status: 400 });
    }

    // --- Signature Verification ---
    const shasum = crypto.createHmac("sha256", secret);
    shasum.update(rawBody);
    const digest = shasum.digest("hex");

    if (digest !== signature) {
      return new NextResponse("Invalid signature", { status: 400 });
    }
    
    // --- Signature is Valid: Process the Event ---
    const event = JSON.parse(rawBody);

    // Use a switch statement to handle different event types
    switch (event.event) {

      // This event fires for the initial payment AND all recurring payments
      case 'subscription.charged':
        const subscriptionCharged = event.payload.subscription.entity;
        const gymIdCharged = subscriptionCharged.notes?.gymId;

        if (!gymIdCharged) {
          throw new Error("gymId missing from webhook notes for subscription.charged");
        }

        // Update the subscription in your database
        await prisma.subscription.update({
          where: { gymId: gymIdCharged },
          data: {
            status: 'ACTIVE',
            providerSubscriptionId: subscriptionCharged.id,
            // Razorpay timestamps are in seconds, convert to ISO string
            currentPeriodStart: new Date(subscriptionCharged.current_start * 1000),
            currentPeriodEnd: new Date(subscriptionCharged.current_end * 1000),
          },
        });
        console.log(`Subscription ACTIVATED or RENEWED for Gym ID: ${gymIdCharged}`);
        break;

      case 'subscription.cancelled':
        const subscriptionCancelled = event.payload.subscription.entity;
        const gymIdCancelled = subscriptionCancelled.notes?.gymId;

        if (!gymIdCancelled) {
          throw new Error("gymId missing from webhook notes for subscription.cancelled");
        }
        
        await prisma.subscription.update({
          where: { gymId: gymIdCancelled },
          data: { status: 'CANCELED' },
        });
        console.log(`Subscription CANCELED for Gym ID: ${gymIdCancelled}`);
        break;

      case 'subscription.halted':
        const subscriptionHalted = event.payload.subscription.entity;
        const gymIdHalted = subscriptionHalted.notes?.gymId;

        if (!gymIdHalted) {
          throw new Error("gymId missing from webhook notes for subscription.halted");
        }
        
        await prisma.subscription.update({
          where: { gymId: gymIdHalted },
          data: { status: 'PAST_DUE' },
        });
        console.log(`Subscription HALTED (payment failed) for Gym ID: ${gymIdHalted}`);
        break;
      
      // You can add more cases for other events you subscribe to
      default:
        console.log(`Unhandled Razorpay event type: ${event.event}`);
    }
    
    // Acknowledge receipt of the event
    return NextResponse.json({ status: "ok" });

  } catch (error: any) {
    console.error("Webhook processing error:", error.message);
    return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 });
  }
}