"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ApifyError, getApifyAccount, getApifyUsage } from "@/lib/apify/client";
import {
  decryptSecret,
  encryptSecret,
  isSecretsKeyConfigured,
  lastFour,
} from "@/lib/crypto/secrets";

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

export type ApifyTokenState = {
  last4: string | null;
  valid: boolean;
  checkedAt: string | null;
};

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

  const { supabase, user } = await getAuthUser();

  let account;
  try {
    account = await getApifyAccount(token);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof ApifyError ? e.message : "No se pudo validar el token con Apify.",
    };
  }

  const checkedAt = new Date().toISOString();
  const last4 = lastFour(token);

  const { error } = await supabase
    .from("clients")
    .update({
      apify_token_cipher: encryptSecret(token),
      apify_token_last4: last4,
      apify_token_valid: true,
      apify_token_checked_at: checkedAt,
    })
    .eq("id", clientId)
    .eq("owner_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/clientes/${clientId}`);
  return {
    ok: true,
    username: account.username,
    state: { last4, valid: true, checkedAt },
  };
}

export async function removeApifyToken(clientId: string): Promise<void> {
  const { supabase, user } = await getAuthUser();

  const { error } = await supabase
    .from("clients")
    .update({
      apify_token_cipher: null,
      apify_token_last4: null,
      apify_token_valid: false,
      apify_token_checked_at: null,
    })
    .eq("id", clientId)
    .eq("owner_id", user.id);

  if (error) throw new Error(error.message);

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
  const { supabase, user } = await getAuthUser();

  const { data } = await supabase
    .from("clients")
    .select("apify_token_cipher, apify_token_last4")
    .eq("id", clientId)
    .eq("owner_id", user.id)
    .maybeSingle();

  const cipher = (data?.apify_token_cipher as string | null) ?? null;
  if (!cipher) return { ok: false, error: "Este cliente no tiene token de Apify guardado." };

  let token: string;
  try {
    token = decryptSecret(cipher);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo leer el token guardado.",
    };
  }

  const checkedAt = new Date().toISOString();
  const last4 = (data?.apify_token_last4 as string | null) ?? null;

  let account;
  try {
    account = await getApifyAccount(token);
  } catch (e) {
    await supabase
      .from("clients")
      .update({ apify_token_valid: false, apify_token_checked_at: checkedAt })
      .eq("id", clientId)
      .eq("owner_id", user.id);
    revalidatePath(`/clientes/${clientId}`);
    return {
      ok: false,
      error: e instanceof ApifyError ? e.message : "Apify no aceptó el token guardado.",
    };
  }

  // El consumo es informativo: si falla, no invalidamos nada.
  let usage: ApifyUsageInfo | null = null;
  try {
    usage = await getApifyUsage(token);
  } catch {
    usage = null;
  }

  await supabase
    .from("clients")
    .update({ apify_token_valid: true, apify_token_checked_at: checkedAt })
    .eq("id", clientId)
    .eq("owner_id", user.id);

  revalidatePath(`/clientes/${clientId}`);
  return {
    ok: true,
    username: account.username,
    usage,
    state: { last4, valid: true, checkedAt },
  };
}
