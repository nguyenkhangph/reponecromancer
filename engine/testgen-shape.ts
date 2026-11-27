/**
 * jsonShape: reduce a JSON value to its structural skeleton.
 *
 * Rules:
 *   null            → "null"
 *   string/number/boolean/undefined → typeof result ("string", "number", etc.)
 *   []              → []
 *   [a, b, c]       → [jsonShape(a)]   (first element only)
 *   { k: v, … }     → { k: jsonShape(v), … }
 *
 * Volatile leaf values (uptime, timestamps, UUIDs) all become "string" or
 * "number", so the shape stays stable across runs while still catching
 * structural regressions (removed keys, changed types, array → object).
 */
export type JsonShape = string | JsonShape[] | { [k: string]: JsonShape };

export function jsonShape(v: unknown): JsonShape {
  if (v === null) return "null";
  if (Array.isArray(v)) return v.length === 0 ? [] : [jsonShape(v[0])];
  if (typeof v === "object") {
    const out: { [k: string]: JsonShape } = {};
    for (const k of Object.keys(v as object)) out[k] = jsonShape((v as Record<string, unknown>)[k]);
    return out;
  }
  return typeof v;
}
