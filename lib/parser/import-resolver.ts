/**
 * Import resolution using ts-morph.
 * Extracts imports, re-exports, and dynamic imports from source files.
 */

import { Project, SyntaxKind, Node } from 'ts-morph';
import * as path from 'path';
import * as fs from 'fs';
import type { Edge, UnresolvedImport, FileNode } from './types';

export interface ResolveResult {
  edges: Edge[];
  unresolved: UnresolvedImport[];
  coverage: {
    totalImports: number;
    resolved: number;
    external: number;
    excluded: number;
    failed: number;
  };
}

const EXTERNAL_PATTERNS = [
  /^[^./]/, // Doesn't start with . or /
  /^node:/, // Node built-ins
];

// ---------------------------------------------------------------------------
// tsconfig paths aliases

// We only handle the common wildcard-prefix form: "@/*": ["./src/*"].
// Multi-target or non-wildcard entries are left to the external bucket —
// that is no worse than the previous behaviour.
interface PathsAlias {
  /** Alias prefix before the wildcard, e.g. "@/" */
  prefix: string;
  /** Replacement prefix before the wildcard, already resolved to absolute */
  targetPrefix: string;
}

/**
 * Read tsconfig.json at rootDir and extract compilerOptions.paths as a flat
 * list of prefix aliases. Returns [] if no tsconfig, no paths, or parse fails.
 */
function loadPathAliases(rootDir: string): PathsAlias[] {
  const tsconfigPath = path.join(rootDir, 'tsconfig.json');
  if (!fs.existsSync(tsconfigPath)) return [];

  let raw: string;
  try {
    raw = fs.readFileSync(tsconfigPath, 'utf8');
  } catch {
    return [];
  }

  // tsconfig.json allows comments — strip them before JSON.parse
  const stripped = raw
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  let parsed: {
    compilerOptions?: { baseUrl?: string; paths?: Record<string, string[]> };
  };
  try {
    parsed = JSON.parse(stripped) as typeof parsed;
  } catch {
    return [];
  }

  const rawPaths = parsed.compilerOptions?.paths;
  if (!rawPaths) return [];

  // baseUrl defaults to rootDir when absent
  const baseUrl = parsed.compilerOptions?.baseUrl
    ? path.resolve(rootDir, parsed.compilerOptions.baseUrl)
    : rootDir;

  const aliases: PathsAlias[] = [];
  for (const [pattern, targets] of Object.entries(rawPaths)) {
    if (
      !pattern.endsWith('/*') ||
      targets.length !== 1 ||
      !targets[0].endsWith('/*')
    ) {
      continue; // skip non-wildcard / multi-target entries
    }
    aliases.push({
      prefix: pattern.slice(0, -1),                             // "@/"
      targetPrefix: path.resolve(baseUrl, targets[0].slice(0, -1)), // absolute
    });
  }
  return aliases;
}

// ---------------------------------------------------------------------------
// Specifier resolution

interface SpecifierResult {
  resolved?: string;
  external?: boolean;
  excluded?: boolean;
  /** Alias matched but target file not found — already recorded in unresolved */
  aliasNotFound?: boolean;
  reason?: string;
}

/**
 * Resolve a single import specifier to an absolute file path.
 *
 * Order:
 *   1. tsconfig paths aliases (must run before EXTERNAL_PATTERNS so "@/…"
 *      is not mis-classified as an external package)
 *   2. External-pattern check
 *   3. Relative / absolute path resolution
 */
