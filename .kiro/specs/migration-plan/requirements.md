# Requirements — Migration plan & codemods (Suture)

## Introduction

Turn the diagnosis into an ordered plan and apply deterministic AST codemods
that patch breaking changes while preserving formatting and behaviour.

## Requirements

### Requirement 1 — Plan

1. THE SYSTEM SHALL emit a plan with five phases: exhume, transplant, suture, galvanize, verify.
2. WHEN a codemod rule fires THE SYSTEM SHALL aggregate it in the suture phase as "N patched, M flagged".

### Requirement 2 — Node core removals

1. WHEN code calls `util.puts/print/debug/error` on a `require('util'|'sys')` binding THE SYSTEM SHALL rewrite to `console.log`, `process.stdout.write` (joining multiple args) or `console.error`, and drop the require if it becomes unused.
2. WHEN code uses `new Buffer(x)` THE SYSTEM SHALL use `Buffer.alloc` for numeric/length expressions, `Buffer.from` for data, and a typeof-guarded ternary for size-like identifiers.
3. WHEN code uses `GLOBAL`, `os.tmpDir()`, `process.EventEmitter` or `require('sys')` THE SYSTEM SHALL replace them with `globalThis`, `os.tmpdir()`, `require('events').EventEmitter`, `require('util')`.

### Requirement 3 — Express 3 → 5

1. WHEN `app.configure(fn)` wraps setup THE SYSTEM SHALL unwrap and dedent the body; WHEN it is env-scoped THE SYSTEM SHALL emit `if (process.env.NODE_ENV === env)`.
2. WHEN bundled Connect middleware is used (`express.bodyParser/logger/methodOverride/cookieParser/session/compress/favicon`) THE SYSTEM SHALL replace it with `express.json()+urlencoded()` or the standalone package, and add that package.
3. WHEN `app.use(app.router)` exists THE SYSTEM SHALL remove it.
4. WHEN `res.send|json(status, body)` or `res.send(status)` is used THE SYSTEM SHALL emit `res.status(s).send|json(body)` / `res.sendStatus(s)`.
5. WHEN `app.del`, `req.param(name)`, `res.sendfile`, `'*'` or `:param?` routes are used THE SYSTEM SHALL emit `app.delete`, `params ?? body ?? query`, `res.sendFile`, `/{*splat}`, `{/:param}`.

### Requirement 4 — Dead packages → native

1. `request` → generated fetch-based compat shim (`necro-compat/request.js`, callback API). `request-promise` → `necro-compat/request-promise.js`, which resolves with the body (or the full response with `resolveWithFullResponse`) and rejects non-2xx with `StatusCodeError` unless `simple: false` — the shims must preserve each library's semantics, verified by a live HTTP test.
2. `node-uuid` → `node:crypto` `randomUUID()`.
3. `moment` → `dayjs` plus only the plugins the file needs.
4. `left-pad`, `mkdirp`, `rimraf` → `padStart`, `fs.mkdir*`, `fs.rm*`; requires removed.
5. `require('optimist').argv` → `yargs-parser`.

### Requirement 5 — jQuery 1 → 4

1. `.bind/.unbind` with an event-name string → `.on/.off` (Function#bind untouched).
2. `.delegate(sel, ev, fn)` → `.on(ev, sel, fn)`; `$(sel).live(ev, fn)` → `$(document).on(ev, sel, fn)`.
3. `.size()` → `.length`; `$.trim/isArray/parseJSON/now/isFunction` → native.
4. `$.browser.*` → `false`/`undefined`, and a resulting dead `if (false && …)` branch is removed with an explanatory comment.

### Requirement 6 — Safety

1. IF two edits overlap THEN THE SYSTEM SHALL keep the first, record the second as `fixed: false`, and never throw.
2. THE SYSTEM SHALL leave every byte outside an edited range unchanged.
