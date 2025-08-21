import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { Toaster } from "react-hot-toast";
import { MembersClient } from "./MembersClient";

/**
 * The server-side page for managing a gym's members.
 * It fetches all necessary data and passes it to the client component.
 */
export default async function MembersPage({ params }: { params: Promise<{ gymId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;
  const { gymId } = await params;

  // Fetch all necessary data for the page in one go
  const gym = await prisma.gym.findFirst({
    where: { id: gymId, ownerId: userId },
    include: {
      subscription: true,
      members: {
        include: {
          plan: true,
        },
        orderBy: { joinedAt: 'desc' },
      },
      membershipPlans: {
        orderBy: { createdAt: 'asc' },
      },
      customFields: { // Fetch the custom field definitions
        orderBy: { order: 'asc' },
      },
    },
  });

  if (!gym) redirect("/setup");

  const isProPlan = gym.subscription?.planId !== "free_plan";
  const plans = gym.membershipPlans;

  return (
    <div className="space-y-8">
      <Toaster position="top-center" />
      <div>
        <h1 className="text-3xl font-bold">Member Management</h1>
        <p className="text-muted-foreground">
          Add, view, and manage all the members of your gym.
        </p>
      </div>
      
      {/* ✅ UPDATED: Pass the customFields prop to the client component */}
      <MembersClient 
        initialMembers={gym.members}
        membershipPlans={plans}
        customFields={gym.customFields}
        gymId={gymId}
        isProPlan={isProPlan}
      />
    </div>
  );
}
