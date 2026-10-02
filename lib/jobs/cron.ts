/**
 * Envoltorio común de las rutas `app/api/cron/*` (Vercel Cron).
 *
 * Vercel llama a cada ruta con `GET` y `Authorization: Bearer <CRON_SECRET>`.
 * A diferencia de las Scheduled Functions de Netlify (que solo invoca su
 * scheduler), estas rutas son URLs públicas: sin el chequeo del secreto,
 * cualquiera podría disparar el borrado en firme de la papelera. Falla cerrado:
 * si `CRON_SECRET` no está definida, responde 401 a todo.
 *
 * ⚠️ `/api/cron` está en `PUBLIC_PATHS` (lib/supabase/middleware.ts): el
 * cron llega sin cookies de sesión y, sin eso, el middleware lo redirigiría
 * (307) a /login antes de correr — y Vercel lo contaría como ejecución exitosa.
 */

import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "../supabase/service";

export async function runCron(
  req: NextRequest,
  name: string,
  job: (supabase: SupabaseClient) => Promise<{ ok: boolean }>,
) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const result = await job(createServiceClient());
  if (!result.ok) console.error(`[cron ${name}]`, result);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
