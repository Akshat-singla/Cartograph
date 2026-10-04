#!/usr/bin/env tsx
/**
 * Verify that parser output can be read back and types hold.
 */

import * as fs from 'fs';
import type { ParseResult } from '../lib/parser';

const inputFile = process.argv[2];

if (!inputFile) {
  console.error('Usage: tsx scripts/verify-output.ts <json-file>');
  process.exit(1);
}

try {
  const content = fs.readFileSync(inputFile, 'utf-8');
  const data = JSON.parse(content);

  // Verify structure matches ParseResult
  const result: ParseResult = {
    files: data.files,
    edges: data.edges,
    coverage: data.coverage,
    unresolved: data.unresolved,
    skipped: data.skipped,
    metrics: {
      folderCount: data.metrics.folderCount,
      // Convert back from plain objects to Maps
      fanIn: new Map(Object.entries(data.metrics.fanIn)),
      fanOut: new Map(Object.entries(data.metrics.fanOut)),
    },
  };

  // Validate required fields
  if (!Array.isArray(result.files)) throw new Error('files must be array');
  if (!Array.isArray(result.edges)) throw new Error('edges must be array');
  if (typeof result.coverage !== 'object') throw new Error('coverage must be object');
  if (!Array.isArray(result.unresolved)) throw new Error('unresolved must be array');
  if (!Array.isArray(result.skipped)) throw new Error('skipped must be array');
  if (typeof result.metrics !== 'object') throw new Error('metrics must be object');

  // Validate file structure
  for (const file of result.files) {
    if (typeof file.path !== 'string') throw new Error('file.path must be string');
    if (typeof file.folder !== 'string') throw new Error('file.folder must be string');
    if (typeof file.lines !== 'number') throw new Error('file.lines must be number');
    if (typeof file.hash !== 'string') throw new Error('file.hash must be string');
    if (typeof file.module !== 'string') throw new Error('file.module must be string');
  }

  // Validate edge structure
  for (const edge of result.edges) {
    if (typeof edge.from !== 'string') throw new Error('edge.from must be string');
    if (typeof edge.to !== 'string') throw new Error('edge.to must be string');
    if (!['import', 're-export', 'dynamic-import'].includes(edge.kind)) {
      throw new Error('edge.kind must be valid');
    }
  }

  console.log('✓ Types hold');
  console.log(`✓ Read ${result.files.length} files`);
  console.log(`✓ Read ${result.edges.length} edges`);
  console.log(`✓ Read ${result.unresolved.length} unresolved imports`);
  console.log(`✓ Read ${result.skipped.length} skipped files`);
  console.log(`✓ Fan-in map has ${result.metrics.fanIn.size} entries`);
  console.log(`✓ Fan-out map has ${result.metrics.fanOut.size} entries`);
  console.log('');
  console.log('All checks passed!');
} catch (err) {
  console.error('✗ Verification failed:', err);
  process.exit(1);
}
