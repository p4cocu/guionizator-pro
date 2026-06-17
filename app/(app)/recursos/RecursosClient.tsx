"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addResourceManual,
  createOwnResource,
  deleteOwnResource,
  deleteResource,
  regenerateIngestToken,
  updateOwnResource,
  updateResourceCategory,
  updateResourceClient,
  updateResourceScriptId,
  updateResourceSourceName,
  updateResourceTags,
  type ClienteLite,
  type OwnResourceRow,
  type ResourceRow,
  type ScriptLite,
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
  initialOwnResources: OwnResourceRow[];
  clientes: ClienteLite[];
  scripts: ScriptLite[];
  ingestToken: string;
  ingestUrl: string;
};

export default function RecursosClient({
  initialResources,
  initialOwnResources,
  clientes,
  scripts,
  ingestToken,
  ingestUrl,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Tabs
  const [activeTab, setActiveTab] = useState<"capturados" | "propios">("capturados");

  // Filtros capturados
  const [catFilter, setCatFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
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
  const [manualSourceName, setManualSourceName] = useState("");
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
        const hay = [r.title, r.summary, r.prompt_text, r.raw_text, r.source_name, r.tags.join(" ")]
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
    const sourceName = manualSourceName.trim() || null;
    startTransition(async () => {
      try {
        await addResourceManual(
          isUrl ? { url: value, source_name: sourceName } : { text: value, source_name: sourceName },
        );
        setManualInput("");
        setManualSourceName("");
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
            <code>{`{ "url": "...", "text": "...", "source_name": "tapewarp.ai" }`}</code>.
            El campo <code>source_name</code> es opcional — se te pregunta al ejecutar el Shortcut.
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

      {/* ── Tabs ── */}
      <div className={s.tabs}>
        <button
          className={`${s.tab} ${activeTab === "capturados" ? s.tabActive : ""}`}
          onClick={() => setActiveTab("capturados")}
        >
          Capturados
          <span className={s.tabCount}>{initialResources.length}</span>
        </button>
        <button
          className={`${s.tab} ${activeTab === "propios" ? s.tabActive : ""}`}
          onClick={() => setActiveTab("propios")}
        >
          Recursos Propios
          <span className={s.tabCount}>{initialOwnResources.length}</span>
        </button>
      </div>

      {/* ══ TAB CAPTURADOS ══ */}
      {activeTab === "capturados" && (
        <>
          {/* Alta manual */}
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
            <div className={s.addRow} style={{ marginTop: 8 }}>
              <input
                className="input"
                placeholder="Creador / fuente (opcional) — ej. Alex Hormozi, tapewarp.ai…"
                value={manualSourceName}
                onChange={(e) => setManualSourceName(e.target.value)}
                disabled={adding}
                style={{ fontSize: 13 }}
              />
            </div>
            {addError && <p className={s.error}>{addError}</p>}
          </div>

          {/* Filtros */}
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

          {/* Lista */}
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
                  scripts={scripts}
                  allCategories={allCategories}
                  onChanged={() => router.refresh()}
                  copy={copy}
                  copied={copied}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ══ TAB RECURSOS PROPIOS ══ */}
      {activeTab === "propios" && (
        <OwnResourcesTab
          ownResources={initialOwnResources}
          resources={initialResources}
          scripts={scripts}
          onChanged={() => router.refresh()}
        />
      )}
    </div>
  );
}

// ── Tarjeta de recurso capturado ────────────────────────────────────────────

function ResourceCard({
  r,
  clientes,
  scripts,
  allCategories,
  onChanged,
  copy,
  copied,
}: {
  r: ResourceRow;
  clientes: ClienteLite[];
  scripts: ScriptLite[];
  allCategories: readonly string[];
  onChanged: () => void;
  copy: (text: string, key: string) => void;
  copied: string | null;
}) {
  const [, startTransition] = useTransition();
  const [editingTags, setEditingTags] = useState(false);
  const [tagsDraft, setTagsDraft] = useState(r.tags.join(", "));
  const [editingScript, setEditingScript] = useState(false);
  const [scriptDraft, setScriptDraft] = useState(r.script_id ?? "");
  const [editingSource, setEditingSource] = useState(false);
  const [sourceDraft, setSourceDraft] = useState(r.source_name ?? "");

  function mutate(fn: () => Promise<void>) {
    startTransition(async () => {
      await fn();
      onChanged();
    });
  }

  function handleScriptSave() {
    mutate(async () => {
      await updateResourceScriptId(r.id, scriptDraft.trim() || null);
      setEditingScript(false);
    });
  }

  const linkedScript = scripts.find((sc) => sc.id === r.script_id);

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
        <div className={s.cardTopRight}>
          {editingSource ? (
            <span className={s.sourceEditRow}>
              <input
                className={s.sourceEditInput}
                value={sourceDraft}
                onChange={(e) => setSourceDraft(e.target.value)}
                placeholder="Creador / fuente…"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    mutate(async () => {
                      await updateResourceSourceName(r.id, sourceDraft.trim() || null);
                      setEditingSource(false);
                    });
                  }
                  if (e.key === "Escape") { setEditingSource(false); setSourceDraft(r.source_name ?? ""); }
                }}
              />
              <button
                className={s.sourceEditSave}
                onClick={() =>
                  mutate(async () => {
                    await updateResourceSourceName(r.id, sourceDraft.trim() || null);
                    setEditingSource(false);
                  })
                }
              >✓</button>
              <button
                className={s.sourceEditSave}
                onClick={() => { setEditingSource(false); setSourceDraft(r.source_name ?? ""); }}
              >✕</button>
            </span>
          ) : (
            <button
              className={r.source_name ? s.sourceBadge : s.sourceAddBtn}
              title={r.source_name ? "Editar creador/fuente" : "Agregar creador/fuente"}
              onClick={() => setEditingSource(true)}
            >
              {r.source_name ?? "+ fuente"}
            </button>
          )}
          <button
            className={s.delBtn}
            onClick={() => mutate(() => deleteResource(r.id))}
            aria-label="Eliminar"
            title="Eliminar"
          >
            🗑
          </button>
        </div>
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

      {/* Vínculo con guión */}
      <div className={s.scriptLink}>
        <span className={s.scriptLinkLabel}>Guión vinculado</span>
        {!editingScript ? (
          <div className={s.scriptLinkRow}>
            {linkedScript ? (
              <span className={s.scriptLinked} title={linkedScript.id}>
                {linkedScript.title || linkedScript.structure_name}
              </span>
            ) : (
              <span className={s.scriptEmpty}>Sin vincular</span>
            )}
            <button className={s.tagEdit} onClick={() => setEditingScript(true)}>
              ✎
            </button>
            {r.script_id && (
              <button
                className={s.tagEdit}
                onClick={() => mutate(() => updateResourceScriptId(r.id, null))}
                title="Desvincular"
              >
                ✕
              </button>
            )}
          </div>
        ) : (
          <div className={s.tagsEdit}>
            <input
              className="input"
              value={scriptDraft}
              onChange={(e) => setScriptDraft(e.target.value)}
              placeholder="Pega el ID del guión…"
              autoFocus
            />
            <button className="btn btn-secondary" onClick={handleScriptSave}>✓</button>
            <button className="btn btn-ghost" onClick={() => { setEditingScript(false); setScriptDraft(r.script_id ?? ""); }}>✕</button>
          </div>
        )}
      </div>

      {/* Pie: cliente */}
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

// ── Tab Recursos Propios ────────────────────────────────────────────────────

function OwnResourcesTab({
  ownResources,
  resources,
  scripts,
  onChanged,
}: {
  ownResources: OwnResourceRow[];
  resources: ResourceRow[];
  scripts: ScriptLite[];
  onChanged: () => void;
}) {
  const [, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);

  // Formulario nuevo recurso propio
  const [title, setTitle] = useState("");
  const [driveUrl, setDriveUrl] = useState("");
  const [sourceResourceId, setSourceResourceId] = useState("");
  const [scriptId, setScriptId] = useState("");
  const [keywordTrigger, setKeywordTrigger] = useState("");
  const [tags, setTags] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function resetForm() {
    setTitle(""); setDriveUrl(""); setSourceResourceId("");
    setScriptId(""); setKeywordTrigger(""); setTags("");
    setFormError(null);
  }

  function handleCreate() {
    if (!title.trim() || !driveUrl.trim()) {
      setFormError("El título y el link de Drive son obligatorios.");
      return;
    }
    setSaving(true);
    setFormError(null);
    startTransition(async () => {
      try {
        await createOwnResource({
          title,
          drive_url: driveUrl,
          source_resource_id: sourceResourceId.trim() || null,
          script_id: scriptId.trim() || null,
          keyword_trigger: keywordTrigger.trim() || null,
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        });
        resetForm();
        setShowForm(false);
        onChanged();
      } catch (e) {
        setFormError((e as Error).message);
      } finally {
        setSaving(false);
      }
    });
  }

  return (
    <div>
      {/* Encabezado del tab */}
      <div className={`card ${s.panel}`} style={{ marginTop: 16 }}>
        <div className={s.ownHeader}>
          <div>
            <p className={s.ownTitle}>Recursos Propios</p>
            <p className={s.ownSubtitle}>
              Documentos en tu tono de voz y marca (Google Drive). Se comparten cuando la
              gente comenta la keyword. Vinculados al recurso original y al guión.
            </p>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => { setShowForm((v) => !v); resetForm(); }}
          >
            {showForm ? "Cancelar" : "+ Nuevo"}
          </button>
        </div>

        {/* Formulario */}
        {showForm && (
          <div className={s.ownForm}>
            <div className={s.ownField}>
              <label className="field-label">Título *</label>
              <input
                className="input"
                placeholder="ej. Guía de hooks para Instagram"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className={s.ownField}>
              <label className="field-label">Link Google Drive *</label>
              <input
                className="input"
                placeholder="https://drive.google.com/…"
                value={driveUrl}
                onChange={(e) => setDriveUrl(e.target.value)}
              />
            </div>
            <div className={s.ownRow}>
              <div className={s.ownField}>
                <label className="field-label">Recurso original (ID)</label>
                <select
                  className="input"
                  value={sourceResourceId}
                  onChange={(e) => setSourceResourceId(e.target.value)}
                >
                  <option value="">Sin vínculo</option>
                  {resources.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title || r.source_url || r.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </div>
              <div className={s.ownField}>
                <label className="field-label">Guión vinculado (ID)</label>
                <input
                  className="input"
                  placeholder="Pega el ID del guión…"
                  value={scriptId}
                  onChange={(e) => setScriptId(e.target.value)}
                />
              </div>
            </div>
            <div className={s.ownRow}>
              <div className={s.ownField}>
                <label className="field-label">Keyword trigger</label>
                <input
                  className="input"
                  placeholder="ej. GUÍA, HOOKS, PDF…"
                  value={keywordTrigger}
                  onChange={(e) => setKeywordTrigger(e.target.value)}
                />
              </div>
              <div className={s.ownField}>
                <label className="field-label">Tags</label>
                <input
                  className="input"
                  placeholder="separados por coma"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                />
              </div>
            </div>
            {formError && <p className={s.error}>{formError}</p>}
            <div className={s.ownActions}>
              <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>
                {saving ? "Guardando…" : "Guardar recurso propio"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Lista */}
      {ownResources.length === 0 ? (
        <p className={s.empty}>
          Aún no tienes recursos propios. Crea el primero arriba.
        </p>
      ) : (
        <div className={s.grid}>
          {ownResources.map((r) => (
            <OwnResourceCard
              key={r.id}
              r={r}
              resources={resources}
              scripts={scripts}
              onChanged={onChanged}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tarjeta de recurso propio ───────────────────────────────────────────────

function OwnResourceCard({
  r,
  resources,
  scripts,
  onChanged,
}: {
  r: OwnResourceRow;
  resources: ResourceRow[];
  scripts: ScriptLite[];
  onChanged: () => void;
}) {
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [keywordDraft, setKeywordDraft] = useState(r.keyword_trigger ?? "");
  const [urlDraft, setUrlDraft] = useState(r.drive_url);
  const [scriptDraft, setScriptDraft] = useState(r.script_id ?? "");
  const [sourceIdDraft, setSourceIdDraft] = useState(r.source_resource_id ?? "");

  function mutate(fn: () => Promise<void>) {
    startTransition(async () => {
      await fn();
      onChanged();
    });
  }

  const linkedScript = scripts.find((sc) => sc.id === r.script_id);
  const linkedResource = resources.find((res) => res.id === r.source_resource_id);

  return (
    <div className={s.ownCard}>
      <div className={s.cardTop}>
        <span className={s.ownBadge}>Recurso Propio</span>
        <button
          className={s.delBtn}
          onClick={() => mutate(() => deleteOwnResource(r.id))}
          title="Eliminar"
        >
          🗑
        </button>
      </div>

      <p className={s.cardTitle}>{r.title}</p>

      <a className={s.sourceLink} href={r.drive_url} target="_blank" rel="noopener noreferrer">
        📄 Abrir en Drive
      </a>

      {/* Keyword */}
      {r.keyword_trigger && (
        <div className={s.keywordRow}>
          <span className={s.keywordLabel}>Keyword:</span>
          <span className={s.keywordValue}>{r.keyword_trigger}</span>
        </div>
      )}

      {/* Vínculos */}
      <div className={s.ownLinks}>
        {linkedResource && (
          <span className={s.ownLinkChip} title="Recurso original">
            🔗 {linkedResource.title || "Recurso original"}
          </span>
        )}
        {linkedScript && (
          <span className={s.ownLinkChip} title="Guión vinculado">
            📝 {linkedScript.title || linkedScript.structure_name}
          </span>
        )}
      </div>

      {/* Tags */}
      {r.tags.length > 0 && (
        <div className={s.tagsRow}>
          {r.tags.map((t) => (
            <span key={t} className={s.tag}>#{t}</span>
          ))}
        </div>
      )}

      {/* Editar */}
      {!editing ? (
        <button className={s.tagEdit} onClick={() => setEditing(true)}>
          ✎ Editar vínculos y keyword
        </button>
      ) : (
        <div className={s.ownEditBlock}>
          <label className="field-label">Link Drive</label>
          <input
            className="input"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
          />
          <label className="field-label" style={{ marginTop: 8 }}>Recurso original</label>
          <select
            className="input"
            value={sourceIdDraft}
            onChange={(e) => setSourceIdDraft(e.target.value)}
          >
            <option value="">Sin vínculo</option>
            {resources.map((res) => (
              <option key={res.id} value={res.id}>
                {res.title || res.source_url || res.id.slice(0, 8)}
              </option>
            ))}
          </select>
          <label className="field-label" style={{ marginTop: 8 }}>ID del guión</label>
          <input
            className="input"
            value={scriptDraft}
            onChange={(e) => setScriptDraft(e.target.value)}
            placeholder="Pega el ID del guión…"
          />
          <label className="field-label" style={{ marginTop: 8 }}>Keyword trigger</label>
          <input
            className="input"
            value={keywordDraft}
            onChange={(e) => setKeywordDraft(e.target.value)}
            placeholder="ej. GUÍA, HOOKS…"
          />
          <div className={s.ownEditActions}>
            <button
              className="btn btn-primary"
              onClick={() =>
                mutate(async () => {
                  await updateOwnResource(r.id, {
                    drive_url: urlDraft,
                    source_resource_id: sourceIdDraft || null,
                    script_id: scriptDraft.trim() || null,
                    keyword_trigger: keywordDraft.trim() || null,
                  });
                  setEditing(false);
                })
              }
            >
              Guardar
            </button>
            <button className="btn btn-ghost" onClick={() => setEditing(false)}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
