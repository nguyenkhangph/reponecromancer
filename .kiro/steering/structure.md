---
inclusion: always
---

# Repository structure

```
.kiro/                 specs, steering, hooks, MCP settings (part of the submission — never ignore)
app/                   Next.js routes: / (morgue), /lab/[id] (specimen), /exhume?repo= (GitHub), /api/resurrect
components/            Lab (Diagnose → Resurrect → Before/After), DiffView, ExhumeForm, bits
engine/
  index.ts             resurrect(): orchestrates the five phases
  ast.ts               babel parse + walk + require()/express() binding analysis
  codemods.ts          RULES + applyCodemods() (two passes: call sites, then structure)
  configs.ts           Travis/Bower/Grunt/JSHint/engines → GitHub Actions/npm/ESLint
  deps.ts              dependency audit (graveyard + live registry) → new package.json
  knowledge.ts         GRAVEYARD, MAJOR_MIGRATIONS, INTRODUCED
  testgen.ts           JSDoc @example, module-load, route-smoke, entrypoint-boot suites
  github.ts            REST + raw fetch, codeload zip fallback
  report.ts            NECROPSY.md renderer (browser-safe)
  shims.ts             request → fetch compat shim
cli/necro.ts           `npm run necro -- <dir|owner/repo>`
scripts/               verify-presets.ts (+ json reporter)
presets/<id>/          legacy specimens (data — not compiled, not linted)
data/presets/<id>.json verified evidence consumed by the web lab
```
