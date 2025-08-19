"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar } from "recharts";

// Demo data for the chart
const data = [
  { name: "Jan", users: 400, revenue: 2400 },
  { name: "Feb", users: 300, revenue: 1398 },
  { name: "Mar", users: 600, revenue: 9800 },
  { name: "Apr", users: 800, revenue: 3908 },
  { name: "May", users: 700, revenue: 4800 },
  { name: "Jun", users: 900, revenue: 3800 },
];

interface DashboardChartProps {
  title: string;
  description?: string;
  type?: "line" | "bar";
}

/**
 * A reusable chart component for the dashboard, displaying demo data.
 * It can render either a line or a bar chart.
 */
export function DashboardChart({ title, description, type = "line" }: DashboardChartProps) {
  // NOTE: The `hsl(var(--primary))` syntax requires you to have these CSS variables
  // defined in your global CSS file for the colors to work.
  // Example: :root { --primary: 222.2 47.4% 11.2%; --success: 142.1 76.2% 36.3%; }
  const primaryColor = "hsl(var(--primary))";
  const successColor = "hsl(var(--success))";

  return (
    <Card className="col-span-4">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="pl-2">
        <ResponsiveContainer width="100%" height={350}>
          {type === "line" ? (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="users" 
                stroke={primaryColor}
                strokeWidth={2}
                name="New Members"
              />
              <Line 
                type="monotone" 
                dataKey="revenue" 
                stroke={successColor}
                strokeWidth={2}
                name="Revenue (INR)"
              />
            </LineChart>
          ) : (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="users" fill={primaryColor} name="New Members" />
              <Bar dataKey="revenue" fill={successColor} name="Revenue (INR)" />
            </BarChart>
          )}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
