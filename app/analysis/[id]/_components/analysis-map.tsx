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
import { RoutesTable } from "./routes-table";

interface Props {
  analysisId: string;
}

const PAGE_SIZE = 1000;

type PageError = { message: string } | null;

async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error: PageError }>,
): Promise<{ data: T[]; error: PageError }> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const page = await fetchPage(from, from + PAGE_SIZE - 1);
    if (page.error) return { data: rows, error: page.error };
    const batch = page.data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return { data: rows, error: null };
  }
}

// DB row shapes — only the columns we select.
interface DbFile {
  id: string;
  path: string;
  language: string | null;
  line_count: number | null;
  exports: string[] | null;
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
  total_imports: number | null;
  resolved_imports: number | null;
  external_imports: number | null;
  excluded_imports: number | null;
  failed_imports: number | null;
}

interface DbFileRole {
  file_id: string;
  role: string;
}

interface DbAnalysis {
  framework: string | null;
  project: { repo_url: string | null } | null;
}

/**
 * Extracts "owner/repo" from a GitHub URL.
 * Strips a trailing .git suffix before splitting.
 * Returns "unknown" when the URL is absent or malformed.
 */
function repoNameFromUrl(url: string | null | undefined): string {
  if (!url) return "unknown";
  // https://github.com/owner/repo → owner/repo
  const parts = url.replace(/\.git$/, "").split("/");
  if (parts.length >= 2) return parts.slice(-2).join("/");
  return "unknown";
}

export async function AnalysisMap({ analysisId }: Props) {
  const supabase = createSupabaseServerClient();

  // Load files, edges, insights, framework, and file roles in parallel.
  const [filesRes, edgesRes, insightsRes, analysisRes, fileRolesRes] = await Promise.all([
    fetchAllPages(async (from, to) => {
      const { data, error } = await supabase
        .from("files")
        .select("id, path, language, line_count, exports")
        .eq("analysis_id", analysisId)
        .order("path")
        .range(from, to);
      return { data, error };
    }),

    fetchAllPages(async (from, to) => {
      const { data, error } = await supabase
        .from("edges")
        .select("kind, source_id, target_id")
        .eq("analysis_id", analysisId)
        .range(from, to);
      return { data, error };
    }),

    supabase
      .from("insights")
      .select("total_files, parsed_files, skipped_files, skip_reasons, total_imports, resolved_imports, external_imports, excluded_imports, failed_imports")
      .eq("analysis_id", analysisId)
      .single(),

    supabase
      .from("analyses")
      .select("framework, project:projects ( repo_url )")
      .eq("id", analysisId)
      .single(),

    fetchAllPages(async (from, to) => {
      const { data, error } = await supabase
        .from("file_roles")
        .select("file_id, role")
        .eq("analysis_id", analysisId)
        .range(from, to);
      return { data, error };
    }),
  ]);

  if (filesRes.error || edgesRes.error || fileRolesRes.error) notFound();

  const dbFiles = (filesRes.data ?? []) as DbFile[];
  const dbEdges = (edgesRes.data ?? []) as unknown as DbEdge[];
  const insights = insightsRes.data as DbInsights | null;
  const dbAnalysis = analysisRes.data as DbAnalysis | null;
  const dbFileRoles = (fileRolesRes.data ?? []) as DbFileRole[];

  // Build FileNode[] — path and folder are relative (module paths).
  const files: FileNode[] = dbFiles.map((f) => {
    const lastSlash = f.path.lastIndexOf("/");
    const folder = lastSlash > 0 ? f.path.slice(0, lastSlash) : ".";
    return {
      path: f.path,
      folder,
      lines: f.line_count ?? 0,
      hash: "",   // not stored — not needed by the graph
      module: f.path,
      exports: f.exports ?? [],
    };
  });

  // Build a id → path index for resolving edge endpoints.
  const idToPath = new Map(dbFiles.map((f) => [f.id, f.path]));

  // Build the fileRoles map: file path → role string.
  // file_roles rows reference file_id; join through idToPath.
  const fileRoles: Record<string, string> = {};
  for (const r of dbFileRoles) {
    const filePath = idToPath.get(r.file_id);
    if (filePath) fileRoles[filePath] = r.role;
  }

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
  const totalImports = insights?.total_imports ?? edges.length;
  const resolved = insights?.resolved_imports ?? edges.length;

  const framework = dbAnalysis?.framework ?? "generic";
  const repoName = repoNameFromUrl(dbAnalysis?.project?.repo_url);

  const analysis: SerializedParseResult = {
    files,
    edges,
    coverage: {
      totalImports,
      resolved,
      external: insights?.external_imports ?? 0,
      excluded: insights?.excluded_imports ?? 0,
      failed: insights?.failed_imports ?? 0,
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
    repoName,
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

            {/* Graph canvas + routes panel */}
            <main className="flex-1 overflow-hidden bg-neutral-950 flex flex-col">
              <div className="flex-1 overflow-hidden">
                <GraphCanvas
                  analysis={analysis}
                  framework={framework}
                  fileRoles={fileRoles}
                />
              </div>
              {/* Routes panel — collapsible, always present, zero JS */}
              <RoutesTable analysisId={analysisId} />
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
function dbKindToParser(kind: string): "import" | "re-export" | "dynamic-import" | "require" {
  switch (kind) {
    case "reexport": return "re-export";
    case "dynamic": return "dynamic-import";
    case "require": return "require";
    default: return "import";
  }
}
