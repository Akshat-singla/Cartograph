/**
 * store-result.ts — write a ParseResult into the database.
 *
 * This runs after the parser and writes to files, edges, and insights.
 * Uses the service-role client so the pipeline can write on behalf of the
 * user without needing their JWT in scope at this point in the call chain.
 * org_id is threaded through explicitly on every row — the composite FKs
 * in migration 0003 enforce that child rows can't cross tenant boundaries.
 *
 * Writes are batched to avoid hitting Supabase's per-request row limits.
 * Edges reference file rows by UUID, so files must be inserted first.
 */

import type { ParseResult, FileNode, Edge } from "../parser/types";
import type { SupabaseClient } from "@supabase/supabase-js";

const BATCH_SIZE = 500;

export interface StoreOptions {
  supabase: SupabaseClient;
  analysisId: string;
  orgId: string;
  result: ParseResult;
}

export interface StoreResult {
  fileCount: number;
  edgeCount: number;
}

/**
 * Persist a ParseResult for a given analysis.
 * Inserts files first, builds a path→uuid index, then inserts edges.
 * Finally inserts the insights row with coverage stats.
 *
 * Throws on any DB error — the caller (run.ts) catches and marks failed.
 */
export async function storeResult(options: StoreOptions): Promise<StoreResult> {
  const { supabase, analysisId, orgId, result } = options;

  // ── 1. Insert files ─────────────────────────────────────────────────────────
  // Map from absolute path → DB uuid so we can look up source/target ids for
  // edges. Edges from the parser use absolute paths in e.from / e.to.
  // We also need module-path → uuid for cases where the absolute path isn't
  // available, but primary key is absolute path to avoid any round-trip mismatch.
  const absPathToId = new Map<string, string>();  // absolute path → uuid
  const moduleToId = new Map<string, string>();  // relative module path → uuid

  const fileRows = result.files.map((f: FileNode) => ({
    org_id: orgId,
    analysis_id: analysisId,
    path: f.module, // store the relative module path
    language: languageFromPath(f.path),
    line_count: f.lines,
    // stash the absolute path alongside so we can build absPathToId below
    _absPath: f.path,
  }));

  // Insert in batches and collect the returned ids.
  // We correlate returned rows back to absolute paths via the module path index.
  const moduleToAbsPath = new Map(result.files.map((f) => [f.module, f.path]));

  for (let i = 0; i < fileRows.length; i += BATCH_SIZE) {
    const batch = fileRows.slice(i, i + BATCH_SIZE).map(({ _absPath: _, ...row }) => row);
    const { data, error } = await supabase
      .from("files")
      .insert(batch)
      .select("id, path");
    if (error) throw new Error(`Failed to insert files batch: ${error.message}`);
    for (const row of data ?? []) {
      moduleToId.set(row.path, row.id);
      const abs = moduleToAbsPath.get(row.path);
      if (abs) absPathToId.set(abs, row.id);
    }
  }

  // ── 2. Insert edges ──────────────────────────────────────────────────────────
  // Only edges where both ends resolved to files we stored (i.e., internal
  // edges). External-package edges have no target file row.
  const edgeRows: Array<{
    org_id: string;
    analysis_id: string;
    source_id: string;
    target_id: string;
    kind: string;
  }> = [];

  for (const e of result.edges as Edge[]) {
    // e.from and e.to are absolute paths from the parser.
    // Look up by absolute path first (direct match), fall back to module path.
    const sourceId = absPathToId.get(e.from) ?? moduleToId.get(e.from);
    const targetId = absPathToId.get(e.to) ?? moduleToId.get(e.to);

    if (!sourceId || !targetId) continue;

    edgeRows.push({
      org_id: orgId,
      analysis_id: analysisId,
      source_id: sourceId,
      target_id: targetId,
      kind: edgeKind(e.kind),
    });
  }

  console.log(
    `[store] edges: ${result.edges.length} total → ${edgeRows.length} stored` +
    ` (${result.edges.length - edgeRows.length} dropped — target not in files table)`,
  );

  for (let i = 0; i < edgeRows.length; i += BATCH_SIZE) {
    const batch = edgeRows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("edges").insert(batch);
    if (error) throw new Error(`Failed to insert edges batch: ${error.message}`);
  }

  // ── 3. Insert insights ───────────────────────────────────────────────────────
  // Aggregate skip reasons into a { reason: count } map for the jsonb column.
  const skipReasons: Record<string, number> = {};
  for (const s of result.skipped) {
    skipReasons[s.reason] = (skipReasons[s.reason] ?? 0) + 1;
  }

  const { error: insightError } = await supabase.from("insights").insert({
    org_id: orgId,
    analysis_id: analysisId,
    // total_files counts only the files the walker considered as source files
    // (parsed + skipped-due-to-test/excluded-dir). Non-source files like images,
    // markdown, and JSON are in skipped[] with "Unsupported extension" reasons —
    // they were never intended parse targets and must not dilute the coverage pct.
    total_files: result.files.length + sourceSkippedCount(result.skipped),
    parsed_files: result.files.length,
    skipped_files: sourceSkippedCount(result.skipped),
    skip_reasons: skipReasons,
  });

  if (insightError) {
    throw new Error(`Failed to insert insights: ${insightError.message}`);
  }

  return { fileCount: result.files.length, edgeCount: edgeRows.length };
}

/**
 * Count only the skipped entries that were real source-file candidates —
 * test files, excluded directories, and files we couldn't read.
 * "Unsupported extension" skips (images, markdown, JSON, etc.) are not
 * source files and must not count against coverage.
 */
function sourceSkippedCount(
  skipped: Array<{ path: string; reason: string }>,
): number {
  return skipped.filter((s) => !s.reason.startsWith("Unsupported extension")).length;
}

/**
 * Map parser edge kind to the DB check constraint values.
 * Parser uses 'import' | 're-export' | 'dynamic-import'; DB uses
 * 'import' | 'reexport' | 'dynamic' | 'require'.
 */
function edgeKind(kind: Edge["kind"]): string {
  switch (kind) {
    case "re-export":
      return "reexport";
    case "dynamic-import":
      return "dynamic";
    default:
      return "import";
  }
}

/**
 * Infer a language label from a file extension.
 * Kept simple — this is display data, not logic.
 */
function languageFromPath(filePath: string): string {
  if (filePath.endsWith(".tsx")) return "tsx";
  if (filePath.endsWith(".ts")) return "ts";
  if (filePath.endsWith(".jsx")) return "jsx";
  if (filePath.endsWith(".js")) return "js";
  if (filePath.endsWith(".mts") || filePath.endsWith(".cts")) return "ts";
  return "unknown";
}
