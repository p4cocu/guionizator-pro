import { notFound } from "next/navigation";
import { getScriptWithVersions, getScriptCopies, getOwnResourcesForScript, getScriptCovers } from "../actions";
import { getPromptStyles } from "../../prompts/actions";
import { getScriptHooks } from "./hooksActions";
import { getVaultHooks } from "./vaultHooksLoader";
import { getScriptFeedback } from "./feedbackActions";
import ScriptDetailClient from "./ScriptDetailClient";
import ClientFeedbackPanel from "./ClientFeedbackPanel";

export default async function ScriptDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [result, copies, customStyles, ownResources, initialHooks, vaultHooks, savedCovers, feedback] =
    await Promise.all([
      getScriptWithVersions(id),
      getScriptCopies(id),
      getPromptStyles(),
      getOwnResourcesForScript(id),
      getScriptHooks(id),
      getVaultHooks(),
      getScriptCovers(id),
      getScriptFeedback(id),
    ]);
  if (!result) notFound();

  // El panel del portal solo aparece si hay conversación o aprobación: un
  // bloque vacío en cada guion, con la mayoría de las marcas todavía sin portal,
  // sería ruido permanente.
  const showFeedback =
    feedback &&
    (feedback.comments.length > 0 ||
      feedback.approvedAt !== null ||
      feedback.lastClientEdit !== null);

  return (
    <>
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
      {showFeedback && (
        <ClientFeedbackPanel
          scriptId={id}
          clientId={feedback.clientId}
          approvedAt={feedback.approvedAt}
          lastClientEdit={feedback.lastClientEdit}
          comments={feedback.comments}
        />
      )}
    </>
  );
}
