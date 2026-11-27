"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const SUGGESTIONS = ["request/request", "substack/node-optimist", "bower/bower"];

export function ExhumeForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const go = (v: string) => {
    const s = v.trim().replace(/^https?:\/\/(www\.)?github\.com\//i, "").replace(/\.git$/, "").replace(/\/$/, "");
    if (!/^[\w.-]+\/[\w.-]+(\/tree\/[^/]+)?$/.test(s)) {
      setErr("Feed me a GitHub repo: owner/name or a github.com URL.");
      return;
    }
    setErr(null);
    router.push(`/exhume?repo=${encodeURIComponent(s)}`);
  };

  return (
    <div>
      <form
        className="exhume"
        onSubmit={(e) => {
          e.preventDefault();
          go(value);
        }}
      >
        <label className="field">
          <span>github.com/</span>
          <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="owner/abandoned-repo" spellCheck={false} autoComplete="off" aria-label="GitHub repository" />
        </label>
        <button className="btn btn-ecto" type="submit">
          ⚡ Exhume
        </button>
      </form>
      {err ? (
        <div className="err">{err}</div>
      ) : (
        <div className="hint">
          try:
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" onClick={() => go(s)}>
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
