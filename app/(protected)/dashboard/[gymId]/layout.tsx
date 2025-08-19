import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import { AdminSidebar } from "@/components/dashboard/Sidebar";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { SidebarProvider } from "@/components/ui/sidebar"; // Assuming this is a client component

/**
 * This is the main layout for the authenticated dashboard area.
 * It uses the structure you provided, fetches essential gym data,
 * and provides the main UI shell (sidebar, header) for all nested dashboard pages.
 */
export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ gymId: string }>;
}) {
  // 1. Authenticate the user and get their ID
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  // 2. Resolve the gymId from the URL parameters
  const { gymId } = await params;

  // 3. Fetch the gym details from the database
  const gym = await prisma.gym.findFirst({
    where: {
      id: gymId,
      ownerId: userId, // Security check: user must own this gym
    },
  });

  // 4. If no gym is found, redirect the user to the setup page
  if (!gym) {
    redirect("/setup");
  }

  // 5. Render the main dashboard structure using your layout
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-surface">
        <AdminSidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <DashboardHeader  />
          <main className="flex-1 overflow-y-auto p-6 sm:p-8">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
