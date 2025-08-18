"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Toaster, toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea"; // For a description field

// 1. Define the validation schema
const gymDetailsSchema = z.object({
  name: z.string().min(3, { message: "Gym name must be at least 3 characters." }),
  address: z.string().min(5, { message: "Please enter a valid address." }),
  description: z.string().optional(),
});

type GymDetailsFormData = z.infer<typeof gymDetailsSchema>;

// 2. Define the component's props, including the onSuccess callback
interface GymDetailsFormProps {
  onSuccess: (createdGymId: string) => void;
}

export function GymDetailsForm({ onSuccess }: GymDetailsFormProps) {
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<GymDetailsFormData>({
    resolver: zodResolver(gymDetailsSchema),
  });

  // 3. Handle form submission
  const onSubmit = async (data: GymDetailsFormData) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/onboarding/create-gym", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create gym.");
      }

      toast.success("Gym details saved successfully!");
      // 4. Call the onSuccess callback with the new gym's ID
      onSuccess(result.id);

    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <Toaster position="top-center" />
      <CardHeader>
        <CardTitle className="text-2xl">Step 1: Tell us about your gym</CardTitle>
        <CardDescription>
          This information will be used to set up your gym's profile.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-2">
            <Label htmlFor="name">Gym Name</Label>
            <Input id="name" {...register("name")} />
            {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="address">Address</Label>
            <Input id="address" {...register("address")} />
            {errors.address && <p className="text-sm text-red-500">{errors.address.message}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Short Description (Optional)</Label>
            <Textarea id="description" {...register("description")} />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Saving..." : "Save and Continue"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}