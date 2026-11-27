import { GRAVEYARD, MAJOR_MIGRATIONS, INTRODUCED } from "./knowledge";
import { majorsBehind } from "./registry";
import type { DepFinding, RegistryLookup, Severity, DepStatus } from "./types";

export interface DepOutcome {
  migrated: Set<string>;
  stuck: Set<string>;
  introduced: Set<string>;
  introducedDev: Set<string>;
  bowerDeps: Record<string, string>;
  keepTestRunner: boolean;
}

export interface DepAuditResult {
  findings: DepFinding[];
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  added: Array<{ name: string; range: string; dev: boolean; reason: string }>;
}

const caret = (v: string | null, fallback = "latest") => (v ? `^${v}` : fallback);

export async function auditDependencies(pkg: any, registry: RegistryLookup, o: DepOutcome): Promise<DepAuditResult> {
  const entries: Array<{ name: string; declared: string; section: "dependencies" | "devDependencies"; fromBower: boolean }> = [];
  for (const [n, v] of Object.entries<string>(pkg.dependencies ?? {})) entries.push({ name: n, declared: v, section: "dependencies", fromBower: false });
  for (const [n, v] of Object.entries<string>(pkg.devDependencies ?? {})) entries.push({ name: n, declared: v, section: "devDependencies", fromBower: false });
  for (const [n, v] of Object.entries<string>(o.bowerDeps)) {
    if (!entries.some((e) => e.name === n)) entries.push({ name: n, declared: v, section: "dependencies", fromBower: true });
  }

  // npm: aliases resolve to their target; git/file/url specifiers are not on the registry
  const lookupName = (e: { name: string; declared: string }) => {
    const m = String(e.declared).match(/^npm:((?:@[^/]+\/)?[^@]+)@?(.*)$/);
    return m ? m[1] : e.name;
  };
  const nonRegistry = (v: string) => /^(git|github:|file:|link:|https?:|workspace:)|\//.test(String(v)) && !String(v).startsWith("npm:");
  const infos = await Promise.all(
    entries.map((e) =>
      nonRegistry(e.declared)
        ? Promise.resolve({ name: e.name, latest: null, deprecated: null, modified: null, exists: true })
        : registry(lookupName(e)),
    ),
  );
  const aliasOf = new Map<string, string>();
  for (const e of entries) {
    const m = String(e.declared).match(/^npm:((?:@[^/]+\/)?[^@]+)@(.*)$/);
    if (m) {
      aliasOf.set(e.name, m[1]);
      e.declared = m[2];
    }
  }
  const findings: DepFinding[] = [];
  const dependencies: Record<string, string> = {};
  const devDependencies: Record<string, string> = {};

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const info = infos[i];
    const grave = GRAVEYARD[e.name];
    const behind = majorsBehind(e.declared, info.latest);
    let status: DepStatus;
    let cause: string;
    if (!info.exists) {
      status = "dead";
      cause = "Package no longer exists on the npm registry.";
    } else if (grave) {
      status = grave.status === "fossil" ? "fossil" : grave.status;
      cause = grave.cause;
    } else if (info.deprecated) {
      status = "deprecated";
      cause = `npm deprecation notice: ${info.deprecated}`;
    } else if (behind === null) {
      status = "unknown";
      cause = "Could not resolve the latest version.";
    } else if (behind > 0) {
      status = "outdated";
      const mig = MAJOR_MIGRATIONS[e.name];
      cause = mig ? mig.note : `${behind} major version${behind > 1 ? "s" : ""} behind (${e.declared} → ${info.latest}).`;
    } else {
      status = "healthy";
      cause = "Up to date within its major line.";
    }
    if (e.fromBower) cause = `From bower.json. ${cause}`;

    let severity: Severity =
      status === "dead" ? "fatal" : status === "deprecated" ? "critical" : status === "fossil" ? "warning" : status === "outdated" ? ((behind ?? 0) >= 2 ? "critical" : "warning") : "info";

    const target = e.section;
    let action: DepFinding["action"];
    const isRunner = ["mocha", "should", "chai"].includes(e.name);
    if (grave && !(isRunner && o.keepTestRunner)) {
      if (o.stuck.has(e.name)) {
        action = { type: "keep", range: e.declared, reason: "Some call sites need a human — kept until migrated." };
        (target === "dependencies" ? dependencies : devDependencies)[e.name] = e.declared;
      } else if (grave.action === "remove") {
        const why = grave.codemods?.length ? `Call sites migrated by ${grave.codemods.join(", ")}.` : isRunner ? "Replaced by the generated node:test suite." : "No longer needed.";
        action = { type: "remove", reason: why };
      } else if (grave.action === "replace" && grave.to) {
        const toInfo = await registry(grave.to);
        const range = caret(toInfo.latest);
        action = { type: "replace", to: grave.to, range, reason: grave.codemods?.length ? `Swapped by ${grave.codemods.join(", ")}.` : `Use ${grave.to} instead.` };
        const dest = grave.dev || target === "devDependencies" ? devDependencies : dependencies;
        if (!(grave.to in dependencies) && !(grave.to in devDependencies)) dest[grave.to] = range;
      } else {
        const range = caret(info.latest, e.declared);
        action = { type: "upgrade", range, reason: grave.cause };
        (target === "dependencies" ? dependencies : devDependencies)[e.name] = range;
      }
    } else if (status === "outdated" || status === "deprecated" || (isRunner && o.keepTestRunner && behind)) {
      const range = caret(info.latest, e.declared);
      const mig = MAJOR_MIGRATIONS[e.name];
      action = { type: "upgrade", range, reason: mig ? `Breaking changes patched by ${mig.codemods.length} codemods.` : "Major upgrade — guarded by the regression suite." };
      (target === "dependencies" ? dependencies : devDependencies)[e.name] = range;
    } else {
      action = { type: "keep", range: e.declared, reason: status === "healthy" ? "Already healthy." : "Left as declared." };
      (target === "dependencies" ? dependencies : devDependencies)[e.name] = e.declared;
      if (status === "unknown") severity = "info";
    }

    findings.push({
      name: e.name,
      declared: e.declared,
      section: e.section,
      latest: info.latest,
      majorsBehind: behind,
      status,
      severity,
      cause,
      deprecatedMessage: info.deprecated,
      lastPublish: info.modified,
      action,
    });
  }

  // Packages introduced by codemods/config migrations
  const added: DepAuditResult["added"] = [];
  const intro = [...[...o.introduced].map((n) => ({ n, dev: INTRODUCED[n]?.dev ?? false })), ...[...o.introducedDev].map((n) => ({ n, dev: true }))];
  for (const { n, dev } of intro) {
    if (n in dependencies || n in devDependencies) continue;
    const info = await registry(n);
    const range = caret(info.latest);
    (dev ? devDependencies : dependencies)[n] = range;
    added.push({ name: n, range, dev, reason: INTRODUCED[n]?.reason ?? "Introduced by migration" });
  }

  // re-wrap npm: aliases so the alias keeps pointing at its target package
  for (const [alias, target] of aliasOf) {
    for (const bag of [dependencies, devDependencies]) if (alias in bag) bag[alias] = `npm:${target}@${bag[alias]}`;
  }

  const sort = (o: Record<string, string>) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
  return { findings, dependencies: sort(dependencies), devDependencies: sort(devDependencies), added };
}
