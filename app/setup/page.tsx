// app/setup/page.tsx
"use client";

import { useState } from "react";
import { GymDetailsForm } from "@/components/onboarding/GymDetailsForm";
import { SubscriptionPage } from "@/components/onboarding/SubscriptionPage";

export default function SetupPage() {
  // State to manage which step the user is on
  const [step, setStep] = useState(1);
  const [gymId, setGymId] = useState<string | null>(null);

  // This function will be passed to the details form to call on success
  const handleDetailsSuccess = (createdGymId: string) => {
    setGymId(createdGymId);
    setStep(2); // Move to the next step
  };

  return (
    <div className="container mx-auto py-12">
      {/* Step 1: Collect Gym Details */}
      {step === 1 && <GymDetailsForm onSuccess={handleDetailsSuccess} />}

      {/* Step 2: Show Subscription Plans */}
      {step === 2 && <SubscriptionPage gymId={gymId} />}
    </div>
  );
}