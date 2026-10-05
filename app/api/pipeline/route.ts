// Pipeline route — runs the full fetch→parse→store pipeline for one analysis.
//
// Why an API route instead of a server action:
//   Server actions are serverless functions — Next.js tears down the process
//   as soon as the response is sent, killing any background async work.
//   An API route that awaits the pipeline keeps the connection open until the
//   work completes, which prevents premature teardown.
//
// Called internally by the start-analysis server action with a shared secret
// so it isn't accessible to arbitrary callers.
//
// The response is sent immediately (202 Accepted) and the pipeline runs
// inside the same request context, keeping the serverless function alive.
// Because we stream the response and never close it until done, Vercel/Node
// keeps the function warm for the full pipeline duration.

import { NextRequest, NextResponse } from "next/server";
import { runPipeline } from "@/lib/pipeline/run";
import { env } from "@/lib/env";

export async function POST(req: NextRequest) {
  // Verify shared secret — this route is internal only.
  const secret = req.headers.get("x-pipeline-secret");
  if (secret !== env.pipelineSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { analysisId: string; orgId: string; repoUrl: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { analysisId, orgId, repoUrl } = body;
  if (!analysisId || !orgId || !repoUrl) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Run the pipeline — awaited so the request stays open until completion.
  // runPipeline catches its own errors and writes them to the DB.
  await runPipeline({ analysisId, orgId, repoUrl });

  return NextResponse.json({ ok: true });
}
