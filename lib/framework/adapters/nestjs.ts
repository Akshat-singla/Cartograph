/**
 * nestjs.ts — adapter for NestJS projects.
 *
 * Uses ts-morph to parse controller files and extract route decorators.
 * Only string literals are accepted for decorator arguments — if a decorator
 * uses a variable, expression, or template literal, the route is not emitted
 * (absent beats approximate).
 *
 * ts-morph is imported here because this adapter runs only in the pipeline
 * (Node.js). Never import this file from browser/client code.
 */

import * as path from "path";
import { Project, SyntaxKind } from "ts-morph";
import type { FileNode } from "../../parser/types";
import type { FrameworkAdapterImpl, Route } from "../types";

/** Extract basename from a module path. */
function basename(modulePath: string): string {
  return modulePath.split("/").pop() ?? modulePath;
}

/** Map NestJS method decorator names to HTTP verbs. */
const DECORATOR_TO_METHOD: Record<string, string> = {
  Get:    "GET",
  Post:   "POST",
  Put:    "PUT",
  Delete: "DELETE",
  Patch:  "PATCH",
};

/**
 * Normalize a URL pattern: collapse double slashes, ensure leading slash,
 * remove trailing slash (except when the pattern is just "/").
 */
function normalizePattern(prefix: string, suffix: string): string {
  const joined = "/" + prefix.replace(/^\//, "") + "/" + suffix.replace(/^\//, "");
  // Collapse consecutive slashes
  const collapsed = joined.replace(/\/+/g, "/");
  // Remove trailing slash unless root
  return collapsed.length > 1 ? collapsed.replace(/\/$/, "") : collapsed;
}

export const nestjsAdapter: FrameworkAdapterImpl = {
  key: "nestjs",

  detect(_files: FileNode[], packageJson: unknown): boolean {
    const pkg = packageJson as Record<string, unknown> | null ?? {};
    const deps = (pkg["dependencies"] ?? {}) as Record<string, unknown>;
    const devDeps = (pkg["devDependencies"] ?? {}) as Record<string, unknown>;
    return (
      "@nestjs/core" in deps ||
      "@nestjs/common" in deps ||
      "@nestjs/core" in devDeps ||
      "@nestjs/common" in devDeps
    );
  },

  role(file: FileNode): string {
    const base = basename(file.module);

    if (base.endsWith(".controller.ts")) return "Controller";
    if (base.endsWith(".service.ts"))    return "Service";
    if (base.endsWith(".module.ts"))     return "Module";
    if (base.endsWith(".entity.ts"))     return "Entity";
    if (base.endsWith(".model.ts"))      return "Entity";
    if (base.endsWith(".dto.ts"))        return "DTO";
    if (base.endsWith(".guard.ts"))      return "Guard";
    if (base.endsWith(".pipe.ts"))       return "Pipe";
    if (base.endsWith(".interceptor.ts")) return "Interceptor";

    return "Utility";
  },

  extractRoutes(files: FileNode[], rootDir: string): Route[] {
    // Collect controller file paths
    const controllerFiles = files.filter((f) =>
      basename(f.module).endsWith(".controller.ts"),
    );

    if (controllerFiles.length === 0) return [];

    // Create a ts-morph project with only the controller files so we don't
    // parse the entire repository — keep startup cost proportional to what we need.
    const project = new Project({ skipAddingFilesFromTsConfig: true });

    for (const f of controllerFiles) {
      const absPath = path.isAbsolute(f.path)
        ? f.path
        : path.join(rootDir, f.module);
      try {
        project.addSourceFileAtPath(absPath);
      } catch {
        // File not readable — skip, never guess
        continue;
      }
    }

    const routes: Route[] = [];

    for (const sourceFile of project.getSourceFiles()) {
      const filePath = sourceFile.getFilePath();

      for (const cls of sourceFile.getClasses()) {
        // Find the @Controller decorator
        const controllerDec = cls
          .getDecorators()
          .find((d) => d.getName() === "Controller");

        if (!controllerDec) continue; // No @Controller — skip the class

        // Extract the prefix argument: ONLY accept a string literal
        const controllerArgs = controllerDec.getArguments();
        let prefix = ""; // @Controller() with no argument means root prefix

        if (controllerArgs.length > 0) {
          const firstArg = controllerArgs[0];
          if (firstArg.getKind() !== SyntaxKind.StringLiteral) {
            // Non-string-literal prefix (variable, template literal, object) —
            // skip this entire controller since the base path is unknown
            continue;
          }
          prefix = firstArg.asKindOrThrow(SyntaxKind.StringLiteral).getLiteralValue();
        }

        for (const method of cls.getMethods()) {
          for (const [decoratorName, httpMethod] of Object.entries(DECORATOR_TO_METHOD)) {
            const methodDec = method
              .getDecorators()
              .find((d) => d.getName() === decoratorName);
            if (!methodDec) continue;

            const methodArgs = methodDec.getArguments();
            let suffix = ""; // @Get() with no argument means "" suffix

            if (methodArgs.length > 0) {
              const firstArg = methodArgs[0];
              if (firstArg.getKind() !== SyntaxKind.StringLiteral) {
                // Non-string-literal path — skip this method, never guess
                continue;
              }
              suffix = firstArg.asKindOrThrow(SyntaxKind.StringLiteral).getLiteralValue();
            }

            routes.push({
              method: httpMethod,
              pattern: normalizePattern(prefix, suffix),
              file: filePath,
              handlerName: method.getName(),
            });
          }
        }
      }
    }

    return routes;
  },
};
