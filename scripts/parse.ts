#!/usr/bin/env tsx
/**
 * CLI command to run the parser against a directory.
 * Prints what it found and can write the result to a file.
 */

import * as path from 'path';
import * as fs from 'fs';
import { parseRepository } from '../lib/parser';
import type { ParseResult } from '../lib/parser';

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: tsx scripts/parse.ts <directory> [--output <file>]');
    console.error('');
    console.error('Examples:');
    console.error('  tsx scripts/parse.ts .');
    console.error('  tsx scripts/parse.ts . --output result.json');
    console.error('  tsx scripts/parse.ts /path/to/repo');
    process.exit(1);
  }

  const targetDir = path.resolve(args[0]);
  const outputIndex = args.indexOf('--output');
  const outputFile = outputIndex !== -1 ? args[outputIndex + 1] : null;

  if (outputIndex !== -1 && (!outputFile || outputFile.startsWith('--'))) {
    console.error('Error: --output requires a file path argument');
    console.error('Usage: tsx scripts/parse.ts <directory> [--output <file>]');
    process.exit(1);
  }

  if (!fs.existsSync(targetDir)) {
    console.error(`Directory not found: ${targetDir}`);
    process.exit(1);
  }

  console.log(`Parsing repository: ${targetDir}`);
  console.log('');

  const startTime = Date.now();
  const result = await parseRepository({ rootDir: targetDir });
  const elapsed = Date.now() - startTime;

  // Print summary
  printSummary(result, elapsed);

  // Write output file if requested
  if (outputFile) {
    writeOutput(result, outputFile);
  }
}

function printSummary(result: ParseResult, elapsed: number): void {
  const { files, edges, coverage, unresolved, skipped, metrics } = result;

  console.log('=== SUMMARY ===');
  console.log('');

  console.log('Files:');
  console.log(`  Found:   ${files.length}`);
  console.log(`  Skipped: ${skipped.length}`);
  console.log(`  Total:   ${files.length + skipped.length}`);
  console.log('');

  console.log('Folders:');
  console.log(`  Distinct folders: ${metrics.folderCount}`);
  console.log('');

  console.log('Imports:');
  console.log(`  Total seen:  ${coverage.totalImports}`);
  console.log(`  Resolved:    ${coverage.resolved}`);
  console.log(`  External:    ${coverage.external}`);
  console.log(`  Excluded:    ${coverage.excluded}`);
  console.log(`  Failed:      ${coverage.failed}`);
  console.log('');

  console.log('Edges:');
  console.log(`  Total (after dedup): ${edges.length}`);
  console.log(`  Import:              ${edges.filter(e => e.kind === 'import').length}`);
  console.log(`  Re-export:           ${edges.filter(e => e.kind === 're-export').length}`);
  console.log(`  Dynamic import:      ${edges.filter(e => e.kind === 'dynamic-import').length}`);
  console.log('');

  if (skipped.length > 0) {
    console.log('=== SKIPPED FILES ===');
    console.log('');

    // Group by reason
    const byReason = new Map<string, string[]>();
    for (const skip of skipped) {
      const list = byReason.get(skip.reason) || [];
      list.push(skip.path);
      byReason.set(skip.reason, list);
    }

    for (const [reason, paths] of byReason) {
      console.log(`${reason}: ${paths.length} files`);
      // Show first 3 examples
      for (const p of paths.slice(0, 3)) {
        console.log(`  ${p}`);
      }
      if (paths.length > 3) {
        console.log(`  ... and ${paths.length - 3} more`);
      }
      console.log('');
    }
  }

  if (unresolved.length > 0) {
    console.log('=== UNRESOLVED IMPORTS ===');
    console.log('');

    // Group by reason
    const byReason = new Map<string, typeof unresolved>();
    for (const u of unresolved) {
      const list = byReason.get(u.reason) || [];
      list.push(u);
      byReason.set(u.reason, list);
    }

    for (const [reason, imports] of byReason) {
      console.log(`${reason}: ${imports.length} imports`);
      // Show first 3 examples
      for (const imp of imports.slice(0, 3)) {
        console.log(`  ${imp.file}`);
        console.log(`    ${imp.example}`);
      }
      if (imports.length > 3) {
        console.log(`  ... and ${imports.length - 3} more`);
      }
      console.log('');
    }
  }

  console.log(`Completed in ${elapsed}ms`);
}

function writeOutput(result: ParseResult, outputPath: string): void {
  const output = {
    ...result,
    // Convert Maps to objects for JSON serialization
    metrics: {
      ...result.metrics,
      fanIn: Object.fromEntries(result.metrics.fanIn),
      fanOut: Object.fromEntries(result.metrics.fanOut),
    },
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
  console.log('');
  console.log(`Written to ${outputPath}`);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
