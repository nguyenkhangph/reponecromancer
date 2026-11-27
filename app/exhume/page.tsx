import { Suspense } from "react";
import type { Metadata } from "next";
import { Footer, TopBar } from "@/components/bits";
import { ExhumeClient } from "@/components/ExhumeClient";

type Props = { searchParams: Promise<{ repo?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { repo } = await searchParams;
  if (repo) {
    const title = `${repo} — RepoNecromancer lab`;
    return {
      title,
      openGraph: { title },
    };
  }
  return { title: "Exhuming… — RepoNecromancer" };
}

export default function ExhumePage() {
  return (
    <>
      <TopBar />
      <main className="wrap">
        <Suspense fallback={<div className="loading">preparing the slab…</div>}>
          <ExhumeClient />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
