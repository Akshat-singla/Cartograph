/**
 * nextjs.ts — adapter for Next.js App Router and Pages Router projects.
 *
 * Role assignment and route extraction use the file path conventions from
 * Next.js documentation. File content is not available in FileNode, so
 * "Server action" detection falls back to directory/filename conventions:
 *   - files inside an `actions/` or `_actions/` directory under `app/`
 *   - files named `actions.ts` or `actions.tsx`
 * True `"use server"` detection would require reading file content, which
 * this layer does not do. This limitation is documented here deliberately.
 *
 * extractRoutes does read files from disk (via ts-morph) for `route.ts`
 * files in order to find exported HTTP method functions. This is valid
 * because adapters run only inside the pipeline (Node.js), never in the
 * browser.
 */

import * as path from "path";
import * as fs from "fs";
import type { FileNode } from "../../parser/types";
import type { FrameworkAdapterImpl, Route } from "../types";

/** Extract the basename from a module path. */
function basename(modulePath: string): string {
  return modulePath.split("/").pop() ?? modulePath;
}

/** Extract the stem (basename without extension). */
function stem(base: string): string {
  const i = base.lastIndexOf(".");
  return i > 0 ? base.slice(0, i) : base;
}

/**
 * Derive the URL pattern from a module path by extracting the segment
 * between `app/` and the filename.
 *
 * Examples:
 *   app/users/[id]/page.tsx → /users/[id]
 *   app/page.tsx             → /
 *   app/(auth)/login/page.tsx → /login   (route groups stripped)
 *
 * Returns null when the pattern cannot be cleanly derived.
 */
function derivePattern(modulePath: string): string | null {
  // Normalize to forward slashes and find the `app/` segment.
  const normalized = modulePath.replace(/\\/g, "/");
  const appIndex = normalized.indexOf("/app/");
  if (appIndex === -1) {
    // Could also start with "app/" (no leading slash)
    if (!normalized.startsWith("app/")) return null;
  }

  const afterApp = appIndex !== -1
    ? normalized.slice(appIndex + 5)  // skip "/app/"
    : normalized.slice(4);             // skip "app/"

  // Strip the filename (last segment)
  const lastSlash = afterApp.lastIndexOf("/");
  const dirPart = lastSlash > 0 ? afterApp.slice(0, lastSlash) : "";

  // Remove route groups: segments surrounded by parentheses, e.g. (auth)
  const stripped = dirPart
    .split("/")
    .filter((seg) => seg !== "" && !/^\(.*\)$/.test(seg))
    .join("/");

  return stripped.length > 0 ? `/${stripped}` : "/";
}

const HTTP_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH"] as const;

/**
 * Read a route.ts file from disk and extract exported HTTP method names.
 * Uses a simple regex rather than full AST parsing — we only need the
 * exported function names, not their bodies.
 *
 * Returns only the HTTP methods that appear as `export (async) function METHOD`
 * or `export const METHOD =` patterns.
 */
function extractHttpMethodsFromFile(filePath: string): string[] {
  let source: string;
  try {
    source = fs.readFileSync(filePath, "utf-8");
  } catch {
    return [];
  }

  const found: string[] = [];
  for (const method of HTTP_METHODS) {
    // Match: export async function GET, export function GET, export const GET =
    const pattern = new RegExp(
      `export\\s+(async\\s+)?function\\s+${method}\\b|export\\s+const\\s+${method}\\s*=`,
    );
    if (pattern.test(source)) {
      found.push(method);
    }
  }
  return found;
}

export const nextjsAdapter: FrameworkAdapterImpl = {
  key: "nextjs",

  detect(files: FileNode[], _packageJson: unknown): boolean {
    // Detect App Router: any file matching app/layout.tsx (or .ts, .jsx, .js)
    const appLayoutPattern = /(^|\/)app\/layout\.(tsx?|jsx?)$/;
    if (files.some((f) => appLayoutPattern.test(f.module))) return true;

    // Detect Pages Router: any file under a pages/ directory
    const pagesPattern = /(^|\/)pages\//;
    if (files.some((f) => pagesPattern.test(f.module))) return true;

    return false;
  },

  role(file: FileNode): string {
    const mod = file.module.replace(/\\/g, "/");
    const base = basename(mod);
    const name = stem(base);

    // Next.js special filenames → Layout
    const layoutNames = ["layout", "template", "loading", "error", "not-found"];
    if (
      layoutNames.includes(name) &&
      /\.(tsx?|jsx?)$/.test(base)
    ) {
      return "Layout";
    }

    // API endpoint: route.ts / route.js under app/
    if (/\/app\//i.test(mod) && /^route\.(tsx?|js)$/.test(base)) {
      return "API endpoint";
    }

    // Page route: page.tsx / page.jsx under app/ or pages/
    if (/^page\.(tsx?|jsx?)$/.test(base)) {
      return "Page route";
    }

    // Server action: files in an actions/ or _actions/ directory under app/,
    // or files named actions.ts / actions.tsx.
    // Note: true "use server" detection requires file content; this is a
    // convention-based proxy. Files with "use server" but outside these paths
    // will be classified as Utility.
    if (
      /\/app\/.*\/_?actions\//.test(mod) ||
      base === "actions.ts" ||
      base === "actions.tsx"
    ) {
      return "Server action";
    }

    return "Utility";
  },

  extractRoutes(files: FileNode[], rootDir: string): Route[] {
    const routes: Route[] = [];

    for (const f of files) {
      const mod = f.module.replace(/\\/g, "/");
      const base = basename(mod);

      // Only process files inside the app/ directory
      if (!/(\/)app\//.test(`/${mod}`)) continue;

      const pattern = derivePattern(mod);
      if (pattern === null) continue;

      if (/^page\.(tsx?|jsx?)$/.test(base)) {
        // Page files always respond to GET via the default export
        routes.push({
          method: "GET",
          pattern,
          file: f.path,
          handlerName: "default",
        });
      } else if (/^route\.(tsx?|js)$/.test(base)) {
        // Read the file from disk to find which HTTP method functions are exported
        const absPath = path.isAbsolute(f.path)
          ? f.path
          : path.join(rootDir, f.module);
        const methods = extractHttpMethodsFromFile(absPath);
        for (const method of methods) {
          routes.push({
            method,
            pattern,
            file: f.path,
            handlerName: method,
          });
        }
      }
    }

    return routes;
  },
};
