"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { addMonths } from "date-fns";
import fs from "fs/promises";
import path from "path";
import { HistoryEventType } from "@prisma/client";

// --- Zod Schemas & File Helpers (No changes) ---
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const fileSchema = z
  .instanceof(File)
  .optional()
  .refine((file) => !file || file.size === 0 || file.size <= MAX_FILE_SIZE, `Max file size is 5MB.`)
  .refine(
    (file) => !file || file.size === 0 || ACCEPTED_IMAGE_TYPES.includes(file.type),
    ".jpg, .jpeg, .png and .webp files are accepted."
  );

const MemberSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  email: z.string().email("Invalid email address."),
  phone: z.string().optional(),
  planId: z.string().min(1, "You must select a membership plan."),
  joinedAt: z.coerce.date(),
  dateOfBirth: z.coerce.date().optional().nullable(),
  gender: z.string().optional(),
  weightKg: z.coerce.number().optional().nullable(),
  heightCm: z.coerce.number().optional().nullable(),
  photoUrl: fileSchema,
  idProofUrl: fileSchema,
});

async function handleFileUpload(file: File | undefined, gymId: string): Promise<string | undefined> {
  if (!file || file.size === 0) return undefined;
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const filename = `${Date.now()}-${file.name.replace(/\s/g, "_")}`;
  const uploadDir = path.join(process.cwd(), "public/uploads", gymId);
  const filePath = path.join(uploadDir, filename);
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(filePath, buffer);
  return `/uploads/${gymId}/${filename}`;
}

async function deleteFile(fileUrl: string | null | undefined) {
  if (!fileUrl) return;
  try {
    const filePath = path.join(process.cwd(), "public", fileUrl);
    await fs.unlink(filePath);
  } catch (error: any) {
    if (error.code !== 'ENOENT') console.error("Error deleting file:", error);
  }
}

// --- Server Actions ---

export async function createMember(gymId: string, formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const gym = await prisma.gym.findFirst({
    where: { id: gymId, ownerId: userId },
    include: { subscription: true, _count: { select: { members: true } } },
  });

  if (!gym) return { success: false, message: "Gym not found or permission denied." };

  if (gym.subscription?.planId === "free_plan" && gym._count.members >= 50) {
    return { success: false, message: "Free plan member limit of 50 reached. Please upgrade." };
  }
  
  const rawData = Object.fromEntries(formData.entries());
  const validatedFields = MemberSchema.safeParse(rawData);

  if (!validatedFields.success) {
    return { success: false, message: "Invalid form data.", errors: validatedFields.error.flatten().fieldErrors };
  }
  
  const { name, email, phone, planId, joinedAt, photoUrl: photoFile, idProofUrl: idProofFile, ...otherFields } = validatedFields.data;

  const [photoUrl, idProofUrl] = await Promise.all([
    handleFileUpload(photoFile, gymId),
    handleFileUpload(idProofFile, gymId)
  ]);

  const selectedPlan = await prisma.membershipPlan.findUnique({ where: { id: planId } });
  if (!selectedPlan) return { success: false, message: "Selected plan not found." };

  const membershipExpiresAt = addMonths(joinedAt, selectedPlan.durationMonths);

  try {
    await prisma.$transaction(async (tx) => {
      const newMember = await tx.member.create({
        data: { name, email, phone, joinedAt, membershipExpiresAt, gymId, planId, photoUrl, idProofUrl, ...otherFields },
      });

      await tx.membershipHistory.create({
        data: {
          type: HistoryEventType.JOINED,
          description: `Joined with '${selectedPlan.name}' plan.`,
          amountPaid: selectedPlan.price + selectedPlan.admissionFee,
          newExpiryDate: membershipExpiresAt,
          memberId: newMember.id,
        },
      });
    });
  } catch (error: any) {
    if (error.code === 'P2002') return { success: false, message: "A member with this email already exists." };
    return { success: false, message: "Database error: Could not add member." };
  }

  revalidatePath(`/dashboard/${gymId}/members`);
  return { success: true, message: "Member added successfully!" };
}

