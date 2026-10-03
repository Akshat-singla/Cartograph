"use client";

import {
  OrganizationSwitcher,
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";

// Org switcher lets signed-in users switch between organizations and invite
// members. afterCreateOrganizationUrl and afterLeaveOrganizationUrl keep the
// user inside the app after those actions.
export function AuthNav() {
  return (
    <div className="flex items-center gap-3">
      <Show when="signed-out">
        <SignInButton mode="modal">
          <button className="px-2 py-1 rounded text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors text-xs font-mono">
            Sign in
          </button>
        </SignInButton>
        <SignUpButton mode="modal">
          <button className="px-2 py-1 rounded text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors text-xs font-mono">
            Sign up
          </button>
        </SignUpButton>
      </Show>
      <Show when="signed-in">
        <OrganizationSwitcher
          hidePersonal
          afterCreateOrganizationUrl="/dashboard"
          afterLeaveOrganizationUrl="/"
          afterSelectOrganizationUrl="/dashboard"
          appearance={{
            elements: {
              rootBox: "flex items-center",
              organizationSwitcherTrigger:
                "text-xs font-mono text-neutral-300 hover:text-white px-2 py-1 rounded hover:bg-neutral-800 transition-colors",
            },
          }}
        />
        <UserButton />
      </Show>
    </div>
  );
}
