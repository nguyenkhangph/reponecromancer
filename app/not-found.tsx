import Link from "next/link";
import { Ecg, TopBar } from "@/components/bits";

export default function NotFound() {
  return (
    <>
      <TopBar />
      <main className="wrap loading">
        <Ecg alive={false} />
        <h1 style={{ color: "var(--bone)" }}>404 — this page stayed dead.</h1>
        <Link href="/" className="btn btn-ghost">Back to the morgue</Link>
      </main>
    </>
  );
}
