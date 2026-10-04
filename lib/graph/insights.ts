/**
 * Insight detection — pure functions over the edge list and file list.
 * No model, no network, no Next/React/database imports.
 *
 * Four kinds of insight:
 *   1. filesNothingImports — fanIn === 0, excluding framework-owned files
 *   2. importCycles        — iterative Tarjan SCC (no call-stack risk)
 *   3. highlyImported      — files imported more than 2× the mean fanIn
 *   4. longFiles           — files over LINE_THRESHOLD lines
 *
 * Order follows the spec: filesNothingImports leads, cycles and longFiles
 * sit underneath because they read closer to a verdict.
 *
 * A file nothing imports is NOT automatically an orphan. Pages, routes,
 * layouts, middleware and config are reached by the framework. Reporting
 * them would describe the limit of the parser's view, not a finding.
 */

import type { FileNode } from "../parser/types";

export interface InsightEdge {
  from: string;
  to: string;
}

// A file is longer than this is "too long".
const LINE_THRESHOLD = 500;

// ---------------------------------------------------------------------------
// Framework-owned file exclusions
// Any file matching one of these patterns is NOT reported as "nothing imports".

function isFrameworkOwned(path: string): boolean {
  const p = path.replace(/\\/g, "/");

  return (
    // Next.js app-router pages and layouts
    /\/(app)(\/.*)?\/page\.(tsx?|jsx?)$/.test(p) ||
    /\/(app)(\/.*)?\/layout\.(tsx?|jsx?)$/.test(p) ||
    /\/(app)(\/.*)?\/loading\.(tsx?|jsx?)$/.test(p) ||
    /\/(app)(\/.*)?\/error\.(tsx?|jsx?)$/.test(p) ||
    /\/(app)(\/.*)?\/not-found\.(tsx?|jsx?)$/.test(p) ||
    /\/(app)(\/.*)?\/template\.(tsx?|jsx?)$/.test(p) ||
    // Next.js app-router API routes
    /\/(app)(\/.*)?\/route\.(tsx?|jsx?)$/.test(p) ||
    // Next.js pages router
    /\/pages\/(?!_app|_document|_error)[^/]+\.(tsx?|jsx?)$/.test(p) ||
    // Remix / SvelteKit routes
    /\/routes\//.test(p) ||
    // Middleware (Next.js, Express, etc.)
    /\/middleware\.(tsx?|jsx?|mts?)$/.test(p) ||
    /\/middleware\/index\.(tsx?|jsx?|mts?)$/.test(p) ||
    // Config files (top-level by convention)
    /\/(next|vite|vitest|webpack|babel|jest|rollup|esbuild|postcss|tailwind)\.config\.(tsx?|jsx?|mts?|cts?|js)$/.test(p) ||
    /\/tsconfig(\..*)?\.json$/.test(p) ||
    /\/eslint\.config\.(tsx?|jsx?|mts?|cts?|js)$/.test(p) ||
    /(^|\/)\.eslintrc(\.(js|cjs|json|yml|yaml))?$/.test(p) ||
    /(^|\/)\.babelrc(\.(js|cjs|json))?$/.test(p) ||
    /\/jest\.setup\.(tsx?|jsx?|mts?)$/.test(p)
  );
}

// ---------------------------------------------------------------------------
// Insight 1 — files nothing imports

export interface UnimportedFile {
  file: FileNode;
}

/**
 * Returns files with fanIn === 0, excluding framework-owned paths.
 * These are genuine candidates for "where to start reading" — entry
 * points the import graph can actually see.
 */
export function filesNothingImports(
  files: FileNode[],
  fanIn: Record<string, number>,
): UnimportedFile[] {
  return files
    .filter((f) => !fanIn[f.path] && !isFrameworkOwned(f.path))
    .map((f) => ({ file: f }));
}

// ---------------------------------------------------------------------------
// Insight 2 — import cycles (iterative Tarjan SCC)
//
// Real repositories have tens of thousands of files. Recursive DFS would
// overflow the call stack, so we use an explicit stack for Tarjan's algorithm.

export type Cycle = string[]; // ordered list of file paths forming the cycle

/**
 * Finds all strongly-connected components with more than one node, using an
 * iterative (non-recursive) implementation of Tarjan's SCC algorithm.
 *
 * Returns each cycle as the path list of the SCC's members. Paths within
 * each cycle are in the order they were discovered.
 */
