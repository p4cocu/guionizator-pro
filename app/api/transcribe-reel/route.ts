import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { stat } from "fs/promises";
import path from "path";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

function isLocalDev(): boolean {
  return process.env.NODE_ENV === "development";
}

function runPythonScript(scriptPath: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("python3", [scriptPath, ...args]);

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
    proc.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Script terminó con código ${code}.\n${stderr}`));
        return;
      }
      resolve(stdout.trim());
    });

    proc.on("error", (err) => {
      reject(new Error(`No se pudo ejecutar python3: ${err.message}`));
    });
  });
}

export async function POST(req: NextRequest) {
  if (!isLocalDev()) {
    return NextResponse.json(
      { error: "La transcripción local solo está disponible en desarrollo (Mac)." },
      { status: 403 }
    );
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json() as { post_id?: string; file_path?: string };
    const { post_id, file_path } = body;

    if (!post_id) return NextResponse.json({ error: "post_id es requerido" }, { status: 400 });
    if (!file_path?.trim()) return NextResponse.json({ error: "file_path es requerido" }, { status: 400 });

    if (!path.isAbsolute(file_path)) {
      return NextResponse.json(
        { error: "Usa una ruta absoluta. Ej: /Users/paco/Downloads/video.mp4" },
        { status: 400 }
      );
    }

    const { data: post } = await supabase
      .from("competitor_posts")
      .select("id, username")
      .eq("id", post_id)
      .eq("owner_id", user.id)
      .single();

    if (!post) return NextResponse.json({ error: "Post no encontrado" }, { status: 404 });

    try {
      await stat(file_path);
    } catch {
      return NextResponse.json(
        { error: `Archivo no encontrado en: ${file_path}` },
        { status: 400 }
      );
    }

    const fileSizeMB = (await stat(file_path)).size / 1024 / 1024;
    console.log(`[transcribe-reel] Archivo: ${file_path} (${fileSizeMB.toFixed(1)} MB)`);

    const scriptPath = path.join(process.cwd(), "scripts", "transcribe_reel.py");
    let raw: string;
    try {
      raw = await runPythonScript(scriptPath, [file_path]);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Error en el script de transcripción" },
        { status: 500 }
      );
    }

    let transcription: string;
    try {
      const parsed = JSON.parse(raw) as { transcription: string };
      transcription = parsed.transcription;
    } catch {
      return NextResponse.json({ error: "Error al parsear resultado del script.", raw }, { status: 500 });
    }

    const { error: updateError } = await supabase
      .from("competitor_posts")
      .update({ transcription })
      .eq("id", post_id)
      .eq("owner_id", user.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    console.log(`[transcribe-reel] OK @${post.username} — ${transcription.length} chars`);
    return NextResponse.json({ transcription });
  } catch (e) {
    console.error("[transcribe-reel] Error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error interno" },
      { status: 500 }
    );
  }
}
