/**
 * taxonomy.ts — browser-safe category metadata for each framework.
 *
 * No imports from ts-morph, fs, path, or any Node built-in.
 * This module is safe to import in both server components and client components.
 *
 * Decisions:
 * - Category order matters: the left rail renders them in this sequence.
 * - ROLE_TO_CATEGORY is the canonical mapping from adapter role strings to
 *   display category names. Add a new adapter role here when a new adapter
 *   adds roles.
 * - CATEGORY_COLORS is display metadata only. Colors were chosen so that
 *   routes/pages use blue, services/controllers use green, modules use purple,
 *   utilities use slate — matching developer intuitions about HTTP vs logic.
 */

export const FRAMEWORK_TAXONOMY: Record<string, readonly string[]> = {
  // Routable surfaces first, then UI, then plumbing, then catch-all.
  // "Loading & error UI" covers loading.tsx / error.tsx / not-found.tsx.
  // "Unclassified" collects files that matched no other role.
  nextjs: [
    "Page routes",
    "API endpoints",
    "Server actions",
    "Layouts",
    "Loading & error UI",
    "Components",
    "Hooks",
    "Middleware",
    "Metadata files",
    "Instrumentation",
    "Config files",
    "Tests",
    "Unclassified",
  ],
  nestjs: ["Controllers", "Services", "Modules", "Entities", "DTOs", "Guards", "Pipes", "Interceptors", "Utilities"],
  express: ["Routers", "Controllers", "Services", "Models", "Middleware", "Tests", "Unclassified"],
  react: ["Components", "Hooks", "Contexts", "Utilities"],
  generic: ["Files"],
};

/**
 * Return the ordered category list for a framework key.
 * Falls back to ["Files"] for unknown frameworks.
 */
export function categoryOrderFor(framework: string): readonly string[] {
  return FRAMEWORK_TAXONOMY[framework] ?? ["Files"];
}

/**
 * Maps every adapter role label to the display category name it belongs to.
 * Update this whenever an adapter adds a new role string.
 */
export const ROLE_TO_CATEGORY: Record<string, string> = {
  // Next.js roles — each maps to its taxonomy category name
  "Page route": "Page routes",
  "API endpoint": "API endpoints",
  "Server action": "Server actions",
  "Layout": "Layouts",
  "Loading & error": "Loading & error UI",
  "Component": "Components",
  "Hook": "Hooks",
  "Middleware": "Middleware",
  "Metadata": "Metadata files",
  "Instrumentation": "Instrumentation",
  "Config": "Config files",
  "Test": "Tests",
  "Unclassified": "Unclassified",

  // NestJS roles
  "Controller": "Controllers",
  "Service": "Services",
  "Module": "Modules",
  "Entity": "Entities",
  "DTO": "DTOs",
  "Guard": "Guards",
  "Pipe": "Pipes",
  "Interceptor": "Interceptors",
  "Utility": "Utilities",
  "Router": "Routers",
  "Model": "Models",

  // React roles
  "Context": "Contexts",

  // Generic fallback
  "File": "Files",
};

/**
 * CSS hex color for each category, used as the swatch in the left rail.
 * Routes/pages = blue, services/controllers = green, modules = purple,
 * utilities/generic = slate.
 */
export const CATEGORY_COLORS: Record<string, string> = {
  // Next.js
  "Page routes": "#3b82f6",  // blue
  "API endpoints": "#22c55e",  // green
  "Server actions": "#a855f7",  // purple
  "Layouts": "#f59e0b",  // amber
  "Loading & error UI": "#ef4444",  // red
  "Components": "#3b82f6",  // blue
  "Hooks": "#22c55e",  // green
  "Middleware": "#f97316",  // orange
  "Metadata files": "#64748b",  // slate
  "Instrumentation": "#64748b",  // slate
  "Config files": "#64748b",  // slate
  "Tests": "#64748b",  // slate
  "Unclassified": "#374151",  // dark gray

  // NestJS
  "Controllers": "#3b82f6",  // blue
  "Services": "#22c55e",  // green
  "Modules": "#a855f7",  // purple
  "Entities": "#ec4899",  // pink
  "DTOs": "#64748b",  // slate
  "Guards": "#ef4444",  // red
  "Pipes": "#f97316",  // orange
  "Interceptors": "#a855f7",  // purple
  "Utilities": "#64748b",  // slate
  "Routers": "#3b82f6",
  "Models": "#ec4899",

  // React
  "Contexts": "#a855f7",  // purple

  // Generic
  "Files": "#64748b",  // slate
};