export async function updateMember(memberId: string, gymId: string, formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const gym = await prisma.gym.findFirst({ where: { id: gymId, ownerId: userId } });
  if (!gym) return { success: false, message: "Permission denied." };
  
  const rawData = Object.fromEntries(formData.entries());
  const validatedFields = MemberSchema.safeParse(rawData);

  if (!validatedFields.success) {
    return { success: false, message: "Invalid form data.", errors: validatedFields.error.flatten().fieldErrors };
  }

  const { name, email, phone, planId, joinedAt, photoUrl: photoFile, idProofUrl: idProofFile, ...otherFields } = validatedFields.data;

  const existingMember = await prisma.member.findUnique({ where: { id: memberId } });
  if (!existingMember) return { success: false, message: "Member not found." };

  const [photoUrl, idProofUrl] = await Promise.all([
    photoFile && photoFile.size > 0 ? (async () => { await deleteFile(existingMember.photoUrl); return handleFileUpload(photoFile, gymId); })() : Promise.resolve(existingMember.photoUrl),
    idProofFile && idProofFile.size > 0 ? (async () => { await deleteFile(existingMember.idProofUrl); return handleFileUpload(idProofFile, gymId); })() : Promise.resolve(existingMember.idProofUrl)
  ]);

  const selectedPlan = await prisma.membershipPlan.findUnique({ where: { id: planId } });
  if (!selectedPlan) return { success: false, message: "Selected plan not found." };

  const membershipExpiresAt = addMonths(joinedAt, selectedPlan.durationMonths);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.member.update({
        where: { id: memberId, gymId: gymId },
        data: { name, email, phone, planId, joinedAt, membershipExpiresAt, photoUrl, idProofUrl, ...otherFields },
      });

      if (existingMember.planId !== planId) {
        await tx.membershipHistory.create({
          data: {
            type: HistoryEventType.PLAN_CHANGED,
            description: `Plan changed to '${selectedPlan.name}'.`,
            newExpiryDate: membershipExpiresAt,
            memberId: memberId,
          },
        });
      }
    });
  } catch (error) {
    return { success: false, message: "Database error: Could not update member." };
  }

  revalidatePath(`/dashboard/${gymId}/members`);
  return { success: true, message: "Member details updated." };
}

// ✅ UPDATED: This function is now more robust.
export async function renewMembership(memberId: string, gymId: string, planIdFromForm: string | null) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const gym = await prisma.gym.findFirst({ 
    where: { id: gymId, ownerId: userId },
    include: { subscription: true }
  });
  if (!gym) return { success: false, message: "Permission denied." };

  const member = await prisma.member.findUnique({
    where: { id: memberId },
  });

  if (!member) return { success: false, message: "Member not found." };

  const isProPlan = gym.subscription?.planId !== "free_plan";
  
  // Determine the correct plan ID to use for renewal
  const renewalPlanId = isProPlan ? planIdFromForm : member.planId;

  if (!renewalPlanId) {
    return { success: false, message: "A plan must be selected for renewal." };
  }

  const newPlan = await prisma.membershipPlan.findUnique({ where: { id: renewalPlanId } });
  if (!newPlan) return { success: false, message: "Renewal plan not found." };
  
  const renewalStartDate = member.membershipExpiresAt && member.membershipExpiresAt > new Date()
    ? member.membershipExpiresAt
    : new Date();
  
  const newExpiryDate = addMonths(renewalStartDate, newPlan.durationMonths);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.member.update({
        where: { id: memberId },
        data: { 
          planId: newPlan.id,
          membershipExpiresAt: newExpiryDate 
        },
      });

      await tx.membershipHistory.create({
        data: {
          type: HistoryEventType.RENEWED,
          description: `Renewed with '${newPlan.name}' plan.`,
          amountPaid: newPlan.price,
          newExpiryDate: newExpiryDate,
          memberId: memberId,
        },
      });
    });
  } catch (error) {
    return { success: false, message: "Database error: Could not renew membership." };
  }

  revalidatePath(`/dashboard/${gymId}/members`);
  return { success: true, message: "Membership renewed successfully!" };
}


export async function deleteMember(memberId: string, gymId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const gym = await prisma.gym.findFirst({ where: { id: gymId, ownerId: userId } });
  if (!gym) return { success: false, message: "Permission denied." };

  try {
    const member = await prisma.member.findUnique({ where: { id: memberId } });
    if (!member) return { success: false, message: "Member not found." };

    await Promise.all([
      deleteFile(member.photoUrl),
      deleteFile(member.idProofUrl)
    ]);

    await prisma.member.delete({
      where: { id: memberId, gymId: gymId },
    });
  } catch (error) {
    return { success: false, message: "Database error: Could not delete member." };
  }

  revalidatePath(`/dashboard/${gymId}/members`);
  return { success: true, message: "Member deleted." };
}
