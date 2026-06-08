import fs from "fs";
import path from "path";
import { createClient } from "@/lib/supabase/server";
import CerebroEditor from "./CerebroEditor";
import styles from "./cerebro.module.css";

export const metadata = { title: "Cerebro — Guionizator Pro" };

function readDefaultBrain(): string {
  const brainPath = path.join(process.cwd(), "brain", "system-prompt.md");
  return fs.readFileSync(brainPath, "utf-8");
}

export default async function CerebroPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: versions } = await supabase
    .from("brain_versions")
    .select("id, version, label, is_active, created_at, content")
    .eq("owner_id", user!.id)
    .order("version", { ascending: false });

  const activeVersion = versions?.find((v) => v.is_active);
  const initialContent = (activeVersion?.content as string | null | undefined) ?? readDefaultBrain();
  const isDefault = !activeVersion;

  // Fetch content for each version in history (only need it for active, rest show metadata)
  const historyVersions = (versions ?? []).map(
    ({ id, version, label, is_active, created_at }) => ({
      id,
      version,
      label,
      is_active,
      created_at,
    })
  );

  return (
    <div>
      <div className={styles.header}>
        <div>
          <span className="eyebrow">Fase 1</span>
          <h1 className={styles.title}>Cerebro</h1>
        </div>
      </div>

      <CerebroEditor
        initialContent={initialContent}
        versions={historyVersions}
        isDefault={isDefault}
      />
    </div>
  );
}
