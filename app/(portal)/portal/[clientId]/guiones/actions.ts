"use server";

/**
 * Lo único que el cliente puede ESCRIBIR desde el portal (Fase D, etapa 5):
 * comentar un guion y marcarlo como aprobado.
 *
 * ⚠️ NO reexportar tipos desde este archivo (regla de `CLAUDE.md`): en un módulo
 * `"use server"` un `export type` sobrevive al bundle como una referencia que en
 * runtime no existe y revienta la página al cargar. Los tipos viven en
 * `lib/portal/comments.ts`.
 *
 * Cada action revalida el acceso a la marca **y** el flag `guiones` con
 * `requirePortalClient`, igual que la página: una server action es un endpoint
 * público: que la UI no dibuje el botón no impide que alguien la invoque.
 * Aun así, el que manda es la RLS.
 */

import { revalidatePath } from "next/cache";
import { requirePortalSession, requirePortalClient } from "@/lib/portal/access";
import { addScriptComment } from "@/lib/portal/comments";
import { createServiceClient } from "@/lib/supabase/service";
import { ensureCalendarEntry } from "@/lib/portal/scheduling";
import {
  applyTextDraft,
  assertValidDraft,
  ScriptTextError,
  type ScriptTextDraft,
} from "@/lib/portal/scriptEdit";
import { trashScript as trashScriptRow } from "@/lib/portal/trash";

export type CommentResult = { ok: true } | { ok: false; error: string };

/**
 * Confirma que el guion es de esta marca antes de tocarlo. La RLS ya lo
 * garantiza, pero sin esto un `script_id` de otra marca haría un insert cuya
 * policy fallaría con un mensaje de Postgres en vez de uno legible.
 */
