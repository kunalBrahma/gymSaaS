import { NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { SubscriptionStatus } from "@prisma/client";

const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

/**
 * Check and update naturally expired subscriptions to free plan
 */
async function handleNaturalExpiry() {
  try {
    const now = new Date();
    
    // Find all expired subscriptions that aren't already on free plan
    const expiredSubscriptions = await prisma.subscription.findMany({
      where: {
        currentPeriodEnd: { lt: now },
        status: SubscriptionStatus.ACTIVE,
        planId: { not: "free_plan" }
      }
    });

    if (expiredSubscriptions.length > 0) {
      console.log(`🔄 Found ${expiredSubscriptions.length} naturally expired subscriptions. Converting to free plan...`);
      
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 100);

      // Update all expired subscriptions to free plan
      for (const subscription of expiredSubscriptions) {
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            status: SubscriptionStatus.ACTIVE,          // ✅ Keep ACTIVE status
            planId: "free_plan",                        // ✅ Change to free plan
            // ✅ DON'T change providerSubscriptionId for natural expiry (keep original for reactivation)
            currentPeriodStart: now,
            currentPeriodEnd: futureDate,               // ✅ 100 years for free plan
          },
        });

        console.log(`✅ Subscription naturally expired → free plan: ${subscription.providerSubscriptionId}`);
      }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ Error handling natural expiry:", errorMessage);
  }
}

