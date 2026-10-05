// Shared row types derived from the schema.
// These mirror the database columns we actually select — not a full ORM type,
// just what the app needs. Add columns as phases require them.

export type AnalysisStatus = "queued" | "running" | "done" | "failed";

// Pipeline stage values written by run.ts and forwarded via realtime.
export type PipelineStage =
  | "fetching"
  | "extracting"
  | "parsing"
  | "storing"
  | "done"
  | "failed";

export interface AnalysisRow {
  id: string;
  status: AnalysisStatus;
  stage: PipelineStage | null;
  message: string | null;
  commit_sha: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
  // joined from projects
  project: {
    name: string;
    repo_url: string;
  } | null;
}
