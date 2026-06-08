import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { createClient } from "@/lib/supabase/server";
import styles from "./shell.module.css";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Defensa adicional al middleware.
  if (!user) redirect("/login");

  return (
    <div className={styles.shell}>
      <Sidebar />
      <div className={styles.main}>
        <Topbar email={user.email} />
        <div className={`${styles.content} blueprint`}>
          <div className={styles.inner}>{children}</div>
        </div>
      </div>
    </div>
  );
}
