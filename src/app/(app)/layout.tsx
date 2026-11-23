import { Suspense } from "react";

import { BottomNav, BottomNavView } from "@/components/bottom-nav";
import { OfflineSync } from "@/components/offline-sync";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col pb-32">
        <OfflineSync />
        {children}
      </div>
      <Suspense fallback={<BottomNavView pathname={null} />}>
        <BottomNav />
      </Suspense>
    </>
  );
}
