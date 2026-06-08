import { notFound } from "next/navigation";
import { getScriptWithVersions } from "../actions";
import ScriptDetailClient from "./ScriptDetailClient";

export default async function ScriptDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getScriptWithVersions(id);
  if (!result) notFound();

  return <ScriptDetailClient script={result.script} versions={result.versions} />;
}
