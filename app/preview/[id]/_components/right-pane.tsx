"use client";

// Right detail pane — phase 5.
//
// Default state (nothing selected): repo summary — name, framework, counts,
// most-imported files, entry-point files, skipped count.
//
// File selected: two tabs (Structure / Explanation). Structure shows path,
// kind, lines, fan-in/out counts and full neighbour lists. Explanation is an
// empty state for now.
//
// Folder selected: same two tabs, Structure lists file kinds inside the folder.
//
// All path clicks call setSelected so the map moves its selection.
// Hovering a neighbour path calls setHovered so the map highlights it.
// Both directions run through SelectionContext — no network calls.
//
// Which tab is open survives selection changes (stored in local state).

import { useMemo, useState } from "react";
import { useSelection } from "./selection-context";
import {
  computeRepoSummary,
  type RepoSummary,
  type FileDetail,
} from "@/lib/graph/repo-stats";
import { foldDirectories } from "@/lib/graph/fold";
import type { FileNode } from "@/lib/parser/types";

// ---------------------------------------------------------------------------
// Helpers

function basename(p: string): string {
  return p.split("/").pop() ?? p;
}

function ext(p: string): string {
  const b = basename(p);
  const i = b.lastIndexOf(".");
  return i > 0 ? b.slice(i) : "";
}

// Derive the repo root from file paths (same browser-safe logic as the canvas)
function deriveRoot(paths: string[]): string {
  if (paths.length === 0) return "/";
  function dirname(p: string): string {
    const i = p.lastIndexOf("/");
    return i <= 0 ? "/" : p.slice(0, i);
  }
  let prefix = dirname(paths[0]);
  for (const p of paths) {
    while (prefix !== "/" && !p.startsWith(prefix + "/")) {
      const i = prefix.lastIndexOf("/");
      prefix = i > 0 ? prefix.slice(0, i) : "/";
    }
  }
  return prefix;
}

// Display path relative to the repo root for readability
function relativePath(p: string, root: string): string {
  if (p.startsWith(root + "/")) return p.slice(root.length + 1);
  return p;
}

type TabId = "structure" | "explanation";

// ---------------------------------------------------------------------------
// Sub-components

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] uppercase tracking-widest text-neutral-500 px-3 pt-3 pb-1">
      {children}
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between items-baseline px-3 py-0.5">
      <span className="text-neutral-500 text-xs">{label}</span>
      <span className="text-neutral-200 text-xs tabular-nums font-mono">{value}</span>
    </div>
  );
}

interface PathRowProps {
  path: string;
  root: string;
  onSelect: () => void;
  onHoverEnter: () => void;
  onHoverLeave: () => void;
  highlighted?: boolean;
}

