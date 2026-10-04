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

/**
 * Resolve all imports in a list of files.
 */
export function resolveImports(
  files: FileNode[],
  rootDir: string
): ResolveResult {
  const project = new Project({
    useInMemoryFileSystem: false,
    skipAddingFilesFromTsConfig: true,
  });

  // Add all files to the project
  const filePaths = files.map(f => f.path);
  project.addSourceFilesAtPaths(filePaths);

  const edges: Edge[] = [];
  const unresolved: UnresolvedImport[] = [];
  let totalImports = 0;
  let resolved = 0;
  let external = 0;
  let excluded = 0;
  let failed = 0;

  const filePathSet = new Set(filePaths);

  for (const file of files) {
    const sourceFile = project.getSourceFile(file.path);
    if (!sourceFile) continue;

    // Extract regular imports: import { foo } from './bar'
    const importDeclarations = sourceFile.getImportDeclarations();
    for (const importDecl of importDeclarations) {
      const specifier = importDecl.getModuleSpecifierValue();
      totalImports++;
      
      const result = resolveSpecifier(
        specifier,
        file.path,
        rootDir,
        filePathSet
      );
      
      if (result.resolved) {
        edges.push({ from: file.path, to: result.resolved, kind: 'import' });
        resolved++;
      } else if (result.external) {
        external++;
      } else if (result.excluded) {
        excluded++;
      } else {
        failed++;
        unresolved.push({
          file: file.path,
          specifier,
          reason: result.reason || 'Unknown',
          example: importDecl.getText(),
        });
      }
    }

    // Extract re-exports: export { foo } from './bar' or export * from './bar'
    const exportDeclarations = sourceFile.getExportDeclarations();
    for (const exportDecl of exportDeclarations) {
      const specifier = exportDecl.getModuleSpecifierValue();
      if (!specifier) continue; // export { foo } without from
      
      totalImports++;
      
      const result = resolveSpecifier(
        specifier,
        file.path,
        rootDir,
        filePathSet
      );
      
      if (result.resolved) {
        edges.push({ from: file.path, to: result.resolved, kind: 're-export' });
        resolved++;
      } else if (result.external) {
        external++;
      } else if (result.excluded) {
        excluded++;
      } else {
        failed++;
        unresolved.push({
          file: file.path,
          specifier,
          reason: result.reason || 'Unknown',
          example: exportDecl.getText(),
        });
      }
    }

    // Extract dynamic imports: import('./bar')
    sourceFile.forEachDescendant((node) => {
      if (Node.isCallExpression(node)) {
        const expr = node.getExpression();
        if (expr.getKind() === SyntaxKind.ImportKeyword) {
          const args = node.getArguments();
          if (args.length > 0 && Node.isStringLiteral(args[0])) {
            const specifier = args[0].getLiteralValue();
            totalImports++;
            
            const result = resolveSpecifier(
              specifier,
              file.path,
              rootDir,
              filePathSet
            );
            
            if (result.resolved) {
              edges.push({ from: file.path, to: result.resolved, kind: 'dynamic-import' });
              resolved++;
            } else if (result.external) {
              external++;
            } else if (result.excluded) {
              excluded++;
            } else {
              failed++;
              unresolved.push({
                file: file.path,
                specifier,
                reason: result.reason || 'Unknown',
                example: node.getText(),
              });
            }
          }
        }
      }
    });
  }

  return {
    edges,
    unresolved,
    coverage: {
      totalImports,
      resolved,
      external,
      excluded,
      failed,
    },
  };
}

interface SpecifierResult {
  resolved?: string;
  external?: boolean;
  excluded?: boolean;
  reason?: string;
}

/**
 * Resolve a single import specifier to an absolute file path.
 */
function resolveSpecifier(
  specifier: string,
  fromFile: string,
  rootDir: string,
  filePathSet: Set<string>
): SpecifierResult {
  // Check if it's an external package
  if (EXTERNAL_PATTERNS.some(pattern => pattern.test(specifier))) {
    return { external: true };
  }

  // Resolve relative or absolute paths
  const fromDir = path.dirname(fromFile);
  let resolvedPath: string;

  if (specifier.startsWith('.')) {
    // Relative import
    resolvedPath = path.resolve(fromDir, specifier);
  } else if (specifier.startsWith('/')) {
    // Absolute import (relative to root)
    resolvedPath = path.join(rootDir, specifier);
  } else {
    // Could be a path alias or external - treat as external for now
    return { external: true };
  }

  // Try to find the actual file
  const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '.mts', '.cts'];
  
  for (const ext of extensions) {
    const candidate = resolvedPath + ext;
    if (filePathSet.has(candidate)) {
      return { resolved: candidate };
    }
  }

  // Try index files
  for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
    const candidate = path.join(resolvedPath, `index${ext}`);
    if (filePathSet.has(candidate)) {
      return { resolved: candidate };
    }
  }

  // Check if the path exists outside our file set (excluded)
  if (fs.existsSync(resolvedPath)) {
    return { excluded: true };
  }

  // Failed to resolve
  return {
    reason: `File not found: ${resolvedPath}`,
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
