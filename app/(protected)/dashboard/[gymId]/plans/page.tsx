import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { PlansClient } from "./PlansClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Toaster } from "react-hot-toast";

/**
 * The server-side page for managing a gym's membership plans.
 * It fetches the initial data and handles the Pro/Free plan logic.
 */
export default async function MembershipPlansPage({ params }: { params: Promise<{ gymId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;
  const { gymId } = await params;

  const gym = await prisma.gym.findFirst({
    where: { id: gymId, ownerId: userId },
    include: {
      subscription: true,
      membershipPlans: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!gym) redirect("/setup");

  const isProPlan = gym.subscription?.planId !== "free_plan";
  const canCreatePlan = isProPlan || gym.membershipPlans.length === 0;

  return (
    <div className="space-y-8">
      <Toaster position="top-center" />
      <div>
        <h1 className="text-3xl font-bold">Membership Plans</h1>
        <p className="text-muted-foreground">
          Create and manage the membership plans for your gym.
        </p>
      </div>

      {canCreatePlan ? (
        // Pro users OR free users who haven't created a plan yet will see the full client
        <PlansClient 
          initialData={gym.membershipPlans} 
          gymId={gymId} 
          isProPlan={isProPlan}
        />
      ) : (
        // Free users who have already created their one plan will see this
        <>
          <Card className="bg-muted/40">
            <CardHeader>
              <CardTitle>Upgrade to Pro to Add More Plans</CardTitle>
              <CardDescription>
                Your Free Plan is limited to one custom membership plan. Upgrade to create unlimited plans, special offers, and more.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button>Upgrade Now</Button>
            </CardContent>
          </Card>
          
          {/* They can still see their existing plan */}
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Your Plan</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {gym.membershipPlans.map((plan) => (
                <Card key={plan.id}>
                  <CardHeader>
                    <CardTitle>{plan.name}</CardTitle>
                    <CardDescription>
                      ₹{(plan.price / 100).toFixed(2)} / {plan.durationMonths} month(s)
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
