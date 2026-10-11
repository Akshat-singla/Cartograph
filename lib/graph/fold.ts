/**
 * Folding algorithm.
 *
 * Rule: every directory starts as its own node. Working deepest-first,
 * any directory whose file count is below the threshold merges into its
 * parent. The threshold starts at 2 and is raised until the node count
 * lands below TARGET_MAX_NODES. Each pass is computed fresh so a merge
 * at one depth does not influence another merge at the same depth.
 */

import type { FileNode, Edge } from '../parser/types';
import path from 'path';

export const TARGET_MAX_NODES = 24;

export interface FoldedNode {
  /** The directory path this node represents */
  dir: string;
  /** All files inside (recursively after folding) */
  files: FileNode[];
  /** Fan-in across all files in this node */
  fanIn: number;
  /** Fan-out across all files in this node */
  fanOut: number;
}

export interface FoldResult {
  nodes: FoldedNode[];
  /** Threshold that produced this result */
  threshold: number;
}

/**
 * Fold directories into nodes.
 * Pure function — same input always produces the same output.
 *
 * @param rootDir  The repository root — no node is allowed to merge above it.
 */
export function foldDirectories(
  files: FileNode[],
  edges: Edge[],
  fanInMap: Record<string, number>,
  fanOutMap: Record<string, number>,
  rootDir?: string,
): FoldResult {
  // Start threshold at 2, raise until we're under TARGET_MAX_NODES
  for (let threshold = 2; threshold <= files.length; threshold++) {
    const nodes = runFold(files, threshold, fanInMap, fanOutMap, rootDir);
    if (nodes.length <= TARGET_MAX_NODES) {
      void edges;
      return { nodes, threshold };
    }
  }
  return { nodes: runFold(files, files.length, fanInMap, fanOutMap, rootDir), threshold: files.length };
}

function runFold(
  files: FileNode[],
  threshold: number,
  fanInMap: Record<string, number>,
  fanOutMap: Record<string, number>,
  rootDir?: string,
): FoldedNode[] {
  // Group files by their immediate directory
  const byDir = new Map<string, FileNode[]>();
  for (const f of files) {
    const dir = f.folder;
    const bucket = byDir.get(dir) ?? [];
    bucket.push(f);
    byDir.set(dir, bucket);
  }

  // Build a mutable map: dir → files (we'll merge small dirs into parents)
  const dirFiles = new Map<string, FileNode[]>(byDir);

  // Collect all dirs and sort deepest-first (most slashes first)
  const dirs = [...dirFiles.keys()].sort(
    (a, b) => depth(b) - depth(a),
  );

  // Each pass is independent: snapshot the current file counts before merging
  const snapshot = new Map<string, number>();
  for (const [d, fs] of dirFiles) snapshot.set(d, fs.length);

  for (const dir of dirs) {
    if ((snapshot.get(dir) ?? 0) < threshold) {
      const parent = path.dirname(dir);
      // Don't merge into yourself (root reached) or above the repo root
      if (parent === dir) continue;
      if (rootDir && parent.length < rootDir.length) continue;
      // Move files to parent — always create the parent bucket if it doesn't
      // exist yet (handles the case where the parent was itself removed earlier
      // in this pass).
      const parentFiles = dirFiles.get(parent) ?? [];
      const ownFiles = dirFiles.get(dir) ?? [];
      dirFiles.set(parent, [...parentFiles, ...ownFiles]);
      dirFiles.delete(dir);
    }
  }

  // Second pass: clean up any surviving single-file nodes that got stranded
  // by re-merging them upward (iteratively, so chains resolve).
  let changed = true;
  while (changed) {
    changed = false;
    const strandedDirs = [...dirFiles.keys()].sort((a, b) => depth(b) - depth(a));
    for (const dir of strandedDirs) {
      const fs = dirFiles.get(dir);
      if (!fs || fs.length >= threshold) continue;
      const parent = path.dirname(dir);
      if (parent === dir) continue;
      if (rootDir && parent.length < rootDir.length) continue;
      const parentFiles = dirFiles.get(parent) ?? [];
      dirFiles.set(parent, [...parentFiles, ...fs]);
      dirFiles.delete(dir);
      changed = true;
    }
  }

  // Build FoldedNode array
  const result: FoldedNode[] = [];
  for (const [dir, fs] of dirFiles) {
    const totalFanIn = fs.reduce((s, f) => s + (fanInMap[f.path] ?? 0), 0);
    const totalFanOut = fs.reduce((s, f) => s + (fanOutMap[f.path] ?? 0), 0);
    result.push({ dir, files: fs, fanIn: totalFanIn, fanOut: totalFanOut });
  }

  return result;
}

function depth(p: string): number {
  return p.split(path.sep).length;
}

/**
 * Shortest label that is still unique among the given set of dirs.
 * Uses the last path segment; if there's a collision, extends leftward.
 */
export function shortestUniqueLabels(dirs: string[]): Map<string, string> {
  const labels = new Map<string, string>();

  function lastN(dir: string, n: number): string {
    const parts = dir.split(path.sep).filter(Boolean);
    return parts.slice(-n).join('/');
  }

  let n = 1;
  while (true) {
    const candidates = new Map<string, string>();
    for (const dir of dirs) {
      candidates.set(dir, lastN(dir, n));
    }
    // Check for uniqueness
    const seen = new Map<string, string[]>();
    for (const [dir, label] of candidates) {
      const bucket = seen.get(label) ?? [];
      bucket.push(dir);
      seen.set(label, bucket);
    }
    const conflicts = [...seen.values()].filter(v => v.length > 1).flat();
    for (const [dir, label] of candidates) {
      if (!conflicts.includes(dir)) {
        labels.set(dir, label);
      }
    }
    const remaining = dirs.filter(d => !labels.has(d));
    if (remaining.length === 0) break;
    // Only re-process conflicting dirs next round
    n++;
    // Safety: if n exceeds max parts, just use the full path
    if (n > 20) {
      for (const dir of remaining) labels.set(dir, dir);
      break;
    }
  }

  return labels;
}
