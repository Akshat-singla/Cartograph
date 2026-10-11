// Dashboard — lists every analysis belonging to the current organization.
// There is no org_id filter in this query. If a row appears here that belongs
// to a different org, the RLS policy is wrong, not this file.

import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { AnalysisRow } from "@/lib/types";
import { AnalysisList } from "./_components/analysis-list";

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("analyses")
    .select(
      `id, status, stage, message, commit_sha, error, created_at, updated_at,
       project:projects ( name, repo_url )`,
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    // Surface the error clearly rather than silently showing an empty list.
    return (
      <div className="flex flex-1 items-center justify-center font-mono text-xs text-red-400">
        Failed to load analyses: {error.message}
      </div>
    );
  }

  const analyses = (data ?? []) as unknown as AnalysisRow[];

  return <AnalysisList analyses={analyses} />;
}
