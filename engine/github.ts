import { unzipSync, strFromU8 } from "fflate";
import type { FileMap } from "./types";

export interface RepoRef {
  owner: string;
  repo: string;
  ref?: string;
}

export interface RepoMeta {
  fullName: string;
  description: string | null;
  defaultBranch: string;
  pushedAt: string | null;
  archived: boolean;
  stars: number;
  license: string | null;
  htmlUrl: string;
}

export interface FetchedRepo {
  meta: RepoMeta;
  files: FileMap;
  skipped: number;
  truncated: boolean;
}

export class RepoFetchError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export function parseRepoInput(input: string): RepoRef | null {
  const s = input.trim().replace(/\.git$/, "").replace(/\/+$/, "");
  const m =
    s.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+)(?:\/tree\/([^/]+))?/i) ??
    s.match(/^([\w.-]+)\/([\w.-]+)$/);
  if (!m) return null;
  return { owner: m[1], repo: m[2], ref: m[3] };
}

const CONFIG_FILES = new Set(["package.json", "bower.json", ".bowerrc", ".travis.yml", "Gruntfile.js", "Gruntfile.coffee", "gulpfile.js", ".jshintrc", ".jshintignore", ".nvmrc", "package-lock.json", "yarn.lock", "LICENSE", "LICENSE.md", "LICENCE"]);
const MAX_FILES = 60;
const MAX_BYTES = 80_000;

function wanted(path: string, size: number): boolean {
  if (CONFIG_FILES.has(path)) return path !== "package-lock.json" && path !== "yarn.lock";
  if (path.startsWith(".github/workflows/")) return true;
  if (size > MAX_BYTES) return false;
  if (!/\.(c?js)$/.test(path) || /\.min\.js$/.test(path)) return false;
  return !/(^|\/)(node_modules|bower_components|dist|build|vendor|coverage|examples?|docs?|benchmarks?|fixtures?)\//.test(path);
}

function priority(path: string): number {
  if (CONFIG_FILES.has(path)) return 0;
  const depth = path.split("/").length;
  if (/^(index|app|server|main)\.c?js$/.test(path)) return 1;
  if (/^(lib|src|bin)\//.test(path)) return 2 + depth * 0.1;
  if (/(^|\/)(test|tests|spec)\//.test(path)) return 6;
  return 4 + depth * 0.1;
}

export async function fetchRepo(ref: RepoRef, opts: { token?: string; timeoutMs?: number } = {}): Promise<FetchedRepo> {
  const headers: Record<string, string> = { accept: "application/vnd.github+json", "user-agent": "RepoNecromancer" };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  const timeout = opts.timeoutMs ?? 10_000;
  const get = async (url: string, raw = false) => {
    const res = await fetch(url, { headers: raw ? { "user-agent": "RepoNecromancer" } : headers, signal: AbortSignal.timeout(timeout) });
    return res;
  };

  let r = await get(`https://api.github.com/repos/${ref.owner}/${ref.repo}`);
  if (r.status === 401 && headers.authorization) {
    delete headers.authorization; // bad token: fall back to anonymous access
    r = await get(`https://api.github.com/repos/${ref.owner}/${ref.repo}`);
  }
  if (r.status === 404) throw new RepoFetchError(`Repository ${ref.owner}/${ref.repo} was not found (or it is private).`, 404);
  if (r.status === 403 || r.status === 429) return fetchViaZip(ref, timeout);
  if (!r.ok) throw new RepoFetchError(`GitHub API error ${r.status}.`, 502);
  const repo: any = await r.json();
  const branch = ref.ref ?? repo.default_branch;
  const meta: RepoMeta = {
    fullName: repo.full_name,
    description: repo.description,
    defaultBranch: branch,
    pushedAt: repo.pushed_at,
    archived: !!repo.archived,
    stars: repo.stargazers_count ?? 0,
    license: repo.license?.spdx_id ?? null,
    htmlUrl: repo.html_url,
  };

  const t = await get(`https://api.github.com/repos/${ref.owner}/${ref.repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
  if (!t.ok) throw new RepoFetchError(`Could not list files (${t.status}).`, 502);
  const tree: any = await t.json();
  const blobs: Array<{ path: string; size: number }> = (tree.tree ?? []).filter((n: any) => n.type === "blob").map((n: any) => ({ path: n.path, size: n.size ?? 0 }));
  const allPaths = new Set(blobs.map((b) => b.path));
  if (!allPaths.has("package.json")) {
    throw new RepoFetchError("No package.json at the repository root — RepoNecromancer currently raises JavaScript/Node.js projects.", 422);
  }
  const candidates = blobs.filter((b) => wanted(b.path, b.size)).sort((a, b) => priority(a.path) - priority(b.path) || a.path.localeCompare(b.path));
  const picked = candidates.slice(0, MAX_FILES);

  const files: FileMap = {};
  // presence markers for lockfiles / license so audits see them without downloading
  for (const p of ["package-lock.json", "yarn.lock", "pnpm-lock.yaml"]) if (allPaths.has(p)) files[p] = "";
  await Promise.all(
    picked.map(async (b) => {
      const res = await get(`https://raw.githubusercontent.com/${ref.owner}/${ref.repo}/${encodeURIComponent(branch)}/${b.path.split("/").map(encodeURIComponent).join("/")}`, true);
      if (res.ok) files[b.path] = await res.text();
    }),
  );
  return { meta, files, skipped: Math.max(0, candidates.length - picked.length), truncated: !!tree.truncated };
}

