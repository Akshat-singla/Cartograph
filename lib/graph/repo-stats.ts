/**
 * Pure functions for deriving repo-level stats from a ParseResult.
 * No imports from Next, React, or the database.
 */

import type { FileNode } from "../parser/types";

// The serialised shape we work with (fanIn/fanOut are plain objects after JSON)
export interface RepoAnalysis {
  files: FileNode[];
  edges: Array<{ from: string; to: string; kind: string }>;
  coverage: {
    totalImports: number;
    resolved: number;
    external: number;
    excluded: number;
    failed: number;
  };
  skipped: Array<{ path: string; reason: string }>;
  metrics: {
    folderCount: number;
    fanIn: Record<string, number>;
    fanOut: Record<string, number>;
  };
}

export interface RepoSummary {
  /** Last path segment of the root dir — "excalidraw", "my-app", etc. */
  repoName: string;
  /** Framework inferred from file naming conventions */
  framework: string;
  fileCount: number;
  importCount: number;
  /** Unique resolved edges (internal imports) */
  resolvedEdgeCount: number;
  /** Files identifiable as routes by convention */
  routeCount: number;
  /** Files that nothing else imports — candidate entry points to read */
  entryFiles: FileNode[];
  /** Files with the highest fan-in, ordered descending */
  mostImported: Array<{ file: FileNode; fanIn: number }>;
  /** Number of skipped files */
  skippedCount: number;
}

export interface FileDetail {
  file: FileNode;
  fanIn: number;
  fanOut: number;
  /** Files that import this one */
  dependents: FileNode[];
  /** Files this one imports */
  dependencies: FileNode[];
}

export interface FolderDetail {
  dir: string;
  files: FileNode[];
  /** Breakdown by extension */
  byKind: Array<{ ext: string; count: number }>;
}

// ---------------------------------------------------------------------------
// Framework detection
// Heuristics based on file naming conventions, not file contents.
// Order matters — the first match wins.

const FRAMEWORK_PATTERNS: Array<{ name: string; test: (paths: string[]) => boolean }> = [
  {
    name: "Next.js",
    test: (ps) =>
      ps.some((p) => /\/(app|pages)\/(page|layout|route)\.(tsx?|jsx?)$/.test(p)) ||
      ps.some((p) => /next\.config\.(js|ts|mjs)$/.test(p)),
  },
  {
    name: "Remix",
    test: (ps) =>
      ps.some((p) => /\/app\/routes\//.test(p)) &&
      ps.some((p) => /remix\.config/.test(p)),
  },
  {
    name: "SvelteKit",
    test: (ps) => ps.some((p) => /\+page\.svelte$/.test(p)),
  },
  {
    name: "Vite / React",
    test: (ps) =>
      ps.some((p) => /vite\.config\.(ts|js|mts)$/.test(p)) &&
      ps.some((p) => /\.(tsx|jsx)$/.test(p)),
  },
  {
    name: "React",
    test: (ps) => ps.some((p) => /\.(tsx|jsx)$/.test(p)),
  },
  {
    name: "Node.js",
    test: () => true, // fallback
  },
];

export function detectFramework(filePaths: string[]): string {
  for (const { name, test } of FRAMEWORK_PATTERNS) {
    if (test(filePaths)) return name;
  }
  return "Unknown";
}

// ---------------------------------------------------------------------------
// Route detection
// A file is treated as a route if it matches common framework route conventions.

function isRoute(path: string): boolean {
  return (
    // Next.js app router
    /\/(app)\/(.*\/)?(page|route|layout)\.(tsx?|jsx?)$/.test(path) ||
    // Next.js pages router
    /\/pages\/(?!_app|_document|_error)[^/]+\.(tsx?|jsx?)$/.test(path) ||
    // Remix / SvelteKit
    /\/routes\//.test(path)
  );
}

// ---------------------------------------------------------------------------
// Repo name: last non-empty segment of the common path prefix

function repoNameFromPaths(files: FileNode[]): string {
  if (files.length === 0) return "unknown";
  const folders = files.map((f) => f.folder);
  // Find common prefix
  let prefix = folders[0];
  for (const f of folders) {
    while (prefix && !f.startsWith(prefix)) {
      const idx = prefix.lastIndexOf("/");
      prefix = idx > 0 ? prefix.slice(0, idx) : "";
    }
  }
  if (!prefix) return "unknown";
  const parts = prefix.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "unknown";
}

// ---------------------------------------------------------------------------

export function computeRepoSummary(a: RepoAnalysis): RepoSummary {
  const paths = a.files.map((f) => f.path);

  // Entry files: nothing imports them (fanIn === 0 or absent)
  const entryFiles = a.files.filter((f) => !a.metrics.fanIn[f.path]);

  // Most imported: top 10 by fan-in, must have at least 1
  const mostImported = a.files
    .map((f) => ({ file: f, fanIn: a.metrics.fanIn[f.path] ?? 0 }))
    .filter((x) => x.fanIn > 0)
    .sort((a, b) => b.fanIn - a.fanIn)
    .slice(0, 10);

  return {
    repoName: repoNameFromPaths(a.files),
    framework: detectFramework(paths),
    fileCount: a.files.length,
    importCount: a.coverage.totalImports,
    resolvedEdgeCount: a.edges.length,
    routeCount: paths.filter(isRoute).length,
    entryFiles,
    mostImported,
    skippedCount: a.skipped.length,
  };
}

export function computeFileDetail(
  filePath: string,
  a: RepoAnalysis,
): FileDetail | null {
  const file = a.files.find((f) => f.path === filePath);
  if (!file) return null;

  const fileIndex = new Map(a.files.map((f) => [f.path, f]));

  // Files this one imports (outgoing edges from filePath)
  const dependencies = a.edges
    .filter((e) => e.from === filePath)
    .map((e) => fileIndex.get(e.to))
    .filter((f): f is FileNode => f !== undefined);

  // Files that import this one (incoming edges to filePath)
  const dependents = a.edges
    .filter((e) => e.to === filePath)
    .map((e) => fileIndex.get(e.from))
    .filter((f): f is FileNode => f !== undefined);

  return {
    file,
    fanIn: a.metrics.fanIn[filePath] ?? 0,
    fanOut: a.metrics.fanOut[filePath] ?? 0,
    dependents,
    dependencies,
  };
}

export function computeFolderDetail(
  dir: string,
  files: FileNode[],
): FolderDetail {
  // Count by extension
  const extMap = new Map<string, number>();
  for (const f of files) {
    const ext = f.path.split(".").pop() ?? "";
    extMap.set(ext, (extMap.get(ext) ?? 0) + 1);
  }
  const byKind = [...extMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([ext, count]) => ({ ext: `.${ext}`, count }));

  return { dir, files, byKind };
}
