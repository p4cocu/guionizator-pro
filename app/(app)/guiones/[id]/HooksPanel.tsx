"use client";

import { useState, useTransition } from "react";
import {
  addScriptHook,
  generateLayeredHooks,
  removeScriptHook,
  reorderScriptHooks,
  reviewScriptHook,
  updateScriptHookLayers,
  type ScriptHook,
} from "./hooksActions";
import type { Hook } from "../../ganchos/actions";
import { Checklist, Layers, ScoreBadge } from "@/components/hooks/HookParts";
import type { HookReview, LayeredHook } from "@/lib/hooks/prompts";
import { labelFor } from "@/lib/competencia/taxonomy";
import styles from "./hooks.module.css";

type Suggestion = {
  hook_id: string | null;
  hook_text: string;
  razon: string;
};

type Props = {
  scriptId: string;
  scriptContent: string;
  initialHooks: ScriptHook[];
  vaultHooks: Pick<Hook, "id" | "hook_template" | "category">[];
};

export default function HooksPanel({
  scriptId,
  scriptContent,
  initialHooks,
  vaultHooks,
}: Props) {
  const [hooks, setHooks] = useState<ScriptHook[]>(initialHooks);
  const [freeText, setFreeText] = useState("");
  const [showVault, setShowVault] = useState(false);
  const [vaultFilter, setVaultFilter] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [layered, setLayered] = useState<LayeredHook[] | null>(null);
  const [isLayering, setIsLayering] = useState(false);
  const [layerError, setLayerError] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviews, setReviews] = useState<Record<string, HookReview>>({});
  const [openChecks, setOpenChecks] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  async function handleGenerateLayered() {
    setLayerError(null);
    setIsLayering(true);
    try {
      const res = await generateLayeredHooks(scriptId);
      if (!res.ok) setLayerError(res.error);
      else setLayered(res.hooks);
    } finally {
      setIsLayering(false);
    }
  }

  async function handleAddLayered(h: LayeredHook) {
    setRowError(null);
    try {
      const newHook = await addScriptHook(scriptId, h.verbal, null, {
        text_overlay: h.text_overlay,
        visual: h.visual,
        hook_type: h.hook_type,
        checks: h.checks,
        why: h.why,
      });
      setHooks((prev) => [...prev, newHook]);
      setLayered((prev) => prev?.filter((x) => x !== h) ?? null);
    } catch (e) {
      setRowError(e instanceof Error ? e.message : "No se pudo agregar el gancho.");
    }
  }

  async function handleReview(hook: ScriptHook) {
    setRowError(null);
    setReviewingId(hook.id);
    try {
      const res = await reviewScriptHook(hook.id, scriptId);
      if (!res.ok) {
        setRowError(res.error);
        return;
      }
      setReviews((prev) => ({ ...prev, [hook.id]: res.review }));
      setHooks((prev) => prev.map((h) => (h.id === hook.id ? { ...h, checks: res.review.checks } : h)));
      setOpenChecks(hook.id);
    } finally {
      setReviewingId(null);
    }
  }

  async function handleUseImproved(hook: ScriptHook, review: HookReview) {
    setRowError(null);
    try {
      const updated = await updateScriptHookLayers(hook.id, scriptId, {
        hook_text: review.improved.verbal || hook.hook_text,
        text_overlay: review.improved.text_overlay,
        visual: review.improved.visual,
        hook_type: review.improved.hook_type,
        why: review.improved.why,
        // El checklist viejo era del gancho anterior: se limpia para no mentir.
        checks: null,
      });
      setHooks((prev) => prev.map((h) => (h.id === hook.id ? updated : h)));
      setReviews((prev) => {
        const next = { ...prev };
        delete next[hook.id];
        return next;
      });
    } catch (e) {
      setRowError(e instanceof Error ? e.message : "No se pudo actualizar el gancho.");
    }
  }

  async function handleAddFree() {
    if (!freeText.trim()) return;
    const newHook = await addScriptHook(scriptId, freeText.trim(), null);
    setHooks((prev) => [...prev, newHook]);
    setFreeText("");
  }

  async function handleAddFromVault(hook: Pick<Hook, "id" | "hook_template">) {
    const newHook = await addScriptHook(scriptId, hook.hook_template, hook.id);
    setHooks((prev) => [...prev, newHook]);
    setShowVault(false);
    setVaultFilter("");
  }

  async function handleAddSuggestion(s: Suggestion) {
    const newHook = await addScriptHook(scriptId, s.hook_text, s.hook_id);
    setHooks((prev) => [...prev, newHook]);
    setSuggestions((prev) => prev?.filter((x) => x.hook_text !== s.hook_text) ?? null);
  }

  function handleRemove(id: string) {
    setHooks((prev) => prev.filter((h) => h.id !== id));
    startTransition(() => removeScriptHook(id, scriptId));
  }

  async function handleSuggest() {
    setSuggestions(null);
    setSuggestError(null);
    setIsSuggesting(true);
    try {
      const res = await fetch("/api/ai/suggest-hooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script_id: scriptId, script_content: scriptContent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al sugerir");
      setSuggestions(data.suggestions ?? []);
    } catch (e) {
      setSuggestError(e instanceof Error ? e.message : "Error al obtener sugerencias");
    } finally {
      setIsSuggesting(false);
    }
  }

  // ── Drag-and-drop ─────────────────────────────────────────────────────────

  function handleDragStart(id: string) {
    setDragId(id);
  }

  function handleDragOver(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    if (!dragId || dragId === targetId) return;
    const newOrder = [...hooks];
    const fromIdx = newOrder.findIndex((h) => h.id === dragId);
    const toIdx = newOrder.findIndex((h) => h.id === targetId);
    const [moved] = newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, moved);
    setHooks(newOrder);
  }

  function handleDragEnd() {
    if (dragId) {
      startTransition(() => reorderScriptHooks(scriptId, hooks.map((h) => h.id)));
    }
    setDragId(null);
  }

  const filteredVault = vaultHooks.filter((h) =>
    h.hook_template.toLowerCase().includes(vaultFilter.toLowerCase())
  );

  const categories = Array.from(
    new Set(vaultHooks.map((h) => h.category).filter(Boolean))
  ) as string[];

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <h3 className={styles.panelTitle}>Ganchos</h3>
        <span className={styles.panelCount}>{hooks.length}</span>
      </div>

      {/* ── Lista de hooks agregados ── */}
      {hooks.length > 0 && (
        <ul className={styles.hookList}>
          {hooks.map((hook) => (
            <li
              key={hook.id}
              className={`${styles.hookItem} ${dragId === hook.id ? styles.hookItemDragging : ""}`}
              draggable
              onDragStart={() => handleDragStart(hook.id)}
              onDragOver={(e) => handleDragOver(e, hook.id)}
              onDragEnd={handleDragEnd}
            >
              <span className={styles.hookDragHandle}>⠿</span>
              <div className={styles.hookBody}>
                <Layers verbal={hook.hook_text} text={hook.text_overlay} visual={hook.visual} />
                <div className={styles.hookMeta}>
                  {hook.checks && (
                    <button
                      type="button"
                      className={styles.metaBtn}
                      onClick={() => setOpenChecks((v) => (v === hook.id ? null : hook.id))}
                    >
                      <ScoreBadge checks={hook.checks} /> criterios
                    </button>
                  )}
                  {hook.hook_type && <span className={styles.metaTag}>{labelFor("hook_type", hook.hook_type)}</span>}
                  <button
                    type="button"
                    className={styles.metaBtn}
                    onClick={() => handleReview(hook)}
                    disabled={reviewingId === hook.id}
                  >
                    {reviewingId === hook.id ? "Revisando…" : hook.checks ? "↻ Revisar" : "✓ Revisar gancho"}
                  </button>
                </div>
                {openChecks === hook.id && hook.checks && <Checklist checks={hook.checks} />}
                {reviews[hook.id] && (
                  <div className={styles.review}>
                    {reviews[hook.id].verdict && <p className={styles.reviewVerdict}>{reviews[hook.id].verdict}</p>}
                    <p className={styles.reviewLabel}>Versión mejorada</p>
                    <Layers
                      verbal={reviews[hook.id].improved.verbal}
                      text={reviews[hook.id].improved.text_overlay}
                      visual={reviews[hook.id].improved.visual}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: 11, padding: "6px 14px" }}
                      onClick={() => handleUseImproved(hook, reviews[hook.id])}
                    >
                      Usar versión mejorada
                    </button>
                  </div>
                )}
              </div>
              <button
                className={styles.hookRemoveBtn}
                onClick={() => handleRemove(hook.id)}
                title="Eliminar"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {hooks.length === 0 && (
        <p className={styles.hookEmpty}>
          Sin ganchos todavía. Pide 3 ganchos de 3 capas (texto en pantalla + visual + frase), toma uno del baúl o escribe el tuyo y revísalo.
        </p>
      )}

      {/* ── Acciones ── */}
      <div className={styles.hookActions}>
        <button
          className="btn btn-primary"
          onClick={handleGenerateLayered}
          disabled={isLayering}
          style={{ fontSize: 12 }}
          title="Texto en pantalla + visual del primer segundo + frase hablada, calificados con los 7 criterios de Andrea"
        >
          {isLayering ? "Escribiendo ganchos…" : "✦ 3 ganchos de 3 capas"}
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => setShowVault((v) => !v)}
          style={{ fontSize: 13 }}
        >
          {showVault ? "✕ Cerrar baúl" : "📦 Seleccionar del baúl"}
        </button>
        <button
          className="btn btn-ghost"
          onClick={handleSuggest}
          disabled={isSuggesting}
          style={{ fontSize: 13 }}
        >
          {isSuggesting ? "Analizando…" : "Sugerir del baúl"}
        </button>
      </div>

      {/* ── Selector del baúl ── */}
      {showVault && (
        <div className={styles.vaultPanel}>
          <input
            className={`input ${styles.vaultSearch}`}
            placeholder="Buscar en el baúl…"
            value={vaultFilter}
            onChange={(e) => setVaultFilter(e.target.value)}
            autoFocus
          />
          {filteredVault.length === 0 ? (
            <p className={styles.vaultEmpty}>No hay ganchos que coincidan.</p>
          ) : (
            <ul className={styles.vaultList}>
              {filteredVault.map((h) => (
                <li key={h.id} className={styles.vaultItem}>
                  <div className={styles.vaultItemMeta}>
                    {h.category && (
                      <span className={styles.vaultCategory}>{h.category.replace(/_/g, " ")}</span>
                    )}
                    <span className={styles.vaultText}>{h.hook_template}</span>
                  </div>
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: 12, padding: "4px 12px", flexShrink: 0 }}
                    onClick={() => handleAddFromVault(h)}
                  >
                    + Agregar
                  </button>
                </li>
              ))}
            </ul>
          )}
          {vaultHooks.length === 0 && (
            <p className={styles.vaultEmpty}>
              Tu baúl de ganchos está vacío.{" "}
              <a href="/ganchos" className={styles.vaultLink}>
                Ir al Baúl →
              </a>
            </p>
          )}
        </div>
      )}

      {rowError && <p className={styles.suggestError}>{rowError}</p>}
      {layerError && <p className={styles.suggestError}>{layerError}</p>}

      {/* ── Ganchos de 3 capas propuestos ── */}
      {layered && layered.length > 0 && (
        <div className={styles.suggestionsPanel}>
          <p className={styles.suggestionsTitle}>Ganchos de 3 capas</p>
          <ul className={styles.suggestionsList}>
            {layered.map((h, i) => (
              <li key={i} className={`${styles.suggestionItem} ${styles.layeredItem}`}>
                <div className={styles.suggestionContent}>
                  <Layers verbal={h.verbal} text={h.text_overlay} visual={h.visual} />
                  <div className={styles.hookMeta}>
                    <ScoreBadge checks={h.checks} />
                    {h.hook_type && <span className={styles.metaTag}>{labelFor("hook_type", h.hook_type)}</span>}
                    {h.why && <span className={styles.suggestionRazon}>{h.why}</span>}
                  </div>
                  {h.checks.some((c) => c.status === "falla") && (
                    <Checklist checks={h.checks.filter((c) => c.status === "falla")} />
                  )}
                </div>
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 12, padding: "4px 12px", flexShrink: 0 }}
                  onClick={() => handleAddLayered(h)}
                >
                  + Agregar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Sugerencias del baúl ── */}
      {suggestError && (
        <p className={styles.suggestError}>{suggestError}</p>
      )}
      {suggestions && suggestions.length > 0 && (
        <div className={styles.suggestionsPanel}>
          <p className={styles.suggestionsTitle}>Del baúl</p>
          <ul className={styles.suggestionsList}>
            {suggestions.map((s, i) => (
              <li key={i} className={styles.suggestionItem}>
                <div className={styles.suggestionContent}>
                  <span className={styles.suggestionText}>{s.hook_text}</span>
                  <span className={styles.suggestionRazon}>{s.razon}</span>
                </div>
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 12, padding: "4px 12px", flexShrink: 0 }}
                  onClick={() => handleAddSuggestion(s)}
                >
                  + Agregar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {suggestions && suggestions.length === 0 && (
        <p className={styles.suggestEmpty}>No se encontraron sugerencias relevantes.</p>
      )}

      {/* ── Input gancho libre ── */}
      <div className={styles.freeInputRow}>
        <input
          className={`input ${styles.freeInput}`}
          placeholder="Escribir gancho libre…"
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAddFree();
          }}
        />
        <button
          className="btn btn-secondary"
          onClick={handleAddFree}
          disabled={!freeText.trim()}
          style={{ flexShrink: 0, fontSize: 13 }}
        >
          Agregar
        </button>
      </div>
    </div>
  );
}
