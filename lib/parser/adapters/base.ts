/**
 * Framework adapter interface and fallback implementation.
 * The fallback assumes no framework at all.
 */

import type { FrameworkAdapter } from '../types';

/**
 * Fallback adapter: no framework-specific knowledge.
 * Just walks the entire directory.
 */
export class FallbackAdapter implements FrameworkAdapter {
  findEntryPoints(_rootDir: string): string[] {
    // No entry points - we'll walk everything
    return [];
  }

  shouldInclude(_filePath: string): boolean {
    // Include all files that made it through the walker
    return true;
  }
}
