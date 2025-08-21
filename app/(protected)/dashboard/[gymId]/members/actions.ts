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
import { HistoryEventType, Prisma } from "@prisma/client";
import nodemailer from "nodemailer";

// --- Nodemailer Setup for Email Receipts ---
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_SERVER_HOST,
  port: Number(process.env.EMAIL_SERVER_PORT),
  secure: true,
  auth: {
    user: process.env.EMAIL_SERVER_USER,
    pass: process.env.EMAIL_SERVER_PASSWORD,
  },
});

async function sendReceiptEmail(
  member: { email: string; name: string },
  receipt: { receiptNumber: string; amount: number; issuedAt: Date },
  gymName: string
) {
  const emailHtml = `
    <div style="font-family: sans-serif; padding: 20px; color: #333;">
      <h2>Payment Receipt - ${gymName}</h2>
      <p>Hello ${member.name},</p>
      <p>Thank you for your payment. Here are your receipt details:</p>
      <div style="border: 1px solid #ddd; padding: 15px; border-radius: 8px;">
        <p><strong>Receipt Number:</strong> ${receipt.receiptNumber}</p>
        <p><strong>Amount Paid:</strong> ₹${(receipt.amount / 100).toFixed(2)}</p>
        <p><strong>Date Issued:</strong> ${receipt.issuedAt.toLocaleDateString()}</p>
      </div>
      <p>Thank you for being a valued member of ${gymName}.</p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"${gymName}" <${process.env.EMAIL_FROM}>`,
      to: member.email,
      subject: `Your Payment Receipt from ${gymName}`,
      html: emailHtml,
    });
    console.log(`[EMAIL] Receipt sent to ${member.email}`);
  } catch (error) {
    console.error("[EMAIL] Failed to send receipt:", error);
    throw error;
  }
}

// --- Zod Schemas & File Helpers ---
const fileSchema = z.instanceof(File).optional();

const createDynamicMemberSchema = (customFields: { id: string; type: string; required: boolean }[]) => {
  const standardSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters."),
    email: z.string().email("Invalid email address."),
    phone: z.string().optional(),
    address: z.string().optional(),
    planId: z.string().min(1, "You must select a membership plan."),
    joinedAt: z.coerce.date(),
    dateOfBirth: z.coerce.date().optional().nullable(),
    gender: z.string().optional(),
    weightKg: z.coerce.number().optional().nullable(),
    heightCm: z.coerce.number().optional().nullable(),
    photoUrl: fileSchema,
    idProofUrl: fileSchema,
  });

  const customSchemaShape: Record<string, z.ZodTypeAny> = {};

  customFields.forEach((field) => {
    let fieldSchema: z.ZodString | z.ZodNumber | z.ZodDate;
    switch (field.type) {
      case "number":
        fieldSchema = z.coerce.number();
        break;
      case "date":
        fieldSchema = z.coerce.date();
        break;
      case "text":
      default:
        fieldSchema = z.string();
        if (field.required) {
          fieldSchema = fieldSchema.min(1, { message: "This field is required." });
        }
        break;
    }

    customSchemaShape[`custom_${field.id}`] = field.required ? fieldSchema : fieldSchema.optional();
  });

  return z.object({
    ...standardSchema.shape,
    ...customSchemaShape,
  });
};

async function handleFileUpload(file: File | undefined, gymId: string): Promise<string | undefined> {
  if (!file || file.size === 0) return undefined;

  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    throw new Error(`File ${file.name} is too large. Maximum size is 5MB.`);
  }

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
    if (error.code !== "ENOENT") {
      console.error("Error deleting file:", error);
    }
  }
}

// --- Error Handling ---
function handleError(error: any): { success: false; message: string; errorCode?: string } {
  console.error("Error:", error);

  if (error.code === "P2002" && error.meta?.target?.includes("email")) {
    return {
      success: false,
      message: "A member with this email already exists in this gym.",
      errorCode: "EMAIL_ALREADY_EXISTS",
    };
  }
  if (error.code === "P2028") {
    return { success: false, message: "Operation timed out. Please try again.", errorCode: "TIMEOUT" };
  }
  return {
    success: false,
    message: error.message || "An unexpected error occurred.",
    errorCode: "UNKNOWN",
  };
}

