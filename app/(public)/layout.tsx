// app/(public)/layout.tsx

import { HeroHeader } from "@/components/header";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <HeroHeader /> {/* The header only exists for this group */}
      <main>{children}</main>
    </div>
  );
}