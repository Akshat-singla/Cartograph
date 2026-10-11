"use client";

// Provides file categories and the active category filter to the left rail
// and graph canvas.
//
// activeCategory is the `.ext` string of the currently-clicked category
// (e.g. ".tsx"), or null when nothing is filtered. Clicking the same
// category again clears the filter — toggle semantics.

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type { FileCategory } from "@/lib/graph/categories";

interface CategoriesContextValue {
  categories: FileCategory[];
  setCategories: (cats: FileCategory[]) => void;
  /** The `.ext` string of the active filter, or null */
  activeCategory: string | null;
  setActiveCategory: (name: string | null) => void;
}

const CategoriesContext = createContext<CategoriesContextValue>({
  categories: [],
  setCategories: () => undefined,
  activeCategory: null,
  setActiveCategory: () => undefined,
});

export function CategoriesProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<FileCategory[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  return (
    <CategoriesContext.Provider
      value={{ categories, setCategories, activeCategory, setActiveCategory }}
    >
      {children}
    </CategoriesContext.Provider>
  );
}

export function useCategories() {
  return useContext(CategoriesContext);
}
