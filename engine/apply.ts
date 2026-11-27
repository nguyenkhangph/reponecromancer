import type { FileMap, NecropsyReport } from "./types";

/** Apply a report's patches to a file map, producing the resurrected tree. Pure; safe for the browser. */
export function applyPatches(files: FileMap, report: Pick<NecropsyReport, "patches">): FileMap {
  const out: FileMap = { ...files };
  for (const p of report.patches) {
    if (p.kind === "deleted") delete out[p.path];
    else out[p.path] = p.after ?? "";
  }
  return out;
}
