"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import { z } from "zod";
import crypto from "crypto";

// --- Encryption Utilities ---
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

function encrypt(text: string): string {
  if (!ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY is not set in environment variables.");
  }
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, "hex"), iv);
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

// --- Zod Validation Schema ---
const SettingsSchema = z.object({
  name: z.string().min(3, "Gym name must be at least 3 characters."),
  address: z.string().optional(),
  description: z.string().optional(),
  razorpayKeyId: z.string().optional(),
  razorpayKeySecret: z.string().optional(),
});

/**
 * A Server Action to update the gym profile and Razorpay credentials,
 * with a check to ensure Razorpay integration is a Pro feature.
 */
export async function updateGymSettings(gymId: string, formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const validatedFields = SettingsSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!validatedFields.success) {
    return { success: false, message: "Invalid data provided." };
  }

  const { name, address, description, razorpayKeyId, razorpayKeySecret } = validatedFields.data;

  try {
    // ✅ UPDATED: Fetch the gym WITH its subscription to check the plan
    const gym = await prisma.gym.findFirst({ 
      where: { id: gymId, ownerId: userId },
      include: { subscription: true } 
    });

    if (!gym) {
      return { success: false, message: "Gym not found or permission denied." };
    }

    // ✅ ADDED: Pro Feature Check for Razorpay credentials
    const isTryingToAddKeys = (razorpayKeyId && razorpayKeyId.length > 0) || (razorpayKeySecret && razorpayKeySecret.length > 0);
    if (gym.subscription?.planId === "free_plan" && isTryingToAddKeys) {
      return { success: false, message: "Razorpay integration is a Pro feature. Please upgrade your plan to accept online payments." };
    }

    let encryptedSecret = gym.razorpayKeySecret;

    if (razorpayKeySecret && razorpayKeySecret.length > 0) {
      encryptedSecret = encrypt(razorpayKeySecret);
    }

    await prisma.gym.update({
      where: { id: gymId },
      data: {
        name,
        address,
        description,
        razorpayKeyId: razorpayKeyId || null, // Ensure empty strings are saved as null
        razorpayKeySecret: encryptedSecret,
      },
    });

    revalidatePath(`/dashboard/${gymId}/settings`);
    return { success: true, message: "Settings updated successfully!" };

  } catch (error) {
    console.error("Failed to update settings:", error);
    return { success: false, message: "An error occurred while updating settings." };
  }
}
