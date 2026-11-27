/**
 * Runs the full resurrection on every bundled specimen and *actually verifies*
 * it: installs the legacy tree and the resurrected tree on the current Node,
 * runs the generated regression suite against both, plus lint/build checks,
 * and writes the evidence to data/presets/<id>.json for the web lab.
 *
 *   npm run necro:verify            # all presets
 *   npm run necro:verify -- ghost-todo-api
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, existsSync, copyFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { applyPatches, npmRegistry, resurrect } from "../engine/index";
import { SNAPSHOT_FILE, SNAPSHOT_DIR } from "../engine/testgen";
import type { FileMap, NecropsyReport, RunResult, TestCaseResult, VerifyRecord } from "../engine/types";

const ROOT = resolve(import.meta.dirname, "..");
const PRESETS = join(ROOT, "presets");
const OUT = join(ROOT, "data", "presets");
// file:// URL so the reporter also loads on Windows (D:\ paths are not valid ESM specifiers)
const REPORTER = pathToFileURL(join(ROOT, "scripts", "json-reporter.mjs")).href;

export function loadDir(dir: string): FileMap {
  const out: FileMap = {};
  const rec = (d: string) => {
    for (const f of readdirSync(d)) {
      if (f === "node_modules") continue;
      const p = join(d, f);
      if (statSync(p).isDirectory()) rec(p);
      else out[relative(dir, p).split("\\").join("/")] = readFileSync(p, "utf8");
    }
  };
  rec(dir);
  return out;
}

function writeTree(dir: string, files: FileMap) {
  rmSync(dir, { recursive: true, force: true });
  for (const [p, c] of Object.entries(files)) {
    const full = join(dir, p);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, c);
  }
}

function tail(s: string, n = 6000) {
  s = s.replace(/\x1b\[[0-9;]*m/g, "");
  return s.length > n ? "…" + s.slice(-n) : s;
}

function run(cmd: string, args: string[], cwd: string, timeoutMs: number) {
  const t0 = Date.now();
  // npm is npm.cmd on Windows: run it through the shell there, as one command
  // string (args are fixed constants, never user input) to avoid DEP0190.
  const win = process.platform === "win32";
  const r = spawnSync(win ? [cmd, ...args].join(" ") : cmd, win ? [] : args, { cwd, encoding: "utf8", timeout: timeoutMs, shell: win, env: { ...process.env, NODE_ENV: "test", CI: "1", npm_config_update_notifier: "false" } });
  const timedOut = r.error && (r.error as any).code === "ETIMEDOUT";
  return { ok: r.status === 0, status: r.status, out: (r.stdout ?? "") + (r.stderr ?? "") + (timedOut ? `\n[necro] timed out after ${timeoutMs / 1000}s` : r.error ? `\n[necro] ${r.error.message}` : ""), ms: Date.now() - t0 };
}

function runTree(dir: string, testFiles: string[], checks: Array<{ name: string; script: string }>, extraEnv: Record<string, string> = {}): RunResult {
  const install = run("npm", ["install", "--no-audit", "--no-fund", "--loglevel=error"], dir, 240_000);
  const jsonl = join(dir, ".necro-results.jsonl");
  const t0 = Date.now();
  const t = spawnSync(process.execPath, ["--test", "--test-reporter=spec", "--test-reporter-destination=stdout", `--test-reporter=${REPORTER}`, `--test-reporter-destination=${jsonl}`, ...testFiles], {
    cwd: dir,
    encoding: "utf8",
    timeout: 120_000,
    env: { ...process.env, NODE_ENV: "test", FORCE_COLOR: "0", ...extraEnv },
  });
  const cases: TestCaseResult[] = existsSync(jsonl)
    ? readFileSync(jsonl, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l))
    : [];
  const resultChecks = checks.map((c) => {
    const r = run("npm", ["run", c.script, "--silent"], dir, 120_000);
    return { name: c.name, command: `npm run ${c.script}`, ok: r.ok, log: tail(r.out, 3000) };
  });
  return {
    install: { ok: install.ok, durationMs: install.ms, log: tail(install.out) || "(no output)" },
    tests: {
      pass: cases.filter((c) => c.ok).length,
      fail: cases.filter((c) => !c.ok).length,
      cases,
      log: tail((t.stdout ?? "") + (t.stderr ?? "")),
      durationMs: Date.now() - t0,
    },
    checks: resultChecks,
  };
}

async function verifyPreset(id: string) {
  const files = loadDir(join(PRESETS, id));
  const report: NecropsyReport = await resurrect(files, { registry: npmRegistry() });
  const testFiles = report.tests.map((t) => t.path);
  const work = join(tmpdir(), "necro-verify", id);

  // BEFORE: legacy tree + the generated suite (characterization on the corpse)
  const before: FileMap = { ...files };
  for (const t of report.tests) before[t.path] = t.content;
  writeTree(join(work, "before"), before);
  console.log(`\n⚰  ${id}: verifying legacy tree…`);
  const beforeRun = runTree(join(work, "before"), testFiles, [], { NECRO_RECORD: "1" });

  // Copy golden-master snapshot from BEFORE into AFTER (best-effort; skip if missing)
  const beforeSnap = join(work, "before", SNAPSHOT_FILE);
  const afterSnapDir = join(work, "after", SNAPSHOT_DIR);
  const afterSnap = join(work, "after", SNAPSHOT_FILE);

  // AFTER: resurrected tree
  const after = applyPatches(files, report);
  writeTree(join(work, "after"), after);

  if (beforeRun.install.ok && existsSync(beforeSnap)) {
    mkdirSync(afterSnapDir, { recursive: true });
    copyFileSync(beforeSnap, afterSnap);
  }

  const pkg = JSON.parse(after["package.json"]);
  const checks = [
    ...(pkg.scripts?.lint ? [{ name: "lint", script: "lint" }] : []),
    ...(pkg.scripts?.build ? [{ name: "build", script: "build" }] : []),
  ];
  console.log(`⚡ ${id}: verifying resurrected tree…`);
  const afterRun = runTree(join(work, "after"), testFiles, checks);
  const npmV = run("npm", ["--version"], work, 20_000).out.trim();
  const verify: VerifyRecord = { node: process.version, npm: npmV, verifiedAt: new Date().toISOString(), before: beforeRun, after: afterRun };
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, `${id}.json`), JSON.stringify({ files, report, verify }));
  const fmt = (r: RunResult) => `install ${r.install.ok ? "ok" : "FAILED"} · tests ${r.tests.pass}/${r.tests.pass + r.tests.fail}${r.checks.length ? " · " + r.checks.map((c) => `${c.name} ${c.ok ? "ok" : "FAILED"}`).join(" · ") : ""}`;
  console.log(`   before: ${fmt(beforeRun)}\n   after:  ${fmt(afterRun)}\n   pulse:  ${report.vitals.pulseBefore}% → ${report.vitals.pulseAfter}%`);
  return afterRun.install.ok && afterRun.tests.fail === 0 && afterRun.tests.pass > 0 && afterRun.checks.every((c) => c.ok);
}

const only = process.argv.slice(2);
const ids = readdirSync(PRESETS).filter((d) => statSync(join(PRESETS, d)).isDirectory() && (!only.length || only.includes(d)));
let allGreen = true;
for (const id of ids) allGreen = (await verifyPreset(id)) && allGreen;
console.log(allGreen ? "\n🟢 every specimen has a pulse." : "\n🔴 some specimens are still dead — see above.");
process.exit(allGreen ? 0 : 1);
