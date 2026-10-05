"use client";

// ProgressView — shows named pipeline stages and subscribes to live updates.
//
// Uses postgres_changes on the analyses table, filtered to this row's id.
// RLS is enforced per-row by Supabase realtime — the subscriber only receives
// events for rows their org's SELECT policy allows.
//
// Token timing: createSupabaseBrowserClientWithAuth awaits getToken() before
// creating the client so setAuth() fires with a real JWT, not null. Calling
// getToken() synchronously at client construction returns null before Clerk
// has hydrated, which silently breaks realtime authentication.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { createSupabaseBrowserClientWithAuth } from "@/lib/supabase-browser";
import type { AnalysisRow, PipelineStage } from "@/lib/types";

interface ProgressState {
  status: AnalysisRow["status"];
  stage: PipelineStage | null;
  message: string | null;
  error: string | null;
}

const STAGE_LABELS: Record<PipelineStage, string> = {
  fetching: "Downloading archive",
  extracting: "Extracting files",
  parsing: "Parsing imports",
  storing: "Writing to database",
  done: "Complete",
  failed: "Failed",
};

const STAGES: PipelineStage[] = ["fetching", "parsing", "storing", "done"];

function stageIndex(s: PipelineStage | null): number {
  if (!s) return -1;
  // extracting is a sub-step of fetching — show it in the same slot
  return STAGES.indexOf(s === "extracting" ? "fetching" : s);
}

interface Props {
  initial: AnalysisRow;
}

export function ProgressView({ initial }: Props) {
  const router = useRouter();
  const { getToken } = useAuth();

  const [progress, setProgress] = useState<ProgressState>({
    status: initial.status,
    stage: initial.stage,
    message: initial.message,
    error: initial.error,
  });

  const progressRef = useRef(progress);
  progressRef.current = progress;

  useEffect(() => {
    let cancelled = false;
    let removeChannel: (() => void) | undefined;

    async function subscribe() {
      // Await the Clerk token before constructing the client.
      // The synchronous path returns null during SSR/hydration, which causes
      // realtime to open an unauthenticated socket that RLS then rejects.
      const supabase = await createSupabaseBrowserClientWithAuth(
        async () => getToken(),
      );
      if (cancelled) return;

      const channel = supabase
        .channel(`analysis-progress-${initial.id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "analyses",
            filter: `id=eq.${initial.id}`,
          },
          (payload) => {
            const row = payload.new as Partial<AnalysisRow>;
            const next: ProgressState = {
              status: row.status ?? progressRef.current.status,
              stage: (row.stage ?? progressRef.current.stage) as PipelineStage | null,
              message: row.message ?? progressRef.current.message,
              error: row.error ?? progressRef.current.error,
            };
            setProgress(next);
            if (row.status === "done") {
              router.refresh();
            }
          },
        )
        .subscribe((status) => {
          console.log(`[realtime] ${initial.id} → ${status}`);
        });

      removeChannel = () => void supabase.removeChannel(channel);
    }

    void subscribe();

    return () => {
      cancelled = true;
      removeChannel?.();
    };
  }, [initial.id, getToken, router]);

  const currentIdx = stageIndex(progress.stage);
  const isFailed = progress.status === "failed";
  const projectName = initial.project?.name ?? initial.id.slice(0, 8);

  return (
    <div className="flex flex-1 items-center justify-center bg-neutral-950">
      <div className="w-[420px] space-y-6">

        <p className="font-mono text-xs text-neutral-500 truncate">
          {projectName}
        </p>

        <div className="space-y-1">
          {STAGES.map((s, i) => {
            const isPast = i < currentIdx;
            const isCurrent = i === currentIdx;

            let dotColor = "bg-neutral-800";
            let labelColor = "text-neutral-700";

            if (isFailed && isCurrent) {
              dotColor = "bg-red-500";
              labelColor = "text-red-400";
            } else if (isPast) {
              dotColor = "bg-green-500";
              labelColor = "text-neutral-400";
            } else if (isCurrent) {
              dotColor = "bg-blue-400 animate-pulse";
              labelColor = "text-neutral-200";
            }

            return (
              <div key={s} className="flex items-center gap-3">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
                <span className={`font-mono text-xs ${labelColor}`}>
                  {STAGE_LABELS[s]}
                </span>
              </div>
            );
          })}
        </div>

        {progress.message && (
          <p className="font-mono text-[10px] text-neutral-500 leading-relaxed">
            {progress.message}
          </p>
        )}

        {isFailed && progress.error && (
          <div className="border border-red-900 bg-red-950/30 rounded px-3 py-2">
            <p className="font-mono text-[10px] text-red-400 break-words">
              {progress.error}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
