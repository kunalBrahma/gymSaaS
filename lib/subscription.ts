// lib/subscription.ts
import prisma from "@/lib/prisma";
import { SubscriptionStatus } from "@prisma/client";

interface SubscriptionStatusResult {
  subscription: any;
  isPro: boolean;
  planId: string;
  isActive: boolean;
  currentPeriodEnd: Date | null;
  daysRemaining: number | null;
  isExpired: boolean;
}

/**
 * Check and update naturally expired subscriptions to free plan
 */
async function checkAndUpdateExpiredSubscription(gymId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { gymId }
  });

  if (!subscription) return null;

  const now = new Date();
  const isExpired = subscription.currentPeriodEnd < now;
  const isNotFreeAlready = subscription.planId !== "free_plan";

  // If subscription expired and not already on free plan
  if (isExpired && isNotFreeAlready) {
    console.log(`🔄 Pro plan expired for gym ${gymId}, reverting to free plan`);
    
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 100); // 100 years for free plan
    
    const updatedSubscription = await prisma.subscription.update({
      where: { gymId },
      data: {
        status: SubscriptionStatus.ACTIVE,        // ✅ Keep ACTIVE status
        planId: "free_plan",                     // ✅ Change to free plan
        // ✅ DON'T change providerSubscriptionId for natural expiry
        currentPeriodStart: now,
        currentPeriodEnd: futureDate,            // ✅ 100 years for free plan
      },
    });

    console.log(`✅ Subscription reverted to free plan: ${updatedSubscription.id}`);
    return updatedSubscription;
  }

  return subscription;
}

/**
 * Get subscription status for a gym with real-time expiry checking
 */
export async function getSubscriptionStatus(gymId: string): Promise<SubscriptionStatusResult> {
  try {
    // Check and update expired subscriptions first
    const subscription = await checkAndUpdateExpiredSubscription(gymId);
    
    if (!subscription) {
      // No subscription found - return default free plan status
      return {
        subscription: null,
        isPro: false,
        planId: "free_plan",
        isActive: false,
        currentPeriodEnd: null,
        daysRemaining: null,
        isExpired: false,
      };
    }

    const now = new Date();
    const isPro = subscription.planId !== "free_plan";
    const isExpired = subscription.currentPeriodEnd < now;
    
    // Calculate days remaining (only for pro plans)
    let daysRemaining: number | null = null;
    if (isPro && subscription.currentPeriodEnd) {
      const timeDiff = subscription.currentPeriodEnd.getTime() - now.getTime();
      daysRemaining = Math.max(0, Math.ceil(timeDiff / (1000 * 60 * 60 * 24)));
    }

    return {
      subscription,
      isPro,
      planId: subscription.planId,
      isActive: subscription.status === SubscriptionStatus.ACTIVE,
      currentPeriodEnd: subscription.currentPeriodEnd,
      daysRemaining,
      isExpired,
    };

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Error getting subscription status for gym ${gymId}:`, errorMessage);
    
    // Return safe defaults on error
    return {
      subscription: null,
      isPro: false,
      planId: "free_plan",
      isActive: false,
      currentPeriodEnd: null,
      daysRemaining: null,
      isExpired: false,
    };
  }
}

/**
 * Bulk cleanup function for expired subscriptions (for cron jobs)
 */
export async function cleanupExpiredSubscriptions(): Promise<number> {
  try {
    const now = new Date();
    
    // Find all expired non-free subscriptions
    const expiredSubscriptions = await prisma.subscription.findMany({
      where: {
        currentPeriodEnd: { lt: now },
        planId: { not: "free_plan" },
        status: SubscriptionStatus.ACTIVE
      }
    });

    console.log(`🔍 Found ${expiredSubscriptions.length} expired subscriptions`);

    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 100);

    // Update all expired subscriptions to free plan
    for (const sub of expiredSubscriptions) {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          status: SubscriptionStatus.ACTIVE,        // ✅ Keep ACTIVE status
          planId: "free_plan",                     // ✅ Change to free plan
          currentPeriodStart: now,
          currentPeriodEnd: futureDate,            // ✅ 100 years
        },
      });
      
      console.log(`✅ Expired subscription converted: ${sub.gymId}`);
    }

    return expiredSubscriptions.length;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ Error cleaning up expired subscriptions:", errorMessage);
    throw error;
  }
}

/**
 * Check subscription status without making changes (for read-only operations)
 */
export async function getSubscriptionStatusReadOnly(gymId: string): Promise<SubscriptionStatusResult> {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { gymId }
    });

    if (!subscription) {
      return {
        subscription: null,
        isPro: false,
        planId: "free_plan",
        isActive: false,
        currentPeriodEnd: null,
        daysRemaining: null,
        isExpired: false,
      };
    }

    const now = new Date();
    const isPro = subscription.planId !== "free_plan";
    const isExpired = subscription.currentPeriodEnd < now;
    
    let daysRemaining: number | null = null;
    if (isPro && subscription.currentPeriodEnd) {
      const timeDiff = subscription.currentPeriodEnd.getTime() - now.getTime();
      daysRemaining = Math.max(0, Math.ceil(timeDiff / (1000 * 60 * 60 * 24)));
    }

    return {
      subscription,
      isPro: isPro && !isExpired, // ✅ Consider expired pro as not pro
      planId: isExpired && isPro ? "free_plan" : subscription.planId,
      isActive: subscription.status === SubscriptionStatus.ACTIVE,
      currentPeriodEnd: subscription.currentPeriodEnd,
      daysRemaining,
      isExpired,
    };

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Error getting subscription status for gym ${gymId}:`, errorMessage);
    
    return {
      subscription: null,
      isPro: false,
      planId: "free_plan",
      isActive: false,
      currentPeriodEnd: null,
      daysRemaining: null,
      isExpired: false,
    };
  }
}

/**
 * Create initial free plan subscription for new gyms
 */
export async function createFreeSubscription(gymId: string): Promise<any> {
  try {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 100);

    const freeSubscription = await prisma.subscription.create({
      data: {
        gymId: gymId,
        planId: 'free_plan',
        status: SubscriptionStatus.ACTIVE,
        providerSubscriptionId: `free_${gymId}`,      // ✅ Unique per gym
        currentPeriodStart: new Date(),
        currentPeriodEnd: futureDate,                 // ✅ 100 years
      },
    });

    console.log(`✅ Free subscription created for gym: ${gymId}`);
    return freeSubscription;

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Error creating free subscription for gym ${gymId}:`, errorMessage);
    throw error;
  }
}
