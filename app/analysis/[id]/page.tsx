// Analysis page — shows progress while the pipeline runs, then the map.
//
// Server component: loads the initial analysis row so the page renders with
// the last-known state on first load (no spinner flash).
//
// If the analysis is already done, we render the map immediately.
// If it is running/queued, we render the ProgressView client component which
// subscribes to postgres_changes on the analyses table for this row.
// If it failed, we show the error.
// If the id doesn't exist or belongs to another org, 404.

import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { AnalysisRow } from "@/lib/types";
import { ProgressView } from "./_components/progress-view";
import { AnalysisMap } from "./_components/analysis-map";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AnalysisPage({ params }: Props) {
  const { id } = await params;

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("analyses")
    .select(
      `id, status, stage, message, commit_sha, error, created_at, updated_at,
       project:projects ( name, repo_url )`,
    )
    .eq("id", id)
    .single();

  // maybeSingle would return null; single errors on 0 rows — both mean 404.
  if (error || !data) notFound();

  const row = data as unknown as AnalysisRow;

  if (row.status === "done") {
    return <AnalysisMap analysisId={id} />;
  }

  // queued / running / failed — all go through ProgressView.
  // ProgressView subscribes to realtime and redirects to this same page
  // when status flips to done (which re-renders the map branch above).
  return <ProgressView initial={row} />;
}
