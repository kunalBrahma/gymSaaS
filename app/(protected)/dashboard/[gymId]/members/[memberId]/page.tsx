import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { Toaster } from "react-hot-toast";
import { MemberDetailsClient } from "./MemberDetailsClient"; 

/**
 * The server-side page for viewing a single member's details.
 * It fetches all necessary data and passes it to a client component for rendering.
 */
export default async function MemberDetailsPage({ 
  params 
}: { 
  params: Promise<{ gymId: string; memberId: string }> 
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const { gymId, memberId } = await params;

  // 1. Fetch the gym and its subscription to verify ownership and check the plan
  const gym = await prisma.gym.findFirst({
    where: { id: gymId, ownerId: userId },
    include: { subscription: true },
  });

  if (!gym) {
    // This is a security check to ensure the user owns the gym
    redirect("/dashboard");
  }

  // 2. Fetch the specific member's details, including their full history
  const member = await prisma.member.findFirst({
    where: { 
      id: memberId,
      gymId: gymId // Ensure the member belongs to this gym
    },
    include: {
      plan: true,
      history: {
        orderBy: {
          date: 'desc' // Show the most recent events first
        }
      }
    }
  });

  if (!member) {
    // If the member doesn't exist or doesn't belong to this gym, redirect
    redirect(`/dashboard/${gymId}/members`);
  }

  const isProPlan = gym.subscription?.planId !== "free_plan";

  return (
    <div className="space-y-8">
      <Toaster position="top-center" />
      
      {/* ✅ UPDATED: Replaced the temporary debugging output with the final client component */}
      <MemberDetailsClient
        member={member}
        isProPlan={isProPlan}
      /> 
    </div>
  );
}
