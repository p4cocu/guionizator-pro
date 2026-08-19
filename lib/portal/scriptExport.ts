/**
 * Exportar un guion desde el portal: copiar al portapapeles y descargar
 * (Fase D, etapa 8). Módulo **puro**, lo importa un `"use client"`.
 *
 * No se reusa `buildTxt`/`buildMd` de `app/(app)/guiones/[id]/ScriptDetailClient.tsx`
 * a propósito: esos encabezan el archivo con la estructura narrativa, el número
 * de versión y el nombre del cliente. Son datos de taller — al cliente le sirve
 * el texto que va a grabar, no el andamio con el que lo armamos.
 *
 * El markdown ligero del editor (`**`, `==`, `_`) se quita en el `.txt` (se lee
 * en cámara, no se interpreta) y se conserva en el `.md`, donde sí significa
 * algo.
 */

import { toScriptView } from "./scriptView";

export type ExportFormat = "txt" | "md";

/** Saca las marcas del editor para dejar texto plano legible. */
function stripMarkup(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/==(.+?)==/g, "$1").replace(/_(.+?)_/g, "$1");
}

/**
 * Lo que se copia con un clic: en un reel, la voz en off tal cual (es lo que se
 * lee en cámara); en un carrusel, los slides numerados.
 */
export function scriptToClipboard(
  content: Record<string, unknown> | null | undefined,
  type: string | null,
): string {
  const view = toScriptView(content, type);

  if (view.kind === "carousel") {
    return view.slides
      .map((s) => {
        const cuerpo = s.body ? `\n${stripMarkup(s.body)}` : "";
        return `Slide ${s.number}: ${stripMarkup(s.text)}${cuerpo}`;
      })
      .join("\n\n");
  }

  if (view.kind === "reel") {
    if (view.voiceOff) return stripMarkup(view.voiceOff);
    return view.blocks
      .flatMap((b) => b.lines.map((l) => stripMarkup(l.text)))
      .join("\n");
  }

  return "";
}

/** El archivo que se descarga. Incluye el título, que en el portapapeles estorba. */
export function scriptToFile(
  content: Record<string, unknown> | null | undefined,
  type: string | null,
  title: string,
  format: ExportFormat,
): string {
  const view = toScriptView(content, type);
  const md = format === "md";
  const lines: string[] = [md ? `# ${title}` : title.toUpperCase(), ""];

  if (view.kind === "carousel") {
    for (const s of view.slides) {
      lines.push(md ? `## Slide ${s.number}` : `SLIDE ${s.number}`, "");
      lines.push(md ? s.text : stripMarkup(s.text));
      if (s.body) lines.push("", md ? s.body : stripMarkup(s.body));
      lines.push("");
    }
  } else if (view.kind === "reel") {
    if (view.voiceOff) {
      lines.push(md ? "## Voz en off" : "VOZ EN OFF", "");
      lines.push(md ? view.voiceOff : stripMarkup(view.voiceOff), "");
    }
    for (const b of view.blocks) {
      const head = b.duration ? `${b.name} — ${b.duration}` : b.name;
      lines.push(md ? `## ${head}` : head.toUpperCase(), "");
      for (const l of b.lines) {
        const texto = md ? l.text : stripMarkup(l.text);
        lines.push(l.tag ? `${md ? `**[${l.tag}]** ` : `[${l.tag}] `}${texto}` : texto);
      }
      lines.push("");
    }
  }

  return lines.join("\n").trimEnd() + "\n";
}

/** Nombre de archivo sin acentos ni espacios, como el del estudio. */
export function scriptFileName(title: string, format: ExportFormat): string {
  const slug =
    title
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 60) || "guion";
  return `${slug}.${format}`;
}
