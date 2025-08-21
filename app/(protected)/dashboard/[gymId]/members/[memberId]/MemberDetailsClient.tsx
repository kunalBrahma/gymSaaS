"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import { User, Scale, FileText, History, Calendar, TrendingUp, TrendingDown, Repeat, Crown, ArrowRight, CheckCircle, Zap, Lock } from "lucide-react";
import type { Member, MembershipPlan, MembershipHistory } from "@prisma/client";
import Link from "next/link";

type MemberDetails = Member & {
  plan: MembershipPlan;
  history: MembershipHistory[];
};

interface MemberDetailsClientProps {
  member: MemberDetails;
  isProPlan: boolean;
}

const eventIcons = {
  JOINED: <TrendingUp className="h-4 w-4 text-green-500 dark:text-green-400" />,
  RENEWED: <Repeat className="h-4 w-4 text-blue-500 dark:text-blue-400" />,
  PLAN_CHANGED: <TrendingDown className="h-4 w-4 text-yellow-500 dark:text-yellow-400" />,
  MEMBERSHIP_EXPIRED: <Calendar className="h-4 w-4 text-red-500 dark:text-red-400" />,
};

// Helper function to safely parse customFields
function parseCustomFields(customFields: any): Record<string, string | number | Date> | null {
  if (!customFields || typeof customFields !== 'object') {
    return null;
  }
  return Object.keys(customFields).length > 0 ? customFields : null;
}

export function MemberDetailsClient({ member, isProPlan }: MemberDetailsClientProps) {
  const parsedCustomFields = parseCustomFields(member.customFields);
  const freeHistoryLimit = 5;
  const visibleHistory = isProPlan ? member.history : member.history.slice(0, freeHistoryLimit);
  const hiddenCount = member.history.length - freeHistoryLimit;

  return (
    <div className="container mx-auto py-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Sidebar - Member Profile */}
        <div className="lg:col-span-4 xl:col-span-3">
          <div className="sticky top-8 space-y-6">
            
            <Card>
              <CardContent className="p-6 text-center">
                <Avatar className="h-24 w-24 mx-auto mb-4 border-4 border-background shadow-lg">
                  <AvatarImage src={member.photoUrl ?? undefined} className="object-cover" />
                  <AvatarFallback className="text-3xl bg-primary text-primary-foreground">
                    {member.name.split(" ").map((n) => n[0]).join("").toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <h1 className="text-2xl font-bold">{member.name}</h1>
                <p className="text-muted-foreground">{member.email}</p>
                <Badge className="mt-2">{member.plan.name}</Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Contact & Personal Info</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Phone:</span><span className="font-medium">{member.phone || "N/A"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Gender:</span><span className="font-medium">{member.gender || "N/A"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">DOB:</span><span className="font-medium">{member.dateOfBirth ? format(new Date(member.dateOfBirth), "MMM dd, yyyy") : "N/A"}</span></div>
                {member.address && <div className="pt-2 border-t"><p className="text-muted-foreground text-xs mb-1">Address:</p><p className="font-medium leading-relaxed">{member.address}</p></div>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Physical Stats</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Height:</span><span className="font-medium">{member.heightCm ? `${member.heightCm} cm` : "N/A"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Weight:</span><span className="font-medium">{member.weightKg ? `${member.weightKg} kg` : "N/A"}</span></div>
                {member.idProofUrl && <div className="pt-2 border-t"><Link href={member.idProofUrl} target="_blank" className="inline-flex items-center gap-1 text-primary hover:underline text-sm font-medium"><FileText className="h-3 w-3" />View ID Proof</Link></div>}
              </CardContent>
            </Card>

            {isProPlan && parsedCustomFields && (
              <Card>
                <CardHeader><CardTitle className="text-base">Additional Details</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {Object.entries(parsedCustomFields).map(([key, value]) => (
                    <div key={key} className="flex justify-between"><span className="text-muted-foreground capitalize">{key}:</span><span className="font-medium text-right max-w-[60%] break-words">{String(value)}</span></div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Main Content - Membership History */}
        <div className="lg:col-span-8 xl:col-span-9">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold flex items-center gap-3"><History className="h-6 w-6 text-primary" />Membership History</h2>
          </div>

          <div className="space-y-6">
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {visibleHistory.length > 0 ? (
                    visibleHistory.map((event) => (
                      <div key={event.id} className="p-4 sm:p-6 hover:bg-muted/50 transition-colors">
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0 w-10 h-10 bg-muted rounded-full flex items-center justify-center">{eventIcons[event.type]}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                              <div className="flex-1">
                                <h3 className="font-semibold text-base">{event.description}</h3>
                                <p className="text-sm text-muted-foreground mt-1">{format(new Date(event.date), "PPP, p")}</p>
                              </div>
                              {event.amountPaid && <Badge variant="secondary">₹{(event.amountPaid / 100).toFixed(2)}</Badge>}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-12 text-center"><History className="h-12 w-12 text-muted-foreground mx-auto mb-4" /><h3 className="text-lg font-medium mb-2">No History Available</h3><p className="text-muted-foreground">This member doesn't have any recorded history yet.</p></div>
                  )}
                </div>
              </CardContent>
            </Card>

            {!isProPlan && hiddenCount > 0 && (
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent z-10"></div>
                <Card className="blur-sm pointer-events-none">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-start gap-4 opacity-50">
                      <div className="w-10 h-10 bg-muted rounded-full"></div>
                      <div className="flex-1 space-y-2"><div className="h-4 bg-muted rounded w-3/4"></div><div className="h-3 bg-muted rounded w-1/2"></div></div>
                    </div>
                     <div className="flex items-start gap-4 opacity-30">
                      <div className="w-10 h-10 bg-muted rounded-full"></div>
                      <div className="flex-1 space-y-2"><div className="h-4 bg-muted rounded w-2/3"></div><div className="h-3 bg-muted rounded w-1/2"></div></div>
                    </div>
                  </CardContent>
                </Card>
                <div className="absolute inset-0 flex -mt-10 items-center justify-center z-20">
                  <Card className="bg-background/20 backdrop-blur-xl p-6 w-full text-center shadow-lg border-0 rounded-t-none border-b border-r border-l rounded-b-lg">
                    <CardHeader className="p-0">
                      <div className="mx-auto w-12 h-12 bg-primary rounded-full flex items-center justify-center mb-4">
                        <Lock className="h-6 w-6 text-primary-foreground" />
                      </div>
                      <CardTitle>Unlock Full Member History</CardTitle>
                      <CardDescription className="pt-2">You have {hiddenCount} more hidden records for this member.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0 mt-4">
                      <Button asChild>
                        <Link href="/dashboard/subscription">
                          <Crown className="mr-2 h-4 w-4" /> Upgrade to Pro
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
