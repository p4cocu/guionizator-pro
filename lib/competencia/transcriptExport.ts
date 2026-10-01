/**
 * Descargar la transcripción de un post de competencia como `.md` (estudio y
 * portal). Módulo **puro**: lo importan componentes `"use client"`.
 *
 * Es `.md` y no `.txt` a propósito: el archivo está pensado para llevárselo a
 * Claude Code / ChatGPT / Antigravity y reescribirlo ahí. Un encabezado con los
 * datos del post (cuenta, link, métricas, clasificación) le da contexto al
 * modelo sin que haya que explicárselo, y sigue leyéndose bien como texto plano.
 */

import { labelFor, DIMENSIONS } from "./taxonomy";
import { accountLabel } from "./savedLink";

export type TranscriptExportPost = {
  public_id: string;
  username: string;
  permalink: string | null;
  caption: string | null;
  likes: number;
  comments: number;
  video_views: number | null;
  posted_at: string | null;
  transcription: string | null;
  hook_type: string | null;
  script_structure: string | null;
  value_pillar: string | null;
};

const nf = new Intl.NumberFormat("es-MX");

export function transcriptToMarkdown(post: TranscriptExportPost): string {
  const cuenta = accountLabel(post.username);
  const lines: string[] = [`# Transcripción — ${cuenta} (${post.public_id})`, ""];

  if (post.permalink) lines.push(`- **Link:** ${post.permalink}`);
  if (post.posted_at) {
    lines.push(`- **Publicado:** ${new Date(post.posted_at).toLocaleDateString("es-MX")}`);
  }
  const metricas = [
    post.video_views != null ? `${nf.format(post.video_views)} vistas` : null,
    `${nf.format(post.likes)} likes`,
    `${nf.format(post.comments)} comentarios`,
  ].filter(Boolean);
  lines.push(`- **Métricas:** ${metricas.join(" · ")}`);

  for (const { key, title } of DIMENSIONS) {
    const label = labelFor(key, post[key]);
    if (label) lines.push(`- **${title}:** ${label}`);
  }

  lines.push("", "## Lo que dice el video", "", (post.transcription ?? "").trim());

  const caption = post.caption?.trim();
  if (caption) lines.push("", "## Caption original", "", caption);

  return lines.join("\n").trimEnd() + "\n";
}

/** Dispara la descarga en el browser. */
export function downloadTranscript(post: TranscriptExportPost): void {
  const slug =
    post.username
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^\w-]/g, "") || "post";
  const blob = new Blob([transcriptToMarkdown(post)], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `transcripcion-${slug}-${post.public_id}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
