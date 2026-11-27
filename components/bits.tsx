import Link from "next/link";

export const REPO_URL = "https://github.com/nguyenkhangph/reponecromancer";

export function Sigil({ className = "sigil" }: { className?: string }) {
  // a coffin crossed by a lightning bolt
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden>
      <path d="M11 2h10l5 8-3 20H9L6 10z" fill="none" stroke="#efe6d2" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M18 7l-6 10h5l-3 9 8-12h-5l3-7z" fill="#8dff5c" />
    </svg>
  );
}

export function TopBar() {
  return (
    <header className="topbar">
      <div className="wrap">
        <Link href="/" className="wordmark">
          <Sigil /> RepoNecromancer
        </Link>
        <nav>
          <Link href="/#specimens">Specimens</Link>
          <Link href="/#ritual">How it works</Link>
          <Link href="/#kiro">Kiro</Link>
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            GitHub
          </a>
          <span className="badge-kiro">Kiroween 2026</span>
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="foot">
      <div className="wrap">
        <span>RepoNecromancer · MIT License · built for Kiroween 2026 (Resurrection track)</span>
        <span>
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            source
          </a>{" "}
          · specs, steering & hooks live in <code>/.kiro</code>
        </span>
      </div>
    </footer>
  );
}

/** ECG trace. `alive` animates a beating heart; otherwise a flatline with a dying twitch. */
export function Ecg({ alive }: { alive: boolean }) {
  const beat = (x: number) => `L${x} 45 L${x + 8} 45 L${x + 14} 30 L${x + 20} 60 L${x + 28} 8 L${x + 36} 78 L${x + 44} 40 L${x + 52} 45`;
  const alivePath = `M0 45 ${[40, 200, 360, 520, 680, 840, 1000, 1160].map(beat).join(" ")} L1200 45`;
  const deadPath = "M0 45 L180 45 L190 41 L198 49 L206 45 L1200 45";
  return (
    <svg className="ecg" viewBox="0 0 1200 90" preserveAspectRatio="none" aria-hidden>
      {alive ? <path className="trace-alive" d={alivePath} /> : <path className="trace-dead" d={deadPath} />}
    </svg>
  );
}
