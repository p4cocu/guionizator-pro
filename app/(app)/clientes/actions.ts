"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ApifyError, getApifyAccount, getApifyUsage } from "@/lib/apify/client";
import { isSecretsKeyConfigured } from "@/lib/crypto/secrets";
import { ensureSubscription } from "@/lib/billing/subscription";
import {
  ApifyTokenError,
  markApifyTokenChecked,
  readApifyToken,
  removeApifyTokenSecret,
  saveApifyTokenSecret,
} from "@/lib/competencia/apifyToken";
import type { ApifyTokenState } from "@/lib/competencia/apifyToken";

export type ClienteFormData = {
  nombre: string;
  marca: string;
  que_vende: string;
  cliente_ideal: string;
  nicho: string;
  dolor: string;
  deseo: string;
  tono: string;
  notas: string;
};

function calcCompleteness(data: ClienteFormData): number {
  const fields: (keyof ClienteFormData)[] = [
    "que_vende",
    "cliente_ideal",
    "nicho",
    "dolor",
    "deseo",
    "tono",
  ];
  const filled = fields.filter((f) => data[f]?.trim().length > 0).length;
  return Math.round((filled / fields.length) * 100);
}

async function getAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, user };
}

export async function createCliente(data: ClienteFormData) {
  const { supabase, user } = await getAuthUser();

  const { data: cliente, error } = await supabase
    .from("clients")
    .insert({
      owner_id: user.id,
      nombre: data.nombre.trim(),
      marca: data.marca.trim() || null,
      que_vende: data.que_vende.trim() || null,
      cliente_ideal: data.cliente_ideal.trim() || null,
      nicho: data.nicho.trim() || null,
      dolor: data.dolor.trim() || null,
      deseo: data.deseo.trim() || null,
      tono: data.tono.trim() || null,
      notas: data.notas.trim() || null,
      completeness: calcCompleteness(data),
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  // Fila de suscripción desde el día uno (Fase E). El backfill de la migración
  // `0013` cubrió las marcas que ya existían; ésta necesita la suya.
  //
  // Nace SIN exención a propósito: una marca nueva es de un cliente que va a
  // pagar. Las marcas propias se marcan internas con un clic desde el panel, y
  // eso es mejor que el default silencioso al revés — una marca que debía pagar
  // y nunca pagó porque nadie se acordó de sacarle la exención.
  //
  // Si esto falla no se rompe el alta: la marca ya existe, y
  // `requireBillingContext` crea la fila al vuelo la primera vez que haga falta.
  await ensureSubscription(cliente.id, user.id).catch((e) => {
    console.error("[clientes] no se pudo crear la suscripción de la marca:", e);
  });

  revalidatePath("/clientes");
  redirect(`/clientes/${cliente.id}`);
}

export async function updateCliente(id: string, data: ClienteFormData) {
  const { supabase, user } = await getAuthUser();

  const { error } = await supabase
    .from("clients")
    .update({
      nombre: data.nombre.trim(),
      marca: data.marca.trim() || null,
      que_vende: data.que_vende.trim() || null,
      cliente_ideal: data.cliente_ideal.trim() || null,
      nicho: data.nicho.trim() || null,
      dolor: data.dolor.trim() || null,
      deseo: data.deseo.trim() || null,
      tono: data.tono.trim() || null,
      notas: data.notas.trim() || null,
      completeness: calcCompleteness(data),
    })
    .eq("id", id)
    .eq("owner_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
}

export async function deleteCliente(id: string) {
  const { supabase, user } = await getAuthUser();

  const { error } = await supabase
    .from("clients")
    .delete()
    .eq("id", id)
    .eq("owner_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/clientes");
  redirect("/clientes");
}

export async function addResearch(
  clientId: string,
  fuente: string,
  resumen: string,
) {
  const { supabase, user } = await getAuthUser();

  const { error } = await supabase.from("client_research").insert({
    client_id: clientId,
    owner_id: user.id,
    fuente: fuente.trim(),
    resumen: resumen.trim(),
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/clientes/${clientId}`);
}

export async function deleteResearch(researchId: string, clientId: string) {
  const { supabase, user } = await getAuthUser();

  const { error } = await supabase
    .from("client_research")
    .delete()
    .eq("id", researchId)
    .eq("owner_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath(`/clientes/${clientId}`);
}

export async function addProduct(
  clientId: string,
  nombre: string,
  descripcion: string,
  tipo: "producto" | "servicio",
) {
  const { supabase, user } = await getAuthUser();

  const { error } = await supabase.from("client_products").insert({
    client_id: clientId,
    owner_id: user.id,
    nombre: nombre.trim(),
    descripcion: descripcion.trim() || null,
    tipo,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/clientes/${clientId}`);
}

export async function deleteProduct(productId: string, clientId: string) {
  const { supabase, user } = await getAuthUser();

  const { error } = await supabase
    .from("client_products")
    .delete()
    .eq("id", productId)
    .eq("owner_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath(`/clientes/${clientId}`);
}

// ─── Token de Apify por cliente ───────────────────────────────────────────────
// El token se guarda CIFRADO (AES-256-GCM, `SECRETS_KEY`) y nunca se devuelve al
// browser: la UI solo ve los últimos 4 caracteres. Sirve para que cada marca
// pague su propio scraping de competencia. Sin token propio, el cliente usa el
// global `APIFY_API_TOKEN` (el caso de las marcas de Paco).
//
// Desde la migración `0006` el secreto vive en `client_secrets`, tabla sin
// grants para el browser: se lee y escribe con service role
// (lib/competencia/apifyToken.ts), chequeando el `owner_id` a mano porque ese
// cliente saltea la RLS.

// ⚠️ NO reexportar `ApifyTokenState` desde acá. Un `export type { … }` en un
// archivo "use server" sobrevive al bundle como referencia a un binding que en
// runtime no existe, y la página revienta al cargar con
// `ReferenceError: ApifyTokenState is not defined`. Quien lo necesite, que lo
// importe de `@/lib/competencia/apifyToken`.

export type ApifyUsageInfo = {
  usedUsd: number | null;
  limitUsd: number | null;
  cycleEndsAt: string | null;
};

export type SaveApifyTokenResult =
  | { ok: true; username: string | null; state: ApifyTokenState }
  | { ok: false; error: string };

/**
 * Valida el token contra Apify ANTES de guardarlo: si la key no sirve, no entra
 * a la base. Así el estado guardado siempre refleja un token que funcionó.
 */
export async function saveApifyToken(
  clientId: string,
  rawToken: string,
): Promise<SaveApifyTokenResult> {
  const token = rawToken.trim();
  if (!token) return { ok: false, error: "Pega un token de Apify." };
  if (!isSecretsKeyConfigured()) {
    return {
      ok: false,
      error: "Falta SECRETS_KEY en el servidor. Genérala con `openssl rand -base64 32`.",
    };
  }

  const { user } = await getAuthUser();

  let account;
  try {
    account = await getApifyAccount(token);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof ApifyError ? e.message : "No se pudo validar el token con Apify.",
    };
  }

  let state: ApifyTokenState;
  try {
    state = await saveApifyTokenSecret(clientId, user.id, token);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo guardar el token.",
    };
  }

  revalidatePath(`/clientes/${clientId}`);
  return { ok: true, username: account.username, state };
}

export async function removeApifyToken(clientId: string): Promise<void> {
  const { user } = await getAuthUser();

  await removeApifyTokenSecret(clientId, user.id);

  revalidatePath(`/clientes/${clientId}`);
}

export type CheckApifyTokenResult =
  | { ok: true; username: string | null; usage: ApifyUsageInfo | null; state: ApifyTokenState }
  | { ok: false; error: string };

/**
 * Re-valida el token guardado y trae el consumo del ciclo actual. Si Apify lo
 * rechaza, marca `apify_token_valid = false` para que el próximo scrape falle
 * con un mensaje claro en vez de a mitad del run.
 */
export async function checkApifyToken(clientId: string): Promise<CheckApifyTokenResult> {
  const { user } = await getAuthUser();

  let stored: Awaited<ReturnType<typeof readApifyToken>>;
  try {
    stored = await readApifyToken(clientId, user.id);
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof ApifyTokenError || e instanceof Error
          ? e.message
          : "No se pudo leer el token guardado.",
    };
  }
  if (!stored) return { ok: false, error: "Este cliente no tiene token de Apify guardado." };

  let account;
  try {
    account = await getApifyAccount(stored.token);
  } catch (e) {
    // Idem: el mensaje que importa es el de Apify, no el de esta escritura.
    try {
      await markApifyTokenChecked(clientId, user.id, false);
    } catch {
      /* se reporta el error de Apify de todas formas */
    }
    revalidatePath(`/clientes/${clientId}`);
    return {
      ok: false,
      error: e instanceof ApifyError ? e.message : "Apify no aceptó el token guardado.",
    };
  }

  // El consumo es informativo: si falla, no invalidamos nada.
  let usage: ApifyUsageInfo | null = null;
  try {
    usage = await getApifyUsage(stored.token);
  } catch {
    usage = null;
  }

  // Marcar el resultado no puede tumbar la pantalla: si esta escritura falla
  // (p. ej. falta SUPABASE_SERVICE_ROLE_KEY en el entorno), el token igual es
  // válido y el usuario tiene que ver el motivo, no "This page couldn't load".
  let checkedAt: string;
  try {
    checkedAt = await markApifyTokenChecked(clientId, user.id, true);
  } catch (e) {
    return {
      ok: false,
      error: `El token es válido, pero no se pudo guardar la verificación: ${
        e instanceof Error ? e.message : "error desconocido"
      }`,
    };
  }

  revalidatePath(`/clientes/${clientId}`);
  return {
    ok: true,
    username: account.username,
    usage,
    state: { last4: stored.last4, valid: true, checkedAt },
  };
}
