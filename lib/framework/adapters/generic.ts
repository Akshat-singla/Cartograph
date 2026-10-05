/**
 * generic.ts — fallback adapter.
 *
 * Always matches. Returns "File" for every role so the taxonomy puts
 * everything into the single "Files" category.
 */

import type { FileNode } from "../../parser/types";
import type { FrameworkAdapterImpl, Route } from "../types";

export const genericAdapter: FrameworkAdapterImpl = {
  key: "generic",

  // Fallback: always matches when no other adapter claims the repo.
  detect(_files: FileNode[], _packageJson: unknown): boolean {
    return true;
  },

  role(_file: FileNode): string {
    return "File";
  },

  extractRoutes(_files: FileNode[], _rootDir: string): Route[] {
    return [];
  },
};
