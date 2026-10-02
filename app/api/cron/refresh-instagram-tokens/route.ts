import type { NextRequest } from "next/server";
import { runCron } from "@/lib/jobs/cron";
import { refreshInstagramTokens } from "@/lib/jobs/refreshInstagramTokens";

// Vercel Cron (vercel.json). Lógica y reglas en `lib/jobs/refreshInstagramTokens.ts`.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export function GET(req: NextRequest) {
  return runCron(req, "refresh-instagram-tokens", refreshInstagramTokens);
}
