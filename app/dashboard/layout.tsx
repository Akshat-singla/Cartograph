// Protected layout. Middleware enforces sign-in before this renders —
// a signed-out visitor is redirected at the edge, before any HTML is sent.
// auth().protect() here is a belt-and-suspenders check that also ensures
// the user is in an active organization before entering the shell.

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { userId, orgId } = await auth();

  // Belt-and-suspenders: middleware already blocks unsigned-out requests,
  // but this makes the intent explicit and handles edge cases like direct
  // server action calls.
  if (!userId) {
    redirect("/sign-in");
  }

  // If the user is signed in but has no active org, they need to create or
  // join one before they can use the workspace.
  if (!orgId) {
    redirect("/onboarding");
  }

  return (
    <div className="flex flex-1 overflow-hidden h-[calc(100vh-37px)]">
      {/* Left sidebar — repo list and nav, populated in later phases */}
      <aside className="w-56 shrink-0 border-r border-neutral-800 bg-neutral-950 flex flex-col overflow-y-auto">
        <div className="px-3 py-3 border-b border-neutral-800">
          <span className="text-neutral-500 text-xs font-mono uppercase tracking-widest">
            Repositories
          </span>
        </div>
        <div className="flex-1" />
      </aside>

      {/* Main canvas — graph and detail panel, populated in later phases */}
      <main className="flex-1 overflow-hidden flex flex-col bg-neutral-950">
        {children}
      </main>
    </div>
  );
}
