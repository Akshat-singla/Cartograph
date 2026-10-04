/**
 * Extension-based file categories.
 * A category is a fact about the file (its extension), not a guess about its role.
 */

export interface FileCategory {
  name: string;
  /** CSS colour for the swatch */
  color: string;
  count: number;
}

// Fixed palette — extension → colour. Adding a new extension won't shift
// existing colours because the map is explicit.
const EXT_COLORS: Record<string, string> = {
  tsx: '#3b82f6',  // blue   — React components
  ts:  '#22c55e',  // green  — TypeScript modules
  js:  '#f59e0b',  // amber  — JavaScript modules
  mts: '#a855f7',  // purple — ESM TypeScript
  jsx: '#ec4899',  // pink   — JSX (if present)
};

const FALLBACK_COLOR = '#64748b'; // slate — anything else

export function buildCategories(filePaths: string[]): FileCategory[] {
  const counts = new Map<string, number>();
  for (const p of filePaths) {
    const ext = p.split('.').pop() ?? '';
    counts.set(ext, (counts.get(ext) ?? 0) + 1);
  }

  // Produce entries in a stable order: known extensions first, then others
  const result: FileCategory[] = [];
  const knownOrder = ['tsx', 'ts', 'js', 'mts', 'jsx'];
  for (const ext of knownOrder) {
    const count = counts.get(ext);
    if (count !== undefined) {
      result.push({ name: `.${ext}`, color: EXT_COLORS[ext], count });
    }
  }
  // Unknown extensions
  for (const [ext, count] of counts) {
    if (!knownOrder.includes(ext)) {
      result.push({ name: `.${ext}`, color: FALLBACK_COLOR, count });
    }
  }
  return result;
}
