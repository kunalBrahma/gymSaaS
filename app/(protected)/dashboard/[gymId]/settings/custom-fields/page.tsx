import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { Toaster } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CustomFieldsClient } from "./CustomFieldsClient";

/**
 * The server-side page for managing a gym's custom member fields.
 * It fetches the initial data and ensures the user is on a Pro plan.
 */
export default async function CustomFieldsPage({ params }: { params: Promise<{ gymId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;
  const { gymId } = await params;

  // Fetch gym, subscription, and custom fields data
  const gym = await prisma.gym.findFirst({
    where: { id: gymId, ownerId: userId },
    include: {
      subscription: true,
      customFields: {
        orderBy: { order: 'asc' },
      },
    },
  });

  if (!gym) redirect("/setup");

  const isProPlan = gym.subscription?.planId !== "free_plan";

  // ✅ FIXED: Sanitize the data to make it serializable before passing to the client.
  const serializableFields = gym.customFields.map(field => ({
    ...field,
    // Convert the JSON 'options' field to a string
    options: field.options ? JSON.stringify(field.options) : null,
  }));


  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <Toaster position="top-center" />
      <div>
        <h1 className="text-3xl font-bold">Custom Member Fields</h1>
        <p className="text-muted-foreground">
          Customize the member signup form with your own fields.
        </p>
      </div>

      {isProPlan ? (
        <CustomFieldsClient initialFields={serializableFields} gymId={gymId} />
      ) : (
        <Card className="bg-muted/40">
           <CardHeader>
            <CardTitle>Upgrade to Pro to Use Custom Fields</CardTitle>
            <CardDescription>
              Upgrade your plan to add custom fields to your member information form, such as "Emergency Contact" or "Fitness Goals".
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button>Upgrade Now</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
