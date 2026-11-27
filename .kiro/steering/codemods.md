---
inclusion: fileMatch
fileMatchPattern: ["engine/codemods.ts", "engine/knowledge.ts", "engine/ast.ts"]
---

# Writing a codemod rule

1. Add the rule id to `RULES` with a human title and a severity:
   `fatal` = crashes on modern Node/library, `critical` = removed in the target
   major, `warning` = deprecated/replaceable, `info` = flag-only.
2. Detect with the AST, never with regex on source (regex is fine for
   *choosing* plugins, e.g. dayjs relativeTime).
3. Resolve bindings through `collectBindings()` — `util.puts` only matters if
   `util` is actually `require('util')`; `app.del` only if `app = express()`.
4. Edit through `safe(fn, rule, index, module?)`. Prefer the smallest range
   (e.g. overwrite `.json(201, ` → `.status(201).json(`) so nested edits
   still compose.
5. If the rule removes the need for a package, pass the module name so the
   dependency audit can drop it — and make sure the `require()` disappears in
   pass 2 when no references remain.
6. Ambiguous semantics → leave the code, emit `fixed: false`. Example:
   `new Buffer(x)` where `x` may be a number becomes a guarded ternary only for
   size-like identifiers; otherwise `Buffer.from`.
7. Add a case to `engine/engine.test.ts`, run `npm test`, then
   `npm run necro:verify` to prove no specimen regressed.
