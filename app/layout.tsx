import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";
import { AuthNav } from "./_components/auth-nav";
import { ThemeProvider } from "./_components/theme-provider";
import { ThemeToggle } from "./_components/theme-toggle";

// Monospace for the whole app — file paths, identifiers and graph labels
// all want mono. Geist Mono is the project font.
const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cartograph",
  description: "Dependency map for your codebase.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning: the inline theme script mutates the class
    // before React hydrates, which would otherwise cause a mismatch warning.
    <html
      lang="en"
      className={`${geistMono.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="h-full bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100 antialiased font-mono flex flex-col">
        <ClerkProvider>
          <ThemeProvider>
            {/* Global header — 37px fixed height, referenced by dashboard layout */}
            <header className="h-[37px] shrink-0 flex items-center justify-between px-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
              <span className="text-neutral-500 dark:text-neutral-400 text-xs tracking-tight">
                cartograph
              </span>
              <div className="flex items-center gap-3">
                <ThemeToggle />
                <AuthNav />
              </div>
            </header>
            <div className="flex flex-col flex-1 overflow-hidden">
              {children}
            </div>
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
