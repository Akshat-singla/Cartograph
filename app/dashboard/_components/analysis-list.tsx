// Analysis list — renders the repo form and a table of analyses.
// Dense developer-tool layout: small mono type, tight rows, colour only for
// status. No motion, no decoration.
//
// Stale detection: any analysis in status queued or running that was created
// more than 3 minutes ago is shown with a "stale" indicator. The pipeline
// has no queue or timeout, so a process that died mid-run leaves the row
// stuck. The dashboard makes that visible rather than hiding it.

import Link from "next/link";
import type { AnalysisRow, AnalysisStatus } from "@/lib/types";
import { RepoForm } from "./repo-form";

interface Props {
  analyses: AnalysisRow[];
}

const STATUS_CONFIG: Record<
  AnalysisStatus,
  { dot: string; label: string }
> = {
  queued: { dot: "bg-neutral-500", label: "queued" },
  running: { dot: "bg-blue-400", label: "running" },
  done: { dot: "bg-green-400", label: "done" },
  failed: { dot: "bg-red-400", label: "failed" },
};

// 3 minutes — anything running longer without finishing is stale.
const STALE_MS = 3 * 60 * 1000;

function isStale(row: AnalysisRow): boolean {
  if (row.status !== "queued" && row.status !== "running") return false;
  return Date.now() - new Date(row.updated_at).getTime() > STALE_MS;
}

function StatusBadge({ row }: { row: AnalysisRow }) {
  const stale = isStale(row);
  if (stale) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0 bg-amber-500" />
        <span className="text-amber-500">stale</span>
      </span>
    );
  }
  const { dot, label } = STATUS_CONFIG[row.status];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
      <span className="text-neutral-300">{label}</span>
    </span>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toISOString().slice(0, 16).replace("T", " ");
}

function EmptyState() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-center space-y-2">
        <svg
          width="32"
          height="32"
          viewBox="0 0 32 32"
          fill="none"
          className="mx-auto text-neutral-700"
        >
          <rect x="4" y="4" width="24" height="4" rx="1" fill="currentColor" opacity="0.6" />
          <rect x="4" y="12" width="24" height="4" rx="1" fill="currentColor" opacity="0.3" />
          <rect x="4" y="20" width="24" height="4" rx="1" fill="currentColor" opacity="0.15" />
        </svg>
        <p className="font-mono text-xs text-neutral-500">No analyses yet</p>
        <p className="font-mono text-xs text-neutral-700">
          Paste a repository URL above to start.
        </p>
      </div>
    </div>
  );
}

export function AnalysisList({ analyses }: Props) {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* URL form — always visible at the top */}
      <RepoForm />

      {/* Section header */}
      <div className="px-4 py-3 border-b border-neutral-800 flex items-center justify-between shrink-0">
        <span className="font-mono text-xs text-neutral-500 uppercase tracking-widest">
          Analyses
        </span>
        <span className="font-mono text-xs text-neutral-600">
          {analyses.length} {analyses.length === 1 ? "run" : "runs"}
        </span>
      </div>

      {analyses.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-xs font-mono border-collapse">
            <thead className="sticky top-0 bg-neutral-950 z-10">
              <tr className="text-neutral-600 border-b border-neutral-800">
                <th className="text-left px-4 py-2 font-normal w-[38%]">repository</th>
                <th className="text-left px-4 py-2 font-normal w-[15%]">status</th>
                <th className="text-left px-4 py-2 font-normal w-[17%]">stage</th>
                <th className="text-left px-4 py-2 font-normal w-[13%]">commit</th>
                <th className="text-left px-4 py-2 font-normal w-[17%]">started</th>
              </tr>
            </thead>
            <tbody>
              {analyses.map((a) => (
                <tr
                  key={a.id}
                  className="border-b border-neutral-900 hover:bg-neutral-900/60"
                >
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/analysis/${a.id}`}
                      className="block hover:text-neutral-100"
                    >
                      {a.project ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-neutral-100">{a.project.name}</span>
                          <span className="text-neutral-600 text-[10px] truncate max-w-[260px]">
                            {a.project.repo_url.replace("https://github.com/", "")}
                          </span>
                        </div>
                      ) : (
                        <span className="text-neutral-600">—</span>
                      )}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge row={a} />
                  </td>
                  <td className="px-4 py-2.5 text-neutral-500">
                    {a.stage ?? <span className="text-neutral-700">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-neutral-500 tabular-nums">
                    {a.commit_sha ? (
                      <span className="bg-neutral-800 px-1.5 py-0.5 rounded text-neutral-400">
                        {a.commit_sha.slice(0, 7)}
                      </span>
                    ) : (
                      <span className="text-neutral-700">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-neutral-600 tabular-nums">
                    {formatDate(a.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
