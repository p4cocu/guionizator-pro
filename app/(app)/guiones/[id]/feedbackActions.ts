"use server";

/**
 * El lado de Paco de la conversación con el cliente (Fase D, etapa 5).
 *
 * Sin esto, el portal sería un buzón sin destinatario: el cliente comenta y
 * nadie lo lee. Acá se leen los comentarios de un guion y se contesta.
 *
 * La aprobación (`scripts.client_approved_at`) se muestra pero **no se toca
 * desde acá**: es el acto del cliente. Si Paco quiere destrabar algo, comenta.
 *
 * ⚠️ NO reexportar tipos desde este archivo (regla dura de `CLAUDE.md`). El tipo
 * `ScriptComment` vive en `lib/portal/comments.ts`; quien lo necesite lo importa
 * de ahí.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { addScriptComment, listScriptComments } from "@/lib/portal/comments";

export type ScriptFeedback = {
  clientId: string;
  approvedAt: string | null;
  comments: {
    id: string;
    author: string;
    isMine: boolean;
    body: string;
    createdAt: string;
  }[];
};

export type ReplyResult = { ok: true } | { ok: false; error: string };

async function getAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, user };
}

/**
 * Comentarios + estado de aprobación de un guion propio. Devuelve `null` si el
 * guion no existe o no es de Paco — la página lo trata como "sin panel", no
 * como error.
 */
export async function getScriptFeedback(scriptId: string): Promise<ScriptFeedback | null> {
  const { supabase, user } = await getAuthUser();

  const { data: script } = await supabase
    .from("scripts")
    .select("id, client_id, client_approved_at")
    .eq("id", scriptId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!script) return null;

  const comments = await listScriptComments(supabase, scriptId, user.id);

  return {
    clientId: script.client_id as string,
    approvedAt: (script.client_approved_at as string | null) ?? null,
    comments: comments.map((c) => ({
      id: c.id,
      // Del lado de Paco importa QUIÉN del cliente escribió, así que se muestra
      // el mail. "Tú" solo para lo suyo.
      author: c.isMine ? "Tú" : (c.authorEmail ?? "El cliente"),
      isMine: c.isMine,
      body: c.body,
      createdAt: c.createdAt,
    })),
  };
}

/** Contesta un comentario del cliente. Queda en el mismo hilo del guion. */
export async function replyToScriptComment(
  scriptId: string,
  clientId: string,
  body: string,
): Promise<ReplyResult> {
  try {
    const { supabase, user } = await getAuthUser();

    // Que el guion sea de Paco y de esa marca. La RLS ya lo cubre; esto
    // convierte un error de policy en un mensaje legible.
    const { data: script } = await supabase
      .from("scripts")
      .select("id")
      .eq("id", scriptId)
      .eq("client_id", clientId)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!script) return { ok: false, error: "Ese guion no existe o no es tuyo." };

    await addScriptComment(supabase, {
      scriptId,
      clientId,
      authorId: user.id,
      body,
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo enviar la respuesta.",
    };
  }

  revalidatePath(`/guiones/${scriptId}`);
  return { ok: true };
}