export async function POST(req: Request) {
  console.log("🚀 =================WEBHOOK TRIGGERED=================");
  console.log("📅 Timestamp:", new Date().toISOString());
  
  try {
    // Log all headers for debugging
    console.log("📋 Headers received:");
    for (const [key, value] of req.headers.entries()) {
      console.log(`  ${key}: ${value}`);
    }

    const signature = req.headers.get("x-razorpay-signature");
    const rawBody = await req.text();
    
    console.log("🔐 Signature received:", signature);
    console.log("📦 Raw body length:", rawBody.length);
    console.log("📦 Raw body preview:", rawBody.substring(0, 300) + "...");

    // Environment check
    if (!RAZORPAY_WEBHOOK_SECRET) {
      console.error("❌ RAZORPAY_WEBHOOK_SECRET not found");
      console.log("🔍 Available env vars:", Object.keys(process.env).filter(k => k.includes('RAZORPAY')));
      return new NextResponse("Webhook secret not configured.", { status: 500 });
    }
    console.log("✅ Webhook secret found");

    if (!signature) {
      console.error("❌ No signature in headers");
      return new NextResponse("Signature missing.", { status: 400 });
    }

    // Signature verification
    const expectedSignature = crypto
      .createHmac("sha256", RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");

    console.log("🔐 Expected signature:", expectedSignature);
    console.log("🔐 Received signature:", signature);
    
    if (expectedSignature !== signature) {
      console.error("❌ Signature mismatch!");
      return new NextResponse("Invalid signature.", { status: 400 });
    }
    console.log("✅ Signature verified");

    // ✅ Handle natural expiry BEFORE processing webhook events
    await handleNaturalExpiry();

    // Parse event
    const event = JSON.parse(rawBody);
    const eventType = event.event;
    
    console.log("📋 Event type:", eventType);
    console.log("📋 Full event:", JSON.stringify(event, null, 2));

    // Skip payment-only events (not related to subscriptions)
    if (eventType.startsWith('payment.') && !event.payload?.subscription) {
      console.log(`⏭️ Skipping payment-only event: ${eventType}`);
      return NextResponse.json({ status: "skipped", eventType });
    }

    // Check payload structure
    if (!event.payload?.subscription?.entity) {
      console.error("❌ Invalid payload structure");
      return NextResponse.json({ status: "error", message: "Invalid payload" });
    }

    const subscriptionEntity = event.payload.subscription.entity;
    const providerSubscriptionId = subscriptionEntity.id;
    
    console.log("🔍 Looking for subscription ID:", providerSubscriptionId);

    // Database connection test
    try {
      await prisma.$connect();
      console.log("✅ Database connected");
    } catch (dbError: unknown) {
      const errorMessage = dbError instanceof Error ? dbError.message : String(dbError);
      console.error("❌ Database connection failed:", errorMessage);
      return new NextResponse("Database error.", { status: 500 });
    }

    // Find subscription
    const subscription = await prisma.subscription.findUnique({
      where: { providerSubscriptionId },
    });

    if (!subscription) {
      console.error("❌ Subscription not found for ID:", providerSubscriptionId);
      
      // List all subscriptions for debugging
      const allSubs = await prisma.subscription.findMany({
        select: { id: true, providerSubscriptionId: true, gymId: true }
      });
      console.log("📋 All subscriptions in DB:", allSubs);
      
      return NextResponse.json({ 
        status: "warning", 
        message: "Subscription not found",
        searchedId: providerSubscriptionId,
        availableIds: allSubs.map(s => s.providerSubscriptionId)
      });
    }

    console.log("✅ Found subscription:", subscription.id);

    // Handle webhook events
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 100);

    switch (eventType) {
      case "subscription.halted":
      case "subscription.cancelled":
        console.log("🔄 Processing webhook cancellation...");
        const cancelledSub = await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            status: SubscriptionStatus.ACTIVE,               // ✅ Keep ACTIVE status
            planId: "free_plan",                            // ✅ Change to free plan
            providerSubscriptionId: `cancelled_${subscription.providerSubscriptionId}`, // ✅ Change ID for cancellations
            currentPeriodStart: new Date(),
            currentPeriodEnd: futureDate,                   // ✅ 100 years for free plan
          },
        });
        console.log("✅ Subscription cancelled → free plan:", cancelledSub);
        break;

      case "subscription.paused":
        console.log("🔄 Processing subscription pause...");
        // Option A: Immediate free plan reversion
        const pausedSub = await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            status: SubscriptionStatus.ACTIVE,              // ✅ Keep ACTIVE status
            planId: "free_plan",                           // ✅ Revert to free plan immediately
            currentPeriodStart: new Date(),
            currentPeriodEnd: futureDate,                  // ✅ 100 years for free plan
          },
        });
        console.log("✅ Subscription paused → free plan:", pausedSub);
        break;

      case "subscription.charged":
        console.log("🔄 Processing successful charge (ongoing subscription)...");
        const chargedSub = await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            status: SubscriptionStatus.ACTIVE,
            // ✅ DON'T change planId - keep current plan (could be reactivation)
            currentPeriodStart: new Date(subscriptionEntity.current_start * 1000),
            currentPeriodEnd: new Date(subscriptionEntity.current_end * 1000),   // ✅ Back to monthly billing!
          },
        });
        console.log("✅ Subscription charged successfully:", chargedSub);
        break;

      case "subscription.activated":
        console.log("🔄 Processing subscription activation (new or reactivated)...");
        const activatedSub = await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            status: SubscriptionStatus.ACTIVE,
            planId: subscriptionEntity.plan_id,            // ✅ Set to actual Razorpay plan ID
            currentPeriodStart: new Date(subscriptionEntity.current_start * 1000),
            currentPeriodEnd: new Date(subscriptionEntity.current_end * 1000),
          },
        });
        console.log("✅ Subscription activated:", activatedSub);
        break;

      case "subscription.completed":
        console.log("🔄 Processing subscription completion (plan ended)...");
        const completedSub = await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            status: SubscriptionStatus.ACTIVE,              // ✅ Keep ACTIVE status
            planId: "free_plan",                           // ✅ Revert to free plan
            currentPeriodStart: new Date(),
            currentPeriodEnd: futureDate,                  // ✅ 100 years for free plan
          },
        });
        console.log("✅ Subscription completed → free plan:", completedSub);
        break;

      default:
        console.log(`❓ Unhandled event: ${eventType}`);
    }

    console.log("🚀 =================WEBHOOK SUCCESS=================");
    return NextResponse.json({ status: "success", eventType });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error("❌ WEBHOOK ERROR:", errorMessage);
    console.error("❌ Error stack:", errorStack);
    return new NextResponse(`Error: ${errorMessage}`, { status: 500 });
  }
}

// Add GET endpoint for testing
export async function GET() {
  return NextResponse.json({ 
    message: "Webhook endpoint is working",
    timestamp: new Date().toISOString(),
    environment: {
      webhookSecret: !!process.env.RAZORPAY_WEBHOOK_SECRET,
      databaseUrl: !!process.env.DATABASE_URL,
    }
  });
}
