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
  nextjs:  ["Page routes", "API endpoints", "Server actions", "Layouts", "Utilities"],
  nestjs:  ["Controllers", "Services", "Modules", "Entities", "DTOs", "Guards", "Pipes", "Interceptors", "Utilities"],
  react:   ["Components", "Hooks", "Contexts", "Utilities"],
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
  // Next.js roles
  "Page route":    "Page routes",
  "API endpoint":  "API endpoints",
  "Server action": "Server actions",
  "Layout":        "Layouts",
  "Utility":       "Utilities",

  // NestJS roles
  "Controller":  "Controllers",
  "Service":     "Services",
  "Module":      "Modules",
  "Entity":      "Entities",
  "DTO":         "DTOs",
  "Guard":       "Guards",
  "Pipe":        "Pipes",
  "Interceptor": "Interceptors",

  // React roles
  "Component": "Components",
  "Hook":      "Hooks",
  "Context":   "Contexts",

  // Generic fallback
  "File": "Files",
};

/**
 * CSS hex color for each category, used as the swatch in the left rail.
 * Routes/pages = blue, services/controllers = green, modules = purple,
 * utilities/generic = slate.
 */
export const CATEGORY_COLORS: Record<string, string> = {
  "Page routes":   "#3b82f6",  // blue
  "API endpoints": "#22c55e",  // green
  "Server actions":"#a855f7",  // purple
  "Layouts":       "#f59e0b",  // amber
  "Utilities":     "#64748b",  // slate

  "Controllers":   "#3b82f6",  // blue
  "Services":      "#22c55e",  // green
  "Modules":       "#a855f7",  // purple
  "Entities":      "#ec4899",  // pink
  "DTOs":          "#64748b",  // slate
  "Guards":        "#ef4444",  // red
  "Pipes":         "#f97316",  // orange
  "Interceptors":  "#a855f7",  // purple

  "Components":    "#3b82f6",  // blue
  "Hooks":         "#22c55e",  // green
  "Contexts":      "#a855f7",  // purple

  "Files":         "#64748b",  // slate
};
