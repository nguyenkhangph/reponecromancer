# ⚰️⚡ RepoNecromancer

**Raise dead repos. Prove they live.**

RepoNecromancer exhumes abandoned JavaScript/Node.js projects, diagnoses what
killed them, transplants dead dependencies, patches breaking changes with
deterministic **AST codemods**, and proves the patient is alive with
**generated regression tests** that run against both the corpse and the
resurrected tree on Node 22.

Built for **Kiroween 2026, Resurrection track**, using Kiro specs, steering,
hooks and MCP (see [`/.kiro`](.kiro) and the "Built with Kiro" section below).

> Live lab: https://reponecromancer.vercel.app · Demo video: _(YouTube link, under 3 min)_

---

## What it does

| Phase | What happens | Where |
|---|---|---|
| **01 Exhume** | Reads `package.json`, Bower, Grunt, Travis, JSHint and every JS source (GitHub or local) | `engine/github.ts`, `engine/configs.ts` |
| **02 Transplant** | Audits every dependency against the live npm registry plus a curated *graveyard* (request, moment, node-uuid, left-pad, mkdirp, rimraf, optimist, bower, grunt, phantomjs, node-sass, tslint…) → remove / replace / upgrade | `engine/deps.ts`, `engine/knowledge.ts` |
| **03 Suture** | 30 AST codemod rules: Express 3→5, Node core removals (`util.puts`, `new Buffer`, `GLOBAL`, `os.tmpDir`), dead packages → native APIs, jQuery 1→4. Formatting outside each edit is preserved byte-for-byte | `engine/codemods.ts` |
| **04 Galvanize** | Generates `node:test` suites: JSDoc `@example` contracts, module-load, HTTP route smoke tests, server/CLI boot tests | `engine/testgen.ts` |
| **05 Verify** | `npm install` + `node --test` (+ lint/build) on **both** trees; results are stored as evidence | `scripts/verify-presets.ts` |

### Verified specimens (real runs, Node 22)

| Specimen | Legacy tree | Resurrected tree |
|---|---|---|
| `ghost-todo-api` — Express 3 API, request, moment, node-uuid, Travis | install ✅ · tests 16/17 (server dies on `util.puts`) | install ✅ · **17/17** · lint ✅ |
| `crypt-keeper-cli` — Node 0.6 CLI, optimist, left-pad, mkdirp, rimraf | install ✅ · tests **0/10** (`GLOBAL is not defined`) | install ✅ · **10/10** |
| `jquery-zombie-countdown` — jQuery 1.11, Bower, Grunt, PhantomJS | **install fails** (bower) | install ✅ · **7/7** · lint ✅ · build ✅ |

Re-run them yourself: `npm run necro:verify`.

---

## Quick start

```bash
npm install
npm run dev                  # the web lab on http://localhost:3000
npm test                     # engine unit tests
npm run necro:verify         # real before/after verification of all specimens
```

### CLI

```bash
# a local folder
npm run necro -- ./path/to/old-project --out ./old-project-resurrected
# or a GitHub repo
npm run necro -- request/request
cd request-resurrected && npm install && npm test
```

Every resurrected tree ships a `NECROPSY.md` with the diagnosis, the plan,
every patched call site and the generated tests.

### Web lab

- **Morgue** (`/`): paste a GitHub repo or open a verified specimen.
- **01 Diagnose**: cause of death, dependency graveyard, config fossils, breaking call sites, migration plan.
- **02 Resurrect**: the ritual — the pipeline replayed phase by phase.
- **03 Before / After**: verification side by side, per-test board, split diffs, and a `.zip` of the resurrected repo.

GitHub mode runs the full engine server-side (`/api/resurrect`); verification
then happens on your machine with the downloaded tree. Set `GITHUB_TOKEN` on
the deployment for higher GitHub rate limits (the engine falls back to a
codeload zip when the API is rate-limited).

---

## Built with Kiro

Everything Kiro used lives in [`/.kiro`](.kiro) and is committed on purpose.

- **Specs** (`.kiro/specs/`): `audit-engine`, `migration-plan`,
  `test-generation`, `resurrection-lab-ui` — each with EARS-style
  `requirements.md`, `design.md` and `tasks.md`. The engine was built task by
  task from these.
- **Steering** (`.kiro/steering/`): `product.md` (principles + vocabulary),
  `tech.md` (stack rules), `structure.md` (map of the repo), `codemods.md`
  (how to write a safe rule — auto-included when editing the engine) and
  `lab-ui.md` (the visual language — auto-included for UI files).
- **Hooks** (`.kiro/hooks/`): run engine tests on save; re-verify specimens
  when a codemod or preset changes; enforce the new-codemod checklist; keep
  spec checkboxes honest when the agent stops; draft the Devpost section on
  demand.
- **MCP** (`.kiro/settings/mcp.json`): `fetch` for npm registry and changelog
  lookups while curating the graveyard, `github` for pulling real legacy repos
  to test against.

---

## Design notes

- **Deterministic engine.** No LLM rewrites inside the engine: codemods are
  explicit AST rules with binding analysis (`util.puts` is only rewritten when
  `util` really is `require('util')`). Ambiguous sites are flagged, not
  guessed.
- **Behaviour first.** The `request` package becomes a 60-line `fetch` compat
  shim instead of a control-flow rewrite; `moment` becomes `dayjs` with only
  the plugins the file uses; `new Buffer(x)` picks `alloc`/`from` by argument
  shape.
- **Evidence.** The same generated suite runs on both trees; the UI shows only
  numbers that came from a real run.

## Project layout

```
app/          Next.js routes (morgue, /lab/[id], /exhume, /api/resurrect)
components/   Lab, DiffView, ExhumeForm
engine/       the resurrection engine (pure TS, used by web, API and CLI)
cli/          necro CLI
scripts/      verify-presets.ts
presets/      legacy specimens (data)
data/presets/ verification evidence consumed by the lab
.kiro/        specs, steering, hooks, MCP
```

## Team

Bùi Hoàng Long — core engine & Kiro workflow · Phạm Nguyễn Khang — web UI, demo & Devpost

## License

[MIT](LICENSE)
