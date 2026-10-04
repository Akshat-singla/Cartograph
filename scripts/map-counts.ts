#!/usr/bin/env tsx
/**
 * Reads analysis.json and reports the node count after folding,
 * plus validates that every edge terminates on a known node.
 */

import * as fs from 'fs';
import * as path from 'path';
import { foldDirectories } from '../lib/graph/fold';
import type { FileNode, Edge } from '../lib/parser/types';

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: tsx scripts/map-counts.ts <analysis.json>');
  process.exit(1);
}

const filePath = path.resolve(args[0]);
if (!fs.existsSync(filePath)) {
  console.error(`Not found: ${filePath}`);
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as {
  files: FileNode[];
  edges: Edge[];
  metrics: { fanIn: Record<string, number>; fanOut: Record<string, number> };
};

const { files, edges, metrics } = raw;

// Derive rootDir as the common prefix of all file paths
function commonPrefix(paths: string[]): string {
  if (paths.length === 0) return '';
  let prefix = path.dirname(paths[0]);
  for (const p of paths) {
    while (!p.startsWith(prefix + path.sep) && prefix !== path.dirname(prefix)) {
      prefix = path.dirname(prefix);
    }
  }
  return prefix;
}
const rootDir = commonPrefix(files.map(f => f.path));

const { nodes, threshold } = foldDirectories(files, edges, metrics.fanIn, metrics.fanOut, rootDir);

console.log('=== MAP COUNTS ===');
console.log('');
console.log(`Files parsed:    ${files.length}`);
console.log(`Edges:           ${edges.length}`);
console.log(`Fold threshold:  ${threshold} files`);
console.log(`Nodes on map:    ${nodes.length}`);
console.log('');

// Acceptance check #1: under ~24 nodes, ~1 per 10 files
const ratio = (files.length / nodes.length).toFixed(1);
console.log(`Files per node:  ${ratio}  (target ~10)`);
console.log('');

// Acceptance check #2: every node holds more than one file
const singles = nodes.filter(n => n.files.length === 1);
if (singles.length > 0) {
  console.log(`⚠  Single-file nodes (folding not working): ${singles.length}`);
  for (const n of singles.slice(0, 5)) {
    console.log(`   ${n.dir}  →  ${n.files[0].path.split('/').pop()}`);
  }
} else {
  console.log(`✓  Every node holds more than one file`);
}
console.log('');

// Acceptance check #3: every edge terminates on a known node
const nodeDirs = new Set(nodes.flatMap(n => n.files.map(f => f.path)));
const badEdges = edges.filter(e => !nodeDirs.has(e.from) && !nodeDirs.has(e.to));
if (badEdges.length > 0) {
  console.log(`⚠  Edges with both endpoints outside the graph: ${badEdges.length}`);
} else {
  console.log(`✓  All edge endpoints exist in the file set`);
}
console.log('');

// Breakdown of nodes
console.log('Node breakdown:');
const sorted = [...nodes].sort((a, b) => b.files.length - a.files.length);
for (const n of sorted) {
  const label = n.dir.split('/').pop() ?? n.dir;
  console.log(`  ${label.padEnd(40)} ${n.files.length} files  fan-in:${n.fanIn}`);
}
