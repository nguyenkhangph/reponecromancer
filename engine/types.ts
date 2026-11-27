/** Shared types for the RepoNecromancer engine. */

export type FileMap = Record<string, string>;

export type Severity = "fatal" | "critical" | "warning" | "info";

export interface RegistryInfo {
  name: string;
  latest: string | null;
  deprecated: string | null;
  modified: string | null;
  exists: boolean;
}

export type RegistryLookup = (name: string) => Promise<RegistryInfo>;

export type DepStatus = "dead" | "deprecated" | "fossil" | "outdated" | "healthy" | "unknown";

export interface DepAction {
  type: "remove" | "replace" | "upgrade" | "keep";
  /** Replacement package (for replace) */
  to?: string;
  /** Version range written into the resurrected package.json */
  range?: string;
  reason: string;
}

export interface DepFinding {
  name: string;
  declared: string;
  section: "dependencies" | "devDependencies";
  latest: string | null;
  majorsBehind: number | null;
  status: DepStatus;
  severity: Severity;
  cause: string;
  deprecatedMessage: string | null;
  lastPublish: string | null;
  action: DepAction;
}

export interface ConfigFinding {
  id: string;
  file: string;
  title: string;
  severity: Severity;
  cause: string;
  remedy: string;
}

export interface CodeFinding {
  rule: string;
  file: string;
  line: number;
  severity: Severity;
  message: string;
  /** Snippet of the original code */
  snippet: string;
  fixed: boolean;
}

export interface FilePatch {
  path: string;
  kind: "modified" | "added" | "deleted";
  before: string | null;
  after: string | null;
  reasons: string[];
}

export interface GeneratedTest {
  path: string;
  strategy: "jsdoc-example" | "route-smoke" | "module-load" | "entrypoint-boot";
  cases: number;
  content: string;
}

export interface PlanStep {
  phase: "exhume" | "transplant" | "suture" | "galvanize" | "verify";
  title: string;
  items: string[];
}

export interface Vitals {
  name: string;
  description: string | null;
  declaredNode: string | null;
  jsFiles: number;
  totalLines: number;
  pulseBefore: number;
  pulseAfter: number;
  causeOfDeath: string;
}

export interface NecropsyReport {
  engineVersion: string;
  generatedAt: string;
  vitals: Vitals;
  deps: DepFinding[];
  configs: ConfigFinding[];
  code: CodeFinding[];
  plan: PlanStep[];
  patches: FilePatch[];
  tests: GeneratedTest[];
  warnings: string[];
}

export interface TestCaseResult {
  name: string;
  ok: boolean;
  durationMs: number | null;
  error: string | null;
}

export interface RunResult {
  install: { ok: boolean; durationMs: number; log: string };
  tests: { pass: number; fail: number; cases: TestCaseResult[]; log: string; durationMs: number };
  checks: Array<{ name: string; command: string; ok: boolean; log: string }>;
}

export interface VerifyRecord {
  node: string;
  npm: string;
  verifiedAt: string;
  before: RunResult;
  after: RunResult;
}

export interface SpecimenMeta {
  id: string;
  title: string;
  era: string;
  dateOfDeath: string;
  epitaph: string;
  stack: string[];
}

export interface PresetBundle {
  meta: SpecimenMeta;
  report: NecropsyReport;
  verify: VerifyRecord | null;
}