function PathRow({ path, root, onSelect, onHoverEnter, onHoverLeave, highlighted }: PathRowProps) {
  return (
    <div
      onClick={onSelect}
      onMouseEnter={onHoverEnter}
      onMouseLeave={onHoverLeave}
      className={`
        px-3 py-0.5 font-mono text-[11px] truncate cursor-pointer
        ${highlighted
          ? "bg-amber-900/30 text-amber-200"
          : "text-blue-400 hover:text-blue-200 hover:bg-neutral-800"}
      `}
      title={path}
    >
      {relativePath(path, root)}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Repo summary (default / deselected state)

function RepoSummaryPane({
  summary,
  root,
  onSelect,
  onHoverEnter,
  onHoverLeave,
  mapHovered,
}: {
  summary: RepoSummary;
  root: string;
  onSelect: (path: string) => void;
  onHoverEnter: (path: string) => void;
  onHoverLeave: () => void;
  mapHovered: string | null;
}) {
  return (
    <div className="flex flex-col">
      {/* Repo identity */}
      <div className="px-3 py-2 border-b border-neutral-800">
        <div className="font-mono text-sm text-neutral-100 truncate">{summary.repoName}</div>
        <div className="text-[11px] text-neutral-500 mt-0.5">{summary.framework}</div>
      </div>

      {/* Counts */}
      <SectionLabel>overview</SectionLabel>
      <StatRow label="files" value={summary.fileCount} />
      <StatRow label="imports" value={summary.importCount} />
      <StatRow label="resolved edges" value={summary.resolvedEdgeCount} />
      {summary.routeCount > 0 && (
        <StatRow label="routes" value={summary.routeCount} />
      )}
      {summary.skippedCount > 0 && (
        <StatRow label="skipped" value={summary.skippedCount} />
      )}

      {/* Most imported */}
      <SectionLabel>most depended on</SectionLabel>
      {summary.mostImported.map(({ file, fanIn }) => (
        <div
          key={file.path}
          onClick={() => onSelect(file.path)}
          onMouseEnter={() => onHoverEnter(file.path)}
          onMouseLeave={onHoverLeave}
          className={`
            flex items-baseline gap-2 px-3 py-0.5 cursor-pointer
            ${mapHovered === file.path
              ? "bg-amber-900/30"
              : "hover:bg-neutral-800"}
          `}
        >
          <span
            className="font-mono text-[11px] truncate flex-1 text-blue-400 hover:text-blue-200"
            title={file.path}
          >
            {relativePath(file.path, root)}
          </span>
          <span className="text-neutral-500 text-[10px] tabular-nums shrink-0">{fanIn}↓</span>
        </div>
      ))}

      {/* Entry files */}
      {summary.entryFiles.length > 0 && (
        <>
          <SectionLabel>where to start reading</SectionLabel>
          {summary.entryFiles.slice(0, 15).map((file) => (
            <PathRow
              key={file.path}
              path={file.path}
              root={root}
              onSelect={() => onSelect(file.path)}
              onHoverEnter={() => onHoverEnter(file.path)}
              onHoverLeave={onHoverLeave}
              highlighted={mapHovered === file.path}
            />
          ))}
          {summary.entryFiles.length > 15 && (
            <div className="px-3 py-0.5 text-[11px] text-neutral-600">
              +{summary.entryFiles.length - 15} more
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// File structure tab

function FileStructureTab({
  detail,
  root,
  onSelect,
  onHoverEnter,
  onHoverLeave,
  mapHovered,
}: {
  detail: FileDetail;
  root: string;
  onSelect: (path: string) => void;
  onHoverEnter: (path: string) => void;
  onHoverLeave: () => void;
  mapHovered: string | null;
}) {
  const relPath = relativePath(detail.file.path, root);
  return (
    <div className="flex flex-col">
      {/* File identity */}
      <div className="px-3 py-2 border-b border-neutral-800">
        <div className="font-mono text-[11px] text-neutral-300 break-all">{relPath}</div>
        <div className="text-[11px] text-neutral-500 mt-0.5">{ext(detail.file.path) || "file"}</div>
      </div>

      {/* Stats */}
      <SectionLabel>stats</SectionLabel>
      <StatRow label="lines" value={detail.file.lines} />
      <StatRow label="imports" value={detail.fanOut} />
      <StatRow label="imported by" value={detail.fanIn} />

      {/* Dependencies (what this file imports) */}
      {detail.dependencies.length > 0 && (
        <>
          <SectionLabel>imports ({detail.fanOut})</SectionLabel>
          {detail.dependencies.map((f) => (
            <PathRow
              key={f.path}
              path={f.path}
              root={root}
              onSelect={() => onSelect(f.path)}
              onHoverEnter={() => onHoverEnter(f.path)}
              onHoverLeave={onHoverLeave}
              highlighted={mapHovered === f.path}
            />
          ))}
        </>
      )}

      {/* Dependents (what imports this file) */}
      {detail.dependents.length > 0 && (
        <>
          <SectionLabel>imported by ({detail.fanIn})</SectionLabel>
          {detail.dependents.map((f) => (
            <PathRow
              key={f.path}
              path={f.path}
              root={root}
              onSelect={() => onSelect(f.path)}
              onHoverEnter={() => onHoverEnter(f.path)}
              onHoverLeave={onHoverLeave}
              highlighted={mapHovered === f.path}
            />
          ))}
        </>
      )}

      {detail.dependencies.length === 0 && detail.dependents.length === 0 && (
        <div className="px-3 py-2 text-[11px] text-neutral-600">No resolved edges.</div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Folder structure tab

function FolderStructureTab({
  dir,
  files,
  root,
  onSelect,
  onHoverEnter,
  onHoverLeave,
  mapHovered,
}: {
  dir: string;
  files: FileNode[];
  root: string;
  onSelect: (path: string) => void;
  onHoverEnter: (path: string) => void;
  onHoverLeave: () => void;
  mapHovered: string | null;
}) {
  // Count by extension
  const extMap = new Map<string, number>();
  for (const f of files) {
    const e = ext(f.path) || ".?";
    extMap.set(e, (extMap.get(e) ?? 0) + 1);
  }
  const byKind = [...extMap.entries()]
    .sort((a, b) => b[1] - a[1]);

  return (
    <div className="flex flex-col">
      {/* Folder identity */}
      <div className="px-3 py-2 border-b border-neutral-800">
        <div className="font-mono text-[11px] text-neutral-300 break-all">
          {relativePath(dir, root)}
        </div>
        <div className="text-[11px] text-neutral-500 mt-0.5">folder · {files.length} files</div>
      </div>

      {/* Kind breakdown */}
      <SectionLabel>file types</SectionLabel>
      {byKind.map(([e, count]) => (
        <StatRow key={e} label={e} value={count} />
      ))}

      {/* File list */}
      <SectionLabel>files</SectionLabel>
      {files.map((f) => (
        <PathRow
          key={f.path}
          path={f.path}
          root={root}
          onSelect={() => onSelect(f.path)}
          onHoverEnter={() => onHoverEnter(f.path)}
          onHoverLeave={onHoverLeave}
          highlighted={mapHovered === f.path}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab bar

function TabBar({
  active,
  onChange,
}: {
  active: TabId;
  onChange: (t: TabId) => void;
}) {
  return (
    <div className="flex border-b border-neutral-800 shrink-0">
      {(["structure", "explanation"] as TabId[]).map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`
            px-3 py-1.5 text-[10px] uppercase tracking-widest cursor-pointer
            ${active === t
              ? "text-neutral-100 border-b border-blue-500"
              : "text-neutral-500 hover:text-neutral-300"}
          `}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export

export function RightPane() {
  const { selected, mapHovered, analysis, setSelected, setHovered } = useSelection();

  // Which tab is open — survives selection changes
  const [activeTab, setActiveTab] = useState<TabId>("structure");

  const root = useMemo(
    () => (analysis ? deriveRoot(analysis.files.map((f) => f.path)) : "/"),
    [analysis],
  );

  const summary = useMemo(
    () => (analysis ? computeRepoSummary(analysis) : null),
    [analysis],
  );

  // Build fileToDir lookup for folder detection
  const { foldedNodes } = useMemo(() => {
    if (!analysis) return { foldedNodes: [] };
    const { nodes } = foldDirectories(
      analysis.files,
      analysis.edges,
      analysis.metrics.fanIn,
      analysis.metrics.fanOut,
      root,
    );
    return { foldedNodes: nodes };
  }, [analysis, root]);

  // Determine what is selected: a file, a folder node, or nothing
  const selectionKind: "file" | "folder" | "none" = useMemo(() => {
    if (!selected || !analysis) return "none";
    if (analysis.files.some((f) => f.path === selected)) return "file";
    if (foldedNodes.some((n) => n.dir === selected)) return "folder";
    return "none";
  }, [selected, analysis, foldedNodes]);

  const fileDetail = useMemo(() => {
    if (selectionKind !== "file" || !selected || !analysis) return null;
    const fileIndex = new Map(analysis.files.map((f) => [f.path, f]));
    const file = fileIndex.get(selected);
    if (!file) return null;
    const dependencies = analysis.edges
      .filter((e) => e.from === selected)
      .map((e) => fileIndex.get(e.to))
      .filter((f): f is FileNode => f !== undefined);
    const dependents = analysis.edges
      .filter((e) => e.to === selected)
      .map((e) => fileIndex.get(e.from))
      .filter((f): f is FileNode => f !== undefined);
    return {
      file,
      fanIn: analysis.metrics.fanIn[selected] ?? 0,
      fanOut: analysis.metrics.fanOut[selected] ?? 0,
      dependencies,
      dependents,
    };
  }, [selectionKind, selected, analysis]);

  const folderDetail = useMemo(() => {
    if (selectionKind !== "folder" || !selected) return null;
    const node = foldedNodes.find((n) => n.dir === selected);
    return node ?? null;
  }, [selectionKind, selected, foldedNodes]);

  if (!analysis || !summary) {
    // analysis arrives asynchronously from the canvas; show nothing until ready
    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="px-3 py-2 border-b border-neutral-800">
          <span className="text-neutral-600 text-xs">loading…</span>
        </div>
      </div>
    );
  }

  // Nothing selected — repo summary fills the pane
  if (selectionKind === "none") {
    return (
      <div className="flex flex-col flex-1 overflow-y-auto">
        <RepoSummaryPane
          summary={summary}
          root={root}
          onSelect={setSelected}
          onHoverEnter={setHovered}
          onHoverLeave={() => setHovered(null)}
          mapHovered={mapHovered}
        />
      </div>
    );
  }

  // Something selected — two-tab layout
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <TabBar active={activeTab} onChange={setActiveTab} />

      <div className="flex-1 overflow-y-auto">
        {activeTab === "structure" ? (
          selectionKind === "file" && fileDetail ? (
            <FileStructureTab
              detail={fileDetail}
              root={root}
              onSelect={setSelected}
              onHoverEnter={setHovered}
              onHoverLeave={() => setHovered(null)}
              mapHovered={mapHovered}
            />
          ) : selectionKind === "folder" && folderDetail ? (
            <FolderStructureTab
              dir={folderDetail.dir}
              files={folderDetail.files}
              root={root}
              onSelect={setSelected}
              onHoverEnter={setHovered}
              onHoverLeave={() => setHovered(null)}
              mapHovered={mapHovered}
            />
          ) : null
        ) : (
          // Explanation tab — empty state this phase
          <div className="px-3 py-4 text-[11px] text-neutral-600">
            Explanation will appear here once AI analysis is available.
          </div>
        )}
      </div>
    </div>
  );
}
