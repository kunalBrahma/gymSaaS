"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DebugProps {
  gymId: string;
  membershipPlans: any[];
  customFields: any[];
  isProPlan: boolean;
}

export function MemberDebugComponent({ gymId, membershipPlans, customFields, isProPlan }: DebugProps) {
  const [debugInfo, setDebugInfo] = useState<any>(null);

  const testConnection = async () => {
    try {
      // Test basic form data creation
      const testFormData = new FormData();
      testFormData.append("name", "Test User");
      testFormData.append("email", "test@example.com");
      testFormData.append("planId", membershipPlans[0]?.id || "");
      testFormData.append("joinedAt", new Date().toISOString().split('T')[0]);

      console.log("Test FormData:");
      for (const [key, value] of testFormData.entries()) {
        console.log(`${key}: ${value}`);
      }

      setDebugInfo({
        gymId,
        membershipPlansCount: membershipPlans.length,
        customFieldsCount: customFields.length,
        isProPlan,
        firstPlan: membershipPlans[0],
        testFormDataSize: Array.from(testFormData.entries()).length,
      });
    } catch (error:any) {
      console.error("Debug test failed:", error);
      setDebugInfo({error: error.message || "An unexpected error occurred."});
    }
  };

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>Debug Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={testConnection}>Run Debug Test</Button>
        
        {debugInfo && (
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        )}
        
        <div className="text-sm space-y-2">
          <p><strong>Gym ID:</strong> {gymId}</p>
          <p><strong>Membership Plans:</strong> {membershipPlans.length}</p>
          <p><strong>Custom Fields:</strong> {customFields.length}</p>
          <p><strong>Is Pro Plan:</strong> {isProPlan ? "Yes" : "No"}</p>
          {membershipPlans.length > 0 && (
            <p><strong>First Plan:</strong> {membershipPlans[0].name} (ID: {membershipPlans[0].id})</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}