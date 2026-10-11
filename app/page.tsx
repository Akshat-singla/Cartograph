import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { HeroForm } from "./_components/hero-form";

function NetworkIllustration() {
  return (
    <svg viewBox="0 0 360 220" aria-label="Dependency graph illustration" role="img" className="w-full">
      <path d="M70 110 175 55 290 120M70 110 175 175 290 120" fill="none" stroke="currentColor" strokeWidth="1" opacity=".45" />
      <circle cx="70" cy="110" r="24" fill="var(--color-blue-600)" opacity=".9" />
      <circle cx="175" cy="55" r="20" fill="var(--color-green-500)" opacity=".85" />
      <circle cx="175" cy="175" r="20" fill="var(--color-amber-500)" opacity=".85" />
      <circle cx="290" cy="120" r="28" fill="var(--color-blue-600)" opacity=".9" />
    </svg>
  );
}

export default async function HomePage() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <main className="mx-auto w-full max-w-[1140px] px-6">
      <section className="grid min-h-[calc(100vh-37px)] items-center gap-16 py-20 md:grid-cols-2">
        <div>
          <p className="mb-5 text-xs uppercase tracking-[.25em] text-blue-600">Cartograph</p>
          <h1 className="max-w-xl text-5xl font-semibold leading-[1.05] tracking-[-.06em] md:text-7xl">
            See the shape of a codebase.
          </h1>
          <p className="mt-6 max-w-md text-sm leading-7 text-neutral-500">
            Paste a public GitHub repository and get a dependency map built from its real imports, not guesses.
          </p>
          <div className="mt-8"><HeroForm /></div>
          <p className="mt-3 text-[10px] text-neutral-500">Public TypeScript and JavaScript repositories only.</p>
        </div>
        <div className="rounded border border-neutral-200 p-6 text-neutral-700 dark:border-neutral-800 dark:text-neutral-300">
          <NetworkIllustration />
        </div>
      </section>
      <section className="grid gap-12 border-t border-neutral-200 py-24 dark:border-neutral-800 md:grid-cols-3">
        <div><h2 className="text-lg font-medium">What it does</h2><p className="mt-4 max-w-[46ch] text-sm leading-7 text-neutral-500">Folders fold into a readable map. Select a file to see its dependencies, dependents, and blast radius.</p></div>
        <div><h2 className="text-lg font-medium">How it works</h2><p className="mt-4 max-w-[46ch] text-sm leading-7 text-neutral-500">A standalone parser resolves imports and records coverage before anything reaches the canvas.</p></div>
        <div><h2 className="text-lg font-medium">What it does not do</h2><p className="mt-4 max-w-[46ch] text-sm leading-7 text-neutral-500">It does not invent edges, score your code, or pretend an unresolved route is known.</p></div>
      </section>
      <footer className="border-t border-neutral-200 py-8 text-[10px] text-neutral-500 dark:border-neutral-800">Cartograph — structure you can verify.</footer>
    </main>
  );
}
