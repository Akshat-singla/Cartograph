import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

// Root route: signed-in users go to the dashboard, everyone else sees a
// minimal landing with sign-in/sign-up in the header.
export default async function HomePage() {
  const { userId } = await auth();

  if (userId) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-center font-mono text-xs space-y-2">
        <p className="text-neutral-400 text-sm">cartograph</p>
        <p className="text-neutral-600">
          Sign in to map a repository.
        </p>
      </div>
    </div>
  );
}
