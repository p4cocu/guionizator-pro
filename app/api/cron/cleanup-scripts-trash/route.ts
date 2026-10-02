import type { NextRequest } from "next/server";
import { runCron } from "@/lib/jobs/cron";
import { cleanupScriptsTrash } from "@/lib/jobs/cleanupScriptsTrash";

// Vercel Cron (vercel.json). Lógica y reglas en `lib/jobs/cleanupScriptsTrash.ts`.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export function GET(req: NextRequest) {
  return runCron(req, "cleanup-scripts-trash", cleanupScriptsTrash);
}
