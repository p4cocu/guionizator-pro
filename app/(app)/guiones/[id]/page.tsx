import { notFound } from "next/navigation";
import { getScriptWithVersions, getScriptCopies } from "../actions";
import ScriptDetailClient from "./ScriptDetailClient";

export default async function ScriptDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [result, copies] = await Promise.all([
    getScriptWithVersions(id),
    getScriptCopies(id),
  ]);
  if (!result) notFound();

  return (
    <ScriptDetailClient
      script={result.script}
      versions={result.versions}
      initialCopies={copies}
    />
  );
}
