/**
 * run.ts — the full pipeline: fetch → parse → store.
 *
 * Each stage updates analyses.stage and analyses.message, which the pg_notify
 * trigger (migration 0004) forwards to any subscribed browser tabs in real time.
 *
 * The top-level catch writes a 'failed' status and the error text so the row
 * never stays stuck in a non-terminal state. The caller (the server action)
 * fires this and does not await — the pipeline is intentionally asynchronous.
 *
 * The service-role client is used throughout because:
 *   a) RLS would block writes that don't carry the user's JWT
 *   b) The JWT is unavailable in the background async context after the
 *      server action returns
 * org_id is threaded explicitly through every insert.
 */

import { createSupabaseServiceClient } from "../supabase-service";
import { fetchRepo, cleanup } from "./fetch-repo";
import { parseRepository } from "../parser/index";
import { storeResult } from "./store-result";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface RunOptions {
  analysisId: string;
  orgId: string;
  repoUrl: string;
}

type PipelineStage =
  | "fetching"
  | "extracting"
  | "parsing"
  | "storing"
  | "done"
  | "failed";

/**
 * Run the full pipeline for one analysis row.
 * This function is fire-and-forget from the server action — it does not
 * return a meaningful value. All state is written to the database.
 */
export async function runPipeline(options: RunOptions): Promise<void> {
  const { analysisId, orgId, repoUrl } = options;
  const supabase = createSupabaseServiceClient();

  // Mark running immediately so the dashboard doesn't show 'queued' forever.
  await setStage(supabase, analysisId, "fetching", "Downloading repository archive…");
  await supabase
    .from("analyses")
    .update({ status: "running", updated_at: new Date().toISOString() })
    .eq("id", analysisId);

  let tmpDir: string | undefined;

  try {
    // ── Stage 1: fetch ────────────────────────────────────────────────────────
    const fetched = await fetchRepo(repoUrl);
    tmpDir = fetched.tmpDir;

    // Record commit SHA as soon as we have it
    await supabase
      .from("analyses")
      .update({ commit_sha: fetched.commitSha, updated_at: new Date().toISOString() })
      .eq("id", analysisId);

    // ── Stage 2: parse ────────────────────────────────────────────────────────
    await setStage(supabase, analysisId, "parsing", "Parsing imports and building graph…");

    const result = await parseRepository({ rootDir: fetched.extractedPath });

    console.log(
      `[pipeline] parsed: ${result.files.length} files, ` +
      `${result.edges.length} edges, ` +
      `${result.coverage.failed} unresolved, ` +
      `${result.coverage.external} external`,
    );

    // ── Stage 3: store ────────────────────────────────────────────────────────
    await setStage(
      supabase,
      analysisId,
      "storing",
      `Storing ${result.files.length} files…`,
    );

    await storeResult({ supabase, analysisId, orgId, result });

    // ── Done ──────────────────────────────────────────────────────────────────
    await setStage(supabase, analysisId, "done", "Analysis complete.");
    await supabase
      .from("analyses")
      .update({ status: "done", updated_at: new Date().toISOString() })
      .eq("id", analysisId);
  } catch (err) {
    // Write the failure state before re-throwing so the row is never stuck.
    const message = err instanceof Error ? err.message : String(err);
    await setStage(supabase, analysisId, "failed", message).catch(() => {
      // If even the failure write fails, there's nothing left to do.
    });
    // Best-effort — if this also fails there's nothing left to do.
    await supabase
      .from("analyses")
      .update({
        status: "failed",
        error: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", analysisId)
      .then(undefined, () => undefined);
  } finally {
    // Always clean up the tmp directory regardless of outcome.
    if (tmpDir) cleanup(tmpDir);
  }
}

/** Write stage + message to analyses and trigger the pg_notify. */
async function setStage(
  supabase: SupabaseClient,
  analysisId: string,
  stage: PipelineStage,
  message: string,
): Promise<void> {
  await supabase
    .from("analyses")
    .update({ stage, message, updated_at: new Date().toISOString() })
    .eq("id", analysisId);
}
