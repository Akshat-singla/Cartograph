"use client";

// FoldedNode — a directory shown as a single compact box.
// Height encodes fan-in: base 36px + 1px per fan-in point, capped at 120px.
// Width is fixed; the label is the shortest unique string (computed upstream).
// Clicking opens the node into a PanelNode.

import { Handle, Position, type NodeProps } from "@xyflow/react";

export interface FoldedNodeData extends Record<string, unknown> {
  label: string;
  fileCount: number;
  fanIn: number;
  fanOut: number;
  /** Called by the canvas to open this node */
  onOpen: () => void;
  selected: boolean;
  dimmed: boolean;
  /** Highlighted from the pane hovering a neighbour that maps to this dir */
  highlighted: boolean;
  /** Called on mouse enter/leave so the map can push to the pane */
  onHoverEnter: () => void;
  onHoverLeave: () => void;
}

export type FoldedNodeType = {
  id: string;
  type: "folded";
  position: { x: number; y: number };
  data: FoldedNodeData;
};

// Height: base 36 + 1px per fan-in unit, clamped 36–120
export function foldedHeight(fanIn: number): number {
  return Math.min(120, Math.max(36, 36 + fanIn));
}

export const NODE_WIDTH = 160;

export function FoldedNode({ data }: NodeProps) {
  const d = data as FoldedNodeData;
  const h = foldedHeight(d.fanIn);

  return (
    <div
      onClick={d.onOpen}
      onMouseEnter={d.onHoverEnter}
      onMouseLeave={d.onHoverLeave}
      className="cursor-pointer"
      style={{ width: NODE_WIDTH, height: h, opacity: d.dimmed ? 0.2 : 1 }}
    >
      <Handle type="target" position={Position.Left} className="!bg-green-500 !w-1.5 !h-1.5 !border-0" />

      <div
        className={`
          flex flex-col justify-center px-2 h-full rounded
          border font-mono text-xs select-none
          ${d.selected
            ? "border-blue-500 bg-neutral-800 text-neutral-100"
            : d.highlighted
              ? "border-amber-500 bg-neutral-800 text-neutral-100"
              : "border-neutral-700 bg-neutral-900 text-neutral-300 hover:border-neutral-500"}
        `}
      >
        <span className="truncate leading-tight">{d.label}</span>
        <span className="text-neutral-500 text-[10px] tabular-nums mt-0.5">
          {d.fileCount}f · {d.fanIn}↓ {d.fanOut}↑
        </span>
      </div>

      <Handle type="source" position={Position.Right} className="!bg-amber-500 !w-1.5 !h-1.5 !border-0" />
    </div>
  );
}
