/**
 * Portadas y Copy Expert desde el portal (Fase D, etapa 8) — el add-on de IA
 * aplicado a un guion que ya existe.
 *
 * SERVER-ONLY: usa service role. Nunca importar desde un `"use client"`.
 *
 * ## Las dos gastan cupo
 *
 * Las dos llaman a Claude, así que van contra el MISMO tope que generar guiones
 * (`clients.ai_generation_limit`, medido en `ai_usage_log`), igual que "Adaptar
 * a mi marca". Una llamada = una fila. Son más baratas que un guion (Haiku
 * 4.5 contra Sonnet), pero un medidor por tipo de llamada sería otro tope que
 * explicarle al cliente, y sin tope quedaría una canilla abierta.
 *
 * ## Por qué no se reusan `/api/ai/{cover,copy}`
 *
 * Por lo mismo que el resto del portal: esas rutas arman todo con la sesión y
 * **no miden nada**. Además reciben el `content` en el body sin chequear de
 * quién es el guion. Acá el guion se lee con service role filtrando
 * `client_id`, y el consumo se registra.
 *
 * Los dos PROMPTS ya no están duplicados: copy vive en `lib/ai/copyPrompt.ts`
 * (desde 0014) y portadas en `lib/ai/coverPrompt.ts` (desde 2026-09-30). Los
 * dos lados importan el mismo texto; lo que sigue separado es la ejecución.
 *
 * ## Dónde se guardan
 *
 * En las mismas tablas que el estudio: `script_covers` y `script_copies`, con
 * `owner_id` = dueño de la marca. Las dos quedaron **owner-only** en `0006` (el
 * miembro no tiene ninguna policy ahí), así que leer y escribir va con service
 * role, filtrando la pertenencia a mano.
 */

import { createServiceClient } from "../supabase/service";
import { MODEL_FAST } from "../ai/anthropic";
import { generateJsonPlain } from "../ai/json";
import {
  buildCopyPrompt,
  COPY_SYSTEM,
  isCopyPlatform,
  normalizeCopyResult,
  summarizeScriptContent,
} from "../ai/copyPrompt";
import {
  buildCoverPrompt,
  COVER_MAX_TOKENS,
  COVER_SYSTEM,
  coverProductLine,
} from "../ai/coverPrompt";
import { loadGenerationContext, PortalGenerationError } from "./generate";
import { loadProduct } from "../products/load";
import {
  isPortalCopyPlatform,
  type PortalCoverIdea,
  type PortalScriptCopy,
} from "./scriptToolsShared";

// Los tipos y la lista de plataformas viven en `./scriptToolsShared` (módulo
// puro) para que el panel cliente los pueda importar sin arrastrar `fs`, el SDK
// de Anthropic y el service role al bundle del browser.
export {
  PORTAL_COPY_PLATFORMS,
  isPortalCopyPlatform,
  type PortalCoverIdea,
  type PortalScriptCopy,
} from "./scriptToolsShared";

// ─── El guion, leído con service role ────────────────────────────────────────

export type ToolScript = {
  id: string;
  type: string | null;
  title: string | null;
  brief: string | null;
  structure_name: string | null;
  content: Record<string, unknown> | null;
  /** Servicio del guion (0016): copy y portadas leen su ficha. */
  product_id: string | null;
};

/** El guion, confirmando que es de esta marca. 404 si no. */
export async function loadClientScript(clientId: string, scriptId: string): Promise<ToolScript> {
  const { data, error } = await createServiceClient()
    .from("scripts")
    .select("id, type, title, brief, structure_name, content, product_id")
    .eq("id", scriptId)
    .eq("client_id", clientId)
    .maybeSingle();

  if (error) throw new PortalGenerationError(error.message, 500);
  if (!data) throw new PortalGenerationError("Ese guion no existe o no es de esta marca.", 404);
  return data as ToolScript;
}

// ─── Portadas ────────────────────────────────────────────────────────────────

export async function generateCovers(
  script: ToolScript,
  clientId?: string,
): Promise<PortalCoverIdea[]> {
  // El servicio del guion en una línea (0016), igual que en el estudio. Se
  // filtra por la marca: el service role no tiene RLS que lo cubra.
  let productLine: string | null = null;
  if (clientId && script.product_id) {
    const admin = createServiceClient();
    const { data: owner } = await admin
      .from("clients")
      .select("owner_id")
      .eq("id", clientId)
      .maybeSingle();
    if (owner) {
      productLine = coverProductLine(
        await loadProduct(admin, {
          productId: script.product_id,
          ownerId: owner.owner_id as string,
          clientId,
        }),
      );
    }
  }

  const covers = await generateJsonPlain<PortalCoverIdea[]>({
    label: "portal:cover",
    model: MODEL_FAST,
    maxTokens: COVER_MAX_TOKENS,
    system: COVER_SYSTEM,
    userMessage: buildCoverPrompt({
      type: script.type,
      brief: script.brief,
      structureName: script.structure_name,
      content: script.content,
      productLine,
    }),
  });

  if (!Array.isArray(covers) || covers.length === 0) {
    throw new PortalGenerationError("La IA no devolvió portadas. Intenta de nuevo.", 502);
  }
  return covers.slice(0, 3);
}

