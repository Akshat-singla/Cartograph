/**
 * Core types for the parser output.
 * This is the contract between the parser and everything that consumes its output.
 */

export interface FileNode {
  /** Absolute path to the file */
  path: string;
  /** Folder containing this file */
  folder: string;
  /** Lines of code */
  lines: number;
  /** Content hash for change detection */
  hash: string;
  /** What this file represents in the codebase */
  module: string;
}

export interface Edge {
  /** Source file absolute path */
  from: string;
  /** Target file absolute path or external package */
  to: string;
  /** Type of dependency */
  kind: 'import' | 're-export' | 'dynamic-import';
}

export interface UnresolvedImport {
  /** File containing the import */
  file: string;
  /** Import specifier that failed */
  specifier: string;
  /** Why it couldn't be resolved */
  reason: string;
  /** Example of the actual import statement */
  example: string;
}

export interface ParseResult {
  /** All files that became nodes */
  files: FileNode[];
  /** All resolved dependencies */
  edges: Edge[];
  /** Coverage stats */
  coverage: {
    /** Total imports seen across all files */
    totalImports: number;
    /** Resolved to a file inside the repository */
    resolved: number;
    /** Points to external packages */
    external: number;
    /** Deliberately excluded (e.g., test files, config) */
    excluded: number;
    /** Failed to resolve */
    failed: number;
  };
  /** Unresolved imports with reasons */
  unresolved: UnresolvedImport[];
  /** Files deliberately skipped with reasons */
  skipped: Array<{ path: string; reason: string }>;
  /** Computed graph metrics */
  metrics: {
    /** Number of distinct folders */
    folderCount: number;
    /** Fan-in per file (how many files import it) */
    fanIn: Map<string, number>;
    /** Fan-out per file (how many files it imports) */
    fanOut: Map<string, number>;
  };
}

export interface FrameworkAdapter {
  /** Identify entry points for the framework */
  findEntryPoints(rootDir: string): string[];
  /** Decide if a file should be included */
  shouldInclude(filePath: string): boolean;
  /** Custom resolution rules for the framework */
  resolveImport?(
    specifier: string,
    fromFile: string,
    rootDir: string
  ): string | null;
}
