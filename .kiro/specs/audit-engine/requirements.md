# Requirements — Audit engine (Exhume + Transplant)

## Introduction

The audit engine reads a legacy JavaScript repository and produces a
diagnosis: which dependencies are dead, deprecated, fossilised or outdated,
which configuration files belong to dead infrastructure, and a health score
("pulse"). It feeds the migration plan and the lab's Diagnose stage.

## Requirements

### Requirement 1 — Repository intake

**User story:** As a maintainer, I want to point RepoNecromancer at a GitHub
repository or a local folder so that it can examine the code without me
uploading anything.

#### Acceptance criteria

1. WHEN the user submits `owner/repo` or a `github.com` URL THE SYSTEM SHALL fetch the repository metadata, file tree and up to 60 relevant files (configs first, then `lib/`, `src/`, `bin/`, root entry points).
2. WHEN the GitHub REST API is rate-limited THE SYSTEM SHALL fall back to a single codeload zip download and continue.
3. IF the repository has no root `package.json` THEN THE SYSTEM SHALL stop with a clear "not a Node.js project" message (HTTP 422).
4. WHEN files under `node_modules/`, `bower_components/`, `dist/`, `vendor/` or `*.min.js` exist THE SYSTEM SHALL ignore them.
5. WHEN run from the CLI on a directory THE SYSTEM SHALL read every file under 200 kB except `node_modules` and `.git`.

### Requirement 2 — Dependency audit

**User story:** As a maintainer, I want every dependency classified with a
reason and a treatment so that I trust the upgrade.

#### Acceptance criteria

1. WHEN auditing THE SYSTEM SHALL look up every `dependencies`/`devDependencies` entry (and `bower.json` dependencies) in the live npm registry using abbreviated metadata.
2. WHEN a package is in the curated graveyard THE SYSTEM SHALL use the graveyard status (`dead`, `deprecated`, `fossil`) and cause.
3. WHEN the registry marks the latest version deprecated THE SYSTEM SHALL classify the package as `deprecated` and show the npm notice.
4. WHEN a package is one or more majors behind (0.x minors count as majors) THE SYSTEM SHALL classify it `outdated` and propose `^latest`.
5. WHEN a graveyard package's call sites were all migrated by codemods THE SYSTEM SHALL remove it; IF any call site is stuck THEN THE SYSTEM SHALL keep it and say why.
6. WHEN codemods or config migrations introduce a package THE SYSTEM SHALL add it at `^latest` with a recorded reason.
7. WHEN the registry is unreachable THE SYSTEM SHALL classify the package `unknown` and keep the declared range.

### Requirement 3 — Config fossils

#### Acceptance criteria

1. WHEN `.travis.yml` exists THE SYSTEM SHALL flag it critical and generate `.github/workflows/ci.yml` for Node 20 and 22.
2. WHEN `bower.json` exists THE SYSTEM SHALL move its dependencies into `package.json` and delete Bower files.
3. WHEN a Gruntfile exists THE SYSTEM SHALL translate jshint/uglify tasks into `npm run lint` (ESLint) and `npm run build` (esbuild) and delete the Gruntfile.
4. WHEN `.jshintrc` exists THE SYSTEM SHALL translate its env flags, globals and core rules into an ESLint flat config.
5. WHEN `engines.node` targets an EOL release THE SYSTEM SHALL flag it and rewrite it to `>=20`.

### Requirement 4 — Pulse

1. THE SYSTEM SHALL compute pulse as `round(100·e^(−Σpenalty/140))` with penalties fatal 16, critical 7, warning 3, info 1.
2. THE SYSTEM SHALL compute the after-pulse from findings that remain unfixed, and never report it below the before-pulse.
3. THE SYSTEM SHALL name a single "cause of death": the most severe finding.