// --- Server Actions ---

export async function createMember(gymId: string, formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  let uploadedFiles: string[] = [];

  try {
    console.log("=== CREATE MEMBER DEBUG ===");
    console.log("Gym ID:", gymId);
    console.log("User ID:", userId);

    const gym = await prisma.gym.findFirst({
      where: { id: gymId, ownerId: userId },
      include: {
        subscription: true,
        _count: { select: { members: { where: { deletedAt: null } } } },
        customFields: true,
      },
    });

    if (!gym) {
      console.log("Gym not found or permission denied");
      return { success: false, message: "Gym not found or permission denied." };
    }

    console.log("Gym found:", gym.name);
    console.log("Current member count:", gym._count?.members || 0);

    if (gym.subscription?.planId === "free_plan" && gym._count.members >= 2) {
      return { success: false, message: "Free plan member limit of 50 reached. Please upgrade." };
    }

    const rawData: Record<string, any> = {};
    for (const [key, value] of formData.entries()) {
      rawData[key] = value instanceof File ? value : value;
    }

    console.log("Raw form data keys:", Object.keys(rawData));

    if (!rawData.name || !rawData.email || !rawData.planId) {
      return { success: false, message: "Name, email, and plan are required fields." };
    }

    const existingMember = await prisma.member.findFirst({
      where: {
        email: rawData.email as string,
        gymId: gymId,
        deletedAt: null,
      },
    });

    if (existingMember) {
      console.log("Member with email already exists:", rawData.email);
      return {
        success: false,
        message: "A member with this email already exists in this gym.",
        errorCode: "EMAIL_ALREADY_EXISTS",
      };
    }

    const MemberSchema = createDynamicMemberSchema(gym.customFields);
    const validatedFields = MemberSchema.safeParse(rawData);

    if (!validatedFields.success) {
      console.error("Validation errors:", validatedFields.error.flatten());
      return {
        success: false,
        message: "Invalid form data.",
        errors: validatedFields.error.flatten().fieldErrors,
      };
    }

    console.log("Validation passed");
    const {
      name,
      email,
      phone,
      address,
      planId,
      joinedAt,
      photoUrl: photoFile,
      idProofUrl: idProofFile,
      dateOfBirth,
      gender,
      weightKg,
      heightCm,
    } = validatedFields.data;

    const selectedPlan = await prisma.membershipPlan.findUnique({
      where: { id: planId },
      include: { gym: true },
    });

    if (!selectedPlan || selectedPlan.gymId !== gymId) {
      return { success: false, message: "Invalid membership plan for this gym." };
    }

    console.log("Selected plan:", selectedPlan.name);

    let customFieldsData: Prisma.InputJsonValue = {};
    if (gym.subscription?.planId !== "free_plan" && gym.customFields.length > 0) {
      const customData: Record<string, any> = {};
      gym.customFields.forEach((field) => {
        const key = `custom_${field.id}`;
        const value = (validatedFields.data as any)[key];
        if (value !== undefined && value !== null && value !== "") {
          customData[field.name] = value;
        }
      });
      customFieldsData = customData;
      console.log("Custom fields data:", customFieldsData);
    }

    console.log("Processing file uploads...");
    let photoUrl: string | undefined;
    let idProofUrl: string | undefined;

    try {
      [photoUrl, idProofUrl] = await Promise.all([
        handleFileUpload(photoFile, gymId),
        handleFileUpload(idProofFile, gymId),
      ]);

      if (photoUrl) uploadedFiles.push(photoUrl);
      if (idProofUrl) uploadedFiles.push(idProofUrl);

      console.log("File uploads completed:", { photoUrl, idProofUrl });
    } catch (fileError: any) {
      console.error("File upload error:", fileError);
      return { success: false, message: `File upload failed: ${fileError.message}` };
    }

    const membershipExpiresAt = addMonths(joinedAt, selectedPlan.durationMonths);
    console.log("Membership expires at:", membershipExpiresAt);

    console.log("Creating member in database...");

    let newMember: any;
    let receipt: any;

    try {
      const result = await prisma.$transaction(
        async (tx) => {
          const member = await tx.member.create({
            data: {
              name: name.trim(),
              email: email.toLowerCase().trim(),
              phone: phone?.trim() || null,
              address: address?.trim() || null,
              joinedAt,
              membershipExpiresAt,
              gymId,
              planId,
              photoUrl: photoUrl || null,
              idProofUrl: idProofUrl || null,
              customFields: customFieldsData,
              dateOfBirth: dateOfBirth || null,
              gender: gender?.trim() || null,
              weightKg: weightKg || null,
              heightCm: heightCm || null,
            },
          });

          console.log("Member created with ID:", member.id);

          const history = await tx.membershipHistory.create({
            data: {
              type: HistoryEventType.JOINED,
              description: `Joined with '${selectedPlan.name}' plan.`,
              amountPaid: selectedPlan.price + selectedPlan.admissionFee,
              newExpiryDate: membershipExpiresAt,
              memberId: member.id,
            },
          });

          console.log("History record created with ID:", history.id);

          const receiptRecord = await tx.receipt.create({
            data: {
              membershipHistoryId: history.id,
              receiptNumber: `RCPT-${Date.now()}-${member.id}`,
              amount: history.amountPaid!,
              paymentMethod: "Manual Entry",
              issuedAt: new Date(),
            },
          });

          console.log("Receipt created:", receiptRecord.receiptNumber);

          return { member, receipt: receiptRecord };
        },
        {
          timeout: 20000,
          maxWait: 25000,
        }
      );

      newMember = result.member;
      receipt = result.receipt;

      console.log("Transaction completed successfully");
    } catch (transactionError: any) {
      console.error("Database transaction error:", transactionError);
      await Promise.all(uploadedFiles.map((fileUrl) => deleteFile(fileUrl)));
      return handleError(transactionError);
    }

    if (newMember && receipt) {
      sendReceiptEmail({ email: newMember.email, name: newMember.name }, receipt, gym.name)
        .then(() => console.log("Email sent successfully to:", newMember.email))
        .catch((emailError) => console.warn("Email sending failed for member:", newMember.id, emailError));
    }

    revalidatePath(`/dashboard/${gymId}/members`);
    return { success: true, message: "Member added successfully!" };
  } catch (error: any) {
    console.error("Unexpected error in createMember:", error);
    await Promise.all(uploadedFiles.map((fileUrl) => deleteFile(fileUrl)));
    return handleError(error);
  }
}

