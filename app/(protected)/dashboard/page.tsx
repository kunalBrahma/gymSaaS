// app/(protected)/dashboard/layout.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  // 1. ✅ Authentication check
  if (!session || !session.user?.id) {
    redirect("/login");
  }

  // 2. ✅ Find the user's gym with subscription
  const gym = await prisma.gym.findUnique({
    where: { ownerId: session.user.id },
    include: { subscription: true },
  });

  // 3. ✅ If no gym exists, send to setup
  if (!gym) {
    redirect("/setup");
  }

  // 4. ✅ If no subscription exists, send to setup
  if (!gym.subscription) {
    redirect("/setup");
  }

  // 5. ✅ If gym and subscription exist, redirect to gym-specific dashboard
  redirect(`/dashboard/${gym.id}`);
}
