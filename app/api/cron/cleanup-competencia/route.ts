import type { NextRequest } from "next/server";
import { runCron } from "@/lib/jobs/cron";
import { cleanupCompetencia } from "@/lib/jobs/cleanupCompetencia";

// Vercel Cron (vercel.json). Lógica y reglas en `lib/jobs/cleanupCompetencia.ts`.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export function GET(req: NextRequest) {
  return runCron(req, "cleanup-competencia", cleanupCompetencia);
}
