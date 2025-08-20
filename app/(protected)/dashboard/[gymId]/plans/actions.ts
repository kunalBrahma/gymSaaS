"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import { z } from "zod";

const PlanSchema = z.object({
  name: z.string().min(3, "Plan name must be at least 3 characters."),
  price: z.coerce.number().min(0, "Price cannot be negative."),
  admissionFee: z.coerce.number().min(0, "Admission fee cannot be negative."),
  durationMonths: z.coerce.number().int().positive("Duration must be a positive number."),
  description: z.string().optional(),
});

export async function createMembershipPlan(gymId: string, formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const gym = await prisma.gym.findFirst({
    where: { id: gymId, ownerId: userId },
    include: { 
      subscription: true,
      membershipPlans: { select: { id: true } } // Fetch plan count efficiently
    },
  });

  if (!gym) {
    return { success: false, message: "Gym not found or you do not have permission." };
  }

  // ✅ UPDATED: New logic for Free Plan limit
  const isProPlan = gym.subscription?.planId !== "free_plan";
  if (!isProPlan && gym.membershipPlans.length >= 1) {
    return { success: false, message: "The Free Plan is limited to one membership plan. Please upgrade to Pro to add more." };
  }

  const validatedFields = PlanSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!validatedFields.success) {
    return { success: false, message: "Invalid form data.", errors: validatedFields.error.flatten().fieldErrors };
  }

  const { name, price, admissionFee, durationMonths, description } = validatedFields.data;

  try {
    await prisma.membershipPlan.create({
      data: {
        name,
        description,
        price: price * 100,
        admissionFee: admissionFee * 100,
        durationMonths,
        gymId: gymId,
      },
    });
  } catch (error) {
    return { success: false, message: "Database error: Could not create the plan." };
  }

  revalidatePath(`/dashboard/${gymId}/plans`);
  return { success: true, message: "Membership plan created successfully!" };
}

// --- UPDATE AND DELETE FUNCTIONS (No changes needed) ---

export async function updateMembershipPlan(planId: string, gymId: string, formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const gym = await prisma.gym.findFirst({
    where: { id: gymId, ownerId: userId },
  });

  if (!gym) {
    return { success: false, message: "Gym not found." };
  }

  const validatedFields = PlanSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!validatedFields.success) {
    return { success: false, message: "Invalid form data.", errors: validatedFields.error.flatten().fieldErrors };
  }
  
  const { name, price, admissionFee, durationMonths, description } = validatedFields.data;

  try {
    await prisma.membershipPlan.update({
      where: { id: planId, gymId: gymId },
      data: { name, description, price: price * 100, admissionFee: admissionFee * 100, durationMonths },
    });
  } catch (error) {
    return { success: false, message: "Database error." };
  }

  revalidatePath(`/dashboard/${gymId}/plans`);
  return { success: true, message: "Plan updated successfully!" };
}

export async function deleteMembershipPlan(planId: string, gymId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const gym = await prisma.gym.findFirst({
    where: { id: gymId, ownerId: userId },
  });

  if (!gym) {
    return { success: false, message: "Gym not found." };
  }

  try {
    const membersOnPlan = await prisma.member.count({ where: { planId: planId } });
    if (membersOnPlan > 0) {
      return { success: false, message: `Cannot delete plan with ${membersOnPlan} member(s) assigned.` };
    }

    await prisma.membershipPlan.delete({ where: { id: planId, gymId: gymId } });
  } catch (error) {
    return { success: false, message: "Database error." };
  }

  revalidatePath(`/dashboard/${gymId}/plans`);
  return { success: true, message: "Plan deleted successfully!" };
}
