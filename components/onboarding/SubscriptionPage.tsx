"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast, Toaster } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Check, ArrowLeft } from "lucide-react";

// This interface defines the expected shape of the Razorpay options object
interface RazorpayOptions {
  key: string;
  subscription_id: string;
  name: string;
  description: string;
  handler: (response: {
    razorpay_payment_id: string;
    razorpay_subscription_id: string;
    razorpay_signature: string;
  }) => void;
  prefill: {
    name?: string;
    email?: string;
  };
  theme: {
    color: string;
  };
}

// This tells TypeScript that the Razorpay constructor may exist on the window object
declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => any;
  }
}

interface SubscriptionPageProps {
  gymId: string | null;
  onBack: () => void;
}

export function SubscriptionPage({ gymId, onBack }: SubscriptionPageProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState<string | null>(null);

  // NOTE: Replace this with your actual Razorpay Plan ID for the Pro plan
  const proPlanId = "plan_R6sNjxiO80UVqP";

  // Load the Razorpay checkout script when the component mounts
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);

    // Clean up the script when the component unmounts
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handleSubscribe = async (planId: string) => {
    if (!gymId) {
      toast.error("Gym ID is missing. Cannot proceed.");
      return;
    }
    setIsLoading(planId);
    try {
      // 1. Call your backend to create a subscription
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || "Failed to create checkout session."
        );
      }

      const data = await response.json();
      const { subscriptionId, razorpayKeyId } = data;

      // 2. Configure the Razorpay payment modal
      const options: RazorpayOptions = {
        key: razorpayKeyId,
        subscription_id: subscriptionId,
        name: "Gym SaaS Pro Plan",
        description: "Monthly Subscription",
        handler: async function (response) {
          // 3. This function is called after a successful payment
          // Send payment details to your backend for verification and to save the subscription
          const verificationResponse = await fetch("/api/checkout/success", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_subscription_id: response.razorpay_subscription_id,
              razorpay_signature: response.razorpay_signature,
              gymId: gymId,
              planId: planId,
            }),
          });

          if (!verificationResponse.ok) {
            const errorData = await verificationResponse.json();
            throw new Error(
              errorData.message || "Payment verification failed."
            );
          }

          toast.success("Payment successful! Redirecting to dashboard...");
          router.push(`/dashboard/${gymId}`);
        },
        prefill: {
          // You can prefill user details here, e.g., from your user session
        },
        theme: {
          color: "#3B82F6", // Blue-500
        },
      };

      // 4. Open the Razorpay payment modal
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (error: any) {
      toast.error(error.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(null);
    }
  };

  const handleSelectFreePlan = async () => {
    setIsLoading("free");
    try {
      // Call the backend to set the user's plan to 'free' in the database.
      const response = await fetch("/api/select-free-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gymId }),
      });

      if (!response.ok) {
        throw new Error("Failed to select free plan. Please try again.");
      }

      toast.success("Free plan selected! Redirecting...");
      router.push(`/dashboard/${gymId}`);
    } catch (error: any) {
      toast.error(error.message || "Could not select the free plan.");
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <section className="">
      <Toaster position="top-center" />

      <div className="mx-auto max-w-5xl ">
        <div className=" grid gap-6 md:grid-cols-5 md:gap-0">
          {/* Free Plan */}
          <div className="rounded-lg flex flex-col justify-between space-y-8 border p-6 md:col-span-2 md:my-2 md:rounded-r-none md:border-r-0 lg:p-10">
            <div className="space-y-4">
              <div>
                <h2 className="font-medium">Free</h2>
                <span className="my-3 block text-2xl font-semibold">
                  ₹0 / mo
                </span>
                <p className="text-muted-foreground text-sm">
                  Perfect for getting started
                </p>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={handleSelectFreePlan}
                disabled={isLoading === "free"}
              >
                {isLoading === "free" ? "Processing..." : "Get Started"}
              </Button>

              <hr className="border-dashed" />

              <ul className="list-outside space-y-3 text-sm">
                {[
                  "Up to 10 Members",
                  "Basic Workout Tracking",
                  "Community Support",
                ].map((item, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <Check className="size-3" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Pro Plan */}
          <div className="dark:bg-muted rounded-lg border p-6 shadow-lg shadow-gray-950/5 md:col-span-3 lg:p-10 dark:[--color-muted:var(--color-zinc-900)]">
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <h2 className="font-medium">Pro</h2>
                  <span className="my-3 block text-2xl font-semibold">
                    ₹1,999 / mo
                  </span>
                  <p className="text-muted-foreground text-sm">
                    For growing gyms
                  </p>
                </div>

                <Button
                  className="w-full"
                  onClick={() => handleSubscribe(proPlanId)}
                  disabled={isLoading === proPlanId}
                >
                  {isLoading === proPlanId ? "Processing..." : "Get Started"}
                </Button>
              </div>

              <div>
                <div className="text-sm font-medium">
                  Everything in free plus :
                </div>

                <ul className="mt-4 list-outside space-y-3 text-sm">
                  {[
                    "Everything in Free Plan",
                    "Unlimited Members",
                    "Advanced Analytics",
                    "Custom Branding",
                    "Priority Email Support",
                    "Mobile App Access",
                    "Custom Reports",
                    "Monthly Product Updates",
                    "Advanced Security Features",
                    "Priority Support",
                  ].map((item, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <Check className="size-3" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Go Back Button */}
        <div className="mt-10 text-center">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back to Edit Details
          </Button>
        </div>
      </div>
    </section>
  );
}
