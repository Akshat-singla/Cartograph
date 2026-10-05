"use server";

/**
 * start-analysis — server action that kicks off a pipeline run.
 *
 * Behaviour:
 *   1. Validate the URL is a recognisable GitHub repository URL.
 *   2. Upsert the project row (unique on org_id + repo_url).
 *   3. Check whether an analysis already exists for this project. If one
 *      does, return its id without creating a second row. Submitting the
 *      same URL twice lands you on the existing analysis.
 *   4. Insert a new analysis row with status 'queued'.
 *   5. Fire the pipeline in the background (no await).
 *   6. Return the analysis id so the caller can redirect to the progress page.
 *
 * The pipeline is fire-and-forget: the server action returns before parsing
 * finishes. Progress is written to the database and the browser subscribes
 * via realtime.
 */

import { auth } from "@clerk/nextjs/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { parseGitHubUrl } from "@/lib/pipeline/fetch-repo";
import { env } from "@/lib/env";

export type StartAnalysisResult =
  | { ok: true; analysisId: string; isNew: boolean }
  | { ok: false; error: string };

export async function startAnalysis(
  repoUrl: string,
): Promise<StartAnalysisResult> {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return { ok: false, error: "Not authenticated." };
  }

  // ── Validate URL ────────────────────────────────────────────────────────────
  let owner: string;
  let repo: string;
  try {
    ({ owner, repo } = parseGitHubUrl(repoUrl));
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Invalid repository URL.",
    };
  }

  // ── Upsert project ──────────────────────────────────────────────────────────
  // Use the server client (user JWT) for reads and writes that the user should
  // own. The unique constraint (org_id, repo_url) makes this safe to call
  // repeatedly.
  const userClient = createSupabaseServerClient();

  const { data: projectData, error: projectError } = await userClient
    .from("projects")
    .upsert(
      {
        org_id: orgId,
        repo_url: repoUrl.trim().replace(/\.git$/, "").replace(/\/$/, ""),
        name: `${owner}/${repo}`,
      },
      { onConflict: "org_id,repo_url" },
    )
    .select("id")
    .single();

  if (projectError || !projectData) {
    return {
      ok: false,
      error: `Could not create project: ${projectError?.message ?? "unknown error"}`,
    };
  }

  const projectId = projectData.id;

  // ── Check for existing analysis ─────────────────────────────────────────────
  // Only one analysis per project is the rule. Return the existing one if it
  // exists; the caller redirects to it rather than starting a duplicate.
  const { data: existing } = await userClient
    .from("analyses")
    .select("id, status")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    return { ok: true, analysisId: existing.id, isNew: false };
  }

  // ── Insert analysis row ─────────────────────────────────────────────────────
  // Use the service client for the insert because the user client carries the
  // JWT which sets org_id via RLS — but we need to supply org_id explicitly
  // for the composite FK constraint and the pipeline's service client writes.
  // We use the user client here though: the user IS authenticated and the
  // insert policy allows it. This keeps the audit trail consistent.
  const { data: analysisData, error: analysisError } = await userClient
    .from("analyses")
    .insert({
      org_id: orgId,
      project_id: projectId,
      status: "queued",
    })
    .select("id")
    .single();

  if (analysisError || !analysisData) {
    return {
      ok: false,
      error: `Could not create analysis: ${analysisError?.message ?? "unknown error"}`,
    };
  }

  const analysisId = analysisData.id;

  // ── Fire pipeline ───────────────────────────────────────────────────────────
  // Call the internal API route rather than running the pipeline inline.
  // Server actions are serverless functions — Next.js tears down the process
  // as soon as the response is sent, killing any background async work.
  // The API route awaits the full pipeline, keeping its request context alive.
  // We fire it without awaiting so the server action returns immediately.
  const pipelineUrl = new URL("/api/pipeline", env.appUrl);
  fetch(pipelineUrl.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-pipeline-secret": env.pipelineSecret,
    },
    body: JSON.stringify({ analysisId, orgId, repoUrl }),
  }).catch((err) => {
    console.error(`[pipeline] Failed to call pipeline route for ${analysisId}:`, err);
  });

  return { ok: true, analysisId, isNew: true };
}
