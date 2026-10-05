// AnalysisMap — server component that loads real file/edge data from the DB
// and renders the graph canvas with a coverage banner.
//
// Reconstructs the SerializedParseResult shape the canvas expects from the
// files and edges tables. The parser wrote:
//   files.path   = f.module  (relative, forward-slash)
//   files.language, files.line_count
//   edges.source_id, edges.target_id, edges.kind
//
// We join edges to files to get source/target paths, then build the
// fan-in/fan-out maps as plain objects (the serialised form).

import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { SerializedParseResult } from "@/app/preview/[id]/_components/selection-context";
import type { FileNode } from "@/lib/parser/types";
import { GraphCanvas } from "@/app/preview/[id]/_components/graph-canvas";
import { CategoriesProvider } from "@/app/preview/[id]/_components/categories-context";
import { SelectionProvider } from "@/app/preview/[id]/_components/selection-context";
import { LeftRail } from "@/app/preview/[id]/_components/left-rail";
import { RightPane } from "@/app/preview/[id]/_components/right-pane";
import { CoverageBanner } from "./coverage-banner";

interface Props {
  analysisId: string;
}

// DB row shapes — only the columns we select.
interface DbFile {
  id: string;
  path: string;
  language: string | null;
  line_count: number | null;
}

interface DbEdge {
  kind: string;
  source_id: string;
  target_id: string;
}

interface DbInsights {
  total_files: number;
  parsed_files: number;
  skipped_files: number;
  skip_reasons: Record<string, number>;
}

export async function AnalysisMap({ analysisId }: Props) {
  const supabase = createSupabaseServerClient();

  // Load files, edges, and insights in parallel.
  const [filesRes, edgesRes, insightsRes] = await Promise.all([
    supabase
      .from("files")
      .select("id, path, language, line_count")
      .eq("analysis_id", analysisId)
      .order("path"),

    supabase
      .from("edges")
      .select("kind, source_id, target_id")
      .eq("analysis_id", analysisId),

    supabase
      .from("insights")
      .select("total_files, parsed_files, skipped_files, skip_reasons")
      .eq("analysis_id", analysisId)
      .single(),
  ]);

  if (filesRes.error) notFound();

  const dbFiles = (filesRes.data ?? []) as DbFile[];
  const dbEdges = (edgesRes.data ?? []) as unknown as DbEdge[];
  const insights = insightsRes.data as DbInsights | null;

  // Build FileNode[] — path and folder are relative (module paths).
  // The parser stored them as forward-slash relative paths (e.g. "src/index.ts").
  // folder = dirname of that relative path.
  const files: FileNode[] = dbFiles.map((f) => {
    const lastSlash = f.path.lastIndexOf("/");
    const folder = lastSlash > 0 ? f.path.slice(0, lastSlash) : ".";
    return {
      path: f.path,
      folder,
      lines: f.line_count ?? 0,
      hash: "",   // not stored — not needed by the graph
      module: f.path,
    };
  });

  // Build a id → path index for resolving edge endpoints.
  const idToPath = new Map(dbFiles.map((f) => [f.id, f.path]));

  // Build edge list — only edges with both ends resolved to known files.
  const edges = dbEdges
    .filter((e) => idToPath.has(e.source_id) && idToPath.has(e.target_id))
    .map((e) => ({
      from: idToPath.get(e.source_id)!,
      to: idToPath.get(e.target_id)!,
      kind: dbKindToParser(e.kind),
    }));

  // Build fan-in / fan-out as plain Record<string, number>.
  const fanIn: Record<string, number> = {};
  const fanOut: Record<string, number> = {};
  for (const e of edges) {
    fanIn[e.to] = (fanIn[e.to] ?? 0) + 1;
    fanOut[e.from] = (fanOut[e.from] ?? 0) + 1;
  }

  // Coverage: use insights row if present, otherwise derive from what we have.
  const totalImports = edges.length + (insights?.skipped_files ?? 0);
  const resolved = edges.length;

  const analysis: SerializedParseResult = {
    files,
    edges,
    coverage: {
      totalImports,
      resolved,
      external: 0,   // not stored separately — external edges were dropped at store time
      excluded: 0,
      failed: insights?.skipped_files ?? 0,
    },
    unresolved: [],
    skipped: insights
      ? Object.entries(insights.skip_reasons).flatMap(([reason, count]) =>
        Array.from({ length: count }, (_, i) => ({
          path: `skipped-${i}`,
          reason,
        })),
      )
      : [],
    metrics: {
      folderCount: new Set(files.map((f) => f.folder)).size,
      fanIn,
      fanOut,
    },
  };

  // Coverage percentage: resolved / (resolved + skipped) — external is not a failure.
  const parsedFiles = insights?.parsed_files ?? files.length;
  const totalFiles = insights?.total_files ?? files.length;
  const coveragePct = totalFiles > 0 ? Math.round((parsedFiles / totalFiles) * 100) : 100;
  const isPartial = coveragePct < 95;

  return (
    <SelectionProvider>
      <CategoriesProvider>
        <div className="flex flex-col flex-1 overflow-hidden h-[calc(100vh-37px)]">
          {/* Coverage banner — always shown, collapses to one line when ok */}
          <CoverageBanner pct={coveragePct} isPartial={isPartial} />

          <div className="flex flex-1 overflow-hidden">
            {/* Left rail */}
            <aside className="w-[200px] shrink-0 border-r border-neutral-800 bg-neutral-950 flex flex-col overflow-y-auto">
              <LeftRail />
            </aside>

            {/* Graph canvas */}
            <main className="flex-1 overflow-hidden bg-neutral-950">
              <GraphCanvas analysis={analysis} />
            </main>

            {/* Right pane */}
            <aside className="w-[280px] shrink-0 border-l border-neutral-800 bg-neutral-950 flex flex-col overflow-y-auto">
              <RightPane />
            </aside>
          </div>
        </div>
      </CategoriesProvider>
    </SelectionProvider>
  );
}

// Map DB kind values back to the parser edge kind type the canvas expects.
function dbKindToParser(kind: string): "import" | "re-export" | "dynamic-import" {
  switch (kind) {
    case "reexport": return "re-export";
    case "dynamic": return "dynamic-import";
    default: return "import";
  }
}