/** Fallback when the REST API is rate-limited: one codeload zip, no API quota. */
async function fetchViaZip(ref: RepoRef, timeout: number): Promise<FetchedRepo> {
  const url = `https://codeload.github.com/${ref.owner}/${ref.repo}/zip/${ref.ref ? encodeURIComponent(ref.ref) : "HEAD"}`;
  const res = await fetch(url, { headers: { "user-agent": "RepoNecromancer" }, signal: AbortSignal.timeout(timeout * 2) });
  if (res.status === 404) throw new RepoFetchError(`Repository ${ref.owner}/${ref.repo} was not found (or it is private).`, 404);
  if (!res.ok) throw new RepoFetchError("GitHub rate limit reached — try one of the bundled specimens, or run the CLI locally.", 429);
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > 40_000_000) throw new RepoFetchError("Repository archive is too large for the web lab — use the CLI.", 413);
  const buf = new Uint8Array(await res.arrayBuffer());
  const sizes = new Map<string, number>();
  const entries = unzipSync(buf, {
    filter: (f) => {
      const path = f.name.split("/").slice(1).join("/");
      if (!path || f.name.endsWith("/")) return false;
      sizes.set(path, f.originalSize);
      return wanted(path, f.originalSize) || path === "package.json";
    },
  });
  const all = [...sizes.keys()];
  if (!sizes.has("package.json")) throw new RepoFetchError("No package.json at the repository root — RepoNecromancer currently raises JavaScript/Node.js projects.", 422);
  const picked = Object.keys(entries)
    .map((n) => ({ name: n, path: n.split("/").slice(1).join("/") }))
    .sort((a, b) => priority(a.path) - priority(b.path) || a.path.localeCompare(b.path));
  const files: FileMap = {};
  for (const p of ["package-lock.json", "yarn.lock", "pnpm-lock.yaml"]) if (sizes.has(p)) files[p] = "";
  for (const e of picked.slice(0, MAX_FILES)) files[e.path] = strFromU8(entries[e.name]);
  return {
    meta: { fullName: `${ref.owner}/${ref.repo}`, description: null, defaultBranch: ref.ref ?? "HEAD", pushedAt: null, archived: false, stars: 0, license: null, htmlUrl: `https://github.com/${ref.owner}/${ref.repo}` },
    files,
    skipped: Math.max(0, picked.length - MAX_FILES),
    truncated: all.length > 5000,
  };
}
