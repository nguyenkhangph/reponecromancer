"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { LabBundle } from "@/lib/specimens";
import { Ecg } from "./bits";
import { ExhumeForm } from "./ExhumeForm";
import { Lab } from "./Lab";

const STEPS = ["digging up the repository…", "reading package.json…", "asking the npm registry who died…", "running 31 codemods…", "writing regression tests…"];

export function ExhumeClient() {
  const repo = useSearchParams().get("repo") ?? "";
  const [bundle, setBundle] = useState<LabBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!repo) return;
    let alive = true;
    setBundle(null);
    setError(null);
    setStep(0);
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 1100);
    fetch(`/api/resurrect?repo=${encodeURIComponent(repo)}`)
      .then(async (r) => {
        const j = await r.json();
        if (!alive) return;
        if (!r.ok) setError(j.error ?? `Request failed (${r.status})`);
        else setBundle(j);
      })
      .catch((e) => alive && setError(String(e)))
      .finally(() => clearInterval(t));
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [repo]);

  if (!repo) {
    return (
      <div className="loading">
        <p>Which corpse shall we exhume?</p>
        <div style={{ display: "inline-block", textAlign: "left" }}>
          <ExhumeForm />
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="loading">
        <Ecg alive={false} />
        <div className="err" style={{ fontSize: 16 }}>☠ {error}</div>
        <p style={{ marginTop: 24 }}>
          Try another repo, or open a <Link href="/#specimens">verified specimen</Link>.
        </p>
        <div style={{ display: "inline-block", textAlign: "left", marginTop: 12 }}>
          <ExhumeForm />
        </div>
      </div>
    );
  }
  if (!bundle) {
    return (
      <div className="loading">
        <Ecg alive={false} />
        <div>
          ⛏ github.com/{repo}
          <br />
          <span style={{ color: "var(--ecto)" }}>{STEPS[step]}</span>
        </div>
      </div>
    );
  }
  return <Lab bundle={bundle} />;
}
