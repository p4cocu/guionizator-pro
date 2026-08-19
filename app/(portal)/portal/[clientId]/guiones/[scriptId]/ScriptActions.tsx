"use client";

/**
 * Copiar y descargar el guion, del lado del cliente (Fase D, etapa 8).
 *
 * Es el equivalente de los botones "Copiar" y "Descargar" del estudio
 * (`ScriptDetailClient`), pero sobre el texto que el cliente necesita y sin los
 * datos de taller (estructura narrativa, número de versión). Todo pasa en el
 * browser: **no cuesta crédito ni toca la API**, a diferencia de Portadas y
 * Copy Expert.
 */

import { useState } from "react";
import {
  scriptToClipboard,
  scriptToFile,
  scriptFileName,
  type ExportFormat,
} from "@/lib/portal/scriptExport";
import s from "../guiones.module.css";

export default function ScriptActions({
  content,
  type,
  title,
}: {
  content: Record<string, unknown> | null;
  type: string | null;
  title: string;
}) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isReel = type !== "carousel";
  const texto = scriptToClipboard(content, type);

  async function copiar() {
    if (!texto) return;
    try {
      await navigator.clipboard.writeText(texto);
      setCopied(true);
      setError(null);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sin permiso de portapapeles (o sin https): se dice, no se falla en silencio.
      setError("Tu navegador no dejó copiar. Selecciona el texto y usa Ctrl/Cmd+C.");
    }
  }

  function descargar(format: ExportFormat) {
    const blob = new Blob([scriptToFile(content, type, title, format)], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = scriptFileName(title, format);
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!texto) return null;

  return (
    <div className={s.toolbar}>
      <button type="button" className="btn btn-secondary" onClick={copiar}>
        {copied ? "¡Copiado!" : isReel ? "Copiar voz en off" : "Copiar carrusel"}
      </button>
      <button type="button" className="btn btn-ghost" onClick={() => descargar("txt")}>
        Descargar .txt
      </button>
      <button type="button" className="btn btn-ghost" onClick={() => descargar("md")}>
        Descargar .md
      </button>
      {error && <span className={s.error}>{error}</span>}
    </div>
  );
}