export function importCycles(
  files: FileNode[],
  edges: InsightEdge[],
): Cycle[] {
  // Build adjacency list (internal file paths only)
  const filePaths = new Set(files.map((f) => f.path));
  const adj = new Map<string, string[]>();
  for (const f of files) adj.set(f.path, []);
  for (const e of edges) {
    if (filePaths.has(e.from) && filePaths.has(e.to)) {
      adj.get(e.from)!.push(e.to);
    }
  }

  // Iterative Tarjan's SCC
  // Each stack frame: { node, adjIndex, lowlink, index }
  const index = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const onStack = new Map<string, boolean>();
  const stack: string[] = [];
  const cycles: Cycle[] = [];
  let counter = 0;

  // Call-stack simulation
  interface Frame {
    node: string;
    childIndex: number; // which child we're about to process
  }

  for (const startNode of files.map((f) => f.path)) {
    if (index.has(startNode)) continue;

    const callStack: Frame[] = [{ node: startNode, childIndex: 0 }];

    while (callStack.length > 0) {
      const frame = callStack[callStack.length - 1];
      const v = frame.node;
      const children = adj.get(v) ?? [];

      if (frame.childIndex === 0) {
        // First visit — assign index/lowlink
        index.set(v, counter);
        lowlink.set(v, counter);
        counter++;
        stack.push(v);
        onStack.set(v, true);
      }

      let pushed = false;
      while (frame.childIndex < children.length) {
        const w = children[frame.childIndex];
        frame.childIndex++;

        if (!index.has(w)) {
          // Not yet visited — push onto call stack and continue DFS
          callStack.push({ node: w, childIndex: 0 });
          pushed = true;
          break;
        } else if (onStack.get(w)) {
          // Back edge — w is already on the SCC stack
          const wIdx = index.get(w)!;
          const vLow = lowlink.get(v)!;
          if (wIdx < vLow) lowlink.set(v, wIdx);
        }
      }

      if (pushed) continue; // process child first

      // All children done — pop this frame
      callStack.pop();

      if (callStack.length > 0) {
        const parent = callStack[callStack.length - 1];
        const parentLow = lowlink.get(parent.node)!;
        const vLow = lowlink.get(v)!;
        if (vLow < parentLow) lowlink.set(parent.node, vLow);
      }

      // Root of an SCC?
      if (lowlink.get(v) === index.get(v)) {
        const scc: string[] = [];
        while (true) {
          const w = stack.pop()!;
          onStack.set(w, false);
          scc.push(w);
          if (w === v) break;
        }
        // Only report cycles — SCCs with more than one member
        if (scc.length > 1) {
          cycles.push(scc);
        }
      }
    }
  }

  return cycles;
}

// ---------------------------------------------------------------------------
// Insight 3 — highly imported files

export interface HighlyImported {
  file: FileNode;
  fanIn: number;
  /** How many times higher than the mean */
  ratio: number;
}

/**
 * Files whose fanIn is more than 2× the mean fanIn across all files that
 * are imported at least once. The threshold is chosen to be explanatory
 * without being a grade — it answers "what is load-bearing?" not "what is bad?"
 */
export function highlyImportedFiles(
  files: FileNode[],
  fanIn: Record<string, number>,
): HighlyImported[] {
  const imported = files
    .map((f) => ({ file: f, fanIn: fanIn[f.path] ?? 0 }))
    .filter((x) => x.fanIn > 0);

  if (imported.length === 0) return [];

  const mean = imported.reduce((s, x) => s + x.fanIn, 0) / imported.length;

  // Need at least mean > 1 to produce any results; avoids noise in tiny repos
  if (mean <= 1) return [];

  const threshold = mean * 2;

  return imported
    .filter((x) => x.fanIn >= threshold)
    .map((x) => ({ ...x, ratio: parseFloat((x.fanIn / mean).toFixed(1)) }))
    .sort((a, b) => b.fanIn - a.fanIn);
}

// ---------------------------------------------------------------------------
// Insight 4 — long files

export interface LongFile {
  file: FileNode;
  lines: number;
}

/**
 * Files over LINE_THRESHOLD lines. Threshold is a simple count fact,
 * not a quality judgment.
 */
export function longFiles(files: FileNode[]): LongFile[] {
  return files
    .filter((f) => f.lines > LINE_THRESHOLD)
    .map((f) => ({ file: f, lines: f.lines }))
    .sort((a, b) => b.lines - a.lines);
}

// ---------------------------------------------------------------------------
// Composite export — all four insights in one call

export interface Insights {
  unimported: UnimportedFile[];
  cycles: Cycle[];
  highlyImported: HighlyImported[];
  long: LongFile[];
}

export function computeInsights(
  files: FileNode[],
  edges: InsightEdge[],
  fanIn: Record<string, number>,
): Insights {
  return {
    // filesNothingImports leads — spec order
    unimported: filesNothingImports(files, fanIn),
    cycles: importCycles(files, edges),
    highlyImported: highlyImportedFiles(files, fanIn),
    long: longFiles(files),
  };
}
