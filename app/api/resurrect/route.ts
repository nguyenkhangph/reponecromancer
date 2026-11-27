import { NextResponse } from "next/server";
import { resurrect, npmRegistry, NotANodeProjectError } from "@/engine/index";
import { fetchRepo, parseRepoInput, RepoFetchError } from "@/engine/github";
import type { LabBundle } from "@/lib/specimens";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const input = new URL(req.url).searchParams.get("repo") ?? "";
  const ref = parseRepoInput(input);
  if (!ref) return NextResponse.json({ error: "Give me a GitHub repo: owner/name or a github.com URL." }, { status: 400 });

  try {
    const fetched = await fetchRepo(ref, { token: process.env.GITHUB_TOKEN });
    const report = await resurrect(fetched.files, { registry: npmRegistry({ timeoutMs: 6000 }) });
    const notes: string[] = [];
    if (fetched.skipped) notes.push(`${fetched.skipped} more source files were not scanned (the web lab samples up to 60 files — use the CLI for the whole repo).`);
    if (fetched.meta.archived) notes.push("This repository is archived by its owner.");
    const bundle: LabBundle = {
      meta: {
        id: fetched.meta.fullName,
        title: fetched.meta.fullName,
        era: report.vitals.declaredNode ? `Declared Node ${report.vitals.declaredNode}` : "Node.js project",
        dateOfDeath: fetched.meta.pushedAt?.slice(0, 10) ?? "unknown",
        epitaph: fetched.meta.description ?? report.vitals.description ?? "",
        stack: report.deps.slice(0, 6).map((d) => d.name),
      },
      files: fetched.files,
      report,
      verify: null,
      source: "github",
      repoUrl: fetched.meta.htmlUrl,
      notes,
    };
    return NextResponse.json(bundle, { headers: { "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
  } catch (e: any) {
    if (e instanceof RepoFetchError) return NextResponse.json({ error: e.message }, { status: e.status });
    if (e instanceof NotANodeProjectError) return NextResponse.json({ error: e.message }, { status: 422 });
    return NextResponse.json({ error: `The ritual failed: ${e?.message ?? e}` }, { status: 500 });
  }
}