export async function updateMember(memberId: string, gymId: string, formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  let uploadedFiles: string[] = [];

  try {
    const gym = await prisma.gym.findFirst({
      where: { id: gymId, ownerId: userId },
      include: { customFields: true, subscription: true },
    });

    if (!gym) {
      return { success: false, message: "Permission denied." };
    }

    const rawData = Object.fromEntries(formData.entries());
    const MemberSchema = createDynamicMemberSchema(gym.customFields);
    const validatedFields = MemberSchema.safeParse(rawData);

    if (!validatedFields.success) {
      return {
        success: false,
        message: "Invalid form data.",
        errors: validatedFields.error.flatten().fieldErrors,
      };
    }

    const {
      name,
      email,
      phone,
      address,
      planId,
      joinedAt,
      photoUrl: photoFile,
      idProofUrl: idProofFile,
      dateOfBirth,
      gender,
      weightKg,
      heightCm,
    } = validatedFields.data;

    const existingMember = await prisma.member.findUnique({
      where: { id: memberId, gymId },
      select: { id: true, photoUrl: true, idProofUrl: true, planId: true, deletedAt: true },
    });

    if (!existingMember) {
      return { success: false, message: "Member not found." };
    }

    if (existingMember.deletedAt) {
      return { success: false, message: "Cannot update a deleted member." };
    }

    const selectedPlan = await prisma.membershipPlan.findUnique({
      where: { id: planId },
      include: { gym: true },
    });

    if (!selectedPlan || selectedPlan.gymId !== gymId) {
      return { success: false, message: "Invalid membership plan for this gym." };
    }

    const membershipExpiresAt = addMonths(joinedAt, selectedPlan.durationMonths);

    let photoUrl: string | null = existingMember.photoUrl;
    let idProofUrl: string | null = existingMember.idProofUrl;

    try {
      if (photoFile && photoFile.size > 0) {
        const oldPhotoUrl = existingMember.photoUrl;
        const newPhotoUrl = await handleFileUpload(photoFile, gymId);
        if (newPhotoUrl) {
          photoUrl = newPhotoUrl;
          uploadedFiles.push(newPhotoUrl);
          if (oldPhotoUrl) await deleteFile(oldPhotoUrl);
        }
      }

      if (idProofFile && idProofFile.size > 0) {
        const oldIdProofUrl = existingMember.idProofUrl;
        const newIdProofUrl = await handleFileUpload(idProofFile, gymId);
        if (newIdProofUrl) {
          idProofUrl = newIdProofUrl;
          uploadedFiles.push(newIdProofUrl);
          if (oldIdProofUrl) await deleteFile(oldIdProofUrl);
        }
      }
    } catch (fileError: any) {
      console.error("File upload error:", fileError);
      return { success: false, message: `File upload failed: ${fileError.message}` };
    }

    const dataToUpdate: Prisma.MemberUpdateInput = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone?.trim() || null,
      address: address?.trim() || null,
      joinedAt,
      membershipExpiresAt,
      dateOfBirth: dateOfBirth || null,
      gender: gender?.trim() || null,
      weightKg: weightKg || null,
      heightCm: heightCm || null,
      photoUrl,
      idProofUrl,
      plan: { connect: { id: planId } },
    };

    if (gym.subscription?.planId !== "free_plan" && gym.customFields.length > 0) {
      const customData: Record<string, any> = {};
      gym.customFields.forEach((field) => {
        const key = `custom_${field.id}`;
        const value = (validatedFields.data as any)[key];
        if (value !== undefined && value !== null && value !== "") {
          customData[field.name] = value;
        }
      });
      dataToUpdate.customFields = customData;
    }

    try {
      await prisma.$transaction(
        async (tx) => {
          await tx.member.update({
            where: { id: memberId, gymId: gymId },
            data: dataToUpdate,
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
        },
        {
          timeout: 15000,
          maxWait: 20000,
        }
      );
    } catch (transactionError: any) {
      await Promise.all(uploadedFiles.map((fileUrl) => deleteFile(fileUrl)));
      return handleError(transactionError);
    }

    revalidatePath(`/dashboard/${gymId}/members`);
    return { success: true, message: "Member details updated successfully." };
  } catch (error: any) {
    console.error("Update member error:", error);
    await Promise.all(uploadedFiles.map((fileUrl) => deleteFile(fileUrl)));
    return handleError(error);
  }
}

export async function renewMembership(memberId: string, gymId: string, planIdFromForm: string | null) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  try {
    const gym = await prisma.gym.findFirst({
      where: { id: gymId, ownerId: userId },
      include: { subscription: true },
    });

    const member = await prisma.member.findUnique({
      where: { id: memberId, gymId },
      select: {
        id: true,
        email: true,
        name: true,
        membershipExpiresAt: true,
        deletedAt: true,
        plan: {
          select: {
            id: true,
            name: true,
            durationMonths: true,
            price: true,
          },
        },
      },
    });

    if (!gym) {
      return { success: false, message: "Permission denied." };
    }

    if (!member) {
      return { success: false, message: "Member not found." };
    }

    if (member.deletedAt) {
      return { success: false, message: "Cannot renew membership for a deleted member." };
    }

    const isProPlan = gym.subscription?.planId !== "free_plan";
    const renewalPlanId = isProPlan ? planIdFromForm : member.plan.id;

    if (!renewalPlanId) {
      return { success: false, message: "A plan must be selected for renewal." };
    }

    const newPlan = await prisma.membershipPlan.findUnique({
      where: { id: renewalPlanId, gymId },
    });

    if (!newPlan) {
      return { success: false, message: "Renewal plan not found or invalid." };
    }

    const renewalStartDate =
      member.membershipExpiresAt && member.membershipExpiresAt > new Date()
        ? member.membershipExpiresAt
        : new Date();

    const newExpiryDate = addMonths(renewalStartDate, newPlan.durationMonths);

    let receipt: any;

    try {
      await prisma.$transaction(
        async (tx) => {
          await tx.member.update({
            where: { id: memberId },
            data: {
              plan: { connect: { id: newPlan.id } },
              membershipExpiresAt: newExpiryDate,
            },
          });

          const history = await tx.membershipHistory.create({
            data: {
              type: HistoryEventType.RENEWED,
              description: `Renewed with '${newPlan.name}' plan.`,
              amountPaid: newPlan.price,
              newExpiryDate: newExpiryDate,
              memberId: memberId,
            },
          });

          receipt = await tx.receipt.create({
            data: {
              membershipHistoryId: history.id,
              receiptNumber: `RCPT-${Date.now()}-${memberId}`,
              amount: history.amountPaid!,
              paymentMethod: "Manual Renewal",
              issuedAt: new Date(),
            },
          });
        },
        {
          timeout: 15000,
          maxWait: 20000,
        }
      );
    } catch (transactionError: any) {
      return handleError(transactionError);
    }

    if (receipt) {
      sendReceiptEmail({ email: member.email, name: member.name }, receipt, gym.name)
        .then(() => console.log("Renewal receipt email sent successfully"))
        .catch((emailError) => console.warn("Failed to send renewal email:", emailError));
    }

    revalidatePath(`/dashboard/${gymId}/members`);
    return { success: true, message: "Membership renewed successfully!" };
  } catch (error: any) {
    console.error("Renew membership error:", error);
    return handleError(error);
  }
}

