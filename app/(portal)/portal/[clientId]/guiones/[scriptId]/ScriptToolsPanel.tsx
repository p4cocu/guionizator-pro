"use client";

/**
 * Portadas y Copy Expert en el portal (Fase D, etapa 8).
 *
 * Es la versión para el cliente de `CoverCreatorPanel` y `CopyExpertPanel` del
 * estudio. Dos diferencias que importan:
 *
 *  1. **Gastan cupo** del add-on de IA (el mismo que generar guiones), así que
 *     el panel muestra cuánto queda y bloquea al llegar a cero. El corte real
 *     lo hace el servidor; esto es informativo.
 *  2. Se dibuja solo si `generar_ia` está prendido para la marca (lo decide la
 *     página) — con el add-on apagado, el cliente ve copiar y descargar y nada
 *     más.
 *
 * Los prompts de imagen (`ImagePromptsPanel` del estudio) NO se portan: quedan
 * como herramienta interna.
 */

import { useState } from "react";
import {
  PORTAL_COPY_PLATFORMS,
  type PortalCoverIdea,
  type PortalScriptCopy,
} from "@/lib/portal/scriptToolsShared";
import { generarCopy, generarPortadas } from "./toolsActions";
import s from "../guiones.module.css";

export default function ScriptToolsPanel({
  clientId,
  scriptId,
  initialCovers,
  initialCopies,
  initialRemaining,
  creditBalance,
}: {
  clientId: string;
  scriptId: string;
  initialCovers: PortalCoverIdea[] | null;
  initialCopies: PortalScriptCopy[];
  /** Generaciones del PLAN que le quedan este ciclo. `null` = sin tope. */
  initialRemaining: number | null;
  /**
   * Saldo de recargas compradas (Fase E). ⚠️ Sin esto, agotar el cupo del ciclo
   * apagaba Portadas y Copy Expert aunque el cliente tuviera créditos pagados:
   * el servidor los habría generado descontándolos del saldo.
   */
  creditBalance: number;
}) {
  const [covers, setCovers] = useState(initialCovers);
  const [copies, setCopies] = useState<PortalScriptCopy[]>(initialCopies);
  const [platform, setPlatform] = useState<string>(PORTAL_COPY_PLATFORMS[0].id);
  const [remaining, setRemaining] = useState(initialRemaining);
  const [loading, setLoading] = useState<"covers" | "copy" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Espeja el `blocked` del servidor (`getAiUsageState`): el cupo del ciclo
  // agotado no bloquea si quedan recargas compradas.
  const planAgotado = remaining !== null && remaining <= 0;
  const blocked = planAgotado && creditBalance <= 0;
  const currentCopy = copies.find((c) => c.platform === platform) ?? null;

  async function copiar(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Sin portapapeles disponible: el texto está en pantalla igual.
    }
  }

  async function pedirPortadas() {
    setLoading("covers");
    setError(null);
    try {
      const res = await generarPortadas(clientId, scriptId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setCovers(res.covers);
      setRemaining((r) => (r === null ? null : Math.max(0, r - 1)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron generar las portadas.");
    } finally {
      setLoading(null);
    }
  }

  async function pedirCopy() {
    setLoading("copy");
    setError(null);
    try {
      const res = await generarCopy(clientId, scriptId, platform);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const nuevo = res.copy;
      setCopies((prev) => [nuevo, ...prev.filter((c) => c.platform !== nuevo.platform)]);
      setRemaining((r) => (r === null ? null : Math.max(0, r - 1)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar el copy.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <section className={s.tools}>
      <div className={s.toolsHead}>
        <h3 className={s.toolsTitle}>Herramientas de este guion</h3>
        {remaining !== null && (
          <span className={s.toolsQuota}>
            {planAgotado && creditBalance > 0
              ? `${creditBalance} créditos comprados`
              : `${remaining} generaciones este ciclo`}
          </span>
        )}
      </div>

      {error && <p className={s.error}>{error}</p>}

      {/* ── Portadas ── */}
      <div className={s.tool}>
        <div className={s.toolTop}>
          <p className={s.toolName}>🎨 Portadas</p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={pedirPortadas}
            disabled={loading !== null || blocked}
            title={blocked ? "Llegaste al tope del ciclo y no te quedan créditos" : undefined}
          >
            {loading === "covers"
              ? "Generando…"
              : covers
                ? "↺ Regenerar"
                : "✦ Generar 3 portadas"}
          </button>
        </div>

        {!covers ? (
          <p className={s.toolHint}>
            Tres ideas de portada para este contenido, con el texto que iría
            encima y el prompt listo para un generador de imágenes.
          </p>
        ) : (
          <div className={s.coverList}>
            {covers.map((c, i) => (
              <div key={i} className={s.cover}>
                <span className={s.coverNum}>
                  Portada {i + 1}
                  {c.has_character ? " · con personaje" : ""}
                </span>
                <p className={s.coverText}>&ldquo;{c.cover_text}&rdquo;</p>
                <p className={s.coverWhy}>{c.rationale_es}</p>
                <div className={s.coverPrompt}>{c.prompt_en}</div>
                <button
                  type="button"
                  className={s.copyLink}
                  onClick={() => copiar(c.prompt_en, `cover-${i}`)}
                >
                  {copied === `cover-${i}` ? "¡Copiado!" : "Copiar prompt"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Copy ── */}
      <div className={s.tool}>
        <div className={s.toolTop}>
          <p className={s.toolName}>✍ Copy de publicación</p>
          <div className={s.toolControls}>
            <select
              className="input"
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              disabled={loading !== null}
              aria-label="Plataforma del copy"
            >
              {PORTAL_COPY_PLATFORMS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={pedirCopy}
              disabled={loading !== null || blocked}
              title={blocked ? "Llegaste al tope del ciclo y no te quedan créditos" : undefined}
            >
              {loading === "copy" ? "Generando…" : currentCopy ? "↺ Regenerar" : "✦ Generar copy"}
            </button>
          </div>
        </div>

        {!currentCopy ? (
          <p className={s.toolHint}>
            El texto que acompaña la publicación, con sus hashtags, escrito a
            partir de este guion.
          </p>
        ) : (
          <div className={s.copyBox}>
            <p className={s.copyText}>{currentCopy.copy}</p>
            {currentCopy.hashtags && <p className={s.copyTags}>{currentCopy.hashtags}</p>}
            <button
              type="button"
              className={s.copyLink}
              onClick={() =>
                copiar(
                  currentCopy.hashtags
                    ? `${currentCopy.copy}\n\n${currentCopy.hashtags}`
                    : currentCopy.copy,
                  "copy",
                )
              }
            >
              {copied === "copy" ? "¡Copiado!" : "Copiar copy + hashtags"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
