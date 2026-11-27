# Tasks — Audit engine

- [x] 1. Define report types (`engine/types.ts`) — _Req 2, 4_
- [x] 2. Implement `npmRegistry()` with abbreviated metadata + per-run cache — _Req 2.1, 2.7_
- [x] 3. Implement `snapshotRegistry()` for offline tests — _Req 2_
- [x] 4. Curate the graveyard: request, node-uuid, moment, left-pad, mkdirp, rimraf, optimist, mocha/should/chai, jshint, grunt*, bower, phantomjs, node-sass, tslint, babel-eslint, coffee-script, jade, istanbul, gulp-util, body-parser, colors, q, nomnom — _Req 2.2_
- [x] 5. `auditDependencies()` with remove/replace/upgrade/keep decisions driven by codemod outcome — _Req 2.3–2.6_
- [x] 6. `analyzeConfigs()` for Travis, Bower, Grunt, JSHint, gulp, engines, lockfile, license — _Req 3_
- [x] 7. ESLint flat-config translator from `.jshintrc` (comments allowed) — _Req 3.4_
- [x] 8. Pulse + cause of death — _Req 4_
- [x] 9. GitHub intake with prioritised file sampling and zip fallback — _Req 1_
- [x] 10. Unit tests in `engine/engine.test.ts` (offline registry) — _all_
- [ ] 11. Python/Ruby graveyards (stretch, post-Kiroween)
