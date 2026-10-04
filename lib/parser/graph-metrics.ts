/**
 * Graph calculations: fan-in and fan-out.
 * Pure functions over file and edge lists.
 */

import type { Edge, FileNode } from './types';

/**
 * Calculate fan-in for each file (how many files import it).
 */
export function calculateFanIn(
  files: FileNode[],
  edges: Edge[]
): Map<string, number> {
  const fanIn = new Map<string, number>();

  // Initialize all files with 0
  for (const file of files) {
    fanIn.set(file.path, 0);
  }

  // Count incoming edges
  for (const edge of edges) {
    const current = fanIn.get(edge.to) ?? 0;
    fanIn.set(edge.to, current + 1);
  }

  return fanIn;
}

/**
 * Calculate fan-out for each file (how many files it imports).
 */
export function calculateFanOut(
  files: FileNode[],
  edges: Edge[]
): Map<string, number> {
  const fanOut = new Map<string, number>();

  // Initialize all files with 0
  for (const file of files) {
    fanOut.set(file.path, 0);
  }

  // Count outgoing edges
  for (const edge of edges) {
    const current = fanOut.get(edge.from) ?? 0;
    fanOut.set(edge.from, current + 1);
  }

  return fanOut;
}
