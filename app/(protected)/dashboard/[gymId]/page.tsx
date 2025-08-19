import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
import { getSubscriptionStatus } from "@/lib/subscription";
import { StatCard } from "@/components/dashboard/StatCard";
import { UpgradeNotice } from "@/components/dashboard/UpgradeNotice";
import { DashboardChart } from "@/components/dashboard/dashboard-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, DollarSign, Activity, TrendingUp, FileText, Shield, UserPlus, Calendar, Dumbbell } from "lucide-react";

/**
 * This is the main dashboard page.
 * It fetches detailed stats for the gym and displays different information
 * based on the user's subscription plan (Free vs. Pro).
 */
export default async function DashboardPage({
  params,
}: {
  params: Promise<{ gymId: string }>;
}) {
  // 1. Authenticate the user
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  // ✅ FIXED: Await the params promise to resolve it before accessing its properties.
  const { gymId } = await params;

  // 2. Fetch gym and subscription data in one query
  const gym = await prisma.gym.findFirst({
    where: {
      id: gymId,
      ownerId: userId,
    },
    include: {
      subscription: true, 
    },
  });

  if (!gym) {
    redirect("/setup");
  }

  // 3. Get real-time subscription status
  const subscriptionStatus = await getSubscriptionStatus(gymId);

  // Mock data for display
  const memberCount = 247;
  const monthlyRevenue = 45230;
  const activeSessions = 23;
  const growthRate = 12.5;
  const memberLimit = 50;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{gym.name} Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here's what's happening with your gym today.
        </p>
      </div>

      {/* Upgrade Notice for Free Users */}
      {!subscriptionStatus.isPro && (
        <UpgradeNotice 
          memberCount={memberCount} 
          memberLimit={memberLimit} 
        />
      )}

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Members"
          value={memberCount.toString()}
          change={subscriptionStatus.isPro ? "+12% from last month" : `${memberCount}/${memberLimit} limit`}
          changeType="positive"
          icon={Users}
        />
        
        {subscriptionStatus.isPro ? (
          <StatCard
            title="Monthly Revenue"
            value={`₹${monthlyRevenue.toLocaleString()}`}
            change="+8% from last month"
            changeType="positive"
            icon={DollarSign}
          />
        ) : (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground">---</div>
              <p className="text-xs text-muted-foreground">Pro Feature</p>
            </CardContent>
          </Card>
        )}

        <StatCard
          title="Active Today"
          value={activeSessions.toString()}
          change="+5% from yesterday"
          changeType="positive"
          icon={Activity}
        />

        <StatCard
          title="Growth Rate"
          value={`${growthRate}%`}
          change="+2% from last month"
          changeType="positive"
          icon={TrendingUp}
        />
      </div>

      {/* Charts Section */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <DashboardChart
          title="Member Growth"
          description="Overview of member acquisition and retention"
          type="line"
        />
        
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest gym activities and updates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                {
                  icon: UserPlus,
                  title: "New member joined",
                  description: "John Doe started Premium membership",
                  time: "2 minutes ago"
                },
                {
                  icon: DollarSign,
                  title: "Payment received",
                  description: "Monthly subscription from Sarah Smith",
                  time: "5 minutes ago"
                },
                {
                  icon: Dumbbell,
                  title: "Equipment maintenance",
                  description: "Treadmill #3 service completed",
                  time: "1 hour ago"
                },
                {
                  icon: Calendar,
                  title: "Class scheduled",
                  description: "Morning Yoga class added",
                  time: "2 hours ago"
                }
              ].map((activity, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <div className="p-2 bg-muted rounded-full">
                    <activity.icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium">{activity.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {activity.description}
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {activity.time}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Member Management
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Manage Members</div>
            <p className="text-xs text-muted-foreground">
              Add, edit, or remove member accounts
            </p>
          </CardContent>
        </Card>

        {subscriptionStatus.isPro ? (
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Analytics
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">View Reports</div>
              <p className="text-xs text-muted-foreground">
                Detailed analytics and insights
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="hover:shadow-lg transition-shadow cursor-pointer opacity-60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Analytics
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">View Reports</div>
              <p className="text-xs text-muted-foreground">
                Pro Feature - Upgrade to unlock
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Gym Settings
            </CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Configure</div>
            <p className="text-xs text-muted-foreground">
              Update gym preferences and settings
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pro Plan Upgrade Prompt for Free Users */}
      {!subscriptionStatus.isPro && (
        <Card className="bg-gradient-to-r from-blue-600 to-blue-700 text-white border-0">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Ready to grow your gym?</h3>
                <p className="text-blue-100 mt-1">
                  Unlock advanced analytics, unlimited members, and premium features.
                </p>
              </div>
              <button className="bg-white text-blue-600 px-6 py-2 rounded-lg font-medium hover:bg-blue-50 transition-colors">
                Upgrade to Pro
              </button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
