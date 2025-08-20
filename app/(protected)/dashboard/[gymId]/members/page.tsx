import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { Toaster } from "react-hot-toast";
import { MembersClient } from "./MembersClient";

/**
 * The server-side page for managing a gym's members.
 * It fetches the initial data (members and plans) and passes it to the client component.
 */
export default async function MembersPage({ params }: { params: Promise<{ gymId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;
  const { gymId } = await params;

  // Fetch the gym, its members, and its membership plans all at once.
  const gym = await prisma.gym.findFirst({
    where: { id: gymId, ownerId: userId },
    include: {
      subscription: true,
      members: {
        include: {
          plan: true, // Include the plan details for each member
        },
        orderBy: { joinedAt: 'desc' },
      },
      membershipPlans: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!gym) redirect("/setup");

  const isProPlan = gym.subscription?.planId !== "free_plan";

  // ✅ FIXED: Removed the hard-coded plan logic.
  // The component now relies solely on the plans fetched from the database.
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
      
      <MembersClient 
        initialMembers={gym.members}
        membershipPlans={plans}
        gymId={gymId}
        isProPlan={isProPlan}
      />
    </div>
  );
}
