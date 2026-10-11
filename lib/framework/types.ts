/**
 * Framework adapter interface and route type.
 *
 * FrameworkAdapterImpl is named to avoid collision with the parser's
 * FrameworkAdapter interface (which handles entry points and shouldInclude).
 * These adapters answer different questions: what *kind* is each file, and
 * what routes does the codebase expose.
 *
 * Adapters run only in the pipeline (Node.js). Never import this from
 * browser code.
 */

import type { FileNode } from "../parser/types";

export interface Route {
  /** HTTP verb, upper-cased: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" */
  method: string;
  /** Full URL pattern, e.g. "/users/[id]" */
  pattern: string;
  /** Absolute path to the file defining this route */
  file: string;
  /** Exported function or handler name, e.g. "GET", "createUser", "default" */
  handlerName: string;
}

export interface FrameworkAdapterImpl {
  /** Identifier string: "nextjs" | "nestjs" | "react" | "generic" */
  readonly key: string;

  /**
   * Return true if this adapter applies to the repo.
   * @param files    Parsed file list from the repository.
   * @param packageJson  Parsed package.json, or {} if absent.
   */
  detect(files: FileNode[], packageJson: unknown): boolean;

  /**
   * Assign a role label to a single file (e.g. "Page route", "Service").
   * Role is derived from path/filename conventions only — no file content.
   */
  role(file: FileNode): string;

  /**
   * Extract statically-discoverable HTTP routes from the file list.
   * @param files   Full file list (same as passed to detect).
   * @param rootDir Absolute path to the repository root on disk.
   * @returns       Only routes that could be fully resolved. Never guesses.
   */
  extractRoutes(files: FileNode[], rootDir: string): Route[];
}
