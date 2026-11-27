# Devpost draft — RepoNecromancer

**Live lab:** https://reponecromancer.fun · **Repo:** https://github.com/nguyenkhangph/reponecromancer


**Track:** Resurrection · **Bonus:** Kiro Crew, Best Demo

## Inspiration

npm is a graveyard. Thousands of useful projects from 2012–2016 still work *in
principle* but won't install or boot on a modern Node: Express 3 lost Connect,
Node 12 deleted `util.puts`, Bower's registry froze, Travis CI shut down,
PhantomJS stopped downloading. Upgrading by hand is boring, risky and nobody
trusts the result. We wanted a necromancer that brings them back **and shows
proof**.

## What it does

Point RepoNecromancer at a GitHub repo (or open a bundled specimen):

1. **Exhume**: reads the manifest, configs and every source file.
2. **Transplant**: audits each dependency against the live npm registry and a
   curated graveyard, then removes, replaces or upgrades it.
3. **Suture**: 31 deterministic AST codemod rules patch the breaking changes
   (Express 3→5, Node core removals, jQuery 1→4, dead packages → native APIs)
   while leaving every other byte untouched.
4. **Galvanize**: generates `node:test` regression suites from JSDoc
   `@example`s, HTTP routes (with golden-master response shapes recorded from
   the legacy tree), module loads and entry points.
5. **Verify**: installs and tests both the corpse and the resurrected tree
   on Node 22.

The lab shows the cause of death, the migration plan, a replay of the ritual,
split diffs of every patch, a per-test before/after board and a downloadable
`.zip` with a `NECROPSY.md`.

Real results: `crypt-keeper` goes from 0/10 tests to 10/10; the Bower/Grunt
jQuery plugin goes from "npm install fails" to install + lint + build + 7/7
tests; the Express 3 API goes to 17/17 with lint green.

## How we built it with Kiro

- **Spec-driven development.** We wrote four specs before code:
  `audit-engine`, `migration-plan`, `test-generation`, `resurrection-lab-ui`.
  The requirements use EARS ("WHEN code calls `util.puts` … THE SYSTEM SHALL
  …"), the designs fixed the key architecture decisions (codemods *before* the
  dependency audit; a two-pass AST surgery; a `request`→`fetch` shim instead
  of a control-flow rewrite), and `tasks.md` tracks implementation. Example:
  we asked Kiro to add `request-promise` to the graveyard. It read the
  specs, ran the tests first, wrote the graveyard entry and a unit test, and
  the hooks then updated `migration-plan` requirement 4.1 and the task lists
  in two specs. Review against the spec's "preserve behaviour" principle
  caught that request-promise resolves with the *body* and rejects non-2xx,
  so it got its own shim plus a live-HTTP semantics test.
- **Steering docs.** `product.md` set the "evidence over vibes" and
  "deterministic engine" rules and the vocabulary used everywhere in the UI.
  `codemods.md` is scoped by `fileMatch` to the engine, so every new rule
  followed the same safe pattern (binding analysis, `safe()` edits, flag
  instead of guess). `lab-ui.md` is scoped to UI files and holds the
  resurrection-lab palette and patterns.
- **Agent hooks.** Saving an engine file runs the unit tests; editing a codemod
  or a specimen re-runs the real before/after verification (the kind of check
  that exposed `new Buffer(buf.length)` → `Buffer.from(number)` during
  development); a checklist hook keeps the graveyard, tests and specs in sync; an
  `Stop` hook ticks spec tasks; a manual `#devpost-writeup` steering prompt
  drafts this write-up.
- **MCP.** `.kiro/settings/mcp.json` configures a `fetch` server (npm registry
  metadata, changelogs for the graveyard) and a `github` server (pulling real
  legacy repos to test intake). Example: asked Kiro to cross-check the
  graveyard against reality, it used the `fetch` MCP to read
  `registry.npmjs.org/left-pad/latest` (confirming npm's own
  "use String.prototype.padStart()" deprecation, matching our graveyard
  entry) and read `bower/bower`'s package.json, finding 7 graveyard packages
  (request, mkdirp, rimraf, q, node-uuid, mocha, chai) — which is why
  bower/bower is one of the suggested repos in the lab. The `Stop` hook then
  fired and confirmed no spec tasks needed updating. With the `github` MCP
  (`get_file_contents` on bower/bower v1.8.14) Kiro listed all 56
  dependencies and flagged the same 7 graveyard packages — and surfaced
  `"nock-legacy": "npm:nock@9.2.3"`, the npm-alias form our dependency audit
  had initially misread as a dead package (now handled and unit-tested).

## Challenges

- Making codemods compose: structural rewrites (`app.configure` unwrapping)
  conflicted with call-site edits inside them, so we split the surgery into
  two parsed passes.
- Proving behaviour preservation without existing tests: characterization
  tests that run on both trees.

## Accomplishments

- Every number in the UI is from a real run, reproducible with
  `npm run necro:verify`.
- Zero-dependency generated tests (`node:test`) that run inside 2012-era CJS
  packages.

## What's next

Graveyards for Python (setup.py/distutils, Python 2 idioms) and Ruby, automatic
callback→async rewrites (today they are suggestions only), and a GitHub App
that opens the resurrection as a pull request.

## Built with

Kiro · TypeScript · Next.js · React · Babel parser · magic-string · jsdiff ·
fflate · node:test · Vercel

---

## Demo video script (≤ 3:00)

| Time | Shot | Voice-over |
|---|---|---|
| 0:00–0:15 | Morgue page, ECG beating | "npm is a graveyard. This is RepoNecromancer." |
| 0:15–0:40 | Open `crypt-keeper` → Diagnose | "Cause of death: `GLOBAL`, `os.tmpDir()`, `util.print`. 0 of 10 tests pass on Node 22." |
| 0:40–1:05 | Resurrect → terminal ritual | "Exhume, transplant, suture, galvanize, verify." |
| 1:05–1:40 | Before/After: test board red → green, diff of `lib/crypt.js` | "Same generated suite on both trees. 10/10." |
| 1:40–2:05 | Zombie widget: install fails → lint/build/tests green; diff of `$.browser` | "Bower, Grunt and PhantomJS, gone." |
| 2:05–2:25 | Paste a real GitHub repo | "Works on real repos too." |
| 2:25–2:55 | Kiro: specs, steering, hooks firing in the IDE | "Built spec-first with Kiro: specs, steering, hooks and MCP." |
| 2:55–3:00 | Logo | "Raise dead repos. Prove they live." |