/** Portadas guardadas de un guion. `null` si nunca se generaron. */
export async function loadCovers(scriptId: string): Promise<PortalCoverIdea[] | null> {
  const { data } = await createServiceClient()
    .from("script_covers")
    .select("covers")
    .eq("script_id", scriptId)
    .maybeSingle();

  const covers = data?.covers as PortalCoverIdea[] | undefined;
  return covers?.length ? covers : null;
}

/** Guarda con `owner_id` del DUEÑO, no del miembro: si no, Paco no las ve. */
export async function saveCovers(
  scriptId: string,
  ownerId: string,
  covers: PortalCoverIdea[],
): Promise<void> {
  const { error } = await createServiceClient()
    .from("script_covers")
    .upsert(
      { owner_id: ownerId, script_id: scriptId, covers, updated_at: new Date().toISOString() },
      { onConflict: "script_id,owner_id" },
    );
  if (error) throw new PortalGenerationError(error.message, 500);
}

// ─── Copy ────────────────────────────────────────────────────────────────────

/**
 * El copy del portal usa **el mismo prompt que el estudio**
 * (`lib/ai/copyPrompt.ts`) desde la migración `0014`.
 *
 * Antes estaba duplicado acá, con la excusa de que `/api/ai/copy` es un handler
 * y no un módulo importable. Con el copy en dos versiones esa copia se volvía
 * cara: dos formatos de salida que se desincronizan a la primera corrección.
 * Lo que sigue siendo distinto es la EJECUCIÓN, que es lo que justificaba la
 * separación: acá se lee con service role, se cobra cupo y se cierra con
 * `settleGeneration`.
 *
 * El contexto de la marca entra **sin `notas`** (`loadGenerationContext`): son
 * apuntes internos y todo lo que entra al prompt puede salir parafraseado.
 */
export async function generateCopy(
  script: ToolScript,
  platform: string,
  clientId?: string,
): Promise<PortalScriptCopy> {
  if (!isPortalCopyPlatform(platform) || !isCopyPlatform(platform)) {
    throw new PortalGenerationError("Esa plataforma no está disponible.", 400);
  }

  // Si el contexto de la marca falla, se genera igual: un copy más genérico es
  // mejor que un error después de haber chequeado el cupo.
  let brandContext: string | null = null;
  if (clientId) {
    try {
      // Con el servicio del guion (0016): la ficha entra pegada a la marca y
      // el CTA del copy sale de ahí, igual que en el estudio.
      brandContext = (await loadGenerationContext(clientId, script.product_id)).clientContext;
    } catch {
      brandContext = null;
    }
  }

  const result = await generateJsonPlain<{
    copy_short?: string;
    copy_long?: string;
    copy?: string;
    hashtags?: string;
  }>({
    label: "portal:copy",
    model: MODEL_FAST,
    // Dos versiones en una sola respuesta necesitan más techo que las 1024 de
    // antes; quedarse corto dispara el reintento de `lib/ai/json.ts`.
    maxTokens: 2048,
    system: COPY_SYSTEM,
    userMessage: buildCopyPrompt({
      platform,
      scriptType: script.type ?? "reel",
      contentSummary: summarizeScriptContent(script.type ?? "reel", script.content),
      brief: script.brief,
      title: script.title,
      brandContext,
    }),
  });

  let normalized;
  try {
    normalized = normalizeCopyResult(result);
  } catch {
    throw new PortalGenerationError("La IA no devolvió el copy. Intenta de nuevo.", 502);
  }

  return {
    platform,
    copy: normalized.copy_long,
    copyShort: normalized.copy_short,
    hashtags: normalized.hashtags,
  };
}

/** Copies guardados de un guion, uno por plataforma. */
export async function loadCopies(scriptId: string): Promise<PortalScriptCopy[]> {
  const { data } = await createServiceClient()
    .from("script_copies")
    .select("platform, copy_text, copy_short, hashtags")
    .eq("script_id", scriptId)
    .order("created_at", { ascending: false });

  const seen = new Set<string>();
  const out: PortalScriptCopy[] = [];
  for (const row of data ?? []) {
    const platform = row.platform as string;
    if (seen.has(platform)) continue;
    seen.add(platform);
    out.push({
      platform,
      copy: (row.copy_text as string) ?? "",
      copyShort: (row.copy_short as string | null) ?? "",
      hashtags: (row.hashtags as string | null) ?? "",
    });
  }
  return out;
}

/** Reemplaza el copy de esa plataforma, como hace `saveScriptCopy` del estudio. */
export async function saveCopy(
  scriptId: string,
  ownerId: string,
  copy: PortalScriptCopy,
): Promise<void> {
  const admin = createServiceClient();

  await admin
    .from("script_copies")
    .delete()
    .eq("script_id", scriptId)
    .eq("platform", copy.platform)
    .eq("owner_id", ownerId);

  const { error } = await admin.from("script_copies").insert({
    owner_id: ownerId,
    script_id: scriptId,
    platform: copy.platform,
    copy_text: copy.copy,
    copy_short: copy.copyShort || null,
    hashtags: copy.hashtags || null,
  });

  if (error) throw new PortalGenerationError(error.message, 500);
}
