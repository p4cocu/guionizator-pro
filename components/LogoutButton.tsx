"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      className="btn btn-ghost"
      style={{ padding: "8px 14px", fontSize: 11 }}
      onClick={handleLogout}
      disabled={loading}
    >
      {loading ? "Saliendo…" : "Salir"}
    </button>
  );
}
