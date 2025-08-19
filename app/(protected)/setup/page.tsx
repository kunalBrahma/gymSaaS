"use client";

import { useState, useEffect } from "react"; // Import useEffect
import { ProgressSteps } from "@/components/onboarding/ProgressSteps";
import { GymDetailsForm } from "@/components/onboarding/GymDetailsForm";
import { SubscriptionPage } from "@/components/onboarding/SubscriptionPage";
import { Skeleton } from "@/components/ui/skeleton"; // For a loading state

export default function SetupPage() {
  const [step, setStep] = useState(1);
  const [gymId, setGymId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Add loading state

  // This useEffect hook runs once when the page loads
  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        const response = await fetch('/api/onboarding/status');
        const data = await response.json();

        // If the user has already created a gym, store its ID
        // and then jump to step 2. This is the crucial fix.
        if (data.hasCreatedGym && data.gymId) {
          setGymId(data.gymId);
          setStep(2);
        }
      } catch (error) {
        console.error("Failed to check onboarding status", error);
      } finally {
        setIsLoading(false); // Stop loading once check is complete
      }
    };

    checkOnboardingStatus();
  }, []); // The empty array ensures this runs only once on mount

  const handleDetailsSuccess = (createdOrUpdatedGymId: string) => {
    setGymId(createdOrUpdatedGymId);
    setStep(2);
  };

  const handleBack = () => {
    setStep(1);
  };

  // Show a loading skeleton while we check the user's status
  if (isLoading) {
    return (
        <div className="container mx-auto mt-40 flex flex-col items-center gap-8">
            <Skeleton className="h-10 w-80" />
            <Skeleton className="h-96 w-full max-w-2xl" />
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-10 sm:py-16 px-4">
      <div className="container mx-auto mt-20">
        <ProgressSteps currentStep={step} />
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl mb-4">
            Welcome to Your Gym Setup
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Let's get your gym configured in just 2 simple steps.
          </p>
        </div>
        <div className="flex items-center justify-center">
          {step === 1 && (
            <GymDetailsForm gymId={gymId} onSuccess={handleDetailsSuccess} />
          )}
          {step === 2 && (
            <SubscriptionPage gymId={gymId} onBack={handleBack} />
          )}
        </div>
      </div>
    </div>
  );
}
