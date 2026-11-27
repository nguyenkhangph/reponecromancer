# Tasks — Migration plan & codemods

- [x] 1. AST utilities: parse with recovery, walk with parents, bindings — _Req 6_
- [x] 2. `safe()` edit wrapper + finding recorder — _Req 6.1_
- [x] 3. Node core rules: util-print, buffer-constructor, global-alias, os-tmpdir, process-eventemitter, sys-module — _Req 2_
- [x] 4. Express rules: configure, bundled-middleware, app-router, status-args, app-del, req-param, sendfile, path-syntax, create-server — _Req 3_
- [x] 5. Package rules: request shim + request-promise shim (body/StatusCodeError semantics), node-uuid, moment→dayjs (+plugins), left-pad, mkdirp, rimraf, optimist — _Req 4_
- [x] 6. jQuery rules: bind/unbind, delegate/live, size, static utils, $.browser + dead-branch removal — _Req 5_
- [x] 7. Pass 2: require cleanup for fully migrated modules (incl. util after util-print) — _Req 2.1, 4.4_
- [x] 8. Plan builder in `resurrect()` — _Req 1_
- [x] 9. Flag-only rules: fs.exists, url.parse, domain — _Req 6_
- [x] 10. Verify on all specimens with lint + build checks (`npm run necro:verify`)
- [ ] 11. Callback → async/await suggestions (flag-only, stretch)
