// Signed-in users land here when they have no active organization.
// CreateOrganization is the only path forward — there is no personal workspace.
// After creating one they are taken straight to /dashboard.

import { CreateOrganization } from "@clerk/nextjs";

export default function OnboardingPage() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <p className="text-neutral-500 text-xs font-mono">
          Create a team to get started.
        </p>
        <CreateOrganization afterCreateOrganizationUrl="/dashboard" />
      </div>
    </div>
  );
}
