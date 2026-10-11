"use client";

// Provides file categories, the active category filter, framework key, and
// file-role map to the left rail and graph canvas.
//
// activeCategory is the category name string of the currently-clicked category,
// or null when nothing is filtered. Clicking the same category again clears
// the filter — toggle semantics.
//
// framework: the detected framework key pushed by GraphCanvas on mount.
// fileRoles: path → role map pushed by GraphCanvas on mount.

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
  /** The category name string of the active filter, or null */
  activeCategory: string | null;
  setActiveCategory: (name: string | null) => void;
  /** Detected framework key: "nextjs" | "nestjs" | "react" | "generic" */
  framework: string;
  setFramework: (fw: string) => void;
  /** Maps file path → adapter role string (e.g. "Page route", "Service") */
  fileRoles: Record<string, string>;
  setFileRoles: (roles: Record<string, string>) => void;
}

const CategoriesContext = createContext<CategoriesContextValue>({
  categories: [],
  setCategories: () => undefined,
  activeCategory: null,
  setActiveCategory: () => undefined,
  framework: "generic",
  setFramework: () => undefined,
  fileRoles: {},
  setFileRoles: () => undefined,
});

export function CategoriesProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<FileCategory[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [framework, setFramework] = useState<string>("generic");
  const [fileRoles, setFileRoles] = useState<Record<string, string>>({});

  return (
    <CategoriesContext.Provider
      value={{
        categories,
        setCategories,
        activeCategory,
        setActiveCategory,
        framework,
        setFramework,
        fileRoles,
        setFileRoles,
      }}
    >
      {children}
    </CategoriesContext.Provider>
  );
}

export function useCategories() {
  return useContext(CategoriesContext);
}
