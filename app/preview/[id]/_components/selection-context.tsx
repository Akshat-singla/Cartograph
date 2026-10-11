"use client";

// SelectionContext — shared state between the graph canvas and the right pane.
//
// Why a context rather than lifting state up further:
//   The layout is a server component and can't hold client state. The canvas
//   already uses this pattern (see categories-context.tsx). The provider lives
//   in layout.tsx, the canvas writes, and the pane reads.
//
// Shape:
//   selected    — the currently selected item: a file path, a dir path, or null
//   hovered     — the item currently hovered in the pane (path or null)
//   mapHovered  — the item currently hovered on the map (path or null)
//   analysis    — the full parse result, pumped in by the canvas so the pane
//                 can compute stats without a network call
//   setSelected — called by canvas when user clicks a node/file
//   setHovered  — called by pane when user hovers a neighbour path
//   setMapHovered — called by canvas when user hovers a node

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type { ParseResult } from "@/lib/parser/types";

// Serialisable ParseResult — fanIn/fanOut come back from JSON as plain objects
export type SerializedParseResult = Omit<ParseResult, "metrics"> & {
  metrics: {
    folderCount: number;
    fanIn: Record<string, number>;
    fanOut: Record<string, number>;
  };
};

interface SelectionContextValue {
  selected: string | null;
  hovered: string | null;
  mapHovered: string | null;
  analysis: SerializedParseResult | null;
  setSelected: (path: string | null) => void;
  setHovered: (path: string | null) => void;
  setMapHovered: (path: string | null) => void;
  setAnalysis: (a: SerializedParseResult) => void;
}

const SelectionContext = createContext<SelectionContextValue>({
  selected: null,
  hovered: null,
  mapHovered: null,
  analysis: null,
  setSelected: () => undefined,
  setHovered: () => undefined,
  setMapHovered: () => undefined,
  setAnalysis: () => undefined,
});

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [mapHovered, setMapHovered] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<SerializedParseResult | null>(null);

  return (
    <SelectionContext.Provider
      value={{
        selected,
        hovered,
        mapHovered,
        analysis,
        setSelected,
        setHovered,
        setMapHovered,
        setAnalysis,
      }}
    >
      {children}
    </SelectionContext.Provider>
  );
}

export function useSelection() {
  return useContext(SelectionContext);
}
