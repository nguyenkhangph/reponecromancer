"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { zipSync, strToU8 } from "fflate";
import { applyPatches } from "@/engine/apply";
import { renderNecropsy } from "@/engine/report";
import type { DepFinding, FilePatch, RunResult, Severity } from "@/engine/types";
import type { LabBundle } from "@/lib/specimens";
import { DiffView } from "./DiffView";
import { Ecg } from "./bits";

type Stage = "diagnose" | "ritual" | "compare";
type Line = { text: string; cls?: "h" | "ok" | "bad" | "dim" };

const PHASES = [
  { id: "exhume", label: "Exhume the corpse" },
  { id: "transplant", label: "Transplant dependencies" },
  { id: "suture", label: "Suture breaking changes" },
  { id: "galvanize", label: "Galvanize regression tests" },
  { id: "verify", label: "Verify the pulse" },
] as const;

const SEV_LABEL: Record<Severity, string> = { fatal: "fatal", critical: "critical", warning: "warning", info: "info" };

function fmtAction(d: DepFinding) {
  const a = d.action;
  if (a.type === "remove") return "remove";
  if (a.type === "replace") return `→ ${a.to}@${a.range}`;
  if (a.type === "upgrade") return `→ ${a.range}`;
  return "keep";
}

function runSummary(r: RunResult) {
  return `${r.tests.pass}/${r.tests.pass + r.tests.fail}`;
}

function buildScript(b: LabBundle): Line[][] {
  const r = b.report;
  const v = r.vitals;
  const s: Line[][] = [[], [], [], [], []];
  const deps = r.deps.length;
  s[0].push({ text: `$ necro exhume ${b.meta.title}`, cls: "h" });
  s[0].push({ text: `  package.json: ${v.name} · declared node ${v.declaredNode ?? "—"} · ${deps} dependencies` });
  s[0].push({ text: `  scanned ${v.jsFiles} source files · ${v.totalLines} lines` });
  for (const c of r.configs) s[0].push({ text: `  ${c.severity === "info" ? "·" : "✗"} ${(c.file === "(none)" ? c.title : c.file).padEnd(16)} ${c.cause}`, cls: c.severity === "info" ? "dim" : "bad" });
  s[0].push({ text: `  cause of death: ${v.causeOfDeath}`, cls: "bad" });

  s[1].push({ text: "$ necro transplant --registry npm", cls: "h" });
  for (const d of r.deps) s[1].push({ text: `  ${d.name.padEnd(22)} ${d.declared.padEnd(9)} ${d.status.padEnd(10)} ${fmtAction(d)}`, cls: d.action.type === "keep" ? "dim" : undefined });
  const pkg = r.patches.find((p) => p.path === "package.json");
  pkg?.reasons.filter((x) => x.startsWith("+ ")).forEach((x) => s[1].push({ text: `  ${x}`, cls: "ok" }));

  s[2].push({ text: "$ necro suture --codemods all", cls: "h" });
  for (const p of r.patches.filter((p) => p.kind === "modified" && p.path !== "package.json")) {
    const n = r.code.filter((c) => c.file === p.path && c.fixed).length;
    s[2].push({ text: `  ✓ ${p.path.padEnd(28)} ${n} suture${n === 1 ? "" : "s"}`, cls: "ok" });
    p.reasons.slice(0, 4).forEach((x) => s[2].push({ text: `      ${x}`, cls: "dim" }));
  }
  for (const p of r.patches.filter((p) => p.kind !== "modified" && !p.path.startsWith("test/necro"))) {
    s[2].push({ text: `  ${p.kind === "added" ? "+" : "−"} ${p.path.padEnd(28)} ${p.reasons[0] ?? ""}`, cls: p.kind === "added" ? "ok" : "bad" });
  }
  const open = r.code.filter((c) => !c.fixed);
  if (open.length) s[2].push({ text: `  ⚠ ${open.length} call site(s) flagged for a human`, cls: "bad" });

  s[3].push({ text: "$ necro galvanize --runner node:test", cls: "h" });
  for (const t of r.tests) s[3].push({ text: `  + ${t.path.padEnd(32)} ${t.cases} ${t.strategy}`, cls: "ok" });

  s[4].push({ text: "$ necro verify --node 22", cls: "h" });
  if (b.verify) {
    const { before, after } = b.verify;
    s[4].push({ text: `  [corpse]       npm install ${before.install.ok ? "ok" : "FAILED"} (${(before.install.durationMs / 1000).toFixed(1)}s)`, cls: before.install.ok ? "dim" : "bad" });
    s[4].push({ text: `  [corpse]       node --test → ${runSummary(before)} passing`, cls: before.tests.fail ? "bad" : "dim" });
    s[4].push({ text: `  [resurrected]  npm install ${after.install.ok ? "ok" : "FAILED"} (${(after.install.durationMs / 1000).toFixed(1)}s)`, cls: after.install.ok ? "ok" : "bad" });
    s[4].push({ text: `  [resurrected]  node --test → ${runSummary(after)} passing`, cls: after.tests.fail ? "bad" : "ok" });
    for (const c of after.checks) s[4].push({ text: `  [resurrected]  ${c.command} → ${c.ok ? "ok" : "FAILED"}`, cls: c.ok ? "ok" : "bad" });
    s[4].push({ text: `  verified on ${b.verify.node} · npm ${b.verify.npm} · ${b.verify.verifiedAt.slice(0, 10)}`, cls: "dim" });
    const alive = after.install.ok && after.tests.fail === 0 && after.checks.every((c) => c.ok);
    s[4].push({ text: alive ? "\n  ⚡ IT'S ALIVE. ⚡" : "\n  ☠ still twitching — see the test board", cls: alive ? "ok" : "bad" });
  } else {
    s[4].push({ text: "  the web lab can't run npm for you — download the body and run:", cls: "dim" });
    s[4].push({ text: "  $ npm install && npm test" });
    s[4].push({ text: `\n  ⚡ ${r.patches.length} patches ready · pulse ${v.pulseBefore}% → ${v.pulseAfter}% (projected)`, cls: "ok" });
  }
  return s;
}

