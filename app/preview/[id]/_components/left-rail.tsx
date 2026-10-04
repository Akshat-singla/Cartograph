"use client";

// Left rail — category legend.
// Each category is a file role recognised by the parser adapter
// (pages, components, lib, api routes, config, etc.).
// Categories come from the CategoriesContext set by the canvas page.

import { useCategories } from "./categories-context";

export function LeftRail() {
  const { categories } = useCategories();

  return (
    <>
      <div className="px-3 py-2 border-b border-neutral-800 shrink-0">
        <span className="text-neutral-500 text-xs uppercase tracking-widest">
          files
        </span>
      </div>

      <ul className="flex flex-col gap-px py-1">
        {categories.length === 0 && (
          <li className="px-3 py-1.5 text-neutral-600 text-xs">—</li>
        )}
        {categories.map((cat) => (
          <li
            key={cat.name}
            className="flex items-center gap-2 px-3 py-1.5 text-neutral-300"
          >
            {/* Colour swatch — 8×8 px square */}
            <span
              className="shrink-0 w-2 h-2 rounded-sm"
              style={{ backgroundColor: cat.color }}
              aria-hidden="true"
            />
            <span className="flex-1 text-xs truncate font-mono">{cat.name}</span>
            <span className="text-xs text-neutral-500 tabular-nums">
              {cat.count}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
