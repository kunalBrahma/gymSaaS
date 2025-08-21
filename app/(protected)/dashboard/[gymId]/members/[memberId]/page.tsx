import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { Toaster } from "react-hot-toast";
import { MemberDetailsClient } from "./MemberDetailsClient";

export default async function MemberDetailsPage({
  params,
}: {
  params: Promise<{ gymId: string; memberId: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const { gymId, memberId } = await params;

  // Fetch the gym and its subscription to verify ownership and check the plan
  const gym = await prisma.gym.findFirst({
    where: { id: gymId, ownerId: userId },
    include: { subscription: true },
  });

  if (!gym) {
    redirect("/dashboard");
  }

  // Fetch the specific member's details, including their full history
  const member = await prisma.member.findFirst({
    where: {
      id: memberId,
      gymId: gymId,
    },
    include: {
      plan: true,
      history: {
        orderBy: { date: "desc" },
      },
    },
  });

  if (!member) {
    redirect(`/dashboard/${gymId}/members`);
  }

  const isProPlan = gym.subscription?.planId !== "free_plan";

  return (
    <div className="space-y-8">
      <Toaster position="top-center" />
      <MemberDetailsClient
        member={member}
        isProPlan={isProPlan}
      />
    </div>
  );
}