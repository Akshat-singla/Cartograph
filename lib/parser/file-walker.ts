/**
 * File discovery and categorization.
 * Decides which files become nodes in the graph.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type { FileNode } from './types';

const SUPPORTED_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts'];

export interface WalkOptions {
  /** Root directory to walk */
  rootDir: string;
  /** Directories to exclude */
  excludeDirs?: string[];
}

export interface WalkResult {
  files: FileNode[];
  skipped: Array<{ path: string; reason: string }>;
}

/**
 * Walk a directory and collect all source files.
 * Structural selection: we keep whole directories or exclude them entirely.
 */
export function walkDirectory(options: WalkOptions): WalkResult {
  const { rootDir, excludeDirs = ['node_modules', '.next', '.git', 'dist', 'build', 'out'] } = options;

  const files: FileNode[] = [];
  const skipped: Array<{ path: string; reason: string }> = [];

  function walk(dir: string): void {
    let entries: fs.Dirent[];

    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (err) {
      skipped.push({ path: dir, reason: `Cannot read directory: ${err}` });
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Check if this directory should be excluded
        if (excludeDirs.includes(entry.name)) {
          skipped.push({ path: fullPath, reason: 'Excluded directory' });
          continue;
        }
        walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);

        if (!SUPPORTED_EXTENSIONS.includes(ext)) {
          skipped.push({ path: fullPath, reason: `Unsupported extension: ${ext}` });
          continue;
        }

        // Don't parse type definition files
        if (entry.name.endsWith('.d.ts')) {
          skipped.push({ path: fullPath, reason: 'Type definition file' });
          continue;
        }

        // Don't parse test files
        if (isTestFile(entry.name)) {
          skipped.push({ path: fullPath, reason: 'Test file' });
          continue;
        }

        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const lines = content.split('\n').length;
          const hash = crypto.createHash('sha256').update(content).digest('hex').slice(0, 8);
          const folder = path.dirname(fullPath);
          const modulePath = fullPath.replace(rootDir, '').replace(/^\//, '');

          files.push({
            path: fullPath,
            folder,
            lines,
            hash,
            module: modulePath,
          });
        } catch (err) {
          skipped.push({ path: fullPath, reason: `Cannot read file: ${err}` });
        }
      }
    }
  }

  walk(rootDir);

  return { files, skipped };
}

function isTestFile(filename: string): boolean {
  return (
    filename.endsWith('.test.ts') ||
    filename.endsWith('.test.tsx') ||
    filename.endsWith('.test.js') ||
    filename.endsWith('.test.jsx') ||
    filename.endsWith('.spec.ts') ||
    filename.endsWith('.spec.tsx') ||
    filename.endsWith('.spec.js') ||
    filename.endsWith('.spec.jsx')
  );
}

/**
 * Count distinct folders in a file list.
 */
export function countFolders(files: FileNode[]): number {
  const folders = new Set(files.map(f => f.folder));
  return folders.size;
}
