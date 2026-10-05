"use client";

// RepoForm — paste a GitHub URL and submit.
// Calls the startAnalysis server action, then redirects:
//   - new analysis  → /analysis/<id>   (progress page)
//   - existing one  → /analysis/<id>   (same page; already done or in progress)
//   - error         → shows inline message, stays on form
//
// Dense tool style: single-line input + button, no decoration.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startAnalysis } from "@/app/actions/start-analysis";

export function RepoForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;

    setError(null);
    startTransition(async () => {
      const result = await startAnalysis(trimmed);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/analysis/${result.analysisId}`);
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2 px-4 py-3 border-b border-neutral-800 shrink-0"
    >
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://github.com/owner/repo"
        disabled={isPending}
        className="
          flex-1 bg-neutral-900 border border-neutral-700 rounded
          px-2.5 py-1.5 font-mono text-xs text-neutral-100
          placeholder:text-neutral-600
          focus:outline-none focus:border-neutral-500
          disabled:opacity-50
        "
      />
      <button
        type="submit"
        disabled={isPending || !url.trim()}
        className="
          bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40
          border border-neutral-700 rounded
          px-3 py-1.5 font-mono text-xs text-neutral-300
          transition-colors
        "
      >
        {isPending ? "…" : "Analyse"}
      </button>
      {error && (
        <span className="font-mono text-[10px] text-red-400 ml-1 max-w-[260px] truncate">
          {error}
        </span>
      )}
    </form>
  );
}
