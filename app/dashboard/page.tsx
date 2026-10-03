// Dashboard home — org name is read from auth() on the server (first paint,
// no client hydration required) satisfying acceptance check #3.

import { auth } from "@clerk/nextjs/server";

export default async function DashboardPage() {
  const { orgSlug, orgId } = await auth();

  return (
    <div className="flex flex-1 items-center justify-center text-neutral-600">
      <div className="text-center font-mono text-xs space-y-1">
        <p className="text-neutral-400">
          {orgSlug ?? orgId ?? "No organization"}
        </p>
        <p>Paste a repository URL to get started.</p>
      </div>
    </div>
  );
}
