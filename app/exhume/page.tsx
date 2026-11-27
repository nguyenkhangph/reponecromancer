import { Suspense } from "react";
import { Footer, TopBar } from "@/components/bits";
import { ExhumeClient } from "@/components/ExhumeClient";

export const metadata = { title: "Exhuming… — RepoNecromancer" };

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
