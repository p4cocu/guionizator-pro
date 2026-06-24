"use client";

import { useState, useTransition } from "react";
import {
  addScriptHook,
  removeScriptHook,
  reorderScriptHooks,
  type ScriptHook,
} from "./hooksActions";
import type { Hook } from "../../ganchos/actions";
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
              <span className={styles.hookText}>{hook.hook_text}</span>
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
          Sin ganchos todavía. Agrégalos manualmente, desde el baúl o pide sugerencias de IA.
        </p>
      )}

      {/* ── Acciones ── */}
      <div className={styles.hookActions}>
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
          {isSuggesting ? "Analizando…" : "✦ Sugerir con IA"}
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

      {/* ── Sugerencias de IA ── */}
      {suggestError && (
        <p className={styles.suggestError}>{suggestError}</p>
      )}
      {suggestions && suggestions.length > 0 && (
        <div className={styles.suggestionsPanel}>
          <p className={styles.suggestionsTitle}>Sugerencias de IA</p>
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
