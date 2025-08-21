import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { Toaster } from "react-hot-toast";
import { SettingsForm } from "./SettingsForm"; // Import the client component
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Lock } from "lucide-react";

/**
 * The settings page for a gym. This server component fetches the initial data
 * and passes it to the client form component.
 */
export default async function SettingsPage({ params }: { params: Promise<{ gymId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;
  const { gymId } = await params;

  // ✅ UPDATED: Fetch subscription data to check the user's plan
  const gym = await prisma.gym.findFirst({
    where: { id: gymId, ownerId: userId },
    include: { subscription: true },
  });

  if (!gym) redirect("/setup");

  const isProPlan = gym.subscription?.planId !== "free_plan";

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <Toaster position="top-center" />
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your gym's profile and payment integration.
        </p>
      </div>
      
      {/* The form is now wrapped in its own client component */}
      <SettingsForm gym={gym} />

      {/* ✅ NEW: Card for Custom Fields, with logic for Pro/Free plans */}
      <Card>
        <CardHeader>
          <CardTitle>Custom Member Fields</CardTitle>
          <CardDescription>
            Customize the member signup form with your own fields, such as "Emergency Contact" or "Fitness Goals".
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isProPlan ? (
            <Button asChild>
              <Link href={`/dashboard/${gymId}/settings/custom-fields`}>Manage Custom Fields</Link>
            </Button>
          ) : (
            <div className="flex items-center justify-between p-4 rounded-md bg-muted/50 border">
              <p className="text-sm text-muted-foreground">This is a Pro feature. Upgrade your plan to add custom fields.</p>
              <Button disabled>
                <Lock className="mr-2 h-4 w-4" />
                Manage Custom Fields
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
