/**
 * Graph traversal — blast radius and dependency chain.
 *
 * Both are the same iterative BFS over the edge list with a direction
 * argument. Written once, called twice.
 *
 * No imports from Next, React, or the database.
 */

export interface TraversalEdge {
  from: string;
  to: string;
}

/**
 * Iterative BFS from `start` up to `depth` hops.
 *
 * direction="forward" follows edges from → to  (what does this file depend on?)
 * direction="reverse" follows edges to → from  (what depends on this file?)
 *
 * Returns every reachable path except `start` itself, in BFS order.
 */
function traverse(
  start: string,
  edges: TraversalEdge[],
  direction: "forward" | "reverse",
  depth: number,
): string[] {
  // Build adjacency list in the requested direction once.
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    const [from, to] = direction === "forward" ? [e.from, e.to] : [e.to, e.from];
    let list = adj.get(from);
    if (!list) { list = []; adj.set(from, list); }
    list.push(to);
  }

  const visited = new Set<string>([start]);
  const result: string[] = [];

  // BFS queue entries carry the current depth so we can stop exactly at limit.
  let queue: Array<{ node: string; d: number }> = [{ node: start, d: 0 }];

  while (queue.length > 0) {
    const next: Array<{ node: string; d: number }> = [];
    for (const { node, d } of queue) {
      if (d >= depth) continue;
      for (const neighbour of adj.get(node) ?? []) {
        if (!visited.has(neighbour)) {
          visited.add(neighbour);
          result.push(neighbour);
          next.push({ node: neighbour, d: d + 1 });
        }
      }
    }
    queue = next;
  }

  return result;
}

/**
 * Blast radius — every file that would break if `filePath` changed.
 * Follows edges in reverse (who imports me, transitively).
 * Default depth: 2.
 */
export function blastRadius(
  filePath: string,
  edges: TraversalEdge[],
  depth = 2,
): string[] {
  return traverse(filePath, edges, "reverse", depth);
}

/**
 * Dependency chain — everything this file needs to run.
 * Follows edges forward (what I import, transitively).
 * Default depth: 2.
 */
export function dependencyChain(
  filePath: string,
  edges: TraversalEdge[],
  depth = 2,
): string[] {
  return traverse(filePath, edges, "forward", depth);
}
