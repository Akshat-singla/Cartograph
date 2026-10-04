// Canvas shell for a single analysis.
// Three columns, fixed here, never relocated:
//   left rail  — 200 px, file-category legend
//   middle     — flex-1, graph canvas
//   right pane — 280 px, detail panel
//
// Both CategoriesProvider and SelectionProvider wrap the shell so the canvas
// (a client component) can push data into the rail and the right pane via context.

import type { ReactNode } from "react";
import { CategoriesProvider } from "./_components/categories-context";
import { SelectionProvider } from "./_components/selection-context";
import { LeftRail } from "./_components/left-rail";
import { RightPane } from "./_components/right-pane";

export default function CanvasLayout({ children }: { children: ReactNode }) {
  return (
    <SelectionProvider>
      <CategoriesProvider>
        <div className="flex flex-1 overflow-hidden h-[calc(100vh-37px)]">
          {/* Left rail — 200 px, category legend */}
          <aside className="w-[200px] shrink-0 border-r border-neutral-800 bg-neutral-950 flex flex-col overflow-y-auto">
            <LeftRail />
          </aside>

          {/* Middle — graph canvas fills all remaining space */}
          <main className="flex-1 overflow-hidden bg-neutral-950">
            {children}
          </main>

          {/* Right pane — 280 px, detail panel */}
          <aside className="w-[280px] shrink-0 border-l border-neutral-800 bg-neutral-950 flex flex-col overflow-y-auto">
            <RightPane />
          </aside>
        </div>
      </CategoriesProvider>
    </SelectionProvider>
  );
}
