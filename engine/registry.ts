import type { RegistryInfo, RegistryLookup } from "./types";

const REGISTRY = "https://registry.npmjs.org";

/** Live npm registry lookup using the abbreviated ("corgi") metadata document. */
export function npmRegistry(opts: { timeoutMs?: number } = {}): RegistryLookup {
  const cache = new Map<string, Promise<RegistryInfo>>();
  return (name: string) => {
    if (!cache.has(name)) {
      cache.set(name, lookup(name, opts.timeoutMs ?? 8000));
    }
    return cache.get(name)!;
  };
}

async function lookup(name: string, timeoutMs: number): Promise<RegistryInfo> {
  const url = `${REGISTRY}/${name.startsWith("@") ? "@" + encodeURIComponent(name.slice(1)) : encodeURIComponent(name)}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { accept: "application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8" },
      signal: ctrl.signal,
    });
    if (res.status === 404) return { name, latest: null, deprecated: null, modified: null, exists: false };
    if (!res.ok) throw new Error(`registry ${res.status}`);
    const doc: any = await res.json();
    const latest: string | null = doc["dist-tags"]?.latest ?? null;
    const deprecated: string | null = latest ? doc.versions?.[latest]?.deprecated ?? null : null;
    return { name, latest, deprecated: typeof deprecated === "string" ? deprecated : null, modified: doc.modified ?? null, exists: true };
  } catch {
    return { name, latest: null, deprecated: null, modified: null, exists: true };
  } finally {
    clearTimeout(t);
  }
}

/** Offline lookup backed by a snapshot (used in tests and as a fallback). */
export function snapshotRegistry(snapshot: Record<string, Partial<RegistryInfo>>): RegistryLookup {
  return async (name) => {
    const s = snapshot[name];
    if (!s) return { name, latest: null, deprecated: null, modified: null, exists: true };
    return { name, latest: s.latest ?? null, deprecated: s.deprecated ?? null, modified: s.modified ?? null, exists: s.exists ?? true };
  };
}

/** Parse the leading major version from a semver-ish range like "~1.4.1", "3.x", ">=0.8". */
export function majorOf(range: string | null | undefined): number | null {
  if (!range) return null;
  const m = String(range).match(/(\d+)(?:\.(\d+|x|\*))?/);
  if (!m) return null;
  return Number(m[1]);
}

/** "0-based" versions count minors as majors (0.3 -> 0.4 is breaking). */
export function majorsBehind(declared: string, latest: string | null): number | null {
  if (!latest) return null;
  const a = String(declared).match(/(\d+)\.?(\d+)?/);
  const b = latest.match(/(\d+)\.(\d+)/);
  if (!a || !b) return null;
  const [da, db] = [Number(a[1]), Number(a[2] ?? 0)];
  const [la, lb] = [Number(b[1]), Number(b[2])];
  if (la > da) return la - da;
  if (la === 0 && da === 0 && lb > db) return 1;
  return 0;
}
