import { notFound } from "next/navigation";
import { Footer, TopBar } from "@/components/bits";
import { Lab } from "@/components/Lab";
import { SPECIMENS, getSpecimen } from "@/lib/specimens";

export function generateStaticParams() {
  return SPECIMENS.map((s) => ({ id: s.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = SPECIMENS.find((x) => x.id === id);
  return { title: s ? `${s.title} — RepoNecromancer lab` : "RepoNecromancer" };
}

export default async function SpecimenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bundle = getSpecimen(id);
  if (!bundle) notFound();
  return (
    <>
      <TopBar />
      <main className="wrap">
        <Lab bundle={bundle} />
      </main>
      <Footer />
    </>
  );
}
