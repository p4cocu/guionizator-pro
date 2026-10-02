/**
 * "Tu estrategia" en el portal (migración `0019`).
 *
 * `content_strategies` sigue **owner-only**: no se le dio policy al miembro
 * (con su JWT podría escribir cualquier columna desde PostgREST). Se lee y se
 * escribe con service role, y por eso **cada consulta filtra `client_id` a
 * mano** — mismo patrón que la ficha de servicio (`lib/portal/products.ts`).
 *
 * Quién hace el test: `collaborator` o el dueño. Un `viewer` ve el resultado.
 * El test **reemplaza** la estrategia que hubiera (decisión de Paco,
 * 2026-10-02) y es **gratis**: no exige `generar_ia` ni gasta cupo.
 *
 * SERVER-ONLY.
 */

import { createServiceClient } from "../supabase/service";
import { getPortalClient, requirePortalSession, type PortalClient } from "./access";
import { hasFeature } from "./features";
import { billingMessage, getBillingState } from "../billing/access";
import { buildClientContext } from "../ai/clientContext";
import { buildProductContext } from "../ai/productContext";
import { PRODUCT_COLUMNS, type Product } from "../products/fields";
import { STRATEGY_COLUMNS, normalizeStrategyRow, sanitizeStrategy, type Strategy } from "../strategy/pillars";
import { strategyFromTest } from "../strategy/runTest";
import { sanitizeTestAnswers, type TestAnswers } from "../strategy/test";

export class PortalStrategyError extends Error {}

export type PortalStrategy = Strategy & {
  test_completed_at: string | null;
  /** Las respuestas del último test, para precargar el formulario si lo rehace. */
  test_answers: TestAnswers | null;
};

/** Candado de la action. La página ya pasó por `requirePortalClient`, pero una action es un endpoint público. */
export async function requireStrategyEditor(clientId: string): Promise<{ client: PortalClient; userId: string }> {
  const { user } = await requirePortalSession();
  const client = await getPortalClient(user.id, clientId);
  if (!client) throw new PortalStrategyError("Esa marca no existe.");
  if (!hasFeature(client.features, "estrategia")) {
    throw new PortalStrategyError("Esta sección no está habilitada para tu marca.");
  }
  if (client.role === "viewer") throw new PortalStrategyError("Tu acceso es de solo lectura.");
  if (client.role !== "owner") {
    const billing = await getBillingState(clientId);
    if (!billing.ok) throw new PortalStrategyError(billingMessage(billing));
  }
  return { client, userId: user.id };
}

export async function loadPortalStrategy(clientId: string): Promise<PortalStrategy> {
  const { data, error } = await createServiceClient()
    .from("content_strategies")
    .select(`${STRATEGY_COLUMNS}, test_completed_at, test_answers`)
    // ⚠️ Service role: este filtro es lo único que acota a la marca.
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) {
    console.error("[portal/strategy] no se pudo leer la estrategia:", error.message);
  }
  const row = (data ?? null) as Record<string, unknown> | null;
  return {
    ...normalizeStrategyRow(row, clientId),
    test_completed_at: typeof row?.test_completed_at === "string" ? row.test_completed_at : null,
    test_answers: row?.test_answers ? sanitizeTestAnswers(row.test_answers) : null,
  };
}

/** Corre el test y guarda el resultado encima de lo que hubiera. */
export async function runPortalStrategyTest(input: {
  clientId: string;
  userId: string;
  answers: TestAnswers;
}): Promise<PortalStrategy> {
  const admin = createServiceClient();

  // Perfil SIN `notas` (apuntes internos de Paco: todo lo que entra al prompt
  // puede salir parafraseado en la pantalla del cliente).
  const { data: brand, error } = await admin
    .from("clients")
    .select("owner_id, nombre, marca, que_vende, cliente_ideal, nicho, dolor, deseo, tono")
    .eq("id", input.clientId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!brand) throw new PortalStrategyError("Esa marca no existe.");
  const ownerId = brand.owner_id as string;

  const { data: products } = await admin
    .from("client_products")
    .select(PRODUCT_COLUMNS)
    .eq("owner_id", ownerId)
    .eq("client_id", input.clientId);

  const result = await strategyFromTest({
    answers: input.answers,
    brandContext: buildClientContext(brand as Record<string, string | null>, { includeNotes: false }),
    productsContext: ((products ?? []) as unknown as Product[]).map((p) => buildProductContext(p)).join("\n\n"),
  });

  const clean = sanitizeStrategy({ ...result.fields, account_phase: result.account_phase, pillars: result.pillars });
  const now = new Date().toISOString();
  const { error: upsertError } = await admin.from("content_strategies").upsert(
    {
      client_id: input.clientId,
      // El dueño de la marca, no el miembro: si no, la fila desaparece de la
      // vista de Paco (RLS `owner_id = auth.uid()`).
      owner_id: ownerId,
      ...clean,
      test_answers: input.answers,
      test_completed_at: now,
      test_completed_by: input.userId,
      updated_at: now,
    },
    { onConflict: "client_id" },
  );
  if (upsertError) throw new Error(upsertError.message);

  return {
    ...normalizeStrategyRow({ ...clean, updated_at: now }, input.clientId),
    test_completed_at: now,
    test_answers: input.answers,
  };
}
