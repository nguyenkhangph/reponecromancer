import test from "node:test";
import assert from "node:assert/strict";
import { applyCodemods } from "./codemods";
import { resurrect, snapshotRegistry, applyPatches } from "./index";
import { generateTests } from "./testgen";
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

test("parseRepoInput accepts urls and owner/repo", () => {
  assert.deepEqual(parseRepoInput("https://github.com/a/b.git"), { owner: "a", repo: "b", ref: undefined });
  assert.deepEqual(parseRepoInput("a/b"), { owner: "a", repo: "b", ref: undefined });
  assert.equal(parseRepoInput("not a repo"), null);
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
