import { getPromptStyles } from "./actions";
import PromptsClient from "./PromptsClient";

export default async function PromptsPage() {
  const customStyles = await getPromptStyles();
  return <PromptsClient customStyles={customStyles} />;
}
