import { getPromptStyles } from "../actions";
import LibreClient from "./LibreClient";

export default async function PromptsLibrePage() {
  const customStyles = await getPromptStyles();
  return <LibreClient customStyles={customStyles} />;
}
