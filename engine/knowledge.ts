/**
 * The Graveyard: curated knowledge about dead, deprecated and fossilised
 * npm packages, plus what to resurrect them as. Live registry data
 * (latest version, deprecation notices) is layered on top at audit time.
 */

export interface GraveEntry {
  /** dead = unmaintained/removed, deprecated = officially deprecated, fossil = superseded tooling */
  status: "dead" | "deprecated" | "fossil";
  cause: string;
  action: "remove" | "replace" | "upgrade";
  /** replacement package, when action === "replace" */
  to?: string;
  /** codemod rule ids that migrate call sites */
  codemods?: string[];
  /** if true, the replacement is a devDependency even if the original was a dependency */
  dev?: boolean;
}

export const GRAVEYARD: Record<string, GraveEntry> = {
  request: {
    status: "deprecated",
    cause: "Deprecated since Feb 2020. Node 18+ ships a native fetch().",
    action: "remove",
    codemods: ["request-to-fetch-shim"],
  },
  "request-promise": {
    status: "deprecated",
    cause: "Deprecated together with request in Feb 2020; use native fetch().",
    action: "remove",
    codemods: ["request-to-fetch-shim"],
  },
  "node-uuid": {
    status: "dead",
    cause: "Renamed to `uuid` in 2016; Node 14.17+ has crypto.randomUUID().",
    action: "remove",
    codemods: ["node-uuid-to-crypto"],
  },
  moment: {
    status: "deprecated",
    cause: "Moment is in maintenance mode and recommends lighter, immutable alternatives.",
    action: "replace",
    to: "dayjs",
    codemods: ["moment-to-dayjs"],
  },
  "left-pad": {
    status: "deprecated",
    cause: "The 2016 left-pad incident package. String.prototype.padStart is native since ES2017.",
    action: "remove",
    codemods: ["left-pad-to-padstart"],
  },
  mkdirp: {
    status: "fossil",
    cause: "fs.mkdir({ recursive: true }) is native since Node 10.12.",
    action: "remove",
    codemods: ["mkdirp-to-fs"],
  },
  rimraf: {
    status: "fossil",
    cause: "fs.rm({ recursive: true, force: true }) is native since Node 14.14.",
    action: "remove",
    codemods: ["rimraf-to-fs"],
  },
  optimist: {
    status: "dead",
    cause: "Deprecated and unmaintained since 2014; the author points to yargs.",
    action: "replace",
    to: "yargs-parser",
    codemods: ["optimist-to-yargs-parser"],
  },
  mocha: {
    status: "fossil",
    cause: "Legacy test runner; node:test is built into Node 20+.",
    action: "remove",
  },
  should: { status: "fossil", cause: "Prototype-extending assertion library; node:assert is built in.", action: "remove" },
  chai: { status: "fossil", cause: "node:assert/strict covers the needed assertions.", action: "remove" },
  jshint: { status: "fossil", cause: "Superseded by ESLint flat config.", action: "replace", to: "eslint", dev: true },
  "grunt-contrib-jshint": { status: "fossil", cause: "Grunt + JSHint pipeline superseded by ESLint.", action: "replace", to: "eslint", dev: true },
  grunt: { status: "dead", cause: "Grunt task runner is effectively unmaintained; npm scripts replace it.", action: "remove" },
  "grunt-cli": { status: "dead", cause: "Grunt task runner is effectively unmaintained.", action: "remove" },
  "grunt-contrib-uglify": { status: "dead", cause: "UglifyJS cannot parse modern syntax; esbuild minifies faster.", action: "replace", to: "esbuild", dev: true },
  "grunt-contrib-qunit": { status: "dead", cause: "Depends on PhantomJS, abandoned in 2018.", action: "remove" },
  "grunt-contrib-watch": { status: "dead", cause: "Use `node --watch` or esbuild --watch.", action: "remove" },
  bower: { status: "dead", cause: "Bower itself recommends migrating to npm/yarn.", action: "remove" },
  phantomjs: { status: "dead", cause: "PhantomJS development was suspended in 2018.", action: "remove" },
  "phantomjs-prebuilt": { status: "dead", cause: "PhantomJS development was suspended in 2018.", action: "remove" },
  "node-sass": { status: "deprecated", cause: "LibSass and node-sass are deprecated; native builds fail on modern Node.", action: "replace", to: "sass", dev: true },
  tslint: { status: "deprecated", cause: "TSLint was deprecated in 2019 in favour of typescript-eslint.", action: "replace", to: "eslint", dev: true },
  "babel-eslint": { status: "deprecated", cause: "Renamed to @babel/eslint-parser.", action: "replace", to: "@babel/eslint-parser", dev: true },
  "coffee-script": { status: "dead", cause: "Renamed to `coffeescript`.", action: "replace", to: "coffeescript" },
  jade: { status: "dead", cause: "Renamed to `pug` after a trademark dispute.", action: "replace", to: "pug" },
  istanbul: { status: "dead", cause: "Superseded by nyc / c8 (native V8 coverage).", action: "replace", to: "c8", dev: true },
  "gulp-util": { status: "deprecated", cause: "Deprecated in 2017 and split into standalone modules.", action: "remove" },
  "body-parser": { status: "fossil", cause: "Bundled back into Express as express.json()/express.urlencoded() since 4.16.", action: "remove" },
  colors: { status: "deprecated", cause: "Sabotaged release in Jan 2022; picocolors is the maintained choice.", action: "replace", to: "picocolors" },
  q: { status: "fossil", cause: "Native Promise and async/await replace Q.", action: "upgrade" },
  "nomnom": { status: "dead", cause: "Deprecated by its author.", action: "replace", to: "yargs-parser" },
};

/**
 * Packages whose majors break enough that we only upgrade when matching
 * codemods exist; used to annotate the migration plan.
 */
export const MAJOR_MIGRATIONS: Record<string, { from: number; codemods: string[]; note: string }> = {
  express: {
    from: 3,
    codemods: ["express-configure", "express-bundled-middleware", "express-app-router", "express-status-args", "express-app-del", "express-req-param"],
    note: "Express 3 → 5: bundled Connect middleware removed, app.configure/app.router gone, res.send(status, body) and req.param() removed.",
  },
  jquery: {
    from: 1,
    codemods: ["jquery-bind-to-on", "jquery-size-to-length", "jquery-delegate-to-on", "jquery-browser", "jquery-static-utils"],
    note: "jQuery 1.x → 4.x: $.browser, .live and .size removed; .bind/.delegate deprecated; $.trim/$.isArray/$.parseJSON gone in 4.0.",
  },
};

/** Packages that the codemods may introduce, with the reason. */
export const INTRODUCED: Record<string, { dev: boolean; reason: string }> = {
  dayjs: { dev: false, reason: "Immutable 2kB Moment-compatible API" },
  "yargs-parser": { dev: false, reason: "optimist-compatible argv parsing" },
  "method-override": { dev: false, reason: "Unbundled from Express 3" },
  morgan: { dev: false, reason: "Replaces express.logger()" },
  "cookie-parser": { dev: false, reason: "Unbundled from Express 3" },
  "express-session": { dev: false, reason: "Unbundled from Express 3" },
  compression: { dev: false, reason: "Replaces express.compress()" },
  "serve-favicon": { dev: false, reason: "Replaces express.favicon()" },
  eslint: { dev: true, reason: "Replaces JSHint (flat config)" },
  "@eslint/js": { dev: true, reason: "ESLint recommended rules" },
  esbuild: { dev: true, reason: "Replaces grunt-contrib-uglify" },
};
