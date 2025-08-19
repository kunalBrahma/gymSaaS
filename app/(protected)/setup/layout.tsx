// app/(protected)/setup/layout.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";

export default async function SetupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.id) {
    redirect("/login");
  }
  
  // Find the gym AND its subscription status
  const gym = await prisma.gym.findUnique({
    where: { ownerId: session.user.id },
    include: { subscription: true },
  });

  // THE FIX: Only redirect if the user has a gym AND an active subscription.
  if (gym && gym.subscription?.status === 'ACTIVE') {
    redirect("/dashboard");
  }

  // Otherwise, allow the user to stay on the setup page.
  return <>{children}</>;
}