// RoutesTable — server component.
//
// Fetches routes for an analysis and renders them in a compact collapsible
// panel at the bottom of the main column. Uses a native <details> element
// so no client JS is required — the toggle is pure HTML.
//
// Route data: routes.path holds the URL pattern; routes.handler_name holds
// the exported function name; files.path holds the relative file path.
// The nested select `files(path)` resolves the join in a single query.

import { createSupabaseServerClient } from "@/lib/supabase-server";

interface Props {
  analysisId: string;
}

// Shape returned by the nested select.
// Supabase returns a 1:1 FK relation as an array (even though it's singular),
// so cast via unknown rather than relying on the generated type.
interface DbRoute {
  method: string;
  path: string;
  handler_name: string | null;
  files: { path: string } | { path: string }[] | null;
}

// Method → Tailwind pill classes.
const METHOD_CLASSES: Record<string, string> = {
  GET: "bg-blue-900 text-blue-300",
  POST: "bg-green-900 text-green-300",
  PUT: "bg-amber-900 text-amber-300",
  DELETE: "bg-red-900 text-red-300",
  PATCH: "bg-orange-900 text-orange-300",
};
const METHOD_FALLBACK = "bg-neutral-800 text-neutral-400";

export async function RoutesTable({ analysisId }: Props) {
  const supabase = createSupabaseServerClient();

  const { data } = await supabase
    .from("routes")
    .select("method, path, handler_name, files(path)")
    .eq("analysis_id", analysisId)
    .order("path");

  const routes = (data ?? []) as unknown as DbRoute[];

  return (
    <details className="border-t border-neutral-800 shrink-0">
      <summary className="px-3 py-1.5 cursor-pointer select-none text-[10px] uppercase tracking-widest text-neutral-500 hover:text-neutral-400 list-none flex items-center gap-1">
        <span>routes</span>
        <span className="text-neutral-600">({routes.length})</span>
      </summary>

      {routes.length === 0 ? (
        <p className="px-3 py-2 text-xs text-neutral-500">No routes detected.</p>
      ) : (
        <div className="overflow-x-auto max-h-48 overflow-y-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-neutral-800">
                <th className="px-3 py-1.5 text-left text-[10px] uppercase tracking-widest text-neutral-600 font-normal">
                  Method
                </th>
                <th className="px-3 py-1.5 text-left text-[10px] uppercase tracking-widest text-neutral-600 font-normal">
                  Pattern
                </th>
                <th className="px-3 py-1.5 text-left text-[10px] uppercase tracking-widest text-neutral-600 font-normal">
                  File
                </th>
              </tr>
            </thead>
            <tbody>
              {routes.map((r, i) => {
                const pillClass = METHOD_CLASSES[r.method] ?? METHOD_FALLBACK;
                const filePath = Array.isArray(r.files)
                  ? (r.files[0]?.path ?? "")
                  : (r.files?.path ?? "");
                return (
                  <tr key={i} className="border-b border-neutral-900 hover:bg-neutral-900">
                    <td className="px-3 py-1">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono ${pillClass}`}>
                        {r.method}
                      </span>
                    </td>
                    <td className="px-3 py-1 font-mono text-xs text-neutral-200 whitespace-nowrap">
                      {r.path}
                    </td>
                    <td className="px-3 py-1 font-mono text-xs text-neutral-500 whitespace-nowrap">
                      {filePath}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </details>
  );
}
