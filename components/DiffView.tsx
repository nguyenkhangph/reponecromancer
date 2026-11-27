"use client";

import { diffLines } from "diff";
import { useMemo, useState } from "react";

type Row =
  | { t: "same"; l: number; r: number; text: string }
  | { t: "chg"; l: number | null; r: number | null; left: string | null; right: string | null }
  | { t: "fold"; id: number; rows: Row[] };

function split(s: string): string[] {
  const lines = s.split("\n");
  if (lines.length && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

function buildRows(before: string, after: string): Row[] {
  const parts = diffLines(before, after);
  const rows: Row[] = [];
  let l = 1;
  let r = 1;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (!p.added && !p.removed) {
      for (const text of split(p.value)) rows.push({ t: "same", l: l++, r: r++, text });
      continue;
    }
    if (p.removed && parts[i + 1]?.added) {
      const L = split(p.value);
      const R = split(parts[i + 1].value);
      const n = Math.max(L.length, R.length);
      for (let k = 0; k < n; k++) {
        rows.push({ t: "chg", l: k < L.length ? l++ : null, r: k < R.length ? r++ : null, left: L[k] ?? null, right: R[k] ?? null });
      }
      i++;
      continue;
    }
    for (const text of split(p.value)) {
      if (p.removed) rows.push({ t: "chg", l: l++, r: null, left: text, right: null });
      else rows.push({ t: "chg", l: null, r: r++, left: null, right: text });
    }
  }
  // fold long unchanged runs
  const out: Row[] = [];
  let run: Row[] = [];
  let id = 0;
  const flush = (last: boolean) => {
    const keep = 3;
    if (run.length > keep * 2 + 2) {
      const head = out.length === 0 ? [] : run.slice(0, keep);
      const tail = last ? [] : run.slice(-keep);
      const mid = run.slice(head.length, run.length - tail.length);
      out.push(...head, { t: "fold", id: id++, rows: mid }, ...tail);
    } else out.push(...run);
    run = [];
  };
  for (const row of rows) {
    if (row.t === "same") run.push(row);
    else {
      flush(false);
      out.push(row);
    }
  }
  flush(true);
  return out;
}

export function DiffView({ before, after }: { before: string | null; after: string | null }) {
  const rows = useMemo(() => buildRows(before ?? "", after ?? ""), [before, after]);
  const [open, setOpen] = useState<Set<number>>(new Set());

  const render = (row: Row, key: string): React.ReactNode => {
    if (row.t === "fold") {
      if (open.has(row.id)) return row.rows.map((r, i) => render(r, `${key}-${i}`));
      return (
        <tr key={key} className="fold" onClick={() => setOpen(new Set(open).add(row.id))}>
          <td colSpan={4}>⋯ {row.rows.length} unchanged lines — click to exhume ⋯</td>
        </tr>
      );
    }
    if (row.t === "same") {
      return (
        <tr key={key}>
          <td className="ln">{row.l}</td>
          <td className="code">{row.text}</td>
          <td className="ln">{row.r}</td>
          <td className="code">{row.text}</td>
        </tr>
      );
    }
    return (
      <tr key={key}>
        <td className="ln">{row.l ?? ""}</td>
        <td className={`code ${row.left === null ? "empty" : "del"}`}>{row.left ?? ""}</td>
        <td className="ln">{row.r ?? ""}</td>
        <td className={`code ${row.right === null ? "empty" : "add"}`}>{row.right ?? ""}</td>
      </tr>
    );
  };

  return (
    <div className="diff">
      <table>
        <colgroup>
          <col style={{ width: 42 }} />
          <col />
          <col style={{ width: 42 }} />
          <col />
        </colgroup>
        <tbody>
          <tr className="hdr">
            <td colSpan={2}>† before (legacy)</td>
            <td colSpan={2}>⚡ after (resurrected)</td>
          </tr>
          {rows.map((r, i) => render(r, String(i)))}
        </tbody>
      </table>
    </div>
  );
}
