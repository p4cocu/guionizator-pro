/**
 * Cliente mínimo de Gemini para mirar VIDEO — SERVER-ONLY.
 *
 * Existe para el análisis de gancho visual (migración `0023`): Claude no
 * acepta video y la transcripción de Whisper solo ve lo que se dice. Gemini
 * mira los cuadros. REST directo con `fetch`, sin SDK: es una sola llamada.
 *
 * Solo se mira el INICIO del video: `videoMetadata.endOffset` recorta del lado
 * de Google y `fps` sube la cantidad de cuadros por segundo (el default es 1,
 * que en un gancho de 3 s son 3 fotos). Se paga por cuadro, así que recortar
 * es lo que mantiene barato analizar a más fps.
 *
 * Dos caminos según el peso:
 *   - ≤ INLINE_MAX_BYTES → el video va en base64 dentro de la request (caso
 *     normal: un reel pesa 2-10 MB). Una sola llamada, sin esperas.
 *   - más pesado → Files API: subir, esperar a que quede ACTIVE, analizar y
 *     borrar. El borrado es best-effort (igual expira solo a las 48 h).
 *
 * `GEMINI_API_KEY` sale de Google AI Studio; cuenta aparte de Anthropic y OpenAI.
 */

const API = "https://generativelanguage.googleapis.com";

/** Modelo con video. Verificado contra `GET /v1beta/models` el 2026-10-02. */
export const GEMINI_VISION_MODEL = "gemini-3.8-flash";

/** Límite de la request inline es 20 MB en total; el base64 infla ~33%. */
const INLINE_MAX_BYTES = 14 * 1024 * 1024;
/** Tope de descarga: más que esto no es un reel. */
const DOWNLOAD_MAX_BYTES = 200 * 1024 * 1024;
const FILE_ACTIVE_TIMEOUT_MS = 90_000;

export class GeminiError extends Error {
  constructor(
    message: string,
    public status = 500,
  ) {
    super(message);
    this.name = "GeminiError";
  }
}

function apiKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new GeminiError("Falta GEMINI_API_KEY en el servidor.", 500);
  return key;
}

async function downloadVideo(url: string): Promise<{ bytes: Buffer; mime: string }> {
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  } catch {
    throw new GeminiError("No se pudo descargar el video (tardó demasiado o se cortó).", 502);
  }
  if (!res.ok) {
    throw new GeminiError(`No se pudo descargar el video (Instagram respondió ${res.status}).`, res.status);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength === 0) throw new GeminiError("El video descargado llegó vacío.", 502);
  if (buf.byteLength > DOWNLOAD_MAX_BYTES) {
    throw new GeminiError(`El video pesa ${(buf.byteLength / 1024 / 1024).toFixed(0)} MB: no es un reel.`, 413);
  }
  const type = res.headers.get("content-type") ?? "";
  return { bytes: buf, mime: type.startsWith("video/") ? type.split(";")[0] : "video/mp4" };
}

type UploadedFile = { name: string; uri: string; mimeType: string };

async function uploadFile(bytes: Buffer, mime: string, key: string): Promise<UploadedFile> {
  const start = await fetch(`${API}/upload/v1beta/files?key=${key}`, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(bytes.byteLength),
      "X-Goog-Upload-Header-Content-Type": mime,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: "gancho-visual" } }),
  });
  const uploadUrl = start.headers.get("x-goog-upload-url");
  if (!start.ok || !uploadUrl) throw new GeminiError(`Gemini no aceptó la subida del video (${start.status}).`, 502);

  const done = await fetch(uploadUrl, {
    method: "POST",
    headers: { "X-Goog-Upload-Command": "upload, finalize", "X-Goog-Upload-Offset": "0" },
    body: new Uint8Array(bytes),
  });
  const json = (await done.json().catch(() => null)) as { file?: { name: string; uri: string; state?: string } } | null;
  if (!done.ok || !json?.file) throw new GeminiError(`Falló la subida del video a Gemini (${done.status}).`, 502);

  // El archivo nace PROCESSING; usarlo antes de ACTIVE da 400.
  let state = json.file.state;
  const deadline = Date.now() + FILE_ACTIVE_TIMEOUT_MS;
  while (state !== "ACTIVE") {
    if (state === "FAILED") throw new GeminiError("Gemini no pudo procesar el video.", 502);
    if (Date.now() > deadline) throw new GeminiError("Gemini tardó demasiado en procesar el video.", 504);
    await new Promise((r) => setTimeout(r, 2000));
    const poll = await fetch(`${API}/v1beta/${json.file.name}?key=${key}`);
    state = ((await poll.json().catch(() => null)) as { state?: string } | null)?.state;
  }
  return { name: json.file.name, uri: json.file.uri, mimeType: mime };
}

