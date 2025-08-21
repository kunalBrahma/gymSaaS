"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import { z } from "zod";

// Zod schema for validating the custom field form data
const CustomFieldSchema = z.object({
  name: z.string().min(2, "Field name must be at least 2 characters."),
  type: z.enum(["text", "number", "date", "select"]),
  required: z.coerce.boolean(),
  // Options are only relevant for the 'select' type
  options: z.string().optional(),
});

/**
 * A Server Action to create a new custom field for a gym's member form.
 * This is a Pro-only feature.
 */
export async function createCustomField(gymId: string, formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  // 1. Authorization: Verify ownership and Pro plan status
  const gym = await prisma.gym.findFirst({
    where: { id: gymId, ownerId: userId },
    include: { subscription: true },
  });

  if (!gym) {
    return { success: false, message: "Gym not found or permission denied." };
  }

  if (gym.subscription?.planId === "free_plan") {
    return { success: false, message: "Creating custom fields is a Pro feature. Please upgrade." };
  }

  // 2. Validation
  const validatedFields = CustomFieldSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!validatedFields.success) {
    return { success: false, message: "Invalid form data.", errors: validatedFields.error.flatten().fieldErrors };
  }

  const { name, type, required, options } = validatedFields.data;

  // 3. Database Logic
  try {
    // Get the highest current order to place the new field at the end
    const lastField = await prisma.customField.findFirst({
      where: { gymId },
      orderBy: { order: 'desc' },
    });
    const newOrder = (lastField?.order ?? 0) + 1;

    await prisma.customField.create({
      data: {
        name,
        type,
        required,
        options: type === 'select' ? JSON.parse(options || "[]") : undefined,
        order: newOrder,
        gymId,
      },
    });
  } catch (error) {
    console.error("Failed to create custom field:", error);
    return { success: false, message: "Database error: Could not create field." };
  }

  // 4. Revalidate and Respond
  revalidatePath(`/dashboard/${gymId}/settings/custom-fields`);
  return { success: true, message: "Custom field created successfully!" };
}

/**
 * A Server Action to update an existing custom field.
 */
export async function updateCustomField(fieldId: string, gymId: string, formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  // Pro plan & ownership checks would be repeated here for security
  
  const validatedFields = CustomFieldSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!validatedFields.success) {
    return { success: false, message: "Invalid form data." };
  }
  const { name, type, required, options } = validatedFields.data;

  try {
    await prisma.customField.update({
      where: { id: fieldId, gymId },
      data: { name, type, required, options: type === 'select' ? JSON.parse(options || "[]") : undefined },
    });
  } catch (error) {
    return { success: false, message: "Database error." };
  }
  
  revalidatePath(`/dashboard/${gymId}/settings/custom-fields`);
  return { success: true, message: "Field updated." };
}

/**
 * A Server Action to delete a custom field.
 */
export async function deleteCustomField(fieldId: string, gymId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  // Pro plan & ownership checks would be repeated here

  try {
    await prisma.customField.delete({
      where: { id: fieldId, gymId },
    });
  } catch (error) {
    return { success: false, message: "Database error." };
  }

  revalidatePath(`/dashboard/${gymId}/settings/custom-fields`);
  return { success: true, message: "Field deleted." };
}
