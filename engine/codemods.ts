import MagicString from "magic-string";
import { parseJs, walk, collectBindings, requireTarget, lineOf, lineText, chainRoot, propName, type AnyNode } from "./ast";
import type { CodeFinding, FileMap, Severity } from "./types";
import { REQUEST_SHIM, REQUEST_SHIM_PATH, REQUEST_PROMISE_SHIM, REQUEST_PROMISE_SHIM_PATH } from "./shims";

export interface CodemodResult {
  code: string;
  changed: boolean;
  findings: CodeFinding[];
  /** packages the rewritten code now requires */
  introduced: Set<string>;
  /** legacy modules whose every call site was migrated */
  migrated: Set<string>;
  /** legacy modules with call sites the engine could not migrate */
  stuck: Set<string>;
  addFiles: FileMap;
}

export const RULES: Record<string, { title: string; severity: Severity }> = {
  "buffer-constructor": { title: "new Buffer() → Buffer.from()/Buffer.alloc()", severity: "critical" },
  "util-print": { title: "util.puts/print/debug/error (removed in Node 12)", severity: "fatal" },
  "sys-module": { title: "require('sys') → require('util')", severity: "warning" },
  "os-tmpdir": { title: "os.tmpDir() → os.tmpdir() (removed in Node 14)", severity: "fatal" },
  "global-alias": { title: "GLOBAL → globalThis (removed in Node 12)", severity: "fatal" },
  "process-eventemitter": { title: "process.EventEmitter → require('events')", severity: "fatal" },
  "express-create-server": { title: "express.createServer() → express()", severity: "fatal" },
  "express-configure": { title: "app.configure() removed in Express 4", severity: "fatal" },
  "express-bundled-middleware": { title: "Bundled Connect middleware removed in Express 4", severity: "fatal" },
  "express-app-router": { title: "app.use(app.router) throws in Express 4+", severity: "fatal" },
  "express-status-args": { title: "res.send(status, body) removed in Express 5", severity: "critical" },
  "express-app-del": { title: "app.del() → app.delete()", severity: "critical" },
  "express-req-param": { title: "req.param() removed in Express 5", severity: "critical" },
  "express-sendfile": { title: "res.sendfile() → res.sendFile()", severity: "critical" },
  "express-path-syntax": { title: "Route wildcards/optional params changed in Express 5", severity: "critical" },
  "request-to-fetch-shim": { title: "request / request-promise → native fetch compat shim", severity: "critical" },
  "node-uuid-to-crypto": { title: "node-uuid → crypto.randomUUID()", severity: "warning" },
  "moment-to-dayjs": { title: "moment → dayjs (+ plugins)", severity: "warning" },
  "left-pad-to-padstart": { title: "left-pad → String.prototype.padStart", severity: "warning" },
  "mkdirp-to-fs": { title: "mkdirp → fs.mkdir({ recursive: true })", severity: "warning" },
  "rimraf-to-fs": { title: "rimraf → fs.rm({ recursive: true, force: true })", severity: "warning" },
  "optimist-to-yargs-parser": { title: "optimist → yargs-parser", severity: "warning" },
  "jquery-bind-to-on": { title: ".bind()/.unbind() → .on()/.off()", severity: "warning" },
  "jquery-delegate-to-on": { title: ".delegate()/.live() → .on()", severity: "critical" },
  "jquery-size-to-length": { title: ".size() → .length (removed in jQuery 3)", severity: "critical" },
  "jquery-browser": { title: "$.browser removed in jQuery 1.9", severity: "fatal" },
  "jquery-static-utils": { title: "$.trim/$.isArray/$.parseJSON/$.now/$.isFunction removed in jQuery 4", severity: "critical" },
  "fs-exists": { title: "fs.exists() is deprecated", severity: "info" },
  "url-parse": { title: "url.parse() is legacy; prefer new URL()", severity: "info" },
  "domain-module": { title: "domain module is pending deprecation", severity: "info" },
};