export async function deleteMember(memberId: string, gymId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  try {
    const gym = await prisma.gym.findFirst({
      where: { id: gymId, ownerId: userId },
    });

    if (!gym) {
      return { success: false, message: "Permission denied." };
    }

    const member = await prisma.member.findUnique({
      where: { id: memberId, gymId },
      select: { id: true, photoUrl: true, idProofUrl: true, deletedAt: true },
    });

    if (!member) {
      return { success: false, message: "Member not found." };
    }

    if (member.deletedAt) {
      return { success: false, message: "Member is already deleted." };
    }

    await prisma.$transaction(
      async (tx) => {
        await tx.member.update({
          where: { id: memberId, gymId: gymId },
          data: { deletedAt: new Date() },
        });
      },
      {
        timeout: 10000,
        maxWait: 15000,
      }
    );

    if (member.photoUrl || member.idProofUrl) {
      await Promise.all([deleteFile(member.photoUrl), deleteFile(member.idProofUrl)]);
    }

    revalidatePath(`/dashboard/${gymId}/members`);
    return { success: true, message: "Member deleted successfully." };
  } catch (error: any) {
    console.error("Delete member error:", error);
    return handleError(error);
  }
}

export async function queueReceiptEmail(
  memberEmail: string,
  memberName: string,
  receiptData: any,
  gymName: string
) {
  try {
    await sendReceiptEmail({ email: memberEmail, name: memberName }, receiptData, gymName);
  } catch (emailError) {
    console.error("Background email failed:", emailError);
  }
}

