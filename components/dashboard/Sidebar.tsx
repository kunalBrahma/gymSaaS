"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Settings,
  Dumbbell,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

export function AdminSidebar() {
  const { state, isMobile } = useSidebar();
  const pathname = usePathname();
  const collapsed = state === "collapsed";

  // Extract gymId from pathname
  const pathSegments = pathname.split("/");
  const gymId = pathSegments[2]; // Assuming /dashboard/[gymId]/... structure

  // Define navigation with dynamic gymId
  const navigation = [
    {
      title: "Overview",
      items: [
        {
          name: "Dashboard",
          href: `/dashboard/${gymId}`,
          icon: LayoutDashboard,
        },
      ],
    },
    {
      title: "Management",
      items: [
        {
          name: "Members",
          href: `/dashboard/${gymId}/members`,
          icon: Users,
        },
        {
          name: "Schedule",
          href: `/dashboard/${gymId}/schedule`,
          icon: Calendar,
        },
        {
          name: "Equipment",
          href: `/dashboard/${gymId}/equipment`,
          icon: Dumbbell,
        },
      ],
    },
    {
      title: "System",
      items: [
        {
          name: "Settings",
          href: `/dashboard/${gymId}/settings`,
          icon: Settings,
        },
      ],
    },
  ];

  const isActive = (path: string) => {
    // Handle the base dashboard route separately
    if (path === `/dashboard/${gymId}`) return pathname.endsWith(`/dashboard/${gymId}`);
    // Check if the current path starts with the link's path
    return pathname.startsWith(path);
  };

  const getNavCls = (path: string) =>
    cn(
      "w-full justify-start transition-colors duration-200",
      isActive(path)
        ? "bg-primary/10 text-primary border-r-2 border-primary"
        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
    );

  return (
    <Sidebar
      collapsible="icon"
      className="border-r bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
    >
      <div className="flex h-14 items-center justify-between px-4 border-b">
        {(!collapsed || isMobile) && (
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Dumbbell className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-lg">GymSaaS</span>
          </div>
        )}
        {!isMobile && <SidebarTrigger className="h-8 w-8" />}
      </div>

      <SidebarContent className="mt-4">
        {navigation.map((section) => (
          <SidebarGroup key={section.title}>
            {(!collapsed || isMobile) && (
              <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 mb-2">
                {section.title}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton
                      asChild
                      tooltip={collapsed && !isMobile ? item.name : undefined}
                    >
                      <Link href={item.href} className={getNavCls(item.href)}>
                        <item.icon
                          className={cn(
                            "h-4 w-4",
                            (!collapsed || isMobile) ? "mr-3" : ""
                          )}
                        />
                        {(!collapsed || isMobile) && <span>{item.name}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}