function resolveSpecifier(
  specifier: string,
  fromFile: string,
  rootDir: string,
  filePathSet: Set<string>,
  pathAliases: PathsAlias[],
  unresolved: UnresolvedImport[],
): SpecifierResult {
  const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '.mts', '.cts'];
  const indexExts = ['.ts', '.tsx', '.js', '.jsx'];

  // 1. tsconfig paths aliases
  for (const { prefix, targetPrefix } of pathAliases) {
    if (!specifier.startsWith(prefix)) continue;

    const rest = specifier.slice(prefix.length);        // e.g. "lib/foo"
    const resolvedPath = path.join(targetPrefix, rest); // absolute candidate

    for (const ext of extensions) {
      if (filePathSet.has(resolvedPath + ext)) return { resolved: resolvedPath + ext };
    }
    for (const ext of indexExts) {
      const idx = path.join(resolvedPath, `index${ext}`);
      if (filePathSet.has(idx)) return { resolved: idx };
    }

    // Alias matched but target missing — record with a descriptive reason
    unresolved.push({
      file: fromFile,
      specifier,
      reason: `Mapped alias "${prefix}" → target not found: ${resolvedPath}`,
      example: specifier,
    });
    return { aliasNotFound: true };
  }

  // 2. External packages
  if (EXTERNAL_PATTERNS.some((p) => p.test(specifier))) {
    return { external: true };
  }

  // 3. Relative or root-relative path
  const fromDir = path.dirname(fromFile);
  let resolvedPath: string;

  if (specifier.startsWith('.')) {
    resolvedPath = path.resolve(fromDir, specifier);
  } else if (specifier.startsWith('/')) {
    resolvedPath = path.join(rootDir, specifier);
  } else {
    return { external: true };
  }

  for (const ext of extensions) {
    if (filePathSet.has(resolvedPath + ext)) return { resolved: resolvedPath + ext };
  }

  // ESM extension substitution: TypeScript sources are often imported with
  // their emitted JS extension (.js / .mjs / .cjs). Try the TS equivalent.
  const esmMap: Record<string, string[]> = {
    '.js': ['.ts', '.tsx'],
    '.mjs': ['.mts'],
    '.cjs': ['.cts'],
  };
  const specifierExt = path.extname(specifier);
  const tsAlts = esmMap[specifierExt];
  if (tsAlts) {
    const base = resolvedPath.slice(0, -specifierExt.length);
    for (const alt of tsAlts) {
      if (filePathSet.has(base + alt)) return { resolved: base + alt };
    }
  }

  for (const ext of indexExts) {
    const idx = path.join(resolvedPath, `index${ext}`);
    if (filePathSet.has(idx)) return { resolved: idx };
  }

  // Only classify as excluded when the path is a regular file outside the
  // tracked set — not when it is a directory (which means the index lookup
  // above already exhausted all candidates).
  if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
    return { excluded: true };
  }

  return { reason: `File not found: ${resolvedPath}` };
}

// ---------------------------------------------------------------------------
// Main export

/**
 * Resolve all imports in a list of files.
 */
export function resolveImports(
  files: FileNode[],
  rootDir: string,
): ResolveResult {
  const project = new Project({
    useInMemoryFileSystem: false,
    skipAddingFilesFromTsConfig: true,
  });

  const filePaths = files.map((f) => f.path);
  project.addSourceFilesAtPaths(filePaths);

  // Load tsconfig paths once — re-used for every specifier in this parse run
  const pathAliases = loadPathAliases(rootDir);

  const edges: Edge[] = [];
  const unresolved: UnresolvedImport[] = [];
  let totalImports = 0;
  let resolved = 0;
  let external = 0;
  let excluded = 0;
  let failed = 0;

  const filePathSet = new Set(filePaths);

  function handle(
    specifier: string,
    fromPath: string,
    kind: Edge['kind'],
    example: string,
  ): void {
    totalImports++;
    const result = resolveSpecifier(
      specifier,
      fromPath,
      rootDir,
      filePathSet,
      pathAliases,
      unresolved,
    );

    if (result.resolved) {
      edges.push({ from: fromPath, to: result.resolved, kind });
      resolved++;
    } else if (result.external) {
      external++;
    } else if (result.excluded) {
      excluded++;
    } else if (result.aliasNotFound) {
      // already pushed to unresolved inside resolveSpecifier
      failed++;
    } else {
      failed++;
      unresolved.push({
        file: fromPath,
        specifier,
        reason: result.reason ?? 'Unknown',
        example,
      });
    }
  }

  for (const file of files) {
    const sourceFile = project.getSourceFile(file.path);
    if (!sourceFile) continue;

    // Regular imports: import { foo } from './bar'
    for (const importDecl of sourceFile.getImportDeclarations()) {
      handle(
        importDecl.getModuleSpecifierValue(),
        file.path,
        'import',
        importDecl.getText(),
      );
    }

    // Re-exports: export { foo } from './bar' or export * from './bar'
    for (const exportDecl of sourceFile.getExportDeclarations()) {
      const specifier = exportDecl.getModuleSpecifierValue();
      if (!specifier) continue;
      handle(specifier, file.path, 're-export', exportDecl.getText());
    }

    // Dynamic imports: import('./bar')
    sourceFile.forEachDescendant((node) => {
      if (Node.isCallExpression(node)) {
        const expr = node.getExpression();
        if (expr.getKind() === SyntaxKind.ImportKeyword) {
          const args = node.getArguments();
          if (args.length > 0 && Node.isStringLiteral(args[0])) {
            handle(
              args[0].getLiteralValue(),
              file.path,
              'dynamic-import',
              node.getText(),
            );
          }
        }
      }
    });
  }

  return {
    edges,
    unresolved,
    coverage: { totalImports, resolved, external, excluded, failed },
  };
}

/**
 * Remove duplicate edges (same from/to/kind).
 */
export function deduplicateEdges(edges: Edge[]): Edge[] {
  const seen = new Set<string>();
  const unique: Edge[] = [];
  for (const edge of edges) {
    const key = `${edge.from}|${edge.to}|${edge.kind}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(edge);
    }
  }
  return unique;
}