async function assertScriptInClient(
  supabase: Awaited<ReturnType<typeof requirePortalSession>>["supabase"],
  scriptId: string,
  clientId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("scripts")
    .select("id")
    .eq("id", scriptId)
    .eq("client_id", clientId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Ese guion no existe o no es de esta marca.");
}

export async function postScriptComment(
  clientId: string,
  scriptId: string,
  body: string,
): Promise<CommentResult> {
  try {
    const { supabase, user } = await requirePortalSession();
    await requirePortalClient(user.id, clientId, "guiones");
    await assertScriptInClient(supabase, scriptId, clientId);

    await addScriptComment(supabase, {
      scriptId,
      clientId,
      authorId: user.id,
      body,
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo enviar el comentario.",
    };
  }

  revalidatePath(`/portal/${clientId}/guiones/${scriptId}`);
  return { ok: true };
}

/**
 * Aprobar o desaprobar: escribe `scripts.client_approved_at`.
 *
 * Solo lo puede hacer el rol `collaborator` — la policy `scripts_member_update`
 * (migración `0006`) no le da `update` al `viewer`. No hay RPC de aprobación:
 * aprobar es una edición más, y el trigger `scripts_guard_update` se encarga de
 * que un miembro no pueda cambiar de paso el `owner_id` ni el `client_id`.
 *
 * Si un `viewer` llegara igual hasta acá, el `update` no afecta filas y el
 * mensaje se lo dice. No es un error de servidor: es "no te toca".
 *
 * **Al aprobar** (no al desaprobar): si el guion todavía no tiene una fila en
 * `content_calendar`, se crea una automática a +14 días (`ensureCalendarEntry`,
 * etapa 7). Va con service role porque el miembro no tiene `insert` sobre esa
 * tabla — solo el dueño. Si esa parte falla, la aprobación igual queda guardada
 * (el error se loguea, no se le muestra al cliente: la agenda es un extra, no
 * lo que estaba pidiendo).
 */
export async function setScriptApproval(
  clientId: string,
  scriptId: string,
  approved: boolean,
): Promise<CommentResult> {
  try {
    const { supabase, user } = await requirePortalSession();
    const client = await requirePortalClient(user.id, clientId, "guiones");

    if (client.role === "viewer") {
      return {
        ok: false,
        error: "Tu acceso es de solo lectura. Pídele a quien maneja tu contenido que te dé permiso de colaborador.",
      };
    }

    await assertScriptInClient(supabase, scriptId, clientId);

    const { data, error } = await supabase
      .from("scripts")
      .update({ client_approved_at: approved ? new Date().toISOString() : null })
      .eq("id", scriptId)
      .eq("client_id", clientId)
      .select("id, owner_id, type, title, brief");

    if (error) return { ok: false, error: error.message };
    if (!data?.length) {
      return { ok: false, error: "No tienes permiso para aprobar este guion." };
    }

    if (approved) {
      const script = data[0];
      await ensureCalendarEntry(createServiceClient(), {
        scriptId,
        clientId,
        ownerId: script.owner_id as string,
        type: script.type as string | null,
        title: script.title as string | null,
        brief: script.brief as string | null,
      }).catch((e) => {
        console.error("[portal/guiones] no se pudo agendar el guion aprobado:", e);
      });
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo guardar la aprobación.",
    };
  }

  revalidatePath(`/portal/${clientId}/guiones/${scriptId}`);
  revalidatePath(`/portal/${clientId}/guiones`);
  revalidatePath("/calendario");
  return { ok: true };
}

/**
 * Manda un guion a la papelera desde el portal. Cualquier miembro puede
 * (viewer o collaborator) — a diferencia de aprobar, es reversible y solo
 * Paco la ve: no hace falta el mismo nivel de permiso. La UI pide confirmar
 * dos veces antes de llamar acá (ver `TrashButton.tsx`); esta action no vuelve
 * a preguntar, hace lo que le piden.
 */
export async function trashScript(clientId: string, scriptId: string): Promise<CommentResult> {
  try {
    const { user } = await requirePortalSession();
    await requirePortalClient(user.id, clientId, "guiones");
    await trashScriptRow(createServiceClient(), scriptId, clientId);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo mandar el guion a la papelera.",
    };
  }

  revalidatePath(`/portal/${clientId}/guiones`);
  revalidatePath("/guiones");
  return { ok: true };
}

/**
 * Guarda el texto editado de un guion (etapa 8).
 *
 * ## Por qué va con la sesión del miembro y no con service role
 *
 * La policy `scripts_member_update` (migración `0006`) ya le da `update` al rol
 * `collaborator`, y el trigger `scripts_guard_update` congela
 * `owner_id`/`client_id`/`generated_by` y llena `last_edited_by` /
 * `last_edited_at`. Usar service role acá saltearía justo el control de rol que
 * la base ya hace: un `viewer` terminaría pudiendo editar. (La papelera sí va
 * con service role porque ahí queremos que el viewer pueda.)
 *
 * ## Por qué NO crea una versión nueva
 *
 * En el estudio, guardar un guion inserta otra fila (`saveScriptVersion`). Acá
 * no: los comentarios y la aprobación cuelgan de `script_id`, así que una fila
 * nueva dejaría el hilo huérfano y cambiaría la URL abajo de los pies del
 * cliente. Y el miembro no tiene `insert` sobre `scripts`, a propósito.
 *
 * ## Por qué el merge y no un content nuevo
 *
 * `applyTextDraft` pisa solo las claves de texto: sin eso, editar una frase
 * desde el portal borraría los bloques de producción, la música y el `visual`
 * de cada slide, que el portal ni dibuja. Ver `lib/portal/scriptEdit.ts`.
 *
 * La aprobación **no se toca**: si el cliente edita algo que ya había aprobado,
 * sigue aprobado y el aviso le llega a Paco por `ClientFeedbackPanel`, que
 * muestra la fecha de la última edición.
 */
export async function updateScriptText(
  clientId: string,
  scriptId: string,
  draft: ScriptTextDraft,
): Promise<CommentResult> {
  try {
    const { supabase, user } = await requirePortalSession();
    const client = await requirePortalClient(user.id, clientId, "guiones");

    if (client.role === "viewer") {
      return {
        ok: false,
        error:
          "Tu acceso es de solo lectura. Pídele a quien maneja tu contenido que te dé permiso de colaborador.",
      };
    }

    assertValidDraft(draft);

    const { data: current, error: readError } = await supabase
      .from("scripts")
      .select("id, content")
      .eq("id", scriptId)
      .eq("client_id", clientId)
      .maybeSingle();

    if (readError) return { ok: false, error: readError.message };
    if (!current) return { ok: false, error: "Ese guion no existe o no es de esta marca." };

    const content = applyTextDraft(
      (current.content as Record<string, unknown> | null) ?? null,
      draft,
    );

    const { data, error } = await supabase
      .from("scripts")
      .update({ content })
      .eq("id", scriptId)
      .eq("client_id", clientId)
      .select("id");

    if (error) return { ok: false, error: error.message };
    if (!data?.length) {
      return { ok: false, error: "No tienes permiso para editar este guion." };
    }
  } catch (e) {
    if (e instanceof ScriptTextError) return { ok: false, error: e.message };
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudieron guardar los cambios.",
    };
  }

  revalidatePath(`/portal/${clientId}/guiones/${scriptId}`);
  revalidatePath(`/portal/${clientId}/guiones`);
  revalidatePath(`/guiones/${scriptId}`);
  return { ok: true };
}
