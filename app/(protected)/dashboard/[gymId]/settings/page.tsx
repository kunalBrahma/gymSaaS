import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { Toaster } from "react-hot-toast";
import { SettingsForm } from "./SettingsForm"; // Import the client component

/**
 * The settings page for a gym. This server component fetches the initial data
 * and passes it to the client form component.
 */
export default async function SettingsPage({ params }: { params: Promise<{ gymId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;
  const { gymId } = await params;

  const gym = await prisma.gym.findFirst({
    where: { id: gymId, ownerId: userId },
  });

  if (!gym) redirect("/setup");

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <Toaster position="top-center" />
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your gym's profile and payment integration.
        </p>
      </div>
      
      {/* Render the client component with the fetched gym data */}
      <SettingsForm gym={gym} />
    </div>
  );
}
