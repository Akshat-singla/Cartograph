"use client";

// Graph canvas — phase 5 update.
// Changes from phase 4:
//   - selected and mapHovered state are now in SelectionContext so the right
//     pane can read selection and write hover without a prop chain.
//   - analysis is pushed into SelectionContext on mount so the pane can derive
//     stats without a network call.
//   - FoldedNode and PanelNode receive hover callbacks (onHoverEnter/Leave,
//     onFileHoverEnter/Leave) that write mapHovered into context.
//   - Nodes also receive a highlighted prop driven by context.hovered so the
//     pane can highlight a neighbour on the map by hovering it.

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge as RFEdge,
  type NodeTypes,
  type FitViewOptions,
} from "@xyflow/react";
// React Flow styles are imported globally in app/globals.css

import { foldDirectories, shortestUniqueLabels } from "@/lib/graph/fold";
import { computeLayout } from "@/lib/graph/layout";
import { buildCategories } from "@/lib/graph/categories";
import { useCategories } from "./categories-context";
import { useSelection, type SerializedParseResult } from "./selection-context";
import {
  FoldedNode,
  foldedHeight,
  NODE_WIDTH,
  type FoldedNodeData,
} from "./node-folded";
import {
  PanelNode,
  panelHeight,
  PANEL_WIDTH,
  type PanelNodeData,
} from "./node-panel";
import { useState } from "react";

// ---------------------------------------------------------------------------
// Types

type AppNode = Node<FoldedNodeData | PanelNodeData, "folded" | "panel">;
type AppEdge = RFEdge;

const NODE_TYPES: NodeTypes = {
  folded: FoldedNode as NodeTypes[string],
  panel: PanelNode as NodeTypes[string],
};

// ---------------------------------------------------------------------------
// Browser-safe path helpers (no Node.js 'path' module in client components)

function dirname(p: string): string {
  const i = p.lastIndexOf("/");
  if (i <= 0) return "/";
  return p.slice(0, i);
}

/** Derive the repo root from file paths (common ancestor directory) */
function deriveRoot(paths: string[]): string {
  if (paths.length === 0) return "/";
  let prefix = dirname(paths[0]);
  for (const p of paths) {
    while (prefix !== "/" && !p.startsWith(prefix + "/")) {
      prefix = dirname(prefix);
    }
  }
  return prefix;
}

// ---------------------------------------------------------------------------
// Inner component (needs ReactFlowProvider above it for useReactFlow)

