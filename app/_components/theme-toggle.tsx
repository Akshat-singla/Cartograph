"use client";

import { useTheme, type ThemeMode } from "./theme-provider";

const OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export function ThemeToggle() {
  const { mode, setMode } = useTheme();

  return (
    <div className="flex items-center gap-0.5 rounded border border-neutral-700 bg-neutral-900 p-0.5">
      {OPTIONS.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => setMode(value)}
          className={`px-2 py-0.5 rounded text-xs font-mono transition-colors ${
            mode === value
              ? "bg-neutral-700 text-white"
              : "text-neutral-500 hover:text-neutral-300"
          }`}
          aria-pressed={mode === value}
          aria-label={`${label} theme`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
