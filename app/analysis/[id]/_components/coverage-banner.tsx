// CoverageBanner — always visible when on the map.
// When the graph is complete (>= 95% parsed), collapses to a single line.
// When partial, expands with a note. The figure is always shown — a graph
// that is quietly 30% complete must never be able to look complete.

interface Props {
  pct: number;
  isPartial: boolean;
}

export function CoverageBanner({ pct, isPartial }: Props) {
  if (!isPartial) {
    // Minimal one-line banner — graph is essentially complete.
    return (
      <div className="shrink-0 border-b border-neutral-800 px-4 py-1.5 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
        <span className="font-mono text-[10px] text-neutral-600">
          {pct}% of files parsed
        </span>
      </div>
    );
  }

  // Partial graph — more prominent, named clearly.
  return (
    <div className="shrink-0 border-b border-amber-900/50 bg-amber-950/20 px-4 py-2 flex items-start gap-2">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-0.5" />
      <div className="space-y-0.5">
        <span className="font-mono text-[10px] text-amber-400 font-medium">
          Partial graph — {pct}% of files parsed
        </span>
        <p className="font-mono text-[10px] text-amber-600 leading-relaxed">
          Some files were skipped. The map shows only resolved imports.
          Edges to skipped files are absent, not approximate.
        </p>
      </div>
    </div>
  );
}
