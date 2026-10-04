"use client";

// Left rail — category filter legend.
//
// Clicking a category activates it: the graph dims every node that doesn't
// contain a file matching that extension. Clicking again clears the filter.
// The count on each row is the total number of files in that category across
// the whole repo.
//
// "Dims everything that isn't in it" — nodes stay on screen; only opacity drops.

import { useCategories } from "./categories-context";

export function LeftRail() {
  const { categories, activeCategory, setActiveCategory } = useCategories();

  function handleClick(name: string) {
    // Toggle: clicking the active category clears the filter
    setActiveCategory(activeCategory === name ? null : name);
  }

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
        {categories.map((cat) => {
          const isActive = activeCategory === cat.name;
          // When a filter is active, dim categories that aren't the active one
          const isDimmed = activeCategory !== null && !isActive;

          return (
            <li
              key={cat.name}
              onClick={() => handleClick(cat.name)}
              className={`
                flex items-center gap-2 px-3 py-1.5 cursor-pointer select-none
                transition-opacity
                ${isDimmed ? "opacity-30" : "opacity-100"}
                ${isActive
                  ? "bg-neutral-800 text-neutral-100"
                  : "text-neutral-300 hover:bg-neutral-900"}
              `}
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
          );
        })}
      </ul>
    </>
  );
}
