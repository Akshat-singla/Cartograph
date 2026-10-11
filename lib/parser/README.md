# Parser

Standalone TypeScript parser that analyzes a repository and produces a dependency graph.

## Usage

```bash
# Parse current directory
pnpm parse .

# Parse a specific directory
pnpm parse /path/to/repo

# Write output to file
pnpm parse . --output result.json
```

## What it does

- Walks the directory tree and finds all TypeScript/JavaScript files
- Parses each file with ts-morph to extract:
  - Regular imports: `import { foo } from './bar'`
  - Re-exports: `export * from './bar'`
  - Dynamic imports: `import('./bar')`
- Resolves each import to an actual file or classifies it as external/excluded/failed
- Calculates fan-in and fan-out for each file
- Reports coverage: how many imports were resolved vs failed

## Output structure

The parser returns a `ParseResult` with:

- `files`: List of all parsed files with path, folder, line count, hash
- `edges`: All resolved dependencies (from → to, with kind)
- `coverage`: Stats on resolved/external/excluded/failed imports
- `unresolved`: Failed imports with reasons and examples
- `skipped`: Files that were skipped with reasons
- `metrics`: Folder count, fan-in, fan-out maps

## Constraints

- No framework dependencies (Next.js, React, database)
- Runnable from a plain script
- Works on any directory on disk
- Reports unresolved imports with reasons, never guesses
- File selection is structural (whole directories)

## Example output

```
Files:
  Found:   27
  Skipped: 116
  Total:   143

Folders:
  Distinct folders: 15

Imports:
  Total seen:  51
  Resolved:    19
  External:    31
  Excluded:    1
  Failed:      0

Edges:
  Total (after dedup): 18
  Import:              16
  Re-export:           2
  Dynamic import:      0
```
