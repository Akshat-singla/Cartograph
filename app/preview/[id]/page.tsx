// Preview canvas page.
// Loads analysis.json from the project fixtures and renders the graph.
// The `id` param is accepted but ignored in this phase — there is only one
// fixture file. Later phases will fetch real analysis data from the database.
//
// analysis.json stores metrics.fanIn/fanOut as plain objects (JSON cannot
// serialise Maps). SerializedParseResult matches that shape exactly, so no
// cast is needed.

import type { SerializedParseResult } from "./_components/selection-context";
import { GraphCanvas } from "./_components/graph-canvas";
import analysisData from "@/app/preview/analysis.json";

const analysis = analysisData as unknown as SerializedParseResult;

export default function PreviewPage() {
  return (
    <div className="w-full h-full">
      <GraphCanvas analysis={analysis} />
    </div>
  );
}
