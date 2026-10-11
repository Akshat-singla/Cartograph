/**
 * detect.ts — run adapters in priority order and return the first match.
 *
 * Reads package.json from disk once. Falls back to {} if absent or invalid
 * JSON (a repo without package.json still gets the generic adapter).
 *
 * Adapter priority: nextjs → nestjs → react → generic.
 * generic always returns true so this function always returns a value.
 *
 * This module imports Node built-ins (fs, path) and is pipeline-only.
 * Never import it from browser/client code.
 */

import * as fs from "fs";
import * as path from "path";
import type { FileNode } from "../parser/types";
import type { FrameworkAdapterImpl } from "./types";
import { nextjsAdapter } from "./adapters/nextjs";
import { nestjsAdapter } from "./adapters/nestjs";
import { reactAdapter } from "./adapters/react";
import { expressAdapter } from "./adapters/express";
import { genericAdapter } from "./adapters/generic";

const ADAPTER_ORDER: FrameworkAdapterImpl[] = [
  nextjsAdapter,
  nestjsAdapter,
  expressAdapter,
  reactAdapter,
  genericAdapter,
];

export function detectFramework(
  files: FileNode[],
  rootDir: string,
): { key: string; adapter: FrameworkAdapterImpl } {
  let packageJson: unknown = {};

  try {
    const raw = fs.readFileSync(path.join(rootDir, "package.json"), "utf-8");
    packageJson = JSON.parse(raw);
  } catch {
    // Missing or invalid package.json — treat as empty, still run adapters
  }

  for (const adapter of ADAPTER_ORDER) {
    if (adapter.detect(files, packageJson)) {
      return { key: adapter.key, adapter };
    }
  }

  // Unreachable: generic always matches. TypeScript requires a return here.
  return { key: "generic", adapter: genericAdapter };
}