async function deleteFile(name: string, key: string): Promise<void> {
  await fetch(`${API}/v1beta/${name}?key=${key}`, { method: "DELETE" }).catch(() => undefined);
}

export type VideoClipResult = {
  text: string;
  /** `MAX_TOKENS` = se cortó. */
  finishReason: string | null;
  usage: { promptTokens: number; outputTokens: number } | null;
};

/**
 * Manda los primeros `endSeconds` del video a Gemini con `prompt` y devuelve el
 * texto (JSON si `json`). Lanza `GeminiError` con mensaje legible.
 */
export async function analyzeVideoClip(opts: {
  videoUrl: string;
  prompt: string;
  endSeconds: number;
  fps: number;
  json?: boolean;
  maxOutputTokens?: number;
  model?: string;
}): Promise<VideoClipResult> {
  const key = apiKey();
  const model = opts.model ?? GEMINI_VISION_MODEL;
  const { bytes, mime } = await downloadVideo(opts.videoUrl);

  let uploaded: UploadedFile | null = null;
  try {
    let videoPart: Record<string, unknown>;
    if (bytes.byteLength <= INLINE_MAX_BYTES) {
      videoPart = { inlineData: { mimeType: mime, data: bytes.toString("base64") } };
    } else {
      uploaded = await uploadFile(bytes, mime, key);
      videoPart = { fileData: { mimeType: uploaded.mimeType, fileUri: uploaded.uri } };
    }
    videoPart.videoMetadata = { startOffset: "0s", endOffset: `${opts.endSeconds}s`, fps: opts.fps };

    const res = await fetch(`${API}/v1beta/models/${model}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(120_000),
      body: JSON.stringify({
        contents: [{ role: "user", parts: [videoPart, { text: opts.prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: opts.maxOutputTokens ?? 4096,
          ...(opts.json ? { responseMimeType: "application/json" } : {}),
        },
      }),
    });

    const data = (await res.json().catch(() => null)) as {
      error?: { message?: string };
      candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
      promptFeedback?: { blockReason?: string };
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    } | null;

    if (!res.ok) {
      const msg = data?.error?.message ?? `HTTP ${res.status}`;
      throw new GeminiError(`Gemini respondió con error: ${msg}`, res.status === 429 ? 429 : 502);
    }
    if (data?.promptFeedback?.blockReason) {
      throw new GeminiError(`Gemini se negó a analizar este video (${data.promptFeedback.blockReason}).`, 422);
    }
    const cand = data?.candidates?.[0];
    const text = (cand?.content?.parts ?? [])
      .filter((p) => !p.thought && typeof p.text === "string")
      .map((p) => p.text)
      .join("")
      .trim();
    if (!text) throw new GeminiError("Gemini no devolvió respuesta. Intenta de nuevo.", 502);

    return {
      text,
      finishReason: cand?.finishReason ?? null,
      usage: data?.usageMetadata
        ? {
            promptTokens: data.usageMetadata.promptTokenCount ?? 0,
            outputTokens: data.usageMetadata.candidatesTokenCount ?? 0,
          }
        : null,
    };
  } catch (e) {
    if (e instanceof GeminiError) throw e;
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
      throw new GeminiError("Gemini tardó demasiado en responder.", 504);
    }
    throw e;
  } finally {
    if (uploaded) await deleteFile(uploaded.name, key);
  }
}
