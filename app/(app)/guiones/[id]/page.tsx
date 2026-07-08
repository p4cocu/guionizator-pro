import { notFound } from "next/navigation";
import { getScriptWithVersions, getScriptCopies, getOwnResourcesForScript, getScriptCovers } from "../actions";
import { getPromptStyles } from "../../prompts/actions";
import { getScriptHooks } from "./hooksActions";
import { getVaultHooks } from "./vaultHooksLoader";
import ScriptDetailClient from "./ScriptDetailClient";

export default async function ScriptDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [result, copies, customStyles, ownResources, initialHooks, vaultHooks, savedCovers] =
    await Promise.all([
      getScriptWithVersions(id),
      getScriptCopies(id),
      getPromptStyles(),
      getOwnResourcesForScript(id),
      getScriptHooks(id),
      getVaultHooks(),
      getScriptCovers(id),
    ]);
  if (!result) notFound();

  return (
    <ScriptDetailClient
      script={result.script}
      versions={result.versions}
      initialCopies={copies}
      customStyles={customStyles}
      ownResources={ownResources}
      initialHooks={initialHooks}
      vaultHooks={vaultHooks}
      initialCovers={savedCovers?.covers ?? null}
    />
  );
}
