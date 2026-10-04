// Preview canvas page.
// Loads analysis.json from the project fixtures and renders the graph.
// The `id` param is accepted but ignored in this phase — there is only one
// fixture file. Later phases will fetch real analysis data from the database.

import type { ParseResult } from "@/lib/parser/types";
import { GraphCanvas } from "./_components/graph-canvas";
import analysisData from "@/app/preview/analysis.json";

// analysis.json stores metrics.fanIn/fanOut as plain objects (JSON serialised
// from Maps). Cast it to the shape the canvas expects.
const analysis = analysisData as unknown as ParseResult & {
  metrics: { fanIn: Record<string, number>; fanOut: Record<string, number> };
};

export default function PreviewPage() {
  return (
    <div className="w-full h-full">
      <GraphCanvas analysis={analysis} />
    </div>
  );
}
