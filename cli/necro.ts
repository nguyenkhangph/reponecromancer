#!/usr/bin/env node
/**
 * RepoNecromancer CLI
 *
 *   npm run necro -- <path | owner/repo | github url> [--out <dir>] [--json]
 *
 * Audits the corpse, writes the resurrected tree (with generated regression
 * tests) to --out, plus a NECROPSY.md report. Then:  cd <out> && npm i && npm test
 */
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { applyPatches, npmRegistry, resurrect } from "../engine/index";
import { fetchRepo, parseRepoInput } from "../engine/github";
import { renderNecropsy } from "../engine/report";
import type { FileMap } from "../engine/types";

function loadDir(dir: string): FileMap {
  const out: FileMap = {};
  const rec = (d: string) => {
    for (const f of readdirSync(d)) {
      if (f === "node_modules" || f === ".git") continue;
      const p = join(d, f);
      const st = statSync(p);
      if (st.isDirectory()) rec(p);
      else if (st.size < 200_000) out[relative(dir, p).split("\\").join("/")] = readFileSync(p, "utf8");
    }
  };
  rec(dir);
  return out;
}

const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith("--"));
const outIdx = args.indexOf("--out");
const json = args.includes("--json");
if (!target) {
  console.log("usage: necro <path | owner/repo | github url> [--out <dir>] [--json]");
  process.exit(1);
}

let files: FileMap;
let name: string;
if (existsSync(target) && statSync(target).isDirectory()) {
  files = loadDir(resolve(target));
  name = basename(resolve(target));
} else {
  const ref = parseRepoInput(target);
  if (!ref) {
    console.error(`✗ "${target}" is neither a directory nor a GitHub repo.`);
    process.exit(1);
  }
  console.log(`⛏  exhuming github.com/${ref.owner}/${ref.repo} …`);
  const fetched = await fetchRepo(ref, { token: process.env.GITHUB_TOKEN });
  files = fetched.files;
  name = ref.repo;
}

const report = await resurrect(files, { registry: npmRegistry() });
if (json) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}
const out = resolve(outIdx > -1 ? args[outIdx + 1] : `${name}-resurrected`);
const tree = applyPatches(files, report);
for (const [p, c] of Object.entries(tree)) {
  const full = join(out, p);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, c);
}
writeFileSync(join(out, "NECROPSY.md"), renderNecropsy(report));

const v = report.vitals;
console.log(`\n🧪 ${v.name}: pulse ${v.pulseBefore}% → ${v.pulseAfter}%`);
console.log(`   cause of death: ${v.causeOfDeath}`);
console.log(`   ${report.deps.length} deps audited · ${report.code.filter((c) => c.fixed).length} call sites patched · ${report.tests.reduce((s, t) => s + t.cases, 0)} regression tests generated`);
console.log(`\n⚡ resurrected tree written to ${out}\n   next: cd ${relative(process.cwd(), out) || "."} && npm install && npm test`);
