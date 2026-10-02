"use client";

import { useState, useTransition } from "react";
import { Checklist, Layers, ScoreBadge } from "@/components/hooks/HookParts";
import type { HookReview } from "@/lib/hooks/prompts";
import { labelFor } from "@/lib/competencia/taxonomy";
import { reviewHook, saveHook, type Hook } from "./actions";
import s from "./ganchos.module.css";

type Cliente = { id: string; nombre: string };

/**
 * Revisor de ganchos: pegas tu gancho (las capas que tengas) y lo califica con
 * los 7 criterios del análisis de 1000 ganchos de Andrea + propone una versión
 * de 3 capas. "Guardar en el baúl" guarda la versión mejorada como plantilla.
 */
export default function HookReviewer({
  clientes,
  onSaved,
}: {
  clientes: Cliente[];
  onSaved: (hook: Hook) => void;
}) {
  const [verbal, setVerbal] = useState("");
  const [text, setText] = useState("");
  const [visual, setVisual] = useState("");
  const [context, setContext] = useState("");
  const [clientId, setClientId] = useState("");
  const [review, setReview] = useState<HookReview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [reviewing, startReview] = useTransition();
  const [saving, startSave] = useTransition();

  function handleReview() {
    setError(null);
    setSaved(false);
    startReview(async () => {
      const res = await reviewHook({
        verbal,
        text_overlay: text,
        visual,
        context,
        client_id: clientId || null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setReview(res.review);
    });
  }

  function handleSave() {
    if (!review) return;
    setError(null);
    startSave(async () => {
      const imp = review.improved;
      const template = [imp.text_overlay && `[PANTALLA] ${imp.text_overlay}`, imp.verbal && `[DICE] ${imp.verbal}`, imp.visual && `[VISUAL] ${imp.visual}`]
        .filter(Boolean)
        .join("\n");
      const res = await saveHook({
        hook_original: verbal || text,
        hook_template: template,
        category: null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSaved(true);
      onSaved({
        id: res.id,
        source_post_id: null,
        source_username: null,
        source_permalink: null,
        hook_original: verbal || text,
        hook_template: template,
        category: null,
        created_at: new Date().toISOString(),
      });
    });
  }

  return (
    <section className={`card ${s.reviewer}`}>
      <div>
        <span className="eyebrow">Revisor de ganchos</span>
        <p className={s.reviewerHint}>
          Pega tu gancho y lo calificamos con los 7 criterios del análisis de 1000 ganchos de Andrea Estratega:
          texto en pantalla, abrir declarando, algo concreto en el primer segundo, que se entienda sin sonido…
        </p>
      </div>

      <div className={s.reviewerGrid}>
        <label className="field">
          <span className="field-label">Lo que dices (verbal)</span>
          <input className="input" value={verbal} onChange={(e) => setVerbal(e.target.value)} placeholder="La primera frase del video" />
        </label>
        <label className="field">
          <span className="field-label">Texto en pantalla (opcional)</span>
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Lo que se lee en los primeros 3s" />
        </label>
        <label className="field">
          <span className="field-label">Qué se ve en el primer segundo (opcional)</span>
          <input className="input" value={visual} onChange={(e) => setVisual(e.target.value)} placeholder="Ej: yo entrando al cuadro con el celular en la mano" />
        </label>
        <label className="field">
          <span className="field-label">Marca (opcional)</span>
          <select className="select" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">Sin marca</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className={`field ${s.reviewerWide}`}>
          <span className="field-label">De qué trata el video (opcional)</span>
          <textarea className="textarea" rows={2} value={context} onChange={(e) => setContext(e.target.value)} />
        </label>
      </div>

      <div className={s.reviewerActions}>
        <button type="button" className="btn btn-primary" onClick={handleReview} disabled={reviewing || (!verbal.trim() && !text.trim())}>
          {reviewing ? "Revisando…" : "✓ Revisar gancho"}
        </button>
        {error && <span className={s.reviewerError}>{error}</span>}
      </div>

      {review && (
        <div className={s.reviewerResult}>
          <div>
            <p className={s.reviewerScore}>
              Tu gancho: <ScoreBadge checks={review.checks} />
            </p>
            {review.verdict && <p className={s.reviewerVerdict}>{review.verdict}</p>}
            <Checklist checks={review.checks} />
          </div>
          <div>
            <p className={s.reviewerScore}>
              Versión mejorada
              {review.improved.hook_type && <span className={s.reviewerType}> · {labelFor("hook_type", review.improved.hook_type)}</span>}
            </p>
            <Layers verbal={review.improved.verbal} text={review.improved.text_overlay} visual={review.improved.visual} />
            {review.improved.why && <p className={s.reviewerWhy}>{review.improved.why}</p>}
            <button type="button" className="btn btn-secondary" onClick={handleSave} disabled={saving || saved} style={{ marginTop: 10 }}>
              {saved ? "✓ En el baúl" : saving ? "Guardando…" : "Guardar en el baúl"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
