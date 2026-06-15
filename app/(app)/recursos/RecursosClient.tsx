"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addResourceManual,
  deleteResource,
  regenerateIngestToken,
  updateResourceCategory,
  updateResourceClient,
  updateResourceTags,
  type ClienteLite,
  type ResourceRow,
} from "./actions";
import s from "./recursos.module.css";

const BASE_CATEGORIES = [
  "Prompt Claude",
  "Prompt Imagen",
  "Prompt Video",
  "Guía",
  "Herramienta",
  "Claude",
  "Otro",
] as const;

const LS_KEY = "guionizator_custom_categories";

type Props = {
  initialResources: ResourceRow[];
  clientes: ClienteLite[];
  ingestToken: string;
  ingestUrl: string;
};

export default function RecursosClient({
  initialResources,
  clientes,
  ingestToken,
  ingestUrl,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Filtros
  const [catFilter, setCatFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all"); // all | none | <id>
  const [search, setSearch] = useState("");

  // Categorías personalizadas
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [newCatInput, setNewCatInput] = useState("");
  const [addingCat, setAddingCat] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_KEY);
      if (stored) setCustomCategories(JSON.parse(stored));
    } catch {}
  }, []);

  function saveCustomCategories(cats: string[]) {
    setCustomCategories(cats);
    try { localStorage.setItem(LS_KEY, JSON.stringify(cats)); } catch {}
  }

  function handleAddCat() {
    const name = newCatInput.trim();
    if (!name) return;
    const all = [...(BASE_CATEGORIES as readonly string[]), ...customCategories];
    if (all.includes(name)) return;
    saveCustomCategories([...customCategories, name]);
    setNewCatInput("");
    setAddingCat(false);
  }

  function handleRemoveCat(name: string) {
    saveCustomCategories(customCategories.filter((c) => c !== name));
    if (catFilter === name) setCatFilter("all");
  }

  const allCategories = [...BASE_CATEGORIES, ...customCategories];

  // Alta manual
  const [manualInput, setManualInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Panel de conexión
  const [showConn, setShowConn] = useState(false);
  const [token, setToken] = useState(ingestToken);
  const [copied, setCopied] = useState<string | null>(null);

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  const resources = initialResources;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return resources.filter((r) => {
      if (catFilter !== "all" && r.category !== catFilter) return false;
      if (clientFilter === "none" && r.client_id) return false;
      if (clientFilter !== "all" && clientFilter !== "none" && r.client_id !== clientFilter)
        return false;
      if (q) {
        const hay = [r.title, r.summary, r.prompt_text, r.raw_text, r.tags.join(" ")]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [resources, catFilter, clientFilter, search]);

  const countByCat = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of resources) m.set(r.category, (m.get(r.category) ?? 0) + 1);
    return m;
  }, [resources]);

  function handleAdd() {
    const value = manualInput.trim();
    if (!value) return;
    setAdding(true);
    setAddError(null);
    const isUrl = /^https?:\/\//i.test(value);
    startTransition(async () => {
      try {
        await addResourceManual(isUrl ? { url: value } : { text: value });
        setManualInput("");
        router.refresh();
      } catch (e) {
        setAddError((e as Error).message);
      } finally {
        setAdding(false);
      }
    });
  }

  function handleRegenerate() {
    startTransition(async () => {
      const t = await regenerateIngestToken();
      setToken(t);
    });
  }

  return (
    <div>
      <div className={s.header}>
        <h1 className="text-grad">Recursos</h1>
        <button className="btn btn-ghost" onClick={() => setShowConn((v) => !v)}>
          {showConn ? "Ocultar conexión" : "⚙ Conexión (Shortcut)"}
        </button>
      </div>

      {/* ── Panel de conexión ── */}
      {showConn && (
        <div className={`card ${s.connPanel}`}>
          <p className={s.connTitle}>Conecta tu Shortcut de iPhone</p>
          <p className={s.connHint}>
            El Shortcut hace un POST a este endpoint con el header{" "}
            <code>Authorization: Bearer &lt;token&gt;</code> y un JSON{" "}
            <code>{`{ "url": "...", "text": "..." }`}</code>. Comparte un mensaje de Instagram
            al Shortcut y el recurso aparece aquí clasificado.
          </p>

          <label className="field-label">Endpoint</label>
          <div className={s.copyRow}>
            <input className="input" readOnly value={ingestUrl} />
            <button className="btn btn-secondary" onClick={() => copy(ingestUrl, "url")}>
              {copied === "url" ? "✓" : "Copiar"}
            </button>
          </div>

          <label className="field-label" style={{ marginTop: 12 }}>
            Token de ingesta
          </label>
          <div className={s.copyRow}>
            <input className="input" readOnly value={token} />
            <button className="btn btn-secondary" onClick={() => copy(token, "token")}>
              {copied === "token" ? "✓" : "Copiar"}
            </button>
            <button className="btn btn-ghost" onClick={handleRegenerate}>
              Regenerar
            </button>
          </div>
          <p className={s.connWarn}>
            Mantén el token privado. Si lo regeneras, actualiza el Shortcut con el nuevo.
          </p>
        </div>
      )}

      {/* ── Alta manual ── */}
      <div className={`card ${s.panel}`}>
        <label className="field-label">Agregar recurso manualmente</label>
        <div className={s.addRow}>
          <input
            className="input"
            placeholder="Pega un link o el texto de un prompt…"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            disabled={adding}
          />
          <button className="btn btn-primary" onClick={handleAdd} disabled={adding || !manualInput.trim()}>
            {adding ? "Clasificando…" : "Agregar"}
          </button>
        </div>
        {addError && <p className={s.error}>{addError}</p>}
      </div>

      {/* ── Filtros ── */}
      {resources.length > 0 && (
        <div className={s.filters}>
          <div className={s.filterGroup}>
            <button
              className={`${s.chipBtn} ${catFilter === "all" ? s.chipBtnActive : ""}`}
              onClick={() => setCatFilter("all")}
            >
              Todas ({resources.length})
            </button>
            {allCategories.map((c) => {
              const count = countByCat.get(c);
              const isCustom = customCategories.includes(c);
              if (!count && !isCustom) return null;
              return (
                <span key={c} className={s.catChip}>
                  <button
                    className={`${s.chipBtn} ${catFilter === c ? s.chipBtnActive : ""}`}
                    onClick={() => setCatFilter(c)}
                  >
                    {c}
                    {count ? ` (${count})` : ""}
                  </button>
                  {isCustom && (
                    <button
                      className={s.catChipX}
                      onClick={() => handleRemoveCat(c)}
                      aria-label={`Eliminar categoría ${c}`}
                      title="Eliminar categoría"
                    >
                      ×
                    </button>
                  )}
                </span>
              );
            })}
            {addingCat ? (
              <span className={s.catAddRow}>
                <input
                  className={`input ${s.catAddInput}`}
                  placeholder="Nueva categoría…"
                  value={newCatInput}
                  onChange={(e) => setNewCatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddCat();
                    if (e.key === "Escape") { setAddingCat(false); setNewCatInput(""); }
                  }}
                  autoFocus
                />
                <button className="btn btn-secondary" onClick={handleAddCat} style={{ padding: "6px 12px" }}>✓</button>
                <button className="btn btn-ghost" onClick={() => { setAddingCat(false); setNewCatInput(""); }} style={{ padding: "6px 12px" }}>✕</button>
              </span>
            ) : (
              <button className={s.catAddBtn} onClick={() => setAddingCat(true)}>
                + Categoría
              </button>
            )}
          </div>
          <div className={s.filterRow}>
            <select
              className="input"
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
            >
              <option value="all">Todos los clientes</option>
              <option value="none">Sin cliente</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
            <input
              className="input"
              placeholder="Buscar…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* ── Lista ── */}
      {filtered.length === 0 ? (
        <p className={s.empty}>
          {resources.length === 0
            ? "Aún no hay recursos. Agrega uno arriba o conecta tu Shortcut."
            : "Ningún recurso coincide con los filtros."}
        </p>
      ) : (
        <div className={s.grid}>
          {filtered.map((r) => (
            <ResourceCard
              key={r.id}
              r={r}
              clientes={clientes}
              allCategories={allCategories}
              onChanged={() => router.refresh()}
              copy={copy}
              copied={copied}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tarjeta de recurso ──────────────────────────────────────────────────────

function ResourceCard({
  r,
  clientes,
  allCategories,
  onChanged,
  copy,
  copied,
}: {
  r: ResourceRow;
  clientes: ClienteLite[];
  allCategories: readonly string[];
  onChanged: () => void;
  copy: (text: string, key: string) => void;
  copied: string | null;
}) {
  const [, startTransition] = useTransition();
  const [editingTags, setEditingTags] = useState(false);
  const [tagsDraft, setTagsDraft] = useState(r.tags.join(", "));

  function mutate(fn: () => Promise<void>) {
    startTransition(async () => {
      await fn();
      onChanged();
    });
  }

  return (
    <div className={s.card}>
      <div className={s.cardTop}>
        <select
          className={s.catSelect}
          value={r.category}
          onChange={(e) =>
            mutate(() => updateResourceCategory(r.id, e.target.value))
          }
        >
          {allCategories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
          {!allCategories.includes(r.category) && (
            <option value={r.category}>{r.category}</option>
          )}
        </select>
        <button
          className={s.delBtn}
          onClick={() => mutate(() => deleteResource(r.id))}
          aria-label="Eliminar"
          title="Eliminar"
        >
          🗑
        </button>
      </div>

      <p className={s.cardTitle}>{r.title}</p>
      {r.summary && <p className={s.cardSummary}>{r.summary}</p>}

      {r.prompt_text && (
        <div className={s.promptBox}>
          <pre className={s.promptText}>{r.prompt_text}</pre>
          <button
            className="btn btn-secondary"
            onClick={() => copy(r.prompt_text!, `p-${r.id}`)}
          >
            {copied === `p-${r.id}` ? "✓ Copiado" : "Copiar prompt"}
          </button>
        </div>
      )}

      {r.source_url && (
        <a className={s.sourceLink} href={r.source_url} target="_blank" rel="noopener noreferrer">
          🔗 Abrir recurso
        </a>
      )}

      {/* Tags */}
      <div className={s.tagsRow}>
        {!editingTags ? (
          <>
            {r.tags.map((t) => (
              <span key={t} className={s.tag}>
                #{t}
              </span>
            ))}
            <button className={s.tagEdit} onClick={() => setEditingTags(true)}>
              ✎ tags
            </button>
          </>
        ) : (
          <div className={s.tagsEdit}>
            <input
              className="input"
              value={tagsDraft}
              onChange={(e) => setTagsDraft(e.target.value)}
              placeholder="tags separados por coma"
            />
            <button
              className="btn btn-secondary"
              onClick={() =>
                mutate(async () => {
                  await updateResourceTags(
                    r.id,
                    tagsDraft.split(",").map((t) => t.trim()).filter(Boolean),
                  );
                  setEditingTags(false);
                })
              }
            >
              Guardar
            </button>
          </div>
        )}
      </div>

      {/* Cliente */}
      <div className={s.cardFoot}>
        <select
          className={s.clientSelect}
          value={r.client_id ?? ""}
          onChange={(e) =>
            mutate(() => updateResourceClient(r.id, e.target.value || null))
          }
        >
          <option value="">Sin cliente</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        {r.client_id && r.client_auto && <span className={s.autoTag}>auto</span>}
      </div>
    </div>
  );
}
