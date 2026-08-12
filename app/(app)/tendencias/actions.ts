"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { AiJsonError, generateJsonPlain } from "@/lib/ai/json";
import { MODEL_FAST } from "@/lib/ai/anthropic";

export type TendenciaStatus = "pendiente" | "en_guion" | "descartada";
export type TendenciaUrgency = "urgente" | "evergreen";

export type Tendencia = {
  id: string;
  title: string;
  url: string;
  source: string | null;
  summary: string | null;
  angle_paco: string | null;
  angle_fluia: string | null;
  format_suggested: string | null;
  urgency: TendenciaUrgency;
  notes: string | null;
  status: TendenciaStatus;
  created_at: string;
};

async function getAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, user };
}

export async function getTendencias(): Promise<Tendencia[]> {
  const { supabase, user } = await getAuthUser();
  const { data } = await supabase
    .from("tendencias")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });
  return (data ?? []) as Tendencia[];
}

export type AddTendenciaInput = {
  title: string;
  url: string;
  source?: string;
  summary?: string;
  angle_paco?: string;
  angle_fluia?: string;
  format_suggested?: string;
  urgency?: TendenciaUrgency;
  notes?: string;
};

export type AddResult = { ok: true; id: string } | { ok: false; error: string };

export async function addTendencia(input: AddTendenciaInput): Promise<AddResult> {
  const title = input.title.trim();
  const url = input.url.trim();
  if (!title || !url) return { ok: false, error: "Título y URL son requeridos." };

  const { supabase, user } = await getAuthUser();
  const { data, error } = await supabase
    .from("tendencias")
    .insert({
      owner_id: user.id,
      title,
      url,
      source: input.source?.trim() || null,
      summary: input.summary?.trim() || null,
      angle_paco: input.angle_paco?.trim() || null,
      angle_fluia: input.angle_fluia?.trim() || null,
      format_suggested: input.format_suggested?.trim() || null,
      urgency: input.urgency ?? "evergreen",
      notes: input.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/tendencias");
  return { ok: true, id: data.id as string };
}

export type ImportResult =
  | { ok: true; count: number }
  | { ok: false; error: string };

export async function importarReporte(mdText: string): Promise<ImportResult> {
  if (!mdText.trim()) return { ok: false, error: "El reporte está vacío." };

  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, error: "Falta ANTHROPIC_API_KEY." };
  }

  const { supabase, user } = await getAuthUser();

  const userMessage = `Extrae todas las noticias/tendencias de este reporte y devuelve ÚNICAMENTE un array JSON válido, sin explicaciones ni markdown.

Formato de cada elemento:
{
  "title": "título de la noticia",
  "url": "url completa",
  "source": "nombre de la fuente (solo el nombre, ej: The Verge, MIT Tech Review)",
  "summary": "resumen de 2 líneas",
  "angle_paco": "ángulo para Paco Cuevas (marca personal, IA para negocios)",
  "angle_fluia": "ángulo para FLUIA (agencias, equipos, automatización)",
  "format_suggested": "Reel 30s | Reel 60s | Carrusel",
  "urgency": "urgente | evergreen"
}

REPORTE:
${mdText}`;

  let entries: AddTendenciaInput[];
  try {
    entries = await generateJsonPlain<AddTendenciaInput[]>({
      label: "importar-reporte",
      model: MODEL_FAST,
      maxTokens: 4096,
      userMessage,
    });
  } catch (e) {
    if (e instanceof AiJsonError) {
      return {
        ok: false,
        error: "No se pudo parsear el reporte. Verifica el formato.",
      };
    }
    console.error("[importar-reporte] Error:", e);
    return { ok: false, error: "Error al conectar con la IA. Intenta de nuevo." };
  }

  if (!Array.isArray(entries) || entries.length === 0) {
    return { ok: false, error: "No se encontraron tendencias en el reporte." };
  }

  const inserts = entries
    .filter((e) => e.title?.trim() && e.url?.trim())
    .map((e) => ({
      owner_id: user.id,
      title: e.title.trim(),
      url: e.url.trim(),
      source: e.source?.trim() || null,
      summary: e.summary?.trim() || null,
      angle_paco: e.angle_paco?.trim() || null,
      angle_fluia: e.angle_fluia?.trim() || null,
      format_suggested: e.format_suggested?.trim() || null,
      urgency: (e.urgency === "urgente" ? "urgente" : "evergreen") as TendenciaUrgency,
    }));

  if (inserts.length === 0) {
    return { ok: false, error: "No se pudo extraer ninguna tendencia válida." };
  }

  const { error } = await supabase.from("tendencias").insert(inserts);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/tendencias");
  return { ok: true, count: inserts.length };
}

export async function updateTendenciaStatus(
  id: string,
  status: TendenciaStatus,
): Promise<void> {
  const { supabase, user } = await getAuthUser();
  await supabase
    .from("tendencias")
    .update({ status })
    .eq("id", id)
    .eq("owner_id", user.id);
  revalidatePath("/tendencias");
}

export async function deleteTendencia(id: string): Promise<void> {
  const { supabase, user } = await getAuthUser();
  await supabase
    .from("tendencias")
    .delete()
    .eq("id", id)
    .eq("owner_id", user.id);
  revalidatePath("/tendencias");
}
