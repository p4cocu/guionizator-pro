"use client";

import { useState, useTransition } from "react";
import { deleteHook, updateHookTemplate, type Hook } from "./actions";
import { CATEGORY_LABELS } from "./constants";
import s from "./ganchos.module.css";

export default function GanchosClient({ initialHooks }: { initialHooks: Hook[] }) {
  const [hooks, setHooks] = useState<Hook[]>(initialHooks);
  const [filterCat, setFilterCat] = useState<string>("todas");
  const [copied, setCopied] = useState<string | null>(null);

  const categories = Array.from(
    new Set(hooks.map((h) => h.category).filter(Boolean))
  ) as string[];

  const filtered =
    filterCat === "todas"
      ? hooks
      : hooks.filter((h) => h.category === filterCat);

  function handleDelete(id: string) {
    setHooks((prev) => prev.filter((h) => h.id !== id));
    deleteHook(id);
  }

  async function handleCopy(text: string, id: string) {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1800);
  }

  return (
    <div className={s.page}>
      <div className={s.header}>
        <div>
          <h1 className={s.title}>Baúl de Ganchos</h1>
          <p className={s.subtitle}>
            Plantillas extraídas de videos con buen desempeño · úsalas de inspiración al crear guiones
          </p>
        </div>
        <a href="/competencia" className="btn btn-secondary">
          ← Ir a Competencia
        </a>
      </div>

      {/* ── Filtros de categoría ── */}
      {categories.length > 0 && (
        <div className={s.filters}>
          <button
            className={`${s.filterBtn} ${filterCat === "todas" ? s.filterBtnActive : ""}`}
            onClick={() => setFilterCat("todas")}
          >
            Todas
            <span className={s.filterCount}>{hooks.length}</span>
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              className={`${s.filterBtn} ${filterCat === cat ? s.filterBtnActive : ""}`}
              onClick={() => setFilterCat(cat)}
            >
              {CATEGORY_LABELS[cat] ?? cat}
              <span className={s.filterCount}>
                {hooks.filter((h) => h.category === cat).length}
              </span>
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className={s.empty}>
          {hooks.length === 0 ? (
            <>
              <p>El baúl está vacío.</p>
              <p>
                En <a href="/competencia" className={s.emptyLink}>Competencia</a>, abre un post que tenga transcripción y presiona{" "}
                <strong>⚡ Extraer gancho</strong>.
              </p>
            </>
          ) : (
            <p>No hay ganchos en esta categoría.</p>
          )}
        </div>
      ) : (
        <div className={s.grid}>
          {filtered.map((h) => (
            <HookCard
              key={h.id}
              hook={h}
              isCopied={copied === h.id}
              onCopy={handleCopy}
              onDelete={handleDelete}
              onUpdate={(id, template) =>
                setHooks((prev) =>
                  prev.map((x) => (x.id === id ? { ...x, hook_template: template } : x))
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tarjeta de gancho ─────────────────────────────────────────────────────────

type CardProps = {
  hook: Hook;
  isCopied: boolean;
  onCopy: (text: string, id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, template: string) => void;
};

function HookCard({ hook: h, isCopied, onCopy, onDelete, onUpdate }: CardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(h.hook_template);
  const [saving, startSave] = useTransition();

  function handleSave() {
    startSave(async () => {
      await updateHookTemplate(h.id, draft);
      onUpdate(h.id, draft);
      setEditing(false);
    });
  }

  function handleCancel() {
    setDraft(h.hook_template);
    setEditing(false);
  }

  const briefForGuion = `Gancho inspiración: ${h.hook_template}\n\nFuente: @${h.source_username ?? "desconocido"}\nGancho original: "${h.hook_original}"`;

  return (
    <div className={s.card}>
      <div className={s.cardTop}>
        <div className={s.cardBadges}>
          {h.category && (
            <span className={s.catBadge}>
              {CATEGORY_LABELS[h.category] ?? h.category}
            </span>
          )}
          {h.source_username && (
            <span className={s.sourceBadge}>@{h.source_username}</span>
          )}
        </div>
        <button
          className={s.deleteBtn}
          onClick={() => onDelete(h.id)}
          title="Eliminar"
        >
          ×
        </button>
      </div>

      {/* Gancho original */}
      <div className={s.originalBlock}>
        <span className={s.blockLabel}>Original</span>
        <p className={s.originalText}>&ldquo;{h.hook_original}&rdquo;</p>
        {h.source_permalink && (
          <a
            href={h.source_permalink}
            target="_blank"
            rel="noopener noreferrer"
            className={s.sourceLink}
          >
            Ver post →
          </a>
        )}
      </div>

      {/* Plantilla */}
      <div className={s.templateBlock}>
        <div className={s.templateHead}>
          <span className={s.blockLabel}>Plantilla</span>
          {!editing && (
            <button className={s.editBtn} onClick={() => setEditing(true)}>
              Editar
            </button>
          )}
        </div>

        {editing ? (
          <>
            <textarea
              className="textarea"
              rows={3}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
            />
            <div className={s.editActions}>
              <button className="btn btn-secondary" onClick={handleCancel} disabled={saving}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </>
        ) : (
          <p className={s.templateText}>{h.hook_template}</p>
        )}
      </div>

      {/* Footer */}
      <div className={s.cardFoot}>
        <button
          className={`btn btn-secondary ${s.copyBtn}`}
          onClick={() => onCopy(h.hook_template, h.id)}
        >
          {isCopied ? "✓ Copiado" : "Copiar plantilla"}
        </button>
        <a
          className="btn btn-primary"
          href={`/guiones/nuevo?brief=${encodeURIComponent(briefForGuion)}&type=reel`}
        >
          Usar en guión →
        </a>
      </div>
    </div>
  );
}
