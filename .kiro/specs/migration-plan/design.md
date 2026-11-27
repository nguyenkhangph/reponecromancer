# Design — Migration plan & codemods

## Two-pass surgery

**Pass 1 — call sites.** Parse, collect bindings (`require()` locals,
`express()` apps), walk once, queue `magic-string` edits. Each edit is wrapped
in `safe()`; a thrown overlap becomes an unfixed finding.

**Pass 2 — structure.** Re-parse the pass-1 output and do the edits that need a
stable tree: unwrap `app.configure`, add dayjs plugins after the require,
remove dead `$.browser` branches, delete requires whose binding has zero
remaining references.

Splitting the passes avoids the classic codemod trap where a structural
rewrite (unwrapping a function body) conflicts with call-site edits inside it.

## Binding-aware matching

```js
var u = require('util'); u.puts('x')   // ✓ rewritten
var util = myLogger;     util.puts('x') // ✗ untouched — not node's util
```

## The `request` shim

Instead of rewriting every callback into `await fetch()`, which changes control
flow, we redirect `require('request')` to a 60-line shim implementing
`request(url|opts, cb)` and `request.get/post/...` on native `fetch` with
`json`, `qs`, `form`, `headers`, `timeout`. Behaviour preserved; dependency
(and its 47 transitive packages) gone.

## Rule catalogue

`RULES` in `engine/codemods.ts` is the single source of truth (id, title,
severity). The UI, plan and NECROPSY.md read titles from it.
