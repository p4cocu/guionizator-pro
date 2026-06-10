import { getPromptStyles, getRecentReels, getScriptById } from "./actions";
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
  if (script_id) {
    preloadedScript = await getScriptById(script_id);
  }

  return (
    <PromptsClient
      customStyles={customStyles}
      recentReels={recentReels}
      preloadedScript={preloadedScript}
    />
  );
}