const BUNDLED_MIDDLEWARE: Record<string, { pkg: string | null; factory?: string }> = {
  bodyParser: { pkg: null },
  json: { pkg: null },
  urlencoded: { pkg: null },
  methodOverride: { pkg: "method-override" },
  logger: { pkg: "morgan", factory: "'dev'" },
  cookieParser: { pkg: "cookie-parser" },
  session: { pkg: "express-session" },
  compress: { pkg: "compression" },
  favicon: { pkg: "serve-favicon" },
  errorHandler: { pkg: null },
  csrf: { pkg: null },
  multipart: { pkg: null },
};

const DAYJS_PLUGINS: Array<[(local: string) => RegExp, string]> = [
  [() => /\)\s*\.\s*(fromNow|toNow|from|to)\(/, "relativeTime"],
  [(l) => new RegExp(`\\b${l.replace(/\$/g, "\\$")}\\.duration\\(`), "duration"],
  [(l) => new RegExp(`\\b${l.replace(/\$/g, "\\$")}\\.utc\\(|\\)\\s*\\.utc\\(`), "utc"],
  [() => /\.isBetween\(/, "isBetween"],
  [() => /\.isSameOrBefore\(/, "isSameOrBefore"],
  [() => /\.isSameOrAfter\(/, "isSameOrAfter"],
];

function posixRelative(fromFile: string, toFile: string): string {
  const from = fromFile.split("/").slice(0, -1);
  const to = toFile.split("/");
  let i = 0;
  while (i < from.length && i < to.length - 1 && from[i] === to[i]) i++;
  const up = from.length - i;
  const rel = [...Array(up).fill(".."), ...to.slice(i)].join("/");
  return up === 0 ? "./" + rel : rel;
}

function indentAt(code: string, index: number): string {
  const start = code.lastIndexOf("\n", index - 1) + 1;
  const m = code.slice(start).match(/^[ \t]*/);
  return m ? m[0] : "";
}

/** Range covering a whole statement line (incl. newline) when the statement is alone on its line. */
function statementLineRange(code: string, node: AnyNode): [number, number] {
  const ls = code.lastIndexOf("\n", node.start - 1) + 1;
  let le = code.indexOf("\n", node.end);
  if (le === -1) le = code.length;
  const before = code.slice(ls, node.start);
  const after = code.slice(node.end, le);
  if (/^\s*$/.test(before) && /^\s*;?\s*$/.test(after)) return [ls, Math.min(le + 1, code.length)];
  return [node.start, node.end];
}

export function applyCodemods(path: string, input: string, allFiles: FileMap): CodemodResult {
  const findings: CodeFinding[] = [];
  const introduced = new Set<string>();
  const migrated = new Set<string>();
  const stuck = new Set<string>();
  const addFiles: FileMap = {};
  const original = input;

  const record = (rule: string, code: string, index: number, fixed: boolean, message?: string) => {
    const r = RULES[rule];
    findings.push({
      rule,
      file: path,
      line: lineOf(original === code ? original : code, index),
      severity: r?.severity ?? "warning",
      message: message ?? r?.title ?? rule,
      snippet: lineText(code, index).slice(0, 160),
      fixed,
    });
  };

  // ---------- Pass 1: call-site surgery ----------
  let code = input;
  {
    const ast = parseJs(code);
    if (!ast) {
      return { code: input, changed: false, findings, introduced, migrated, stuck, addFiles };
    }
    const b = collectBindings(ast as AnyNode);
    const ms = new MagicString(code);
    const modOf = (id: string) => b.modules.get(id);
    const isApp = (n: AnyNode) => n && n.type === "Identifier" && b.expressApps.has(n.name);
    const looksJquery = /\bjQuery\b|\$\(|\$\.fn\b/.test(code);
    const safe = (fn: () => void, rule: string, at: number, mod?: string) => {
      try {
        fn();
        record(rule, code, at, true);
        if (mod) migrated.add(mod);
      } catch {
        record(rule, code, at, false, `${RULES[rule]?.title ?? rule} (overlapping edit — manual follow-up)`);
        if (mod) stuck.add(mod);
      }
    };
    const src = (n: AnyNode) => code.slice(n.start, n.end);

    walk(ast as AnyNode, (node, parent) => {
      // --- Node core removals ---
      if (node.type === "NewExpression" && node.callee.type === "Identifier" && node.callee.name === "Buffer") {
        const a0 = node.arguments[0];
        const single = node.arguments.length === 1;
        const numeric =
          single &&
          (a0.type === "NumericLiteral" ||
            (a0.type === "MemberExpression" && propName(a0) === "length") ||
            (a0.type === "BinaryExpression" && ["*", "-", "/", "%", "|", "<<", ">>"].includes(a0.operator)) ||
            (a0.type === "UnaryExpression" && a0.operator === "-") ||
            (a0.type === "CallExpression" && a0.callee.type === "MemberExpression" && a0.callee.object.type === "Identifier" && a0.callee.object.name === "Math"));
        const ambiguous = single && !numeric && a0.type === "Identifier" && /^(n|len|length|size|bytes|count|num)$/i.test(a0.name);
        if (ambiguous) {
          const x = a0.name;
          safe(() => ms.overwrite(node.start, node.end, `(typeof ${x} === 'number' ? Buffer.alloc(${x}) : Buffer.from(${x}))`), "buffer-constructor", node.start);
        } else {
          safe(() => ms.overwrite(node.start, node.callee.end, numeric ? "Buffer.alloc" : "Buffer.from"), "buffer-constructor", node.start);
        }
      }

      const req = requireTarget(node);
      if (req === "sys") {
        safe(() => ms.overwrite(node.arguments[0].start, node.arguments[0].end, "'util'"), "sys-module", node.start);
      }
      if (req === "node-uuid") {
        safe(() => ms.overwrite(node.arguments[0].start, node.arguments[0].end, "'node:crypto'"), "node-uuid-to-crypto", node.start, "node-uuid");
      }
      if (req === "uuid" && parent?.type === "VariableDeclarator") {
        // keep modern uuid as-is
      }
      if (req === "moment") {
        safe(() => ms.overwrite(node.arguments[0].start, node.arguments[0].end, "'dayjs'"), "moment-to-dayjs", node.start, "moment");
        introduced.add("dayjs");
      }
      if (req === "request" || req === "request-promise") {
        // request-promise resolves with the body and rejects non-2xx: it gets its own shim
        const target = req === "request" ? REQUEST_SHIM_PATH : REQUEST_PROMISE_SHIM_PATH;
        const rel = posixRelative(path, target);
        safe(() => ms.overwrite(node.arguments[0].start, node.arguments[0].end, `'${rel}'`), "request-to-fetch-shim", node.start, req);
        addFiles[REQUEST_SHIM_PATH] = REQUEST_SHIM;
        if (req === "request-promise") addFiles[REQUEST_PROMISE_SHIM_PATH] = REQUEST_PROMISE_SHIM;
      }
      if (req === "domain") record("domain-module", code, node.start, false);

      if (node.type === "Identifier" && node.name === "GLOBAL") {
        const isProp = parent && (parent.type === "MemberExpression" || parent.type === "OptionalMemberExpression") && parent.property === node && !parent.computed;
        const isKey = parent && parent.type === "ObjectProperty" && parent.key === node && !parent.computed;
        if (!isProp && !isKey && !b.modules.has("GLOBAL")) {
          safe(() => ms.overwrite(node.start, node.end, "globalThis"), "global-alias", node.start);
        }
      }

      if (node.type === "MemberExpression") {
        const p = propName(node);
        if (node.object.type === "Identifier" && node.object.name === "process" && p === "EventEmitter") {
          safe(() => ms.overwrite(node.start, node.end, "require('events').EventEmitter"), "process-eventemitter", node.start);
        }
        const isBrowserObj = (n: AnyNode) => n.type === "MemberExpression" && n.object.type === "Identifier" && (n.object.name === "$" || n.object.name === "jQuery") && propName(n) === "browser";
        if (isBrowserObj(node.object) && p) {
          const value = p === "version" ? "undefined" : "false";
          safe(() => ms.overwrite(node.start, node.end, `${value} /* necro: $.browser.${p} removed in jQuery 1.9 */`), "jquery-browser", node.start);
          return false;
        }
        if (isBrowserObj(node)) {
          safe(() => ms.overwrite(node.start, node.end, "({} /* necro: $.browser removed in jQuery 1.9 — use feature detection */)"), "jquery-browser", node.start);
        }
        if (requireTarget(node.object) === "optimist" && p === "argv") {
          safe(() => ms.overwrite(node.start, node.end, "require('yargs-parser')(process.argv.slice(2))"), "optimist-to-yargs-parser", node.start, "optimist");
          introduced.add("yargs-parser");
        }
      }

      if (node.type === "CallExpression" && (node.callee.type === "MemberExpression" || node.callee.type === "OptionalMemberExpression")) {
        const callee = node.callee;
        const p = propName(callee);
        const obj = callee.object;
        const objMod = obj.type === "Identifier" ? modOf(obj.name) : undefined;

        if ((objMod === "util" || objMod === "sys") && p && ["puts", "print", "debug", "error"].includes(p)) {
          const target = p === "puts" ? "console.log" : p === "print" ? "process.stdout.write" : "console.error";
          safe(() => {
            ms.overwrite(callee.start, callee.end, target);
            if (p === "print" && node.arguments.length > 1) {
              ms.prependLeft(node.arguments[0].start, "[");
              ms.appendRight(node.arguments[node.arguments.length - 1].end, "].join('')");
            } else if (p === "print" && node.arguments.length === 1) {
              ms.prependLeft(node.arguments[0].start, "String(");
              ms.appendRight(node.arguments[0].end, ")");
            }
          }, "util-print", node.start);
        }
        if (objMod === "os" && p === "tmpDir") {
          safe(() => ms.overwrite(callee.property.start, callee.property.end, "tmpdir"), "os-tmpdir", node.start);
        }
        if (objMod === "express" && p === "createServer") {
          safe(() => ms.overwrite(callee.start, node.end, obj.name + "()"), "express-create-server", node.start);
        }
        if (objMod === "node-uuid" && (p === "v4" || p === "v1")) {
          safe(() => ms.overwrite(callee.property.start, node.end, "randomUUID()"), "node-uuid-to-crypto", node.start, "node-uuid");
        }
        if (objMod === "mkdirp" && p === "sync") {
          const a = node.arguments;
          safe(() => ms.overwrite(node.start, node.end, `require('node:fs').mkdirSync(${src(a[0])}, { recursive: true })`), "mkdirp-to-fs", node.start, "mkdirp");
        }
        if (objMod === "rimraf" && p === "sync") {
          const a = node.arguments;
          safe(() => ms.overwrite(node.start, node.end, `require('node:fs').rmSync(${src(a[0])}, { recursive: true, force: true })`), "rimraf-to-fs", node.start, "rimraf");
        }
        if ((objMod === "fs" || objMod === "node:fs") && p === "exists") record("fs-exists", code, node.start, false);
        if ((objMod === "url" || objMod === "node:url") && p === "parse") record("url-parse", code, node.start, false);

        // --- Express ---
        if (isApp(obj) && p === "del") {
          safe(() => ms.overwrite(callee.property.start, callee.property.end, "delete"), "express-app-del", node.start);
        }
        if (isApp(obj) && p && ["get", "post", "put", "patch", "delete", "del", "all", "use"].includes(p)) {
          const route = node.arguments[0];
          if (route?.type === "StringLiteral") {
            let next = route.value;
            if (next === "*") next = "/{*splat}";
            next = next.replace(/\/\*$/, "/{*splat}").replace(/\/:(\w+)\?/g, "{/:$1}");
            if (next !== route.value) {
              safe(() => ms.overwrite(route.start, route.end, `'${next}'`), "express-path-syntax", route.start);
            }
          }
        }
        if (obj.type === "Identifier" && p && ["send", "json", "jsonp"].includes(p) && node.arguments[0]?.type === "NumericLiteral") {
          const a = node.arguments;
          if (a.length === 1 && p === "send") {
            safe(() => ms.overwrite(callee.property.start, node.end, `sendStatus(${a[0].value})`), "express-status-args", node.start);
          } else if (a.length === 2) {
            safe(() => ms.overwrite(callee.object.end, a[1].start, `.status(${src(a[0])}).${p}(`), "express-status-args", node.start);
          }
        }
        if (obj.type === "Identifier" && p === "sendfile" && /^(res|response)$/.test(obj.name)) {
          safe(() => ms.overwrite(callee.property.start, callee.property.end, "sendFile"), "express-sendfile", node.start);
        }
        if (obj.type === "Identifier" && /^(req|request)$/.test(obj.name) && p === "param" && node.arguments.length === 1 && node.arguments[0].type === "StringLiteral" && modOf(obj.name) === undefined) {
          const k = node.arguments[0].value as string;
          const acc = /^[A-Za-z_$][\w$]*$/.test(k) ? (o: string) => `${o}.${k}` : (o: string) => `${o}[${JSON.stringify(k)}]`;
          const accOpt = /^[A-Za-z_$][\w$]*$/.test(k) ? (o: string) => `${o}?.${k}` : (o: string) => `${o}?.[${JSON.stringify(k)}]`;
          const r = obj.name;
          const bare = parent && ((parent.type === "CallExpression" && parent.callee !== node) || parent.type === "VariableDeclarator" || parent.type === "ExpressionStatement");
          const expr = `${acc(r + ".params")} ?? ${accOpt(r + ".body")} ?? ${acc(r + ".query")}`;
          safe(() => ms.overwrite(node.start, node.end, bare ? expr : `(${expr})`), "express-req-param", node.start);
        }

        // --- jQuery static utilities removed in jQuery 4 ---
        if (obj.type === "Identifier" && (obj.name === "$" || obj.name === "jQuery") && p && ["trim", "isArray", "parseJSON", "now", "isFunction"].includes(p)) {
          const a = node.arguments;
          const rep =
            p === "trim" && a.length === 1 ? `String(${src(a[0])} ?? '').trim()` :
            p === "isArray" ? `Array.isArray(${a.map(src).join(", ")})` :
            p === "parseJSON" ? `JSON.parse(${a.map(src).join(", ")})` :
            p === "now" ? "Date.now()" :
            p === "isFunction" && a.length === 1 ? `(typeof ${src(a[0])} === 'function')` : null;
          if (rep) safe(() => ms.overwrite(node.start, node.end, rep), "jquery-static-utils", node.start, "jquery");
        }

        // --- jQuery ---
        if (looksJquery && (p === "bind" || p === "unbind") && node.arguments[0]?.type === "StringLiteral" && /^[a-z][\w.\s:-]*$/i.test(node.arguments[0].value)) {
          safe(() => ms.overwrite(callee.property.start, callee.property.end, p === "bind" ? "on" : "off"), "jquery-bind-to-on", node.start, "jquery");
        }
        if (looksJquery && p === "delegate" && node.arguments.length >= 3) {
          const [sel, evt] = node.arguments;
          safe(() => {
            ms.overwrite(callee.property.start, callee.property.end, "on");
            ms.overwrite(sel.start, sel.end, src(evt));
            ms.overwrite(evt.start, evt.end, src(sel));
          }, "jquery-delegate-to-on", node.start, "jquery");
        }
        if (looksJquery && p === "live" && obj.type === "CallExpression" && obj.callee.type === "Identifier" && ["$", "jQuery"].includes(obj.callee.name) && obj.arguments[0]) {
          const sel = src(obj.arguments[0]);
          const [evt, ...rest] = node.arguments;
          if (evt) {
            safe(() => ms.overwrite(node.start, node.end, `${obj.callee.name}(document).on(${src(evt)}, ${sel}${rest.length ? ", " + rest.map(src).join(", ") : ""})`), "jquery-delegate-to-on", node.start, "jquery");
          }
        }
        if (looksJquery && p === "size" && node.arguments.length === 0) {
          const root = chainRoot(obj);
          if (root === "$" || root === "jQuery" || root === "this" || (root && /^\$/.test(root))) {
            safe(() => ms.overwrite(callee.property.start, node.end, "length"), "jquery-size-to-length", node.start, "jquery");
          }
        }
      }

      // Express: app.use(express.bodyParser()) & friends, app.use(app.router)
      if (node.type === "ExpressionStatement" && node.expression.type === "CallExpression") {
        const call = node.expression;
        const c = call.callee;
        if (c.type === "MemberExpression" && isApp(c.object) && propName(c) === "use" && call.arguments.length === 1) {
          const arg = call.arguments[0];
          if (arg.type === "MemberExpression" && isApp(arg.object) && propName(arg) === "router") {
            const [s, e] = statementLineRange(code, node);
            safe(() => ms.remove(s, e), "express-app-router", node.start);
            return false;
          }
          if (arg.type === "CallExpression" && arg.callee.type === "MemberExpression" && arg.callee.object.type === "Identifier" && modOf(arg.callee.object.name) === "express") {
            const mw = propName(arg.callee);
            const spec = mw ? BUNDLED_MIDDLEWARE[mw] : undefined;
            if (mw && spec) {
              const ind = indentAt(code, node.start);
              const appName = c.object.name;
              const ex = arg.callee.object.name;
              const args = arg.arguments.map(src).join(", ");
              let replacement: string | null;
              if (mw === "bodyParser") replacement = `${appName}.use(${ex}.json());\n${ind}${appName}.use(${ex}.urlencoded({ extended: true }));`;
              else if (mw === "json" || mw === "urlencoded") replacement = null; // still exists
              else if (spec.pkg) {
                introduced.add(spec.pkg);
                replacement = `${appName}.use(require('${spec.pkg}')(${args || spec.factory || ""}));`;
              } else replacement = `// necro: removed ${ex}.${mw}() — no longer bundled with Express`;
              if (replacement !== null) {
                safe(() => ms.overwrite(node.start, node.end, replacement!), "express-bundled-middleware", node.start);
              }
              return false;
            }
          }
        }
      }

      // left-pad / mkdirp(cb) / rimraf(cb) called directly
      if (node.type === "CallExpression" && node.callee.type === "Identifier") {
        const m = modOf(node.callee.name);
        const a = node.arguments;
        if (m === "left-pad" && a.length >= 2) {
          const ch = a[2] ? (a[2].type === "StringLiteral" ? src(a[2]) : `String(${src(a[2])} ?? ' ')`) : null;
          safe(() => ms.overwrite(node.start, node.end, `String(${src(a[0])}).padStart(${src(a[1])}${ch ? ", " + ch : ""})`), "left-pad-to-padstart", node.start, "left-pad");
        }
        if (m === "mkdirp" && a.length >= 1) {
          const cb = a.length > 1 ? ", " + src(a[a.length - 1]) : "";
          safe(() => ms.overwrite(node.start, node.end, `require('node:fs').mkdir(${src(a[0])}, { recursive: true }${cb})`), "mkdirp-to-fs", node.start, "mkdirp");
        }
        if (m === "rimraf" && a.length >= 1) {
          const cb = a.length > 1 ? ", " + src(a[a.length - 1]) : "";
          safe(() => ms.overwrite(node.start, node.end, `require('node:fs').rm(${src(a[0])}, { recursive: true, force: true }${cb})`), "rimraf-to-fs", node.start, "rimraf");
        }
      }
    });

    // Optimist used in a way we can't migrate (e.g. require('optimist').usage(...))
    if (/require\(['"]optimist['"]\)/.test(code) && !findings.some((f) => f.rule === "optimist-to-yargs-parser")) {
      stuck.add("optimist");
    }
    code = ms.toString();
  }

  // ---------- Pass 2: structural (app.configure unwrap, dayjs plugins, dead requires) ----------
  {
    const ast = parseJs(code);
    if (ast) {
      const b = collectBindings(ast as AnyNode);
      const ms = new MagicString(code);

      walk(ast as AnyNode, (node) => {
        if (node.type === "ExpressionStatement" && node.expression.type === "CallExpression") {
          const call = node.expression;
          const c = call.callee;
          if (c.type === "MemberExpression" && c.object.type === "Identifier" && b.expressApps.has(c.object.name) && propName(c) === "configure") {
            const fn = call.arguments[call.arguments.length - 1];
            const env = call.arguments.length > 1 && call.arguments[0].type === "StringLiteral" ? call.arguments[0].value : null;
            if (fn && (fn.type === "FunctionExpression" || fn.type === "ArrowFunctionExpression") && fn.body.type === "BlockStatement") {
              const inner = code.slice(fn.body.start + 1, fn.body.end - 1).replace(/^\n/, "").replace(/\n\s*$/, "");
              const baseIndent = indentAt(code, node.start);
              const lines = inner.split("\n");
              const minIndent = Math.min(...lines.filter((l) => l.trim()).map((l) => (l.match(/^\s*/)?.[0].length ?? 0)));
              const shift = env ? 0 : Math.max(0, minIndent - baseIndent.length);
              const dedented = lines.map((l, i) => (i === 0 ? l.slice(Math.min(shift + baseIndent.length, l.length - l.trimStart().length)) : l.slice(Math.min(shift, l.length - l.trimStart().length)))).join("\n");
              const body = env ? `if (process.env.NODE_ENV === ${JSON.stringify(env)}) {\n${inner}\n${baseIndent}}` : dedented;
              try {
                ms.overwrite(node.start, node.end, body);
                record("express-configure", code, node.start, true);
              } catch {
                record("express-configure", code, node.start, false);
              }
              return false;
            }
          }
        }
      });

      // dayjs plugins
      if (introduced.has("dayjs")) {
        for (const [local, mod] of b.modules) {
          if (mod !== "dayjs") continue;
          const decl = b.declarators.get(local);
          const plugins = DAYJS_PLUGINS.filter(([re]) => re(local).test(code)).map(([, p]) => p);
          if (decl && plugins.length) {
            const ind = indentAt(code, decl.declaration.start);
            const ext = plugins.map((p) => `\n${ind}${local}.extend(require('dayjs/plugin/${p}'));`).join("");
            ms.appendLeft(decl.declaration.end, ext);
          }
        }
      }

      // Dead branches left behind by $.browser removal: if (false && …) { … }
      walk(ast as AnyNode, (node) => {
        if (node.type !== "IfStatement" || node.alternate) return;
        const t = node.test;
        const dead = (n: AnyNode): boolean => (n.type === "BooleanLiteral" && n.value === false) || (n.type === "LogicalExpression" && n.operator === "&&" && dead(n.left));
        if (dead(t) && /necro: \$\.browser/.test(code.slice(t.start, t.end))) {
          const ind = indentAt(code, node.start);
          try {
            ms.overwrite(node.start, node.end, `// necro: removed a $.browser sniffing branch — $.browser is gone since jQuery 1.9\n${ind}// and the browsers it targeted are long dead. Use feature detection if needed.`);
          } catch {}
          return false;
        }
      });

      // Remove require() bindings for modules whose call sites were all migrated
      const removable = ["left-pad", "mkdirp", "rimraf", ...(findings.some((f) => f.rule === "util-print" && f.fixed) ? ["util", "sys"] : [])];
      for (const [local, mod] of b.modules) {
        if (!removable.includes(mod)) continue;
        let refs = 0;
        walk(ast as AnyNode, (n, parent) => {
          if (n.type !== "Identifier" || n.name !== local) return;
          if (parent?.type === "VariableDeclarator" && parent.id === n) return;
          if (parent && (parent.type === "MemberExpression" || parent.type === "OptionalMemberExpression") && parent.property === n && !parent.computed) return;
          if (parent?.type === "ObjectProperty" && parent.key === n && !parent.computed && !parent.shorthand) return;
          refs++;
        });
        const decl = b.declarators.get(local);
        if (refs === 0 && decl) {
          const { declaration, declarator } = decl;
          const idx = declaration.declarations.indexOf(declarator);
          try {
            if (declaration.declarations.length === 1) {
              const [s, e] = statementLineRange(code, declaration);
              ms.remove(s, e);
            } else if (idx < declaration.declarations.length - 1) {
              ms.remove(declarator.start, declaration.declarations[idx + 1].start);
            } else {
              ms.remove(declaration.declarations[idx - 1].end, declarator.end);
            }
            if (mod !== "util" && mod !== "sys") migrated.add(mod);
          } catch {
            stuck.add(mod);
          }
        } else if (refs > 0 && mod !== "util" && mod !== "sys") {
          stuck.add(mod);
        }
      }
      code = ms.toString();
    }
  }

  for (const s of stuck) migrated.delete(s);
  void allFiles;
  return { code, changed: code !== input, findings, introduced, migrated, stuck, addFiles };
}
