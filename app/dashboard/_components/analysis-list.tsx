// Analysis list — renders a table of analyses or an empty state.
// Dense developer-tool layout: small mono type, tight rows, colour only for
// status. No motion, no decoration.

import type { AnalysisRow, AnalysisStatus } from "@/lib/types";

interface Props {
  analyses: AnalysisRow[];
}

// Status gets a colour dot + label. Dot size is 6px — visible but not loud.
const STATUS_CONFIG: Record<
  AnalysisStatus,
  { dot: string; label: string }
> = {
  queued: { dot: "bg-neutral-500", label: "queued" },
  running: { dot: "bg-blue-400", label: "running" },
  done: { dot: "bg-green-400", label: "done" },
  failed: { dot: "bg-red-400", label: "failed" },
};

function StatusBadge({ status }: { status: AnalysisStatus }) {
  const { dot, label } = STATUS_CONFIG[status];
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
        {/* Minimal grid icon — three rows suggesting an empty table */}
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
          Run an analysis to map a repository.
        </p>
      </div>
    </div>
  );
}

export function AnalysisList({ analyses }: Props) {
  if (analyses.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Section header */}
      <div className="px-4 py-3 border-b border-neutral-800 flex items-center justify-between shrink-0">
        <span className="font-mono text-xs text-neutral-500 uppercase tracking-widest">
          Analyses
        </span>
        <span className="font-mono text-xs text-neutral-600">
          {analyses.length} {analyses.length === 1 ? "run" : "runs"}
        </span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-xs font-mono border-collapse">
          <thead className="sticky top-0 bg-neutral-950 z-10">
            <tr className="text-neutral-600 border-b border-neutral-800">
              <th className="text-left px-4 py-2 font-normal w-[40%]">repository</th>
              <th className="text-left px-4 py-2 font-normal w-[15%]">status</th>
              <th className="text-left px-4 py-2 font-normal w-[15%]">commit</th>
              <th className="text-left px-4 py-2 font-normal w-[30%]">started</th>
            </tr>
          </thead>
          <tbody>
            {analyses.map((a) => (
              <tr
                key={a.id}
                className="border-b border-neutral-900 hover:bg-neutral-900/60"
              >
                <td className="px-4 py-2.5">
                  {a.project ? (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-neutral-100">{a.project.name}</span>
                      <span className="text-neutral-600 text-[10px] truncate max-w-[280px]">
                        {a.project.repo_url.replace("https://github.com/", "")}
                      </span>
                    </div>
                  ) : (
                    <span className="text-neutral-600">—</span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <StatusBadge status={a.status} />
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
    </div>
  );
}
