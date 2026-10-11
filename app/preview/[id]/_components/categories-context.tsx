"use client";

// Provides file categories to the left rail from the page that loaded the data.
// The layout can't receive data props, so the page pumps categories in via context.

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
}

const CategoriesContext = createContext<CategoriesContextValue>({
  categories: [],
  setCategories: () => undefined,
});

export function CategoriesProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<FileCategory[]>([]);
  return (
    <CategoriesContext.Provider value={{ categories, setCategories }}>
      {children}
    </CategoriesContext.Provider>
  );
}

export function useCategories() {
  return useContext(CategoriesContext);
}
