"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast, Toaster } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

// Make sure to get these Plan IDs from your Razorpay Test Dashboard
const plans = [
  {
    name: "Basic Monthly",
    price: "₹499",
    features: ["50 Members", "Basic Reporting", "Email Support"],
    planId: "plan_OebLhJkhO8LlXn", // <-- REPLACE with your actual Plan ID
  },
  {
    name: "Pro Monthly",
    price: "₹999",
    features: ["Unlimited Members", "Advanced Reporting", "Phone Support", "Equipment Tracking"],
    planId: "plan_OebMP1Gf9FftZa", // <-- REPLACE with your actual Plan ID
  },
];

// This component doesn't strictly need the gymId prop if your backend
// correctly uses the session, but it's good practice for clarity.
export function SubscriptionPage({ gymId }: { gymId: string | null }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleSubscribe = async (planId: string) => {
    setIsLoading(planId);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });

      if (!response.ok) {
        throw new Error("Failed to create subscription checkout.");
      }

      const data = await response.json();
      // Redirect to Razorpay's hosted payment page
      router.push(data.checkoutUrl);

    } catch (error: any) {
      toast.error(error.message || "An error occurred.");
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <Toaster position="top-center" />
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold">Step 2: Choose Your Plan</h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 mt-2">
          Your gym details are saved. Now, activate your account by selecting a plan.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {plans.map((plan) => (
          <Card key={plan.planId} className="flex flex-col">
            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
              <CardDescription className="text-4xl font-bold">{plan.price}<span className="text-lg font-normal">/mo</span></CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
              <ul className="space-y-2">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-center">
                    <svg className="w-4 h-4 mr-2 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path></svg>
                    {feature}
                  </li>
                ))}
              </ul>
            </CardContent>
            <div className="p-6 pt-0">
                <Button 
                    onClick={() => handleSubscribe(plan.planId)} 
                    className="w-full"
                    disabled={isLoading === plan.planId}
                >
                    {isLoading === plan.planId ? "Processing..." : "Choose Plan"}
                </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}