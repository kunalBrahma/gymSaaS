import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";

interface UpgradeNoticeProps {
  memberCount: number;
  memberLimit: number;
}

/**
 * A notice component that encourages free-plan users to upgrade.
 * It displays their current usage against their plan's limit.
 */
export function UpgradeNotice({ memberCount, memberLimit }: UpgradeNoticeProps) {
  const usagePercentage = (memberCount / memberLimit) * 100;

  return (
    <div className="mb-6 rounded-lg border border-yellow-300 bg-yellow-50 p-4 dark:border-yellow-700 dark:bg-yellow-900/20">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <div className="flex-1">
          <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">You are on the Free Plan</h3>
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            You have used {memberCount} of your {memberLimit} member slots. Upgrade to Pro for unlimited members and advanced features.
          </p>
          <Progress value={usagePercentage} className="mt-2 h-2" />
        </div>
        <Link href="/setup">
          <Button className="bg-yellow-500 hover:bg-yellow-600 text-white">Upgrade to Pro</Button>
        </Link>
      </div>
    </div>
  );
}
