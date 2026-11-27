import type { FileMap, NecropsyReport, SpecimenMeta, VerifyRecord } from "@/engine/types";
import ghost from "@/data/presets/ghost-todo-api.json";
import crypt from "@/data/presets/crypt-keeper-cli.json";
import zombie from "@/data/presets/bower-zombie-widget.json";

export interface LabBundle {
  meta: SpecimenMeta;
  files: FileMap;
  report: NecropsyReport;
  verify: VerifyRecord | null;
  source: "specimen" | "github";
  repoUrl?: string;
  notes?: string[];
}

export const SPECIMENS: SpecimenMeta[] = [
  {
    id: "ghost-todo-api",
    title: "ghost-todo-api",
    era: "Express 3 · Node 0.10",
    dateOfDeath: "2014-10-31",
    epitaph: "A JSON todo API that died when Express 4 dropped Connect and Node 12 dropped util.puts.",
    stack: ["express@3", "request", "moment", "node-uuid", "mocha", "travis"],
  },
  {
    id: "crypt-keeper-cli",
    title: "crypt-keeper",
    era: "CLI · Node 0.6",
    dateOfDeath: "2012-11-02",
    epitaph: "A note-sealing CLI that won't even load: GLOBAL, os.tmpDir() and util.print are gone.",
    stack: ["optimist", "left-pad", "mkdirp", "rimraf", "new Buffer()"],
  },
  {
    id: "bower-zombie-widget",
    title: "jquery-zombie-countdown",
    era: "jQuery 1.11 · Bower · Grunt",
    dateOfDeath: "2014-10-13",
    epitaph: "A Halloween countdown plugin entombed in Bower, Grunt and PhantomJS. npm install fails.",
    stack: ["bower", "grunt", "phantomjs", "jshint", "$.browser", ".live()"],
  },
];

const DATA: Record<string, { files: FileMap; report: NecropsyReport; verify: VerifyRecord }> = {
  "ghost-todo-api": ghost as any,
  "crypt-keeper-cli": crypt as any,
  "bower-zombie-widget": zombie as any,
};

export function getSpecimen(id: string): LabBundle | null {
  const meta = SPECIMENS.find((s) => s.id === id);
  const d = DATA[id];
  if (!meta || !d) return null;
  return { meta, files: d.files, report: d.report, verify: d.verify, source: "specimen" };
}

export function specimenSummary(id: string) {
  const d = DATA[id];
  if (!d) return null;
  const b = d.verify.before;
  const a = d.verify.after;
  return {
    pulseBefore: d.report.vitals.pulseBefore,
    pulseAfter: d.report.vitals.pulseAfter,
    before: { install: b.install.ok, pass: b.tests.pass, total: b.tests.pass + b.tests.fail },
    after: { install: a.install.ok, pass: a.tests.pass, total: a.tests.pass + a.tests.fail },
    findings: d.report.code.length + d.report.configs.length + d.report.deps.filter((x) => x.status !== "healthy").length,
  };
}
