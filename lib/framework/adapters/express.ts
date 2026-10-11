import type { FileNode } from "../../parser/types";
import type { FrameworkAdapterImpl, Route } from "../types";

const FOLDER_ROLES: Record<string, string> = {
  route: "Router",
  routes: "Router",
  router: "Router",
  routers: "Router",
  controller: "Controller",
  controllers: "Controller",
  service: "Service",
  services: "Service",
  model: "Model",
  models: "Model",
  middleware: "Middleware",
  middlewares: "Middleware",
};

function basename(modulePath: string): string {
  return modulePath.split("/").pop() ?? modulePath;
}

function nearestFolderRole(modulePath: string): string | null {
  const folders = modulePath.split("/").slice(0, -1);
  for (let i = folders.length - 1; i >= 0; i -= 1) {
    const role = FOLDER_ROLES[folders[i] ?? ""];
    if (role) return role;
  }
  return null;
}

export const expressAdapter: FrameworkAdapterImpl = {
  key: "express",

  detect(_files: FileNode[], packageJson: unknown): boolean {
    const pkg = packageJson as Record<string, unknown> | null ?? {};
    const dependencies = {
      ...((pkg.dependencies as Record<string, unknown>) ?? {}),
      ...((pkg.devDependencies as Record<string, unknown>) ?? {}),
    };
    return "express" in dependencies;
  },

  role(file: FileNode): string {
    const base = basename(file.module);
    if (/\.(test|spec)\.(tsx?|jsx?)$/.test(base)) return "Test";
    return nearestFolderRole(file.module) ?? "Unclassified";
  },

  // Express paths are assembled at runtime from mounted routers and
  // middleware, so exact route extraction is deliberately absent.
  extractRoutes(_files: FileNode[], _rootDir: string): Route[] {
    return [];
  },
};
