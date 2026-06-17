import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { writeFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import busboy from "busboy";
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

function parseMultipart(req: NextRequest): Promise<{ fields: Record<string, string>; file: { buffer: Buffer; filename: string } | null }> {
  return new Promise((resolve, reject) => {
    const contentType = req.headers.get("content-type") ?? "";
    const bb = busboy({ headers: { "content-type": contentType }, limits: { fileSize: 500 * 1024 * 1024 } });

    const fields: Record<string, string> = {};
    let fileResult: { buffer: Buffer; filename: string } | null = null;

    bb.on("field", (name, val) => { fields[name] = val; });

    bb.on("file", (name, stream, info) => {
      if (name !== "file") { stream.resume(); return; }
      const chunks: Buffer[] = [];
      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      stream.on("end", () => { fileResult = { buffer: Buffer.concat(chunks), filename: info.filename }; });
    });

    bb.on("finish", () => resolve({ fields, file: fileResult }));
    bb.on("error", reject);

    const body = req.body;
    if (!body) { reject(new Error("Request body vacío")); return; }

    // Leer el web ReadableStream chunk a chunk y escribir directamente a busboy
    const reader = body.getReader();
    (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) { bb.end(); break; }
          if (!bb.write(Buffer.from(value))) {
            await new Promise<void>((res) => bb.once("drain", res));
          }
        }
      } catch (e) {
        bb.destroy(e as Error);
        reject(e);
      }
    })();
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

    const { fields, file } = await parseMultipart(req);
    const post_id = fields["post_id"] ?? null;

    if (!post_id) return NextResponse.json({ error: "post_id es requerido" }, { status: 400 });
    if (!file) return NextResponse.json({ error: "archivo de video es requerido" }, { status: 400 });

    const { data: post } = await supabase
      .from("competitor_posts")
      .select("id, username")
      .eq("id", post_id)
      .eq("owner_id", user.id)
      .single();

    if (!post) return NextResponse.json({ error: "Post no encontrado" }, { status: 404 });

    const ext = file.filename.split(".").pop() ?? "mp4";
    const tmpPath = path.join(tmpdir(), `reel_${Date.now()}.${ext}`);
    await writeFile(tmpPath, file.buffer);

    console.log(`[transcribe-reel] Archivo recibido: ${file.filename} (${(file.buffer.length / 1024 / 1024).toFixed(1)} MB) → ${tmpPath}`);

    const scriptPath = path.join(process.cwd(), "scripts", "transcribe_reel.py");
    let raw: string;
    try {
      raw = await runPythonScript(scriptPath, [tmpPath]);
    } finally {
      await unlink(tmpPath).catch(() => {});
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