function CanvasInner({ analysis }: { analysis: SerializedParseResult }) {
  const { fitView, getViewport } = useReactFlow<AppNode, AppEdge>();
  const { setCategories } = useCategories();
  const {
    selected,
    hovered,
    setSelected,
    setMapHovered,
    setAnalysis,
  } = useSelection();

  // Track which directories are open (expanded into panels)
  const [openDirs, setOpenDirs] = useState<Set<string>>(new Set());

  // Push categories and analysis into context on mount / when analysis changes
  useEffect(() => {
    setCategories(buildCategories(analysis.files.map((f) => f.path)));
  }, [analysis, setCategories]);

  useEffect(() => {
    setAnalysis(analysis);
  }, [analysis, setAnalysis]);

  // Fold the data
  const rootDir = useMemo(
    () => deriveRoot(analysis.files.map((f) => f.path)),
    [analysis],
  );

  const { nodes: foldedNodes } = useMemo(
    () =>
      foldDirectories(
        analysis.files,
        analysis.edges,
        analysis.metrics.fanIn,
        analysis.metrics.fanOut,
        rootDir,
      ),
    [analysis, rootDir],
  );

  // Unique labels
  const labels = useMemo(
    () => shortestUniqueLabels(foldedNodes.map((n) => n.dir)),
    [foldedNodes],
  );

  // Build a lookup: file path → which foldedNode dir contains it
  const fileToDir = useMemo(() => {
    const m = new Map<string, string>();
    for (const fn of foldedNodes) {
      for (const f of fn.files) m.set(f.path, fn.dir);
    }
    return m;
  }, [foldedNodes]);

  // Build set of file paths for quick edge filtering
  const filePaths = useMemo(
    () => new Set(analysis.files.map((f) => f.path)),
    [analysis],
  );

  // Resolve the hovered path from the pane to a dir (so we can highlight it on
  // the map). hovered can be a file path or a dir path.
  const hoveredDir = useMemo((): string | null => {
    if (!hovered) return null;
    return fileToDir.get(hovered) ?? (foldedNodes.some((n) => n.dir === hovered) ? hovered : null);
  }, [hovered, fileToDir, foldedNodes]);

  // ---- Build React Flow nodes and edges ----

  const buildGraph = useCallback((): { rfNodes: AppNode[]; rfEdges: AppEdge[] } => {
    // Compute dimensions for layout
    const layoutNodes = foldedNodes.map((fn) => {
      const isOpen = openDirs.has(fn.dir);
      return {
        id: fn.dir,
        width: isOpen ? PANEL_WIDTH : NODE_WIDTH,
        height: isOpen ? panelHeight(fn.files.length) : foldedHeight(fn.fanIn),
      };
    });

    // Collapse edges: map each edge to its (source dir, target dir) pair
    const edgeSet = new Set<string>();
    const layoutEdges: { source: string; target: string }[] = [];
    for (const e of analysis.edges) {
      const fromDir = fileToDir.get(e.from);
      const toDir = fileToDir.get(e.to);
      if (!fromDir || !toDir || fromDir === toDir) continue;
      const key = `${fromDir}→${toDir}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        layoutEdges.push({ source: fromDir, target: toDir });
      }
    }

    const { positions } = computeLayout(layoutNodes, layoutEdges, "LR");

    // ---- Selection geometry ----
    // Resolve the selected item to a dir.
    const selectedDir: string | null = selected
      ? (fileToDir.get(selected) ?? selected)
      : null;

    // Edges that directly touch the selected dir.
    const litEdgeSet = new Set<string>();
    // Dirs that should be bright: the selected dir + the other end of every lit edge.
    const litDirs = new Set<string>();

    if (selectedDir !== null) {
      litDirs.add(selectedDir);
      for (const e of layoutEdges) {
        if (e.source === selectedDir || e.target === selectedDir) {
          litEdgeSet.add(`${e.source}→${e.target}`);
          litDirs.add(e.source);
          litDirs.add(e.target);
        }
      }
    }

    const dimming = selected !== null;

    // Build RF nodes
    const rfNodes: AppNode[] = foldedNodes.map((fn) => {
      const pos = positions.get(fn.dir) ?? { x: 0, y: 0 };
      const label = labels.get(fn.dir) ?? fn.dir.split("/").pop() ?? fn.dir;
      const isOpen = openDirs.has(fn.dir);
      const dimmed = dimming && !litDirs.has(fn.dir);
      // A node is highlighted when the pane is hovering a neighbour that maps to this dir
      const highlighted = hoveredDir === fn.dir;

      if (isOpen) {
        // Determine which file row (if any) should be highlighted from pane hover
        const highlightedFile =
          hovered && filePaths.has(hovered) && fileToDir.get(hovered) === fn.dir
            ? hovered
            : null;

        const panelData: PanelNodeData = {
          label,
          files: fn.files,
          fanIn: fn.fanIn,
          fanOut: fn.fanOut,
          onClose: () =>
            setOpenDirs((prev) => {
              const n = new Set(prev);
              n.delete(fn.dir);
              return n;
            }),
          selectedFile: filePaths.has(selected ?? "") ? selected : null,
          onSelectFile: (p) => setSelected(selected === p ? null : p),
          dimmed,
          highlighted,
          highlightedFile,
          onHoverEnter: () => setMapHovered(fn.dir),
          onHoverLeave: () => setMapHovered(null),
          onFileHoverEnter: (p) => setMapHovered(p),
          onFileHoverLeave: () => setMapHovered(null),
        };
        return {
          id: fn.dir,
          type: "panel" as const,
          position: pos,
          data: panelData,
          draggable: false,
          selectable: false,
        };
      } else {
        const foldedData: FoldedNodeData = {
          label,
          fileCount: fn.files.length,
          fanIn: fn.fanIn,
          fanOut: fn.fanOut,
          onOpen: () => {
            setOpenDirs((prev) => new Set([...prev, fn.dir]));
            setSelected(fn.dir);
          },
          selected: selected === fn.dir,
          dimmed,
          highlighted,
          onHoverEnter: () => setMapHovered(fn.dir),
          onHoverLeave: () => setMapHovered(null),
        };
        return {
          id: fn.dir,
          type: "folded" as const,
          position: pos,
          data: foldedData,
          draggable: false,
          selectable: false,
        };
      }
    });

    // Build RF edges — lit edges are full opacity, rest are hidden
    const rfEdges: AppEdge[] = layoutEdges.map(({ source, target }, i) => {
      const key = `${source}→${target}`;
      const lit = !dimming || litEdgeSet.has(key);
      return {
        id: `e-${i}`,
        source,
        target,
        style: {
          stroke: lit ? "#737373" : "#262626",
          strokeWidth: lit ? 1.5 : 1,
          opacity: lit ? 1 : 0.15,
        },
        animated: false,
      };
    });

    return { rfNodes, rfEdges };
  }, [
    foldedNodes,
    openDirs,
    selected,
    labels,
    fileToDir,
    filePaths,
    analysis.edges,
    hovered,
    hoveredDir,
    setSelected,
    setMapHovered,
  ]);

  const { rfNodes, rfEdges } = useMemo(() => buildGraph(), [buildGraph]);

  const [nodes, setNodes, onNodesChange] = useNodesState<AppNode>(rfNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<AppEdge>(rfEdges);

  // Sync whenever fold state, selection or hover changes
  const prevOpenRef = useRef(openDirs);
  useEffect(() => {
    const { rfNodes: newNodes, rfEdges: newEdges } = buildGraph();
    setNodes(newNodes);
    setEdges(newEdges);

    // Refit only when opening a new panel — and only zoom out, never in
    const wasOpened = openDirs.size > prevOpenRef.current.size;
    if (wasOpened) {
      const currentZoom = getViewport().zoom;
      const opts: FitViewOptions<AppNode> = {
        maxZoom: currentZoom,
        duration: 0,
        padding: 0.1,
      };
      requestAnimationFrame(() => fitView(opts));
    }
    prevOpenRef.current = openDirs;
  }, [buildGraph, openDirs, setNodes, setEdges, fitView, getViewport]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={NODE_TYPES}
      fitView
      fitViewOptions={{ padding: 0.1 }}
      minZoom={0.05}
      maxZoom={2}
      selectionOnDrag={false}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      onPaneClick={() => setSelected(null)}
      proOptions={{ hideAttribution: true }}
      colorMode="dark"
    />
  );
}

// ---------------------------------------------------------------------------
// Exported component — wraps the inner with the ReactFlow provider

export function GraphCanvas({ analysis }: { analysis: SerializedParseResult }) {
  return (
    <ReactFlowProvider>
      <div className="w-full h-full">
        <CanvasInner analysis={analysis} />
      </div>
    </ReactFlowProvider>
  );
}
