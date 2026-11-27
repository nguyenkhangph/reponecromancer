# Requirements — Regression test generation (Galvanize)

## Introduction

A resurrection is only credible if behaviour is preserved. The generator
writes characterization tests that run unchanged against the legacy tree and
the resurrected tree using only `node:test` (zero dependencies).

## Requirements

### Requirement 1 — JSDoc @example contracts

1. WHEN a JSDoc block contains `@example <expr> // => <expected>` THE SYSTEM SHALL generate `assert.deepStrictEqual(<expr>, <expected>)`.
2. WHEN it contains `// throws` THE SYSTEM SHALL generate `assert.throws`.
3. THE SYSTEM SHALL resolve every called identifier in the example against the module's exports at runtime (`pick(mod, name)`), so `format.tag()` and bare `seal()` both work.
4. THE SYSTEM SHALL `require()` the module inside each test so one broken module yields N failing cases rather than a crashed suite.
5. IF the expression or expected value does not parse THEN THE SYSTEM SHALL skip the example.

### Requirement 2 — Module load smoke tests

1. THE SYSTEM SHALL generate one test per library module that `require()`s it.
2. THE SYSTEM SHALL skip entry points, files with a shebang, files that call `.listen(`, and browser-only files (jQuery/window/document without a UMD guard).

### Requirement 3 — HTTP route smoke tests

1. WHEN a module does `module.exports = app` for an `express()` app THE SYSTEM SHALL list its literal routes.
2. THE SYSTEM SHALL start the app on an ephemeral port once per suite and hit each route (params replaced by `necro-probe`, JSON body `{}` for non-GET).
3. THE SYSTEM SHALL assert the status is not 500 — an unhandled crash — while allowing 4xx and upstream 502/503.

### Requirement 4 — Entrypoint boot tests

1. WHEN `scripts.start` is `node <file>` THE SYSTEM SHALL spawn it with `PORT=0` and require it to stay alive for 2.5 s.
2. WHEN `bin` entries exist THE SYSTEM SHALL run each with no arguments and fail only on a stack trace or signal.

### Requirement 5 — Wiring

1. THE SYSTEM SHALL write suites to `test/necro/*.test.cjs` and set `scripts.test` to `node --test <files>` (appending to an existing mocha suite when one exists).
2. THE verification script SHALL run the same suite on both trees and record per-case results with a JSON reporter.
