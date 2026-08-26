import StructureRunner from "@/components/reading/StructureRunner";
import { requestSeed } from "@/components/ui/time";

export const dynamic = "force-dynamic";

export const metadata = { title: "Text Structure" };

export default async function StructurePage({
  searchParams,
}: {
  searchParams: Promise<{ r?: string }>;
}) {
  // Remount key, same trick as the step pages: "Again" links back here with a
  // new ?r, and without a changing key the finished runner keeps its state.
  const runKey = (await searchParams).r ?? "first";
  const seed = requestSeed();
  return <StructureRunner key={runKey} seed={seed} />;
}
