"use server";

/**
 * Alta del nombre propio desde el portal (Fase D, etapa 8).
 *
 * ⚠️ NO reexportar tipos desde este archivo (regla de `CLAUDE.md`): en un módulo
 * `"use server"` un `export type` sobrevive al bundle como una referencia que en
 * runtime no existe.
 *
 * El `userId` sale SIEMPRE de la sesión, nunca del formulario: si viniera del
 * cliente, cualquiera podría renombrar a cualquiera. La escritura en sí va con
 * service role (`lib/portal/profiles.ts`), porque `portal_profiles` no tiene
 * policies para nadie.
 */

import { revalidatePath } from "next/cache";
import { requirePortalSession } from "@/lib/portal/access";
import { setOwnDisplayName, DisplayNameError } from "@/lib/portal/profiles";

export type SaveNameResult = { ok: true; name: string } | { ok: false; error: string };

export async function saveOwnDisplayName(name: string): Promise<SaveNameResult> {
  try {
    const { user } = await requirePortalSession();
    const saved = await setOwnDisplayName(user.id, name);
    revalidatePath("/portal");
    return { ok: true, name: saved };
  } catch (e) {
    if (e instanceof DisplayNameError) return { ok: false, error: e.message };
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo guardar tu nombre.",
    };
  }
}
