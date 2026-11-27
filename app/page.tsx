import Link from "next/link";
import { Ecg, Footer, TopBar } from "@/components/bits";
import { ExhumeForm } from "@/components/ExhumeForm";
import { SPECIMENS, specimenSummary } from "@/lib/specimens";
import { RULES } from "@/engine/codemods";

const RULE_COUNT = Object.keys(RULES).length;

const PHASES = [
  { n: "01", t: "Exhume", d: "Read the corpse: package.json, Bower, Grunt, Travis, JSHint, every JS source.", k: "spec: audit-engine" },
  { n: "02", t: "Transplant", d: "Audit each dependency against the live npm registry and a curated graveyard; remove, replace or upgrade.", k: "MCP: npm registry" },
  { n: "03", t: "Suture", d: `${RULE_COUNT} AST codemod rules patch the breaking changes: Express 3→5, Node core removals, jQuery 1→4, dead packages → native APIs.`, k: "spec: migration-plan" },
  { n: "04", t: "Galvanize", d: "Generate node:test regression suites from JSDoc @examples, HTTP routes, module loads and entrypoints.", k: "spec: test-generation" },
  { n: "05", t: "Verify", d: "Install and test both the corpse and the resurrected tree on modern Node. Evidence, not vibes.", k: "hook: verify-specimens" },
];

export default function Home() {
  return (
    <>
      <TopBar />
      <main>
        <section className="hero">
          <div className="wrap">
            <span className="eyebrow">Resurrection lab · online</span>
            <h1>
              Raise <em>dead repos</em>.
              <br />
              Prove they live.
            </h1>
            <p className="lede">
              RepoNecromancer exhumes abandoned JavaScript projects, diagnoses <b>what killed them</b>, transplants dead dependencies, sutures
              breaking changes with <b>AST codemods</b>, and proves the patient is alive with <b>generated regression tests</b> that run green on
              Node 22.
            </p>
            <ExhumeForm />
          </div>
          <div style={{ marginTop: 40 }}>
            <Ecg alive />
          </div>
        </section>

        <section className="block" id="specimens">
          <div className="wrap">
            <div className="section-head">
              <h2>The morgue</h2>
              <span className="count">{SPECIMENS.length} specimens · verified on every build</span>
              <p>Synthetic specimens modelled on real 2012–2014 codebases. Each one was installed and tested before and after resurrection — the numbers below are real runs.</p>
            </div>
            <div className="specimens">
              {SPECIMENS.map((s, i) => {
                const sum = specimenSummary(s.id)!;
                return (
                  <Link key={s.id} href={`/lab/${s.id}`} className="tag-card">
                    <div className="no">Specimen #{String(i + 1).padStart(3, "0")}</div>
                    <h3>{s.title}</h3>
                    <div className="era">{s.era}</div>
                    <p className="epitaph">{s.epitaph}</p>
                    <div className="chips">
                      {s.stack.map((c) => (
                        <span key={c} className="chip dead">
                          {c}
                        </span>
                      ))}
                    </div>
                    <div className="stats">
                      <div className="before">
                        <b>{sum.before.install ? `${sum.before.pass}/${sum.before.total}` : "✗"}</b>
                        {sum.before.install ? "tests before" : "install fails"}
                      </div>
                      <div className="arrow">→</div>
                      <div className="after">
                        <b>
                          {sum.after.pass}/{sum.after.total}
                        </b>
                        tests after
                      </div>
                    </div>
                    <div className="dod">
                      † {s.dateOfDeath} · pulse {sum.pulseBefore}% → {sum.pulseAfter}%
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <section className="block" id="ritual">
          <div className="wrap">
            <div className="section-head">
              <h2>The ritual</h2>
              <span className="count">five phases</span>
            </div>
            <div className="phases">
              {PHASES.map((p) => (
                <div className="phase" key={p.n}>
                  <div className="n">{p.n}</div>
                  <h4>{p.t}</h4>
                  <p>{p.d}</p>
                  <div className="kiro">{p.k}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="block" id="kiro">
          <div className="wrap">
            <div className="section-head">
              <h2>Built with Kiro</h2>
              <span className="count">see /.kiro in the repo</span>
            </div>
            <div className="kiro-grid">
              <div className="kiro-card">
                <h4>Specs</h4>
                <p>
                  Each engine phase is a spec — EARS requirements, design and tasks in <code>.kiro/specs/*</code>.
                </p>
              </div>
              <div className="kiro-card">
                <h4>Steering</h4>
                <p>
                  Product, tech, structure and the “resurrection lab” UI language in <code>.kiro/steering</code>.
                </p>
              </div>
              <div className="kiro-card">
                <h4>Hooks</h4>
                <p>Saving a codemod re-runs the engine tests; touching a specimen re-verifies it; specs stay in sync with code.</p>
              </div>
              <div className="kiro-card">
                <h4>MCP</h4>
                <p>
                  Fetch + GitHub MCP servers in <code>.kiro/settings/mcp.json</code> let the agent query npm and real legacy repos while building.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
