/**
 * Dagre layout — pure function.
 * Takes a list of nodes (with widths/heights) and edges, returns positions.
 * Deterministic: same input → same positions every time.
 */

import dagre from '@dagrejs/dagre';

export interface LayoutNode {
  id: string;
  width: number;
  height: number;
}

export interface LayoutEdge {
  source: string;
  target: string;
}

export interface LayoutResult {
  positions: Map<string, { x: number; y: number }>;
  graphWidth: number;
  graphHeight: number;
}

export function computeLayout(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  direction: 'TB' | 'LR' = 'LR',
): LayoutResult {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: direction, ranksep: 80, nodesep: 40, marginx: 40, marginy: 40 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const n of nodes) {
    g.setNode(n.id, { width: n.width, height: n.height });
  }
  for (const e of edges) {
    // dagre silently ignores edges to unknown nodes, so we only add valid ones
    if (g.hasNode(e.source) && g.hasNode(e.target) && e.source !== e.target) {
      g.setEdge(e.source, e.target);
    }
  }

  dagre.layout(g);

  const positions = new Map<string, { x: number; y: number }>();
  for (const id of g.nodes()) {
    const n = g.node(id);
    // Dagre returns center coordinates; React Flow wants top-left
    positions.set(id, { x: n.x - n.width / 2, y: n.y - n.height / 2 });
  }

  const graph = g.graph();
  return {
    positions,
    graphWidth: graph.width ?? 0,
    graphHeight: graph.height ?? 0,
  };
}
