"use server";

/**
 * Panel de facturación de `/clientes/[id]` (Fase E).
 *
 * Todo lo de acá es del DUEÑO de la marca. Cada action valida la pertenencia a
 * mano además de la RLS, porque `client_subscriptions` se lee y se escribe con
 * **service role** y ahí no hay RLS debajo (migración `0013`).
 *
 * ⚠️ NO reexportar tipos desde este archivo (`export type { X }`). En un módulo
 * "use server" eso sobrevive al bundle como referencia a un binding que en
 * runtime no existe y revienta la página al cargar. Los tipos viven en
 * `lib/billing/*`; quien los necesite, que los importe de ahí.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  getSubscriptionForOwner,
  setBillingContact,
  setExempt,
} from "@/lib/billing/subscription";

async function getAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, user };
}

export type BillingActionResult = { ok: true } | { ok: false; error: string };

/**
 * Marca interna o de cortesía.
 *
 * Prenderla es lo que hace que una marca **nunca** se corte y no tenga topes de
 * IA ni de transcripción. Es la palanca con la que las marcas propias de Paco
 * quedan afuera del cobro para siempre, y con la que se migran las de hoy una
 * por una: se apaga cuando el cliente ya pasó por el Checkout.
 *
 * No toca Stripe: si la marca tenía suscripción, sigue existiendo y cobrando.
 * Para dejar de cobrarle hay que cancelarla desde el Customer Portal o desde el
 * dashboard.
 */
export async function setClientExempt(
  clientId: string,
  exempt: boolean,
): Promise<BillingActionResult> {
  try {
    const { user } = await getAuthUser();
    await setExempt(clientId, user.id, exempt);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo cambiar la exención.",
    };
  }

  revalidatePath(`/clientes/${clientId}`);
  return { ok: true };
}

/**
 * Quién es el contacto de facturación de la marca.
 *
 * Normalmente lo fija solo el Checkout (queda quien pagó). Esto es la
 * corrección a mano para los casos reales: la persona que pagó se fue de la
 * empresa, o pagó el asistente y quien tiene que ver las facturas es el dueño.
 *
 * Se valida que ese usuario sea **miembro de esta marca**: si no, el panel de
 * facturación quedaría accesible para alguien que ni siquiera entra al portal.
 */
export async function setClientBillingContact(
  clientId: string,
  userId: string | null,
): Promise<BillingActionResult> {
  try {
    const { supabase, user } = await getAuthUser();

    const sub = await getSubscriptionForOwner(clientId, user.id);
    if (!sub) return { ok: false, error: "Esa marca no es tuya o no tiene suscripción." };

    if (userId) {
      const { data: member, error } = await supabase
        .from("client_members")
        .select("id")
        .eq("client_id", clientId)
        .eq("user_id", userId)
        .maybeSingle();

      if (error) return { ok: false, error: error.message };
      if (!member) {
        return { ok: false, error: "Esa persona no es miembro de esta marca." };
      }
    }

    await setBillingContact(clientId, userId);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo cambiar el contacto de facturación.",
    };
  }

  revalidatePath(`/clientes/${clientId}`);
  return { ok: true };
}
