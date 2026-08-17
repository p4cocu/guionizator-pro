/**
 * Cliente mínimo de la API de Whisper (OpenAI) — SERVER-ONLY.
 *
 * Reemplaza el pipeline local de `scripts/transcribe_reel.py`
 * (faster-whisper + yt-dlp, solo corría en la Mac de Paco). Whisper acepta el
 * video directo (mp4) sin extraerle el audio antes: un fetch + un POST
 * multipart, sin ffmpeg ni binarios que empaquetar en la Netlify Function.
 *
 * `OPENAI_API_KEY` es una cuenta aparte de `ANTHROPIC_API_KEY` — Whisper no es
 * un modelo de Anthropic.
 */

const WHISPER_MAX_BYTES = 25 * 1024 * 1024; // límite duro de la API de OpenAI

export class TranscribeError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "TranscribeError";
  }
}

/**
 * Descarga el video desde `videoUrl` y lo manda a Whisper. Lanza
 * `TranscribeError` con un mensaje legible en cada punto de falla (video
 * inaccesible, demasiado pesado, o error de la API) — el caller no necesita
 * inspeccionar la causa para mostrarle algo útil a quien lo pidió.
 */
export async function transcribeVideo(videoUrl: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new TranscribeError("Falta OPENAI_API_KEY en el servidor.", 500);
  }

  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok) {
    throw new TranscribeError(
      `No se pudo descargar el video (Instagram respondió ${videoRes.status}).`,
      videoRes.status,
    );
  }

  const buffer = await videoRes.arrayBuffer();
  if (buffer.byteLength > WHISPER_MAX_BYTES) {
    const mb = (buffer.byteLength / 1024 / 1024).toFixed(1);
    throw new TranscribeError(
      `El video pesa ${mb} MB — Whisper acepta hasta 25 MB. Es un reel más largo de lo normal.`,
      413,
    );
  }
  if (buffer.byteLength === 0) {
    throw new TranscribeError("El video descargado llegó vacío.", 502);
  }

  const form = new FormData();
  form.append("file", new Blob([buffer], { type: "video/mp4" }), "video.mp4");
  form.append("model", "whisper-1");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    let detail = `OpenAI Whisper respondió ${res.status}.`;
    try {
      const j = (await res.json()) as { error?: { message?: string } };
      if (j.error?.message) detail = j.error.message;
    } catch {
      /* ignore */
    }
    throw new TranscribeError(detail, res.status);
  }

  const data = (await res.json()) as { text?: string };
  const text = data.text?.trim();
  if (!text) throw new TranscribeError("Whisper no devolvió texto.", 502);
  return text;
}
