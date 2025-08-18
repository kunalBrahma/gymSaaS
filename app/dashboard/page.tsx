// app/dashboard/page.tsx

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import Image from "next/image";
import { LogoutButton } from "@/components/AuthButtons";


export default async function DashboardPage() {
  // Fetch the user's session
  const session = await getServerSession(authOptions);

  // If the user is not logged in, redirect them to the login page
  if (!session || !session.user) {
    redirect("/login");
  }

  const user = session.user;

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="w-full max-w-sm p-8 space-y-6 bg-white rounded-lg shadow-lg dark:bg-gray-800">
        <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-white">
          My Profile
        </h1>
        
        {/* Profile Info Section */}
        <div className="flex flex-col items-center space-y-4">
          {user.image && (
            <Image
              src={user.image}
              alt="Profile Picture"
              width={96}
              height={96}
              className="rounded-full ring-2 ring-offset-2 ring-blue-500"
            />
          )}
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {user.name || "Gym Owner"}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {user.email}
            </p>
          </div>
        </div>

        {/* Logout Button */}
        <LogoutButton />
      </div>
    </div>
  );
}