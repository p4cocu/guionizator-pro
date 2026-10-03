"use client";

/**
 * "Revisar un gancho" en el portal. Versión para el cliente del revisor de
 * `/ganchos`: mismas 3 capas y 7 criterios, con etiquetas sin jerga
 * (`plain`). Cuesta 1 generación y no guarda nada — la versión mejorada se
 * copia. Sin tipo de gancho de `taxonomy.ts`: es vocabulario del taller.
 */

import { useState } from "react";
import { Checklist, Layers, ScoreBadge } from "@/components/hooks/HookParts";
import type { HookReview } from "@/lib/hooks/prompts";
import { revisarGanchoSuelto } from "./actions";
import t from "@/components/portal/aiTools.module.css";

export default function HookReviewPortal({
  clientId,
  initialRemaining,
  creditBalance: initialCredits,
}: {
  clientId: string;
  initialRemaining: number | null;
  creditBalance: number;
}) {
  const [verbal, setVerbal] = useState("");
  const [text, setText] = useState("");
  const [visual, setVisual] = useState("");
  const [context, setContext] = useState("");
  const [review, setReview] = useState<HookReview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [remaining, setRemaining] = useState(initialRemaining);
  const [credits, setCredits] = useState(initialCredits);

  // Espeja el `blocked` del servidor: cupo agotado no bloquea si hay recargas.
  const planAgotado = remaining !== null && remaining <= 0;
  const blocked = planAgotado && credits <= 0;

  async function revisar() {
    setLoading(true);
    setError(null);
    setCopied(false);
    try {
      const res = await revisarGanchoSuelto({ clientId, verbal, textOverlay: text, visual, context });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setReview(res.review);
      if (planAgotado) setCredits((c) => Math.max(0, c - 1));
      else setRemaining((r) => (r === null ? null : Math.max(0, r - 1)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos revisar tu gancho.");
    } finally {
      setLoading(false);
    }
  }

  async function copiar() {
    if (!review) return;
    const imp = review.improved;
    const out = [
      imp.text_overlay && `Se lee: ${imp.text_overlay}`,
      imp.visual && `Se ve: ${imp.visual}`,
      imp.verbal && `Dices: ${imp.verbal}`,
    ]
      .filter(Boolean)
      .join("\n");
    try {
      await navigator.clipboard.writeText(out);
      setCopied(true);
    } catch {
      // Sin portapapeles: el texto está en pantalla igual.
    }
  }

  return (
    <section className={t.panel}>
      <div className={t.head}>
        <h3 className={t.title}>Tu gancho</h3>
        {remaining !== null && (
          <span className={t.quota}>
            Cuesta 1 generación ·{" "}
            {planAgotado && credits > 0 ? `${credits} créditos comprados` : `${Math.max(0, remaining)} este ciclo`}
          </span>
        )}
      </div>

      <div className={t.grid}>
        <label className="field">
          <span className="field-label">Lo que dices</span>
          <input className="input" value={verbal} onChange={(e) => setVerbal(e.target.value)} placeholder="La primera frase del video" />
        </label>
        <label className="field">
          <span className="field-label">Lo que se lee en pantalla (opcional)</span>
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="El texto de los primeros segundos" />
        </label>
        <label className={`field ${t.wide}`}>
          <span className="field-label">Lo que se ve en el primer segundo (opcional)</span>
          <input
            className="input"
            value={visual}
            onChange={(e) => setVisual(e.target.value)}
            placeholder="Ej: entro al cuadro con el celular en la mano"
          />
        </label>
        <label className={`field ${t.wide}`}>
          <span className="field-label">De qué trata el video (opcional)</span>
          <textarea className="textarea" rows={2} value={context} onChange={(e) => setContext(e.target.value)} />
        </label>
      </div>

      <div className={t.row}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={revisar}
          disabled={loading || blocked || (!verbal.trim() && !text.trim())}
        >
          {loading ? "Revisando…" : "✓ Revisar mi gancho"}
        </button>
        {blocked && <span className={t.muted}>Se acabaron tus generaciones de este ciclo. Puedes recargar desde Facturación.</span>}
      </div>
      {error && <p className={t.error}>{error}</p>}

      {review && (
        <div className={t.result}>
          <div>
            <p className={t.score}>
              Tu gancho <ScoreBadge checks={review.checks} />
            </p>
            {review.verdict && <p className={t.verdict}>{review.verdict}</p>}
            <Checklist checks={review.checks} plain />
          </div>
          <div>
            <p className={t.score}>Versión mejorada</p>
            <Layers verbal={review.improved.verbal} text={review.improved.text_overlay} visual={review.improved.visual} plain />
            {review.improved.why && <p className={t.verdict}>{review.improved.why}</p>}
            <button type="button" className="btn btn-secondary" onClick={copiar}>
              {copied ? "✓ Copiado" : "Copiar versión mejorada"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
