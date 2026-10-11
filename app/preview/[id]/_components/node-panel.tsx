"use client";

// PanelNode — an open directory rendered as a bordered panel.
// Files appear as scrollable rows inside the box. Edges connect to individual
// file rows via sub-handles keyed by file path.
// Clicking the header closes it back to a FoldedNode.
//
// Scrolling: React Flow intercepts wheel events for canvas zoom/pan.
// The "nowheel" class on the scroll container tells React Flow to leave
// those events alone so the list scrolls normally.

import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { FileNode } from "@/lib/parser/types";

// Row height in px
export const ROW_H = 22;
// Panel header height
export const HEADER_H = 36;
// Panel width
export const PANEL_WIDTH = 220;
// Max height of the scrollable file list
const MAX_LIST_HEIGHT = ROW_H * 14; // ~14 rows visible before scrolling

export function panelHeight(fileCount: number): number {
  const listHeight = Math.min(fileCount * ROW_H, MAX_LIST_HEIGHT);
  return HEADER_H + listHeight + 2; // +2 for bottom border rounding
}

export interface PanelNodeData extends Record<string, unknown> {
  label: string;
  files: FileNode[];
  fanIn: number;
  fanOut: number;
  onClose: () => void;
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
  dimmed: boolean;
  /** File path currently highlighted via pane hover */
  highlightedFile: string | null;
  /** Highlighted because pane is hovering a neighbour that maps to this dir */
  highlighted: boolean;
  /** Called on mouse enter/leave of the panel header (dir-level hover) */
  onHoverEnter: () => void;
  onHoverLeave: () => void;
  /** Called on mouse enter/leave of a file row */
  onFileHoverEnter: (path: string) => void;
  onFileHoverLeave: () => void;
}

export type PanelNodeType = {
  id: string;
  type: "panel";
  position: { x: number; y: number };
  data: PanelNodeData;
};

export function PanelNode({ data, id }: NodeProps) {
  const d = data as PanelNodeData;

  return (
    <div
      style={{ width: PANEL_WIDTH, opacity: d.dimmed ? 0.2 : 1 }}
      className="font-mono text-xs rounded border border-neutral-600 bg-neutral-900 select-none overflow-hidden flex flex-col"
    >
      {/* Target handle on the panel itself */}
      <Handle
        type="target"
        position={Position.Left}
        id={`${id}__in`}
        className="!bg-green-500 !w-1.5 !h-1.5 !border-0"
      />

      {/* Header — clicking closes the panel */}
      <div
        onClick={d.onClose}
        onMouseEnter={d.onHoverEnter}
        onMouseLeave={d.onHoverLeave}
        className={`flex items-center gap-2 px-2 cursor-pointer border-b border-neutral-700 shrink-0
          ${d.highlighted ? "bg-amber-900/40 hover:bg-amber-900/60" : "bg-neutral-800 hover:bg-neutral-700"}`}
        style={{ height: HEADER_H }}
      >
        <span className="flex-1 truncate text-neutral-100">{d.label}</span>
        <span className="text-neutral-500 text-[10px] tabular-nums shrink-0">
          {d.files.length}f · {d.fanIn}↓ {d.fanOut}↑
        </span>
      </div>

      {/* File list — scrollable.
          "nowheel" tells React Flow not to intercept wheel events here
          so the OS scroll behaviour works normally. */}
      <div
        className="nowheel overflow-y-auto"
        style={{ maxHeight: MAX_LIST_HEIGHT }}
      >
        {d.files.map((f) => {
          const name = f.path.split("/").pop() ?? f.path;
          const isSelected = d.selectedFile === f.path;
          const isHighlighted = d.highlightedFile === f.path;
          return (
            <div
              key={f.path}
              onClick={() => d.onSelectFile(f.path)}
              onMouseEnter={() => d.onFileHoverEnter(f.path)}
              onMouseLeave={d.onFileHoverLeave}
              className={`
                relative flex items-center px-2 cursor-pointer
                ${isSelected
                  ? "bg-blue-900/50 text-blue-200"
                  : isHighlighted
                    ? "bg-amber-900/40 text-amber-200"
                    : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
                }
              `}
              style={{ height: ROW_H }}
            >
              {/* Per-file handles so edges can connect to rows */}
              <Handle
                type="target"
                position={Position.Left}
                id={`${id}__${f.path}__in`}
                style={{ top: ROW_H / 2 }}
                className="!bg-green-500 !w-1 !h-1 !border-0"
              />
              <span className="truncate">{name}</span>
              <Handle
                type="source"
                position={Position.Right}
                id={`${id}__${f.path}__out`}
                style={{ top: ROW_H / 2 }}
                className="!bg-amber-500 !w-1 !h-1 !border-0"
              />
            </div>
          );
        })}
      </div>

      {/* Source handle on the panel */}
      <Handle
        type="source"
        position={Position.Right}
        id={`${id}__out`}
        className="!bg-amber-500 !w-1.5 !h-1.5 !border-0"
      />
    </div>
  );
}
