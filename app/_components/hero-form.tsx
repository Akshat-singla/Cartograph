"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const PENDING_REPO_KEY = "cartograph-pending-repo";

export function HeroForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = url.trim();
    if (!value) return;
    localStorage.setItem(PENDING_REPO_KEY, value);
    router.push("/sign-in");
  }

  return (
    <form onSubmit={submit} className="flex w-full max-w-xl gap-2">
      <input
        type="url"
        required
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        placeholder="https://github.com/owner/repository"
        className="min-w-0 flex-1 rounded border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-900 outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
      />
      <button className="rounded bg-blue-600 px-4 py-2 text-xs text-white hover:bg-blue-500">
        Map repository
      </button>
    </form>
  );
}
