/**
 * react.ts — adapter for plain React apps (not Next.js).
 *
 * Detects React projects that do NOT use Next.js. Role assignment is
 * path/extension-based only — we don't have file content in FileNode.
 */

import type { FileNode } from "../../parser/types";
import type { FrameworkAdapterImpl, Route } from "../types";

/** Extract the basename from a module path (the part after the last slash). */
function basename(modulePath: string): string {
  return modulePath.split("/").pop() ?? modulePath;
}

export const reactAdapter: FrameworkAdapterImpl = {
  key: "react",

  detect(_files: FileNode[], packageJson: unknown): boolean {
    const pkg = packageJson as Record<string, unknown> | null ?? {};
    const deps = (pkg["dependencies"] ?? {}) as Record<string, unknown>;
    const devDeps = (pkg["devDependencies"] ?? {}) as Record<string, unknown>;
    const hasReact = "react" in deps || "react" in devDeps;
    const hasNext = "next" in deps || "next" in devDeps;
    // Only claim this repo if it's React without Next.js. The Next.js adapter
    // takes precedence in the detection order, but this guard makes detect()
    // accurate in isolation.
    return hasReact && !hasNext;
  },

  role(file: FileNode): string {
    const base = basename(file.module);
    const lower = base.toLowerCase();

    // Hook: filename starts with "use" (e.g. useAuth.ts, useDebounce.tsx)
    if (/^use[A-Z]/.test(base) && (base.endsWith(".ts") || base.endsWith(".tsx"))) {
      return "Hook";
    }

    // Context: path or filename contains "context" (case-insensitive)
    if (lower.includes("context")) {
      return "Context";
    }

    // Component: JSX-capable extension (.tsx or .jsx)
    if (base.endsWith(".tsx") || base.endsWith(".jsx")) {
      return "Component";
    }

    return "Utility";
  },

  extractRoutes(_files: FileNode[], _rootDir: string): Route[] {
    // React is a view library, not a routing framework. Route extraction
    // would depend on runtime router configuration (react-router, tanstack, etc.)
    // which cannot be statically determined from imports alone.
    return [];
  },
};
