import { getPromptStyles, getRecentReels, getScriptById, getScriptPrompts } from "./actions";
import PromptsClient from "./PromptsClient";

export default async function PromptsPage({
  searchParams,
}: {
  searchParams: Promise<{ script_id?: string }>;
}) {
  const { script_id } = await searchParams;
  const [customStyles, recentReels] = await Promise.all([
    getPromptStyles(),
    getRecentReels(5),
  ]);

  let preloadedScript = null;
  let preloadedPrompts = null;

  if (script_id) {
    [preloadedScript, preloadedPrompts] = await Promise.all([
      getScriptById(script_id),
      getScriptPrompts(script_id),
    ]);
  }

  return (
    <PromptsClient
      customStyles={customStyles}
      recentReels={recentReels}
      preloadedScript={preloadedScript}
      preloadedPrompts={preloadedPrompts}
    />
  );
}
