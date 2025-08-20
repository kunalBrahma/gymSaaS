"use client";

import { useTransition } from "react";
import { toast } from "react-hot-toast";
import { updateGymSettings } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { Gym } from "@prisma/client";

interface SettingsFormProps {
  gym: Gym;
}

/**
 * A client component to handle the settings form submission.
 * It calls the server action and displays toast notifications based on the result.
 */
export function SettingsForm({ gym }: SettingsFormProps) {
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      const result = await updateGymSettings(gym.id, formData);
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message || "An error occurred.");
      }
    });
  };

  return (
    <form action={handleSubmit}>
      <div className="space-y-6">
        {/* Gym Profile Card */}
        <Card>
          <CardHeader>
            <CardTitle>Gym Profile</CardTitle>
            <CardDescription>Update your gym's public information.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1">Gym Name</label>
              <Input id="name" name="name" defaultValue={gym.name} required />
            </div>
            <div>
              <label htmlFor="address" className="block text-sm font-medium mb-1">Address</label>
              <Input id="address" name="address" defaultValue={gym.address ?? ""} />
            </div>
            <div>
              <label htmlFor="description" className="block text-sm font-medium mb-1">Description</label>
              <Textarea id="description" name="description" defaultValue={gym.description ?? ""} />
            </div>
          </CardContent>
        </Card>

        {/* Razorpay Integration Card */}
        <Card>
          <CardHeader>
            <CardTitle>Razorpay Integration</CardTitle>
            <CardDescription>
              Connect your Razorpay account to accept online payments from members. This is a Pro feature.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label htmlFor="razorpayKeyId" className="block text-sm font-medium mb-1">Key ID</label>
              <Input id="razorpayKeyId" name="razorpayKeyId" defaultValue={gym.razorpayKeyId ?? ""} placeholder="rzp_test_..." />
            </div>
            <div>
              <label htmlFor="razorpayKeySecret" className="block text-sm font-medium mb-1">Key Secret</label>
              <Input id="razorpayKeySecret" name="razorpayKeySecret" type="password" placeholder={gym.razorpayKeySecret ? "••••••••••••••••••••••" : "Enter your new secret key"} />
              {gym.razorpayKeySecret && <p className="text-xs text-muted-foreground mt-1">A secret key is already saved. Enter a new one to update it.</p>}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>
    </form>
  );
}
