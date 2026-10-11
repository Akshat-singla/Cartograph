/**
 * Main parser entry point.
 * Takes a directory path, returns structured data about the repository.
 */

import type { ParseResult, FrameworkAdapter } from './types';
import { walkDirectory, countFolders } from './file-walker';
import { resolveImports, deduplicateEdges } from './import-resolver';
import { calculateFanIn, calculateFanOut } from './graph-metrics';
import { FallbackAdapter } from './adapters/base';

export interface ParseOptions {
  /** Root directory to parse */
  rootDir: string;
  /** Framework adapter (defaults to fallback) */
  adapter?: FrameworkAdapter;
  /** Directories to exclude */
  excludeDirs?: string[];
}

/**
 * Parse a repository and return its structure.
 */
export async function parseRepository(
  options: ParseOptions
): Promise<ParseResult> {
  const { rootDir, excludeDirs } = options;

  // Walk the directory tree
  const { files, skipped } = walkDirectory({ rootDir, excludeDirs });

  // Resolve all imports
  const { edges: rawEdges, unresolved, coverage } = resolveImports(
    files,
    rootDir
  );

  // Remove duplicate edges
  const edges = deduplicateEdges(rawEdges);

  // Calculate graph metrics
  const folderCount = countFolders(files);
  const fanIn = calculateFanIn(files, edges);
  const fanOut = calculateFanOut(files, edges);

  return {
    files,
    edges,
    coverage,
    unresolved,
    skipped,
    metrics: {
      folderCount,
      fanIn,
      fanOut,
    },
  };
}

// Re-export types
export type { ParseResult, FileNode, Edge, UnresolvedImport, FrameworkAdapter } from './types';
export { FallbackAdapter } from './adapters/base';