export async function batchCreateMembers(gymId: string, membersData: any[]) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  console.log("Batch create not implemented yet");
  return { success: false, message: "Batch operations not yet implemented." };
}

export async function checkEmailAvailability(gymId: string, email: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  try {
    const existingMember = await prisma.member.findFirst({
      where: {
        email: email.toLowerCase().trim(),
        gymId,
        deletedAt: null,
      },
    });

    return {
      success: true,
      available: !existingMember,
    };
  } catch (error: any) {
    return handleError(error);
  }
}

export async function restoreMember(memberId: string, gymId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  try {
    const gym = await prisma.gym.findFirst({
      where: { id: gymId, ownerId: userId },
    });

    if (!gym) {
      return { success: false, message: "Permission denied." };
    }

    const member = await prisma.member.findUnique({
      where: { id: memberId, gymId },
      select: { id: true, deletedAt: true },
    });

    if (!member) {
      return { success: false, message: "Member not found." };
    }

    if (!member.deletedAt) {
      return { success: false, message: "Member is not deleted." };
    }

    await prisma.member.update({
      where: { id: memberId, gymId: gymId },
      data: { deletedAt: null },
    });

    revalidatePath(`/dashboard/${gymId}/members`);
    return { success: true, message: "Member restored successfully." };
  } catch (error: any) {
    return handleError(error);
  }
}