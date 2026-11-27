import test from "node:test";
import assert from "node:assert/strict";
import { applyCodemods } from "./codemods";
import { resurrect, snapshotRegistry, applyPatches } from "./index";
import { generateTests } from "./testgen";
import { jsonShape } from "./testgen-shape";
import { parseRepoInput } from "./github";

const run = (code: string, path = "app.js") => applyCodemods(path, code, {});

test("new Buffer(string) → Buffer.from, new Buffer(n) → Buffer.alloc", () => {
  const r = run(`var a = new Buffer('x', 'base64'); var b = new Buffer(16); var c = new Buffer(buf.length);`);
  assert.match(r.code, /Buffer\.from\('x', 'base64'\)/);
  assert.match(r.code, /Buffer\.alloc\(16\)/);
  assert.match(r.code, /Buffer\.alloc\(buf\.length\)/);
});

test("util.puts/print are rewritten and the unused util require is dropped", () => {
  const r = run(`var util = require('util');\nutil.puts('a');\nutil.print('b', 'c');\n`);
  assert.equal(r.code, `console.log('a');\nprocess.stdout.write(['b', 'c'].join(''));\n`);
});

test("Express 3 app is lifted to Express 5 idioms", () => {
  const src = `var express = require('express');
var app = express();
app.configure(function () {
  app.use(express.bodyParser());
  app.use(app.router);
});
app.get('/x/:id', function (req, res) { res.send(404, req.param('id')); });
app.del('/x/:id', function (req, res) { res.send(204); });
module.exports = app;
`;
  const r = run(src);
  assert.doesNotMatch(r.code, /configure|bodyParser|app\.router|app\.del\(|req\.param\(/);
  assert.match(r.code, /app\.use\(express\.json\(\)\);\napp\.use\(express\.urlencoded/);
  assert.match(r.code, /res\.status\(404\)\.send\(req\.params\.id \?\? req\.body\?\.id \?\? req\.query\.id\)/);
  assert.match(r.code, /res\.sendStatus\(204\)/);
  assert.match(r.code, /app\.delete\('/);
});

test("left-pad, mkdirp, rimraf collapse into native APIs and their requires vanish", () => {
  const r = run(`var leftPad = require('left-pad');\nvar mkdirp = require('mkdirp');\nvar rimraf = require('rimraf');\nleftPad(1, 3, 0);\nmkdirp.sync(d);\nrimraf.sync(d);\n`);
  assert.doesNotMatch(r.code, /require\('(left-pad|mkdirp|rimraf)'\)/);
  assert.match(r.code, /String\(1\)\.padStart\(3, String\(0 \?\? ' '\)\)/);
  assert.deepEqual([...r.migrated].sort(), ["left-pad", "mkdirp", "rimraf"]);
});

test("moment → dayjs adds the relativeTime plugin only when needed", () => {
  const a = run(`var moment = require('moment');\nmoment(x).fromNow();\n`);
  assert.match(a.code, /require\('dayjs'\);\nmoment\.extend\(require\('dayjs\/plugin\/relativeTime'\)\);/);
  const b = run(`var moment = require('moment');\nmoment().toISOString();\n`);
  assert.doesNotMatch(b.code, /extend/);
});

test("jQuery: .bind with event string → .on, but Function#bind is untouched", () => {
  const r = run(`$(el).bind('click', fn); var g = f.bind(this); $(el).find('a').size();`, "w.js");
  assert.match(r.code, /\$\(el\)\.on\('click', fn\)/);
  assert.match(r.code, /f\.bind\(this\)/);
  assert.match(r.code, /\.find\('a'\)\.length/);
});

test("JSDoc @example lines become characterization tests", () => {
  const files = { "lib/m.js": `/**\n * @example add(1, 2) // => 3\n */\nexports.add = function (a, b) { return a + b; };\n` };
  const t = generateTests(files, { name: "m" });
  const ex = t.find((x) => x.strategy === "jsdoc-example");
  assert.ok(ex);
  assert.equal(ex.cases, 1);
  assert.match(ex.content, /assert\.deepStrictEqual\(add\(1, 2\), 3\)/);
});

test("resurrect() produces a coherent package.json against an offline registry", async () => {
  const registry = snapshotRegistry({ express: { latest: "5.1.0" }, request: { latest: "2.88.2", deprecated: "request has been deprecated" }, dayjs: { latest: "1.11.13" }, moment: { latest: "2.30.1" } });
  const files = {
    "package.json": JSON.stringify({ name: "x", engines: { node: "0.10" }, dependencies: { express: "3.4.8", request: "2.34.0", moment: "2.5.1" } }),
    "index.js": `var request = require('request');\nvar moment = require('moment');\nmodule.exports = function () { return moment().toISOString(); };\n`,
  };
  const r = await resurrect(files, { registry });
  const pkg = JSON.parse(applyPatches(files, r)["package.json"]);
  assert.equal(pkg.engines.node, ">=20");
  assert.deepEqual(pkg.dependencies, { dayjs: "^1.11.13", express: "^5.1.0" });
  assert.ok(r.patches.some((p) => p.path === "necro-compat/request.js" && p.kind === "added"));
  assert.ok(r.vitals.pulseAfter > r.vitals.pulseBefore);
});

test("request-promise is flagged as deprecated in the graveyard", async () => {
  const registry = snapshotRegistry({ "request-promise": { latest: "4.2.6", deprecated: "request-promise has been deprecated" } });
  const files = {
    "package.json": JSON.stringify({ name: "x", dependencies: { "request-promise": "^4.2.6" } }),
    "index.js": `var rp = require('request-promise');\nrp('https://example.com').then(console.log);\n`,
  };
  const r = await resurrect(files, { registry });
  const rpDep = r.deps.find((d) => d.name === "request-promise")!;
  assert.equal(rpDep.status, "deprecated");
  assert.equal(rpDep.action.type, "remove");
  assert.ok(r.patches.some((p) => p.path === "necro-compat/request.js" && p.kind === "added"));
  assert.ok(r.patches.some((p) => p.path === "necro-compat/request-promise.js" && p.kind === "added"));
  assert.match(r.patches.find((p) => p.path === "index.js")!.after!, /require\('\.\/necro-compat\/request-promise\.js'\)/);
  const pkg = JSON.parse(r.patches.find((p) => p.path === "package.json")!.after!);
  assert.ok(!pkg.dependencies?.["request-promise"], "request-promise must be removed from package.json");
});

test("compat shims keep request (callback) and request-promise (body, rejects non-2xx) semantics", async () => {
  const { mkdtempSync, writeFileSync, mkdirSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { createRequire } = await import("node:module");
  const http = await import("node:http");
  const { REQUEST_SHIM, REQUEST_PROMISE_SHIM } = await import("./shims");
  const dir = mkdtempSync(join(tmpdir(), "necro-shim-"));
  mkdirSync(join(dir, "necro-compat"));
  writeFileSync(join(dir, "necro-compat", "request.js"), REQUEST_SHIM);
  writeFileSync(join(dir, "necro-compat", "request-promise.js"), REQUEST_PROMISE_SHIM);
  const req = createRequire(join(dir, "x.js"));
  const request = req("./necro-compat/request.js");
  const rp = req("./necro-compat/request-promise.js");

  const server = http.createServer((q, s) => {
    if (q.url === "/missing") { s.statusCode = 404; s.end("nope"); return; }
    s.setHeader("content-type", "application/json");
    s.end(JSON.stringify({ ok: true, method: q.method }));
  });
  await new Promise<void>((res) => server.listen(0, "127.0.0.1", () => res()));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  try {
    const cb = await new Promise<any>((res, rej) => request({ uri: base + "/x", json: true }, (e: any, r: any, body: any) => (e ? rej(e) : res({ r, body }))));
    assert.equal(cb.r.statusCode, 200);
    assert.deepEqual(cb.body, { ok: true, method: "GET" });

    assert.deepEqual(await rp({ uri: base + "/x", json: true }), { ok: true, method: "GET" });
    assert.deepEqual(await rp.post({ uri: base + "/x", json: true, body: { a: 1 } }), { ok: true, method: "POST" });
    assert.equal((await rp({ uri: base + "/x", resolveWithFullResponse: true })).statusCode, 200);
    await assert.rejects(rp(base + "/missing"), (e: any) => e.name === "StatusCodeError" && e.statusCode === 404);
    assert.equal(await rp({ uri: base + "/missing", simple: false }), "nope");
  } finally {
    server.close();
  }
});

test("jsonShape reduces nested objects, arrays, null, and primitives", () => {
  assert.deepEqual(jsonShape(null), "null");
  assert.deepEqual(jsonShape("hello"), "string");
  assert.deepEqual(jsonShape(42), "number");
  assert.deepEqual(jsonShape(true), "boolean");
  assert.deepEqual(jsonShape([]), []);
  assert.deepEqual(jsonShape([1, 2, 3]), ["number"]);
  assert.deepEqual(jsonShape({ a: 1, b: "x" }), { a: "number", b: "string" });
  assert.deepEqual(jsonShape({ items: [{ id: 1, name: "ghost" }], total: 1 }), { items: [{ id: "number", name: "string" }], total: "number" });
  assert.deepEqual(jsonShape({ nested: { deep: null } }), { nested: { deep: "null" } });
});

test("parseRepoInput accepts urls and owner/repo", () => {
  assert.deepEqual(parseRepoInput("https://github.com/a/b.git"), { owner: "a", repo: "b", ref: undefined });
  assert.deepEqual(parseRepoInput("a/b"), { owner: "a", repo: "b", ref: undefined });
  assert.equal(parseRepoInput("not a repo"), null);
});

test("callback-to-promise: detects fs.readFile with err-param callback", () => {
  const r = run(`var fs = require('fs');\nfs.readFile(p, function (err, data) {});\n`);
  const f = r.findings.find((x) => x.rule === "callback-to-promise");
  assert.ok(f, "should emit a callback-to-promise finding");
  assert.equal(f!.fixed, false);
  assert.match(f!.message, /fs\.readFile\(…, callback\) → await fs\.promises\.readFile\(…\)/);
});

test("callback-to-promise: ignores fs.readFileSync", () => {
  const r = run(`var fs = require('fs');\nfs.readFileSync(p);\n`);
  assert.ok(!r.findings.some((x) => x.rule === "callback-to-promise"), "readFileSync must not trigger the rule");
});

test("callback-to-promise: ignores a non-fs object with readFile method", () => {
  const r = run(`var db = require('some-db');\ndb.readFile(p, function (err, data) {});\n`);
  assert.ok(!r.findings.some((x) => x.rule === "callback-to-promise"), "non-fs binding must not trigger the rule");
});

test("npm: aliases are looked up by their target package", async () => {
  const registry = snapshotRegistry({ typescript: { latest: "5.6.0" } });
  const r = await resurrect({ "package.json": JSON.stringify({ name: "x", devDependencies: { ts2: "npm:typescript@^2.9.2", local: "file:../x" } }) }, { registry });
  const ts2 = r.deps.find((d) => d.name === "ts2")!;
  assert.equal(ts2.status, "outdated");
  assert.equal(r.deps.find((d) => d.name === "local")!.status, "unknown");
  const pkg = JSON.parse(r.patches.find((p) => p.path === "package.json")!.after!);
  assert.equal(pkg.devDependencies.ts2, "npm:typescript@^5.6.0");
});
