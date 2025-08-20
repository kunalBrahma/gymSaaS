"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import type { Member, MembershipPlan, MembershipHistory } from "@prisma/client";
import { History, Calendar, TrendingUp, TrendingDown, Repeat } from "lucide-react";

type MemberDetails = Member & {
  plan: MembershipPlan;
  history: MembershipHistory[];
};

interface MemberDetailsClientProps {
  member: MemberDetails;
  isProPlan: boolean;
}

const eventIcons = {
  JOINED: <TrendingUp className="h-5 w-5 text-green-500" />,
  RENEWED: <Repeat className="h-5 w-5 text-blue-500" />,
  PLAN_CHANGED: <TrendingDown className="h-5 w-5 text-yellow-500" />,
  MEMBERSHIP_EXPIRED: <Calendar className="h-5 w-5 text-red-500" />,
};

export function MemberDetailsClient({ member, isProPlan }: MemberDetailsClientProps) {
  const historyToShow = isProPlan ? member.history : member.history.slice(0, 2);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left Column: Member Profile */}
      <div className="lg:col-span-1 space-y-6">
        <Card>
          <CardHeader className="items-center">
            <Avatar className="h-24 w-24">
              <AvatarImage src={member.photoUrl ?? undefined} />
              <AvatarFallback className="text-3xl">
                {member.name.split(' ').map(n => n[0]).join('').toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <CardTitle className="text-2xl pt-4">{member.name}</CardTitle>
            <CardDescription>{member.email}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phone:</span>
              <span>{member.phone || "N/A"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Gender:</span>
              <span>{member.gender || "N/A"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date of Birth:</span>
              <span>{member.dateOfBirth ? format(new Date(member.dateOfBirth), "PPP") : "N/A"}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Current Membership</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Plan:</span>
              <Badge>{member.plan.name}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Joined On:</span>
              <span>{format(new Date(member.joinedAt), "PPP")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Expires On:</span>
              <span className="font-semibold">{member.membershipExpiresAt ? format(new Date(member.membershipExpiresAt), "PPP") : "N/A"}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Column: Membership History */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-6 w-6" />
              Membership History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {historyToShow.map((event) => (
                <div key={event.id} className="flex items-start gap-4">
                  <div className="bg-muted rounded-full p-2">
                    {eventIcons[event.type]}
                  </div>
                  <div>
                    <p className="font-semibold">{event.description}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(event.date), "PPP, p")}
                    </p>
                    {event.amountPaid && (
                       <p className="text-sm">Amount Paid: ₹{(event.amountPaid / 100).toFixed(2)}</p>
                    )}
                  </div>
                </div>
              ))}

              {!isProPlan && member.history.length > 2 && (
                <div className="text-center border-t pt-4 mt-4">
                  <p className="text-muted-foreground">
                    There are {member.history.length - 2} more records in this member's history.
                  </p>
                  <Button className="mt-2">Upgrade to Pro to View Full History</Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
