"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Toaster, toast } from "react-hot-toast";
import { Building, ArrowRight, Loader2 } from 'lucide-react';
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
import { Textarea } from "@/components/ui/textarea";

const gymDetailsSchema = z.object({
  name: z.string().min(3, { message: "Gym name must be at least 3 characters." }),
  address: z.string().min(5, { message: "Please enter a valid address." }),
  description: z.string().optional(),
});

type GymDetailsFormData = z.infer<typeof gymDetailsSchema>;

interface GymDetailsFormProps {
  gymId?: string | null;
  onSuccess: (updatedGymId: string) => void;
}

export function GymDetailsForm({ gymId, onSuccess }: GymDetailsFormProps) {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const isEditMode = !!gymId;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset, // Get the reset function from useForm
  } = useForm<GymDetailsFormData>({
    resolver: zodResolver(gymDetailsSchema),
  });

  // This useEffect hook fetches the existing gym data when the component
  // is in "edit mode" (i.e., when a gymId is provided).
  useEffect(() => {
    if (isEditMode) {
      const fetchGymData = async () => {
        setIsLoading(true); // Show a loading state on the whole form
        try {
          const response = await fetch(`/api/gyms/${gymId}`);
          if (!response.ok) {
            throw new Error("Could not load your gym details.");
          }
          const data = await response.json();
          
          // Use the 'reset' function to pre-fill the form fields with fetched data
          reset({
            name: data.name,
            address: data.address,
            description: data.description || '',
          });
        } catch (error: any) {
          toast.error(error.message);
        } finally {
          setIsLoading(false);
        }
      };
      fetchGymData();
    }
  }, [isEditMode, gymId, reset]);

  const onSubmit = async (data: GymDetailsFormData) => {
    setIsLoading(true);
    try {
      // Dynamically set the URL and method based on whether we are editing or creating
      const url = isEditMode ? `/api/gyms/${gymId}` : "/api/gyms";
      const method = isEditMode ? "PUT" : "POST";

      const response = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to save details.");
      }

      toast.success(`Gym details ${isEditMode ? 'updated' : 'saved'} successfully!`);
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
      <CardHeader className="text-center">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Building className="w-8 h-8 text-primary" />
        </div>
        <CardTitle className="text-2xl">Step 1: Tell us about your gym</CardTitle>
        <CardDescription>
          This information will be used to set up your gym's profile.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Gym Name *</Label>
            <Input
              id="name"
              placeholder="Enter your gym's name"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address *</Label>
            <Input
              id="address"
              placeholder="Enter your gym's address"
              {...register("address")}
            />
            {errors.address && (
              <p className="text-sm text-destructive">{errors.address.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              rows={4}
              placeholder="Tell us a bit about your gym, its facilities, and what makes it special..."
              {...register("description")}
            />
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  {isEditMode ? 'Update and Continue' : 'Save and Continue'}
                  <ArrowRight className="ml-2 w-5 h-5" />
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