export function Lab({ bundle }: { bundle: LabBundle }) {
  const { report, verify, meta } = bundle;
  const [stage, setStage] = useState<Stage>("diagnose");
  const [resurrected, setResurrected] = useState(false);
  const v = report.vitals;

  const dead = report.deps.filter((d) => d.status === "dead" || d.status === "deprecated").length;
  const breaking = report.code.filter((c) => (c.severity === "fatal" || c.severity === "critical") && c.rule !== "callback-to-promise").length;

  return (
    <>
      <div className="lab-head">
        <div>
          <div className="crumbs">
            <Link href="/">morgue</Link> / {bundle.source === "github" ? "exhumed from GitHub" : "specimen"} / {meta.id}
          </div>
          <h1>{meta.title}</h1>
          {meta.epitaph ? <div className="sub">{meta.epitaph}</div> : null}
          <div className="toe">
            <span>
              era <b>{meta.era}</b>
            </span>
            <span>
              † <b>{meta.dateOfDeath}</b>
            </span>
            <span>
              files <b>{v.jsFiles}</b> · lines <b>{v.totalLines}</b>
            </span>
            {bundle.repoUrl ? (
              <a href={bundle.repoUrl} target="_blank" rel="noreferrer">
                view on GitHub ↗
              </a>
            ) : null}
          </div>
        </div>
        <div className="pulse-pair">
          <div className="pulse dead">
            <div className="lbl">pulse · before</div>
            <div className="val">{v.pulseBefore}%</div>
            <div className="bar">
              <i style={{ width: `${v.pulseBefore}%` }} />
            </div>
          </div>
          <div className={`pulse ${resurrected ? "alive" : "pending"}`}>
            <div className="lbl">pulse · after</div>
            <div className="val">{resurrected ? `${v.pulseAfter}%` : "—"}</div>
            <div className="bar">
              <i style={{ width: resurrected ? `${v.pulseAfter}%` : "0%" }} />
            </div>
          </div>
        </div>
      </div>

      <div className="stages" role="tablist">
        <button className={stage === "diagnose" ? "on" : ""} onClick={() => setStage("diagnose")} role="tab">
          <span className="n">01</span> Diagnose
        </button>
        <button className={stage === "ritual" ? "on" : ""} onClick={() => setStage("ritual")} role="tab">
          <span className="n">02</span> Resurrect
        </button>
        <button className={stage === "compare" ? "on" : ""} onClick={() => setStage("compare")} disabled={!resurrected} role="tab" title={resurrected ? "" : "Perform the ritual first"}>
          <span className="n">03</span> Before / After
        </button>
        <span className="spacer" />
      </div>

      {bundle.notes?.length ? (
        <div className="callout kiro">
          <div className="skull">ℹ</div>
          <div>
            <div className="k">lab notes</div>
            {bundle.notes.map((n) => (
              <div key={n} className="v" style={{ fontSize: 13 }}>
                {n}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {stage === "diagnose" && <Diagnose bundle={bundle} dead={dead} breaking={breaking} onNext={() => setStage("ritual")} />}
      {stage === "ritual" && (
        <Ritual
          bundle={bundle}
          done={resurrected}
          onDone={() => setResurrected(true)}
          onCompare={() => {
            setResurrected(true);
            setStage("compare");
          }}
        />
      )}
      {stage === "compare" && resurrected && <Compare bundle={bundle} />}
    </>
  );
}

function Diagnose({ bundle, dead, breaking, onNext }: { bundle: LabBundle; dead: number; breaking: number; onNext: () => void }) {
  const r = bundle.report;
  const suggestions = r.code.filter((c) => c.rule === "callback-to-promise");
  const breakingCode = r.code.filter((c) => c.rule !== "callback-to-promise");
  return (
    <div>
      <div className="callout">
        <div className="skull">☠</div>
        <div>
          <div className="k">cause of death</div>
          <div className="v">{r.vitals.causeOfDeath}</div>
        </div>
      </div>

      <div className="vitals">
        <div className="vital">
          <div className="n">{r.deps.length}</div>
          <div className="l">dependencies audited</div>
        </div>
        <div className={`vital ${dead ? "bad" : ""}`}>
          <div className="n">{dead}</div>
          <div className="l">dead or deprecated</div>
        </div>
        <div className={`vital ${breaking ? "bad" : ""}`}>
          <div className="n">{breaking}</div>
          <div className="l">breaking call sites</div>
        </div>
        <div className={`vital ${r.configs.length ? "warn" : ""}`}>
          <div className="n">{r.configs.length}</div>
          <div className="l">config fossils</div>
        </div>
      </div>

      <div className="panel">
        <header>
          <h3>Dependency graveyard</h3>
          <span className="meta">live npm registry · {r.generatedAt.slice(0, 10)}</span>
        </header>
        <div className="scroll-x">
          <table className="grave">
            <thead>
              <tr>
                <th>package</th>
                <th>declared</th>
                <th>latest</th>
                <th>status</th>
                <th>diagnosis</th>
                <th>treatment</th>
              </tr>
            </thead>
            <tbody>
              {r.deps.map((d) => (
                <tr key={d.section + d.name}>
                  <td className="pkg">
                    {d.name}
                    {d.section === "devDependencies" ? <span className="note"> dev</span> : null}
                  </td>
                  <td className="ver">{d.declared}</td>
                  <td className="ver">{d.latest ?? "?"}</td>
                  <td>
                    <span className={`status ${d.status}`}>{d.status}</span>
                  </td>
                  <td className="cause">{d.cause}</td>
                  <td>
                    <span className={`act ${d.action.type}`}>{fmtAction(d)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {r.configs.length ? (
        <div className="panel">
          <header>
            <h3>Config fossils</h3>
            <span className="meta">{r.configs.length}</span>
          </header>
          <ul className="findings">
            {r.configs.map((c) => (
              <li key={c.id}>
                <span className={`sev ${c.severity}`} title={SEV_LABEL[c.severity]} />
                <div>
                  <div className="msg">{c.title}</div>
                  <div className="cause">{c.cause}</div>
                  <div className="snip">→ {c.remedy}</div>
                </div>
                <span className="where">{c.file}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="panel">
        <header>
          <h3>Breaking changes in the code</h3>
          <span className="meta">
            {breakingCode.filter((c) => c.fixed).length} patchable · {breakingCode.filter((c) => !c.fixed).length} flagged
          </span>
        </header>
        {breakingCode.length ? (
          <ul className="findings">
            {breakingCode.map((c, i) => (
              <li key={i}>
                <span className={`sev ${c.severity}`} title={SEV_LABEL[c.severity]} />
                <div>
                  <div className="msg">
                    {c.message} {c.fixed ? null : <span className="status fossil">manual</span>}
                  </div>
                  <div className="snip">{c.snippet}</div>
                </div>
                <span className="where">
                  {c.file}:{c.line}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="note" style={{ padding: 18 }}>
            No known breaking API usage found in the scanned sources.
          </div>
        )}
      </div>

      {suggestions.length ? (
        <div className="panel">
          <header>
            <h3>Suggestions <span className="meta" style={{ fontWeight: "normal" }}>(optional modernisation)</span></h3>
            <span className="meta">{suggestions.length} hint{suggestions.length === 1 ? "" : "s"} · won't block resurrection</span>
          </header>
          <ul className="findings">
            {suggestions.map((c, i) => (
              <li key={i}>
                <span className={`sev ${c.severity}`} title={SEV_LABEL[c.severity]} />
                <div>
                  <div className="msg">{c.message}</div>
                  <div className="snip">{c.snippet}</div>
                </div>
                <span className="where">
                  {c.file}:{c.line}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="panel">
        <header>
          <h3>Migration plan</h3>
          <span className="meta">generated from .kiro/specs/migration-plan</span>
        </header>
        <div className="plan">
          {r.plan
            .filter((s) => s.items.length)
            .map((s, i) => (
              <div className="step" key={s.phase}>
                <h4>
                  <span className="n">{String(i + 1).padStart(2, "0")}</span>
                  {s.title}
                </h4>
                <ul>
                  {s.items.slice(0, 12).map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                  {s.items.length > 12 ? <li>…and {s.items.length - 12} more</li> : null}
                </ul>
              </div>
            ))}
        </div>
      </div>

      <div className="toolbar">
        <span className="grow" />
        <button className="btn btn-ecto" onClick={onNext}>
          Proceed to the ritual ⚡
        </button>
      </div>
    </div>
  );
}

function Ritual({ bundle, done, onDone, onCompare }: { bundle: LabBundle; done: boolean; onDone: () => void; onCompare: () => void }) {
  const script = useMemo(() => buildScript(bundle), [bundle]);
  const [phase, setPhase] = useState(done ? PHASES.length : -1);
  const [lines, setLines] = useState<Line[]>(done ? script.flat() : []);
  const timers = useRef<number[]>([]);
  const outRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    outRef.current?.scrollTo({ top: outRef.current.scrollHeight });
  }, [lines]);

  const start = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setLines([]);
    let t = 200;
    script.forEach((phaseLines, pi) => {
      timers.current.push(window.setTimeout(() => setPhase(pi), t));
      for (const l of phaseLines) {
        t += 70 + Math.min(110, l.text.length * 1.5);
        timers.current.push(window.setTimeout(() => setLines((prev) => [...prev, l]), t));
      }
      t += 450;
    });
    timers.current.push(
      window.setTimeout(() => {
        setPhase(PHASES.length);
        onDone();
      }, t),
    );
  };

  const skip = () => {
    timers.current.forEach(clearTimeout);
    setLines(script.flat());
    setPhase(PHASES.length);
    onDone();
  };

  const running = phase >= 0 && phase < PHASES.length;
  const finished = phase >= PHASES.length;

  return (
    <div className="ritual">
      <div className="altar">
        <h3>{finished ? "The specimen lives." : "Perform the resurrection"}</h3>
        <p>
          {bundle.verify
            ? "Replays the real pipeline run: audit, codemods, test generation, and the npm install + node --test evidence captured for this specimen."
            : "Runs the engine output for this repository. Verification happens on your machine — download the resurrected body afterwards."}
        </p>
        <Ecg alive={finished} />
        <ul className="phase-list">
          {PHASES.map((p, i) => (
            <li key={p.id} className={i < phase || finished ? "done" : i === phase ? "active" : ""}>
              <span className="dot">{i < phase || finished ? "✓" : ""}</span>
              {p.label}
            </li>
          ))}
        </ul>
        {!running && !finished ? (
          <button className="btn btn-ecto" onClick={start}>
            ⚡ Resurrect
          </button>
        ) : null}
        {running ? (
          <button className="btn btn-ghost btn-sm" onClick={skip}>
            Skip the incantation
          </button>
        ) : null}
        {finished ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-ecto" onClick={onCompare}>
              Compare before / after →
            </button>
            <button className="btn btn-ghost btn-sm" onClick={start}>
              Replay
            </button>
          </div>
        ) : null}
      </div>
      <div className="terminal">
        <div className="bar">
          <i />
          <i />
          <i />
          <span>necro@lab — {bundle.meta.title}</span>
        </div>
        <div className="out" ref={outRef}>
          {lines.length === 0 ? <div className="ln dim">awaiting the ritual…</div> : null}
          {lines.map((l, i) => (
            <div key={i} className={`ln ${l.cls ?? ""}`}>
              {l.text}
            </div>
          ))}
          {running ? <span className="cursor" /> : null}
        </div>
      </div>
    </div>
  );
}

function RunSide({ title, run, kind }: { title: string; run: RunResult; kind: "before" | "after" }) {
  const total = run.tests.pass + run.tests.fail;
  return (
    <div className={`side ${kind}`}>
      <h3>{title}</h3>
      <div className="big-score">
        {run.tests.pass}/{total}
        <small>tests passing</small>
      </div>
      <div className="rows">
        <div className="row">
          <span>npm install</span>
          <span className={run.install.ok ? "yes" : "no"}>{run.install.ok ? "✓ ok" : "✗ failed"}</span>
        </div>
        <div className="row">
          <span>node --test</span>
          <span className={run.tests.fail ? "no" : "yes"}>{run.tests.fail ? `✗ ${run.tests.fail} failing` : "✓ green"}</span>
        </div>
        {run.checks.map((c) => (
          <div className="row" key={c.name}>
            <span>{c.command}</span>
            <span className={c.ok ? "yes" : "no"}>{c.ok ? "✓ ok" : "✗ failed"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Compare({ bundle }: { bundle: LabBundle }) {
  const { report, verify } = bundle;
  const patches = report.patches;
  const firstCode = patches.find((p) => p.kind === "modified" && p.path !== "package.json") ?? patches[0];
  const [sel, setSel] = useState<string>(firstCode?.path ?? "");
  const current: FilePatch | undefined = patches.find((p) => p.path === sel);

  const download = () => {
    const tree = applyPatches(bundle.files, report);
    tree["NECROPSY.md"] = renderNecropsy(report, verify);
    const zip = zipSync(Object.fromEntries(Object.entries(tree).map(([p, c]) => [`${bundle.report.vitals.name}-resurrected/${p}`, strToU8(c)])), { level: 6 });
    const url = URL.createObjectURL(new Blob([zip as BlobPart], { type: "application/zip" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${bundle.report.vitals.name}-resurrected.zip`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  return (
    <div>
      {verify ? (
        <div className="verdict">
          <RunSide title={`† before — legacy tree on ${verify.node}`} run={verify.before} kind="before" />
          <RunSide title={`⚡ after — resurrected on ${verify.node}`} run={verify.after} kind="after" />
        </div>
      ) : (
        <div className="callout kiro">
          <div className="skull">⚗</div>
          <div>
            <div className="k">verification happens on your machine</div>
            <div className="v" style={{ fontSize: 13 }}>
              Download the resurrected body, then <code>npm install &amp;&amp; npm test</code>. The {report.tests.reduce((s, t) => s + t.cases, 0)} generated
              regression tests also run against the original tree, so you can see exactly what changed.
            </div>
          </div>
        </div>
      )}

      <div className="toolbar">
        <span className="note">
          {patches.filter((p) => p.kind === "modified").length} modified · {patches.filter((p) => p.kind === "added").length} added ·{" "}
          {patches.filter((p) => p.kind === "deleted").length} deleted
        </span>
        <span className="grow" />
        <button className="btn btn-ecto btn-sm" onClick={download}>
          ⬇ Download resurrected repo (.zip)
        </button>
      </div>

      <div className="panel">
        <header>
          <h3>Surgery diff</h3>
          <span className="meta">{current?.path}</span>
        </header>
        <div className="files">
          <div className="filelist">
            {patches.map((p) => (
              <button key={p.path} className={p.path === sel ? "on" : ""} onClick={() => setSel(p.path)} title={p.path}>
                <span className={`k ${p.kind}`}>{p.kind === "modified" ? "M" : p.kind === "added" ? "+" : "−"}</span>
                <span className="p">{p.path}</span>
              </button>
            ))}
          </div>
          <div className="diffpane">
            {current?.reasons.length ? (
              <div className="why">
                {current.reasons.slice(0, 14).map((r) => (
                  <span key={r} className="chip">
                    {r}
                  </span>
                ))}
              </div>
            ) : null}
            {current ? <DiffView key={current.path} before={current.before} after={current.after} /> : null}
          </div>
        </div>
      </div>

      {verify ? (
        <div className="panel">
          <header>
            <h3>Regression test board</h3>
            <span className="meta">same generated suite, both trees</span>
          </header>
          <div className="tests">
            {(["before", "after"] as const).map((k) => (
              <div key={k}>
                <div className="col-h">
                  {k === "before" ? "† legacy" : "⚡ resurrected"} · {runSummary(verify[k])}
                </div>
                {verify[k].tests.cases.length === 0 ? <div className="tcase note">no test results — the suite could not start</div> : null}
                {verify[k].tests.cases.map((c, i) => (
                  <div className="tcase" key={i}>
                    <span className={`i ${c.ok ? "yes" : "no"}`}>{c.ok ? "✓" : "✗"}</span>
                    <div>
                      <div className="nm">{c.name}</div>
                      {!c.ok && c.error ? <div className="e">{c.error.split("\n").slice(0, 3).join("\n")}</div> : null}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <details className="log">
            <summary>legacy npm install log</summary>
            <pre className="logbox">{verify.before.install.log}</pre>
          </details>
          <details className="log">
            <summary>resurrected node --test output</summary>
            <pre className="logbox">{verify.after.tests.log}</pre>
          </details>
        </div>
      ) : null}
    </div>
  );
}